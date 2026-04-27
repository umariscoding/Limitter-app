import { useEffect, useRef } from 'react';
import { subscribeLockState, type LiveLockEvent } from '../services/timerRealtimeService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey, type UIPolicy } from '../utils/policyMapper';
import {
  grantTemporaryOverrideAccess,
  grantTemporaryWebsiteOverride,
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
} from '../services/appBlockerService';
import {
  popManualLockMarker,
  getAllManualLockMarkers,
  deleteManualLockMarker,
  type ManualLockMarker,
} from '../services/lockPolicyNow';

// Two-step restore for a manual-lock marker. The native timer entry is pinned
// at status="blocked" (sticky), so we must:
//   1. UNBLOCK_APP — clears the sticky blocked status, resets usedSeconds=0
//   2. START_TIMERS with snapshot — addTimers' maxOf(existing=0, snapshot)
//      writes back the snapshotted usedSeconds, status stays "waiting"
// Used both by the inline unlock loop (manual-lock end while app is running)
// and the startup scan (manual-lock end while app was killed).
async function restoreFromMarker(marker: ManualLockMarker, key: string): Promise<void> {
  const isWebsite = marker.packageName.startsWith('website:') || key.startsWith('website:');
  if (isWebsite) {
    const domain = marker.packageName.replace(/^website:/, '');
    await grantTemporaryWebsiteOverride(domain);
    await startBulkWebsiteTimers([
      {
        domain,
        durationSeconds: marker.durationSeconds,
        usedSeconds: marker.snapshotUsedSeconds,
      },
    ]);
  } else {
    await grantTemporaryOverrideAccess(marker.packageName, marker.appName, 0);
    await startAppUsageTimer(
      marker.packageName,
      marker.appName,
      marker.durationSeconds,
      marker.snapshotUsedSeconds,
    );
  }
}

// Startup scan: find markers whose locks ended while the app was killed and
// restore the native timer state. Without this, the native side stays
// sticky-blocked even though the server says the policy is no longer locked.
//
// Conditions for restoring a marker (all must hold):
//   - marker.untilTs < now  (lock should have ended)
//   - matching policy exists in current state
//   - policy.is_blocked === false  (server-side lock is gone)
//   - no active RTDB lock entry for this policy's key
async function runStartupRestoreScan(
  locks: Record<string, LiveLockEvent>,
  policies: UIPolicy[],
): Promise<number> {
  const allMarkers = await getAllManualLockMarkers();
  const now = Date.now();
  let restored = 0;

  for (const [policyId, marker] of Object.entries(allMarkers)) {
    if (typeof marker.untilTs !== 'number' || marker.untilTs >= now) continue;

    const policy = policies.find(p => p.id === policyId);
    if (!policy) continue;

    if (policy.is_blocked) continue;

    const key = getPolicyPackageKey(policy);
    const rawKey = key.replace(/^website:/, '');
    const lock = locks[key] || locks[rawKey];
    const isStillLocked =
      lock &&
      lock.isLocked &&
      typeof lock.blockedUntil === 'number' &&
      lock.blockedUntil > now;
    if (isStillLocked) continue;

    try {
      await restoreFromMarker(marker, key);
      // Only delete the marker AFTER a successful restore, so a failed
      // restore (e.g., native module not ready) is retried on the next mount.
      await deleteManualLockMarker(policyId);
      restored += 1;
    } catch (err) {
      console.error('[useLockStateSync] startup restore failed for', policyId, err);
    }
  }

  if (restored > 0) {
    console.log(
      '[useLockStateSync] Restored',
      restored,
      'expired manual lock(s) on startup',
    );
  }
  return restored;
}

