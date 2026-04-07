import { useEffect, useRef } from 'react';
import { subscribeLockState, type LiveLockEvent } from '../services/timerRealtimeService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';

// Timestamp of last native timer sync update — native state takes priority
// over remote lock state when both update within a short window.
let lastNativeUpdateAt = 0;
export const setLastNativeUpdateAt = (ts: number) => { lastNativeUpdateAt = ts; };

const NATIVE_PRIORITY_WINDOW_MS = 3000;

export function useLockStateSync(accountId: string | undefined) {
  const { setPolicies } = usePolicyContext();
  const setPoliciesRef = useRef(setPolicies);
  setPoliciesRef.current = setPolicies;

  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeLockState(accountId, (locks: Record<string, LiveLockEvent>) => {
      const now = Date.now();
      // If native timer just updated, skip this remote update to avoid flicker
      if (now - lastNativeUpdateAt < NATIVE_PRIORITY_WINDOW_MS) return;

      const lockedTargets = new Set<string>();
      for (const lock of Object.values(locks)) {
        if (lock.isLocked && lock.targetKey) {
          const raw = lock.targetKey.trim().toLowerCase();
          lockedTargets.add(raw);
          // Also add with website: prefix so website policies match
          lockedTargets.add(`website:${raw}`);
        }
      }

      setPoliciesRef.current(prev =>
        prev.map(item => {
          const key = getPolicyPackageKey(item);
          const isLockedRemotely = lockedTargets.has(key);

          // Only LOCK from remote state — never unlock.
          // Unlocking is handled by fetchPolicies (fresh API data)
          // and useNativeTimerSync (native timer events).
          if (isLockedRemotely && !item.is_blocked) {
            return { ...item, is_blocked: true, status: 'blocked' as const };
          }

          return item;
        }),
      );
    });

    return unsubscribe;
  }, [accountId]);
}
