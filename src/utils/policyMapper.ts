import type { NativeTimerState } from '../services/appBlockerService';
import type { LiveLockEvent } from '../services/timerRealtimeService';

export interface UIPolicy {
  id: string;
  app_name: string;
  package_name: string;
  packageName: string;
  category: string | null;
  target_label: string;
  target_type: 'app' | 'website' | 'category';
  max_time_minutes: number;
  time_used_minutes: number;
  is_blocked: boolean;
  status: 'active' | 'inactive' | 'blocked';
  blocked_until_timestamp: number;
  created_at: number;
  daily_reset_time_local: string;
  lock_until_timestamp_ms: number | null;
  next_reset_at_ms: number;
  _nativeBudgetSeconds?: number;
  // Derived display state for an active manual Lock Now session. is_manual_locked
  // is true ONLY when a marker exists AND is_blocked is true — a marker alone is
  // stale (lock cancelled / reset wins) and must not freeze the UI.
  is_manual_locked: boolean;
  manual_lock_snapshot_seconds: number | null;
  manual_lock_until_ms: number | null;
  // lockVersion and updatedAt are SERVER-ONLY — never mutated by client code.
  lockVersion?: number;
  updatedAt?: number;
}

// Structural subset of ManualLockMarker the selector needs. Defined locally to
// avoid a circular import with services/lockPolicyNow (which imports UIPolicy).
export type ManualLockSnapshot = {
  snapshotUsedSeconds: number;
  untilTs: number;
};