export function useLockStateSync(accountId: string | undefined) {
  // Only write to rtdbLocks — never touch setPolicies.
  // The derived `policies` value in PolicyContext is computed as:
  //   httpPolicies.map(p => selectPolicyState(rtdbLocks, manualLocks, p))
  // so updating rtdbLocks is the ONLY correct way to propagate lock state.
  const { setRtdbLocks, policies: currentPolicies, refreshManualLocks } = usePolicyContext();
  const setRtdbLocksRef = useRef(setRtdbLocks);
  setRtdbLocksRef.current = setRtdbLocks;
  const refreshManualLocksRef = useRef(refreshManualLocks);
  refreshManualLocksRef.current = refreshManualLocks;

  // Keep a ref to current policies purely for side-effect commands (native blocker).
  // We do NOT use them as merge inputs — they are read-only here.
  const currentPoliciesRef = useRef(currentPolicies);
  currentPoliciesRef.current = currentPolicies;

  // Startup-restore scan plumbing. The scan must wait for BOTH the first RTDB
  // snapshot AND a non-empty policies list before running, so it has the data
  // needed to make safe decisions. It can run only once per mount; failures
  // re-arm via clearing the ran flag inside the IIFE.
  const rtdbLocksRef = useRef<Record<string, LiveLockEvent>>({});
  const rtdbInitializedRef = useRef(false);
  const startupScanRanRef = useRef(false);

  // Tracks the set of currently-locked target keys (lowercased) from the most
  // recent RTDB snapshot. Used to detect lock→unlock TRANSITIONS by diffing
  // against the next snapshot. Must be transition-based: looking up by key in
  // the new snapshot is unsafe because RTDB may key lock entries by policyId
  // while our policies are keyed by package name — that mismatch would falsely
  // mark every locked policy as "newly unlocked" on every callback and nuke
  // its manual-lock marker.
  const prevLockedTargetsRef = useRef<Set<string>>(new Set());
  const maybeRunStartupScanRef = useRef<() => void>(() => {});
  maybeRunStartupScanRef.current = () => {
    if (startupScanRanRef.current) return;
    if (!rtdbInitializedRef.current) return;
    const policies = currentPoliciesRef.current;
    if (policies.length === 0) return;
    startupScanRanRef.current = true;
    void (async () => {
      try {
        const restored = await runStartupRestoreScan(rtdbLocksRef.current, policies);
        if (restored > 0) {
          // Markers were deleted from storage — pull the new (smaller) set into
          // PolicyContext so any still-displayed Locked badges clear.
          await refreshManualLocksRef.current();
        }
      } catch (err) {
        console.error('[useLockStateSync] startup restore scan failed:', err);
        // Clear the flag so a later trigger can retry (e.g., next policies update).
        startupScanRanRef.current = false;
      }
    })();
  };

  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeLockState(accountId, (locks: Record<string, LiveLockEvent>) => {
      const now = Date.now();

      // === SIDE EFFECTS ONLY (native blocker commands) ===
      // Determine which targets are newly locked vs. newly unlocked so we can
      // command the OS-level blocker. This is purely a side effect; it does NOT
      // influence the React state derivation.
      const newlyBlocked: Array<{ package_name: string; app_name: string; blocked_until_timestamp: number }> = [];
      const newlyUnlocked: Array<{ key: string; policyId: string }> = [];

      const prevPolicies = currentPoliciesRef.current;
      for (const [, lock] of Object.entries(locks)) {
        if (!lock.isLocked || !lock.targetKey) continue;
        if (typeof lock.blockedUntil === 'number' && lock.blockedUntil <= now) continue;

        const raw = lock.targetKey.trim().toLowerCase();
        const blockedUntil = typeof lock.blockedUntil === 'number'
          ? lock.blockedUntil
          : now + 24 * 60 * 60 * 1000; // safety fallback only — server should always provide this

        // Find the matching UI policy to see if the native blocker already knows about it
        const matchingPolicy = prevPolicies.find(p => {
          const key = getPolicyPackageKey(p);
          return key === raw || key === `website:${raw}` || key.replace(/^website:/, '') === raw;
        });
        if (matchingPolicy && !matchingPolicy.is_blocked) {
          const pkg = matchingPolicy.app_name || matchingPolicy.package_name || matchingPolicy.packageName;
          if (pkg) {
            newlyBlocked.push({ package_name: pkg, app_name: pkg, blocked_until_timestamp: blockedUntil });
          }
        }
      }

      // Build the set of target keys that are CURRENTLY locked in this RTDB
      // snapshot. Walking values (not RTDB keys) lets us match by `targetKey`
      // regardless of whether the RTDB node is keyed by policyId or package
      // name — which is the same pattern the newly-blocked loop above uses.
      const currentLockedTargets = new Set<string>();
      for (const lock of Object.values(locks)) {
        if (!lock || !lock.isLocked || !lock.targetKey) continue;
        if (typeof lock.blockedUntil !== 'number' || lock.blockedUntil <= now) continue;
        currentLockedTargets.add(lock.targetKey.trim().toLowerCase());
      }

      // A policy is "newly unlocked" iff its target was in the PREVIOUS locked
      // set and is missing from the current one. This is the only safe way to
      // detect transitions — looking up by key in `locks` directly is unsafe
      // because RTDB key format may not match our policy key format.
      for (const prevTarget of prevLockedTargetsRef.current) {
        if (currentLockedTargets.has(prevTarget)) continue;
        const matchingPolicy = prevPolicies.find(p => {
          const k = getPolicyPackageKey(p);
          return (
            k === prevTarget ||
            k === `website:${prevTarget}` ||
            k.replace(/^website:/, '') === prevTarget
          );
        });
        if (!matchingPolicy) continue;
        newlyUnlocked.push({ key: getPolicyPackageKey(matchingPolicy), policyId: matchingPolicy.id });
      }
      prevLockedTargetsRef.current = currentLockedTargets;

      // === PURE STATE UPDATE ===
      // Push the raw RTDB snapshot directly into state. No merging with UI state.
      // PolicyContext will re-derive `policies` via selectPolicyState(rtdbLocks, httpPolicy).
      setRtdbLocksRef.current(locks);

      // Keep the local mirror up to date for the startup scan and trigger it.
      rtdbLocksRef.current = locks;
      rtdbInitializedRef.current = true;
      maybeRunStartupScanRef.current();

      // === NATIVE SIDE EFFECTS ===
      if (newlyBlocked.length > 0) {
        startAppBlockerService(newlyBlocked).catch(err =>
          console.error('[useLockStateSync] startAppBlockerService failed:', err),
        );
        updateBlockedApps(newlyBlocked);
      }

      // Unlock-side handling needs an async marker check per policy (manual
      // locks must restore the snapshotted usedSeconds; override-end uses the
      // existing reset path). Fire-and-forget the loop so we don't block the
      // RTDB callback.
      if (newlyUnlocked.length > 0) {
        void (async () => {
          for (const item of newlyUnlocked) {
            try {
              const marker = await popManualLockMarker(item.policyId);
              if (marker) {
                // Distinguish natural manual-lock end vs early reset-driven
                // unlock. If now is within 5s of the planned untilTs, treat
                // as natural end → restore snapshotted usedSeconds. If unlock
                // fired EARLIER, the daily reset (or admin) cleared the lock
                // — server is truth, drop the snapshot, fall through to the
                // existing reset-to-0 path so native re-syncs to server's
                // fresh usageTodayMinutes=0.
                const now = Date.now();
                const NATURAL_END_TOLERANCE_MS = 5_000;
                const isNaturalEnd = now >= marker.untilTs - NATURAL_END_TOLERANCE_MS;
                if (isNaturalEnd) {
                  await restoreFromMarker(marker, item.key);
                  continue;
                }
                // else: fall through to the reset-to-0 path below.
              }

              // No marker (or marker was discarded by reset-wins rule above):
              // unlock came from override-end / daily reset / unknown source.
              // Reset usedSeconds=0 (matches override grants-fresh-window
              // behavior, and matches what the daily reset just did server-
              // side).
              const raw = item.key.replace(/^website:/, '');
              const isWebsite = item.key.startsWith('website:') || raw.includes('.');
              if (isWebsite) {
                await grantTemporaryWebsiteOverride(raw);
              } else {
                await grantTemporaryOverrideAccess(raw, '', 0);
              }
            } catch (err) {
              console.error('[useLockStateSync] unlock handling failed for', item.key, err);
            }
          }
          // Always refresh after an unlock batch — popManualLockMarker silently
          // mutates storage when it finds a stale marker too, so we can't tell
          // from its return value alone whether storage changed.
          await refreshManualLocksRef.current();
        })();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [accountId]);

  // Also retry the startup scan whenever policies become available, in case
  // the first RTDB snapshot arrived before policies were loaded.
  useEffect(() => {
    maybeRunStartupScanRef.current();
  }, [currentPolicies]);
}
