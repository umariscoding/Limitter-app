import AsyncStorage from '@react-native-async-storage/async-storage';
import { lockNowAPI, type LockNowResponse } from './policyService';
import { getNativeTimerStates } from './appBlockerService';
import type { UIPolicy } from '../utils/policyMapper';

// Reads the most up-to-date used-seconds for a policy directly from the native
// timer. Necessary because policy.time_used_minutes in React state can lag the
// real per-device usage (e.g., the user used the target app while the React
// app was backgrounded, or the server's daily aggregate was not reset by an
// override grant). Returns null when no matching native timer is registered,
// in which case the caller should fall back to policy.time_used_minutes.
async function readNativeUsedSeconds(packageName: string): Promise<number | null> {
  try {
    const states = await getNativeTimerStates();
    if (!Array.isArray(states) || states.length === 0) return null;
    const raw = String(packageName || '').trim().toLowerCase();
    if (!raw) return null;
    const candidates = raw.startsWith('website:')
      ? [raw, raw.replace(/^website:/, '')]
      : [raw, `website:${raw}`];
    const found = states.find(s => {
      const k = String(s.package || '').trim().toLowerCase();
      return candidates.includes(k);
    });
    if (!found) return null;
    const budget = Math.max(0, Number(found.liveTimerUsageBudgetSeconds) || 0);
    const remaining = Math.max(0, Number(found.remainingSeconds) || 0);
    return Math.max(0, budget - remaining);
  } catch (err) {
    console.error('[lockPolicyNow] readNativeUsedSeconds failed:', err);
    return null;
  }
}

// 60s minimum future-time absorbs typical client/server clock drift (NTP-class)
// and prevents "instant unlock" UX when network latency stacks on top of the
// chosen end time.
export const LOCK_NOW_MIN_FUTURE_MS = 60_000;

// A marker is considered stale (and unused) if we are past its planned end time
// by more than this threshold. Cleaned up on read and via cleanupStaleMarkers.
export const MARKER_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const MANUAL_LOCKS_KEY = '@limitter_manual_locks';

// Snapshot of the policy's pre-lock native-timer state. Persisted at lock start
// so that when the lock ends, useLockStateSync can re-arm the timer at the
// SAME usedSeconds value instead of UNBLOCK_APP's reset-to-0 behavior (which
// would let users bypass quota by locking briefly).
//
// LIMITATION (v1): markers live in AsyncStorage on the originating device only.
// If device A locks a policy and device B receives the unlock event first,
// device B has no marker and falls back to the existing UNBLOCK_APP path
// (resets local usedSeconds to 0). The next policy fetch on device B will
// reconcile against server state. v2 should move this into RTDB as a
// `lockReason` so any device can restore correctly.
export interface ManualLockMarker {
  packageName: string;
  appName: string;
  durationSeconds: number;
  snapshotUsedSeconds: number;
  lockedAtMs: number;
  untilTs: number;
}

export type LockPolicyNowResult =
  | { ok: true; response: LockNowResponse }
  | {
      ok: false;
      reason:
        | 'invalid_time'
        | 'in_flight'
        | 'already_blocked'
        | 'marker_write_failed'
        | 'request_failed';
      message: string;
    };

const inFlight = new Set<string>();