function humanizePackageName(packageName: string): string {
  const generic = new Set(['com', 'org', 'net', 'io', 'android', 'app', 'apps', 'mobile', 'lite']);
  const parts = packageName.split('.').filter(p => !generic.has(p.toLowerCase()));
  const name = parts[parts.length - 1] || packageName.split('.')[1] || packageName;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function mapPolicyToUI(item: any): UIPolicy {
  const p = item.policy || item;
  const state = item.policyState || {};

  const rawUsedMinutes = Number(state.usageTodayMinutes) || 0;
  const maxMinutes = Number(p.dailyLimitMinutes) || 0;
  // Clamp at the limit so a backend overshoot never leaks into the UI as "3m / 2m".
  const usedMinutes = maxMinutes > 0 ? Math.min(rawUsedMinutes, maxMinutes) : rawUsedMinutes;
  const isExhausted = !!state.isExhaustedToday && usedMinutes > 0;

  let status: 'active' | 'inactive' | 'blocked' = 'inactive';
  if (isExhausted) status = 'blocked';
  else if (usedMinutes > 0) status = 'active';

  const label = p.targetLabel && p.targetLabel !== p.targetKey
    ? p.targetLabel
    : p.type === 'app'
      ? humanizePackageName(p.targetKey)
      : p.targetLabel || p.targetKey;

  return {
    id: p.policyId,
    app_name: p.targetKey,
    package_name: p.targetKey,
    packageName: p.targetKey,
    category: p.type === 'category' ? p.targetLabel : null,
    target_label: label,
    target_type: p.type,
    max_time_minutes: p.dailyLimitMinutes,
    time_used_minutes: usedMinutes,
    is_blocked: isExhausted,
    status,
    blocked_until_timestamp: 0,
    created_at: p.createdAt?._seconds ? p.createdAt._seconds * 1000 : Date.now(),
    daily_reset_time_local: typeof p.dailyResetTimeLocal === 'string' ? p.dailyResetTimeLocal : '00:00',
    lock_until_timestamp_ms: typeof p.lockUntilTimestampMs === 'number' ? p.lockUntilTimestampMs : null,
    next_reset_at_ms: typeof item.nextResetAtMs === 'number' ? item.nextResetAtMs : 0,
    is_manual_locked: false,
    manual_lock_snapshot_seconds: null,
    manual_lock_until_ms: null,
    // Do NOT set lockVersion/updatedAt here — they are read-only from the server.
  };
}



export function selectPolicyState(
  rtdbLocks: Record<string, LiveLockEvent>,
  manualLocks: Record<string, ManualLockSnapshot>,
  httpState: UIPolicy,
): UIPolicy {
  const key = getPolicyPackageKey(httpState);
  const rawKey = key.replace(/^website:/, '');

  // Check both prefixed and unprefixed keys — RTDB stores by policyId but
  // subscribeLockState returns the full lock object including targetKey.
  const lock = rtdbLocks[key] || rtdbLocks[rawKey];
  const now = Date.now();
  const isLockedRemotely =
    lock && lock.isLocked && typeof lock.blockedUntil === 'number' && lock.blockedUntil > now;

  // Resolve base lock state first — RTDB > HTTP.
  let resolved: UIPolicy;
  if (isLockedRemotely) {
    // === PATH 1: RTDB says locked → lock wins unconditionally ===
    if (!httpState.is_blocked) {
      console.warn('[selectPolicyState] RTDB LOCK OVERRIDE HTTP STATE', key);
    }
    resolved = {
      ...httpState,
      is_blocked: true,
      status: 'blocked',
      blocked_until_timestamp: lock.blockedUntil as number,
    };
  } else {
    // === PATH 2: RTDB has NO active lock ===
    // Firestore (HTTP) `isExhaustedToday` is durable truth for the daily quota
    // (CLAUDE.md §3). RTDB live-lock is only a fast path for active sessions;
    // its absence MUST NOT unblock an already-exhausted policy. Preserve the
    // HTTP-derived is_blocked/status as-is and only clear the RTDB-specific
    // blocked_until_timestamp.
    resolved = {
      ...httpState,
      blocked_until_timestamp: 0,
    };
  }

  // Layer manual-lock display state on top. Per spec ("Single Source of Truth
  // — 1. Active Lock State (highest)"), the marker IS the active lock state
  // and drives the freeze independently. Conditions for "active":
  //   - marker exists
  //   - marker.untilTs is a valid number in the future (lock period not over)
  // Requiring is_blocked from RTDB/HTTP would re-introduce a race window where
  // the marker is in context but the upstream block flag hasn't propagated /
  // had a key-format mismatch / was poisoned by a stale fetch — during that
  // window the display would fall back to the live (potentially corrupted)
  // time_used_minutes.
  //
  // When markerActive is true we ALSO force is_blocked=true so PolicyCard
  // renders the blocked visual treatment. This is correct: from the user's
  // perspective they pressed Lock Now, they expect the card to look blocked.
  // The unlock loop in useLockStateSync remains responsible for clearing the
  // marker when the lock truly ends (natural end / override / reset).
  const marker = manualLocks[httpState.id];
  const now2 = Date.now();
  const markerActive =
    !!marker &&
    typeof marker.untilTs === 'number' &&
    Number.isFinite(marker.untilTs) &&
    marker.untilTs > now2;

  return {
    ...resolved,
    is_blocked: resolved.is_blocked || markerActive,
    status: markerActive ? 'blocked' : resolved.status,
    is_manual_locked: markerActive,
    manual_lock_snapshot_seconds: markerActive ? marker.snapshotUsedSeconds : null,
    manual_lock_until_ms: markerActive ? marker.untilTs : null,
  };
}

export function formatUsageTime(minutes: number): string {
  if (minutes <= 0) return '0s';
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function formatLimitTime(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded >= 60) {
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (rounded <= 0) return '< 1m';
  return `${rounded}m`;
}

export function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) return '0s left';
  return `${formatUsageTime(minutes)} left`;
}

export function getPolicyPackageKey(item: any): string {
  let raw = String(item?.app_name || item?.package_name || item?.packageName || '')
    .trim()
    .toLowerCase();
  if (item?.target_type === 'website') {
    raw = raw.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    if (!raw.startsWith('website:')) {
      return `website:${raw}`;
    }
  }
  return raw;
}

export function normalizeNativePackageKey(pkg: string, targetType?: string): string {
  const raw = String(pkg || '').trim().toLowerCase();
  if (targetType === 'website') {
    const cleaned = raw.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    return cleaned.startsWith('website:') ? cleaned : `website:${cleaned}`;
  }
  return raw;
}

