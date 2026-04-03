import { useEffect, useRef } from 'react';
import { subscribeLockState, type LiveLockEvent } from '../services/timerRealtimeService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';

export function useLockStateSync(accountId: string | undefined) {
  const { setPolicies } = usePolicyContext();
  const setPoliciesRef = useRef(setPolicies);
  setPoliciesRef.current = setPolicies;

  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeLockState(accountId, (locks: Record<string, LiveLockEvent>) => {
      const lockedTargets = new Set<string>();
      for (const lock of Object.values(locks)) {
        if (lock.isLocked && lock.targetKey) {
          lockedTargets.add(lock.targetKey.trim().toLowerCase());
        }
      }

      setPoliciesRef.current(prev =>
        prev.map(item => {
          const key = getPolicyPackageKey(item);
          const isLockedRemotely = lockedTargets.has(key);

          if (isLockedRemotely && !item.is_blocked) {
            return { ...item, is_blocked: true, status: 'blocked' as const };
          }

          if (!isLockedRemotely && item.is_blocked && item.time_used_minutes < item.max_time_minutes) {
            return { ...item, is_blocked: false, status: 'active' as const };
          }

          return item;
        }),
      );
    });

    return unsubscribe;
  }, [accountId]);
}