async function readMarkers(): Promise<Record<string, ManualLockMarker>> {
  try {
    const raw = await AsyncStorage.getItem(MANUAL_LOCKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('[lockPolicyNow] Failed to read manual-lock markers:', err);
    return {};
  }
}

async function writeMarkers(markers: Record<string, ManualLockMarker>): Promise<boolean> {
  try {
    await AsyncStorage.setItem(MANUAL_LOCKS_KEY, JSON.stringify(markers));
    return true;
  } catch (err) {
    console.error('[lockPolicyNow] Failed to write manual-lock markers:', err);
    return false;
  }
}

function isStale(marker: ManualLockMarker, now: number): boolean {
  return (
    typeof marker.untilTs !== 'number' ||
    !Number.isFinite(marker.untilTs) ||
    now > marker.untilTs + MARKER_STALE_THRESHOLD_MS
  );
}

export async function markPolicyManuallyLocked(
  policy: Pick<
    UIPolicy,
    | 'id'
    | 'app_name'
    | 'package_name'
    | 'packageName'
    | 'target_label'
    | 'max_time_minutes'
    | 'time_used_minutes'
  >,
  untilTs: number,
): Promise<boolean> {
  const packageName = policy.app_name || policy.package_name || policy.packageName;
  if (!packageName || !policy.id) {
    console.error('[lockPolicyNow] Cannot mark — missing packageName or policy id');
    return false;
  }

  // Prefer the native timer's current used-seconds — it is the per-device
  // source of truth and reflects post-override resets immediately, whereas
  // policy.time_used_minutes can lag (server aggregate not reset by override,
  // or React state never received a tick because the user was in the target
  // app while this app was backgrounded). Fall back to the React value only
  // when native has no entry for this package (e.g., timer not yet armed).
  const nativeUsedSec = await readNativeUsedSeconds(packageName);
  const fallbackUsedSec = Math.max(0, Math.round((policy.time_used_minutes || 0) * 60));
  const snapshotUsedSeconds = nativeUsedSec !== null ? nativeUsedSec : fallbackUsedSec;

  const markers = await readMarkers();
  markers[policy.id] = {
    packageName,
    appName: policy.target_label || packageName,
    durationSeconds: Math.max(1, Math.round((policy.max_time_minutes || 0) * 60)),
    snapshotUsedSeconds,
    lockedAtMs: Date.now(),
    untilTs,
  };
  return writeMarkers(markers);
}

// Read-only snapshot of all markers. Used by the startup-restore scan in
// useLockStateSync, which iterates markers without consuming them via pop
// (pop's staleness check would also discard recently-expired-but-valid ones).
export async function getAllManualLockMarkers(): Promise<Record<string, ManualLockMarker>> {
  return readMarkers();
}

// Delete a single marker without staleness-checking or returning it. Used by
// the startup-restore scan after a successful two-step restore — only delete
// on success so failed restores are retried on the next mount.
export async function deleteManualLockMarker(policyId: string): Promise<void> {
  if (!policyId) return;
  const markers = await readMarkers();
  if (!(policyId in markers)) return;
  delete markers[policyId];
  await writeMarkers(markers);
}

export async function popManualLockMarker(policyId: string): Promise<ManualLockMarker | null> {
  if (!policyId) return null;
  const markers = await readMarkers();
  const marker = markers[policyId];
  if (!marker) return null;

  // Remove from storage regardless of whether we return it — stale markers
  // should not stick around to corrupt a future restore.
  delete markers[policyId];
  await writeMarkers(markers);

  if (isStale(marker, Date.now())) {
    console.warn(
      '[lockPolicyNow] Discarding stale manual-lock marker for',
      policyId,
      '(planned untilTs was',
      new Date(marker.untilTs).toISOString(),
      ')',
    );
    return null;
  }
  return marker;
}

// Periodic cleanup so AsyncStorage doesn't accumulate markers from failed
// lock attempts or interrupted lock cycles. Safe to call any time.
export async function cleanupStaleMarkers(): Promise<number> {
  const markers = await readMarkers();
  const now = Date.now();
  let removed = 0;
  for (const policyId of Object.keys(markers)) {
    if (isStale(markers[policyId], now)) {
      delete markers[policyId];
      removed += 1;
    }
  }
  if (removed > 0) {
    await writeMarkers(markers);
    console.log('[lockPolicyNow] Cleaned up', removed, 'stale manual-lock marker(s)');
  }
  return removed;
}

type LockablePolicy = Pick<
  UIPolicy,
  | 'id'
  | 'is_blocked'
  | 'app_name'
  | 'package_name'
  | 'packageName'
  | 'target_label'
  | 'max_time_minutes'
  | 'time_used_minutes'
>;

export async function lockPolicyNow(
  policy: LockablePolicy,
  untilTimestampMs?: number | null,
): Promise<LockPolicyNowResult> {
  if (!policy?.id) {
    return { ok: false, reason: 'request_failed', message: 'Missing policy id.' };
  }

  if (policy.is_blocked) {
    return {
      ok: false,
      reason: 'already_blocked',
      message: 'This limit is already blocked.',
    };
  }

  if (typeof untilTimestampMs === 'number') {
    const minAcceptable = Date.now() + LOCK_NOW_MIN_FUTURE_MS;
    if (!Number.isFinite(untilTimestampMs) || untilTimestampMs < minAcceptable) {
      return {
        ok: false,
        reason: 'invalid_time',
        message: 'End time must be at least 60 seconds in the future.',
      };
    }
  }

  if (inFlight.has(policy.id)) {
    return {
      ok: false,
      reason: 'in_flight',
      message: 'A lock request is already pending for this limit.',
    };
  }

  inFlight.add(policy.id);
  try {
    // Persist marker BEFORE the API call. If we cannot persist, REFUSE the
    // lock — silently allowing it would re-open the bypass exploit since the
    // unlock-end path has no way to know it was a manual lock.
    if (typeof untilTimestampMs === 'number') {
      const wrote = await markPolicyManuallyLocked(policy, untilTimestampMs);
      if (!wrote) {
        return {
          ok: false,
          reason: 'marker_write_failed',
          message:
            'Could not save lock state on this device. Free up storage and try again.',
        };
      }
    }
    const response = await lockNowAPI(policy.id, untilTimestampMs ?? null);
    return { ok: true, response };
  } catch (err: any) {
    // Do NOT delete the marker on API failure — we cannot tell whether the
    // backend wrote RTDB before erroring. A stale marker is harmless (it's
    // overwritten on the next lock for the same policy and pruned by
    // cleanupStaleMarkers), but a missing marker when a lock IS live re-opens
    // the bypass exploit.
    return {
      ok: false,
      reason: 'request_failed',
      message: err?.message || 'Failed to lock the limit. Please try again.',
    };
  } finally {
    inFlight.delete(policy.id);
  }
}