export function resolvePolicyBlockedState(item: any): boolean {
  if (typeof item?.is_blocked === 'boolean') return item.is_blocked;

  const rawStatus = String(item?.status_text || item?.status || '')
    .trim()
    .toLowerCase();
  if (rawStatus.includes('block')) return true;
  if (rawStatus.includes('active') || rawStatus.includes('running') || rawStatus.includes('unblocked')) {
    return false;
  }

  const blockedUntil = Number(item?.blocked_until_timestamp || 0);
  if (blockedUntil > Date.now()) return true;

  const maxMinutes = Number(item?.max_time_minutes || 0);
  const usedMinutes = Number(item?.time_used_minutes || 0);
  if (maxMinutes <= 0) return false;
  return usedMinutes >= maxMinutes;
}

export function normalizeUiPolicy(item: UIPolicy): UIPolicy {
  return {
    ...item,
    is_blocked: resolvePolicyBlockedState(item),
  };
}

export function mergeBlockedOverlaysIntoPolicies(
  normalizedPolicies: UIPolicy[],
  _nativeBlockedPackages: Set<string>,
): UIPolicy[] {
  // Server is the ONLY source of truth for blocked state.
  // We no longer rely on local native blocked packages to determine UI status.
  return normalizedPolicies;
}

export type NativeTimerForLiveTimerUsageMerge = Pick<
  NativeTimerState,
  'package' | 'remainingSeconds' | 'liveTimerUsageBudgetSeconds' | 'status'
>;

export function mergeLiveTimerUsageIntoPolicies(
  policies: UIPolicy[],
  timers: NativeTimerForLiveTimerUsageMerge[],
): UIPolicy[] {
  const byPkg = new Map<string, NativeTimerForLiveTimerUsageMerge>();
  timers.forEach(t => {
    const k = String(t.package || '').trim().toLowerCase();
    if (!k) return;

    byPkg.set(k, t);
  });
  return policies.map(item => {
    if (item.target_type !== 'app' && item.target_type !== 'website') return item;
    const key = getPolicyPackageKey(item);
    const timer = byPkg.get(key);

    if (!timer) return item;

    const budget = Math.max(0, Number(timer.liveTimerUsageBudgetSeconds) || 0);
    const remaining = Math.max(0, Number(timer.remainingSeconds) || 0);
    const liveTimerUsageSec = Math.max(0, Math.min(budget, budget - remaining));
    const maxMin = Number(item.max_time_minutes) || 0;
    const nativeStatus = String(timer.status || '').toLowerCase();

    // When native is in "blocked" status its remainingSeconds=0, which makes
    // liveTimerUsageSec saturate at the full budget. That saturated value is
    // only meaningful when the block was caused by quota exhaustion — for a
    // manual Lock Now the user may be at e.g. 35s of a 2m quota, and merging
    // the saturated 2m here would force the bar to falsely show 2m/2m,
    // bypassing the snapshot freeze in PolicyCard during any propagation
    // race. Trust the backend's cumulative time_used_minutes instead.
    if (nativeStatus === 'blocked') {
      // Native blocker is on-device truth for "currently blocked right now".
      // Propagate is_blocked even if backend's isExhaustedToday hasn't caught
      // up yet. selectPolicyState refines further for manual-lock markers.
      return {
        ...item,
        is_blocked: true,
        status: 'blocked',
        _nativeBudgetSeconds: budget > 0 ? budget : undefined,
      };
    }

    // Native is actively running — interpolate from its tick. Server is still
    // the source of truth for cumulative usage; native just provides smoother
    // sub-second updates. Math.max so a slow server fetch can't visually
    // rewind the bar.
    const nativeUsedMinutes = liveTimerUsageSec / 60;
    const cappedUsed = maxMin > 0 ? Math.min(nativeUsedMinutes, maxMin) : nativeUsedMinutes;
    const backendUsed = Number(item.time_used_minutes) || 0;
    const cappedBackendUsed = maxMin > 0 ? Math.min(backendUsed, maxMin) : backendUsed;
    const bestUsed = Math.max(cappedUsed, cappedBackendUsed);

    return {
      ...item,
      time_used_minutes: bestUsed,
      _nativeBudgetSeconds: budget > 0 ? budget : undefined,
    };
  });
}
