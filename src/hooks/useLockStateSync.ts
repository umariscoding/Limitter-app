import { useEffect, useRef } from 'react';
import { subscribeLockState, type LiveLockEvent } from '../services/timerRealtimeService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import {
  grantTemporaryOverrideAccess,
  grantTemporaryWebsiteOverride,
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
} from '../services/appBlockerService';
import { popManualLockMarker } from '../services/lockPolicyNow';

export function useLockStateSync(accountId: string | undefined) {
  // Only write to rtdbLocks — never touch setPolicies.
  // The derived `policies` value in PolicyContext is computed as:
  //   httpPolicies.map(p => selectPolicyState(rtdbLocks, p))
  // so updating rtdbLocks is the ONLY correct way to propagate lock state.
  const { setRtdbLocks, policies: currentPolicies } = usePolicyContext();
  const setRtdbLocksRef = useRef(setRtdbLocks);
  setRtdbLocksRef.current = setRtdbLocks;

  // Keep a ref to current policies purely for side-effect commands (native blocker).
  // We do NOT use them as merge inputs — they are read-only here.
  const currentPoliciesRef = useRef(currentPolicies);
  currentPoliciesRef.current = currentPolicies;

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

      // Check for policies that were blocked but are no longer in the RTDB lock set
      for (const policy of prevPolicies) {
        if (!policy.is_blocked) continue;
        const key = getPolicyPackageKey(policy);
        const rawKey = key.replace(/^website:/, '');
        const lock = locks[key] || locks[rawKey];
        const isStillLocked =
          lock &&
          lock.isLocked &&
          typeof lock.blockedUntil === 'number' &&
          lock.blockedUntil > now;

        if (!isStillLocked) {
          newlyUnlocked.push({ key, policyId: policy.id });
        }
      }

      // === PURE STATE UPDATE ===
      // Push the raw RTDB snapshot directly into state. No merging with UI state.
      // PolicyContext will re-derive `policies` via selectPolicyState(rtdbLocks, httpPolicy).
      setRtdbLocksRef.current(locks);

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
                // Manual-lock end: TWO-STEP restore. The native side has the
                // timer pinned at status="blocked" (via BLOCK_APP). START_TIMERS
                // alone won't help — addTimers in TimerStateManager.kt keeps
                // status sticky-blocked. We must:
                //   1. UNBLOCK_APP — clears blocked status, resets usedSeconds=0
                //   2. START_TIMERS with snapshot — addTimers' maxOf(existing=0,
                //      snapshot) writes back the snapshotted usedSeconds
                // Net result: usedSeconds restored to pre-lock value, status=
                // "waiting". Closes the bypass exploit.
                const isWebsite =
                  marker.packageName.startsWith('website:') || item.key.startsWith('website:');
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
                continue;
              }

              // No marker → unlock came from override-end (or unknown source).
              // Existing behavior: reset usedSeconds=0 (override grants fresh
              // window — that's the monetization model).
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
        })();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [accountId]);
}
