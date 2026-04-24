import { useEffect, useRef } from 'react';
import { subscribeLockState, type LiveLockEvent } from '../services/timerRealtimeService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import {
  startAppBlockerService,
  updateBlockedApps,
} from '../services/appBlockerService';

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
      if (now - lastNativeUpdateAt < NATIVE_PRIORITY_WINDOW_MS) return;

      const lockedTargets = new Set<string>();
      for (const lock of Object.values(locks)) {
        if (lock.isLocked && lock.targetKey) {
          const raw = lock.targetKey.trim().toLowerCase();
          lockedTargets.add(raw);
          lockedTargets.add(`website:${raw}`);
        }
      }

      const newlyBlocked: Array<{ package_name: string; app_name: string; blocked_until_timestamp: number }> = [];

      setPoliciesRef.current(prev => {
        let changed = false;
        const next = prev.map(item => {
          const key = getPolicyPackageKey(item);
          const isLockedRemotely = lockedTargets.has(key);

          if (isLockedRemotely && !item.is_blocked) {
            changed = true;
            const pkg = item.app_name || item.package_name || item.packageName;
            if (pkg) {
              newlyBlocked.push({
                package_name: pkg,
                app_name: pkg,
                blocked_until_timestamp: now + 24 * 60 * 60 * 1000,
              });
            }
            return { ...item, is_blocked: true, status: 'blocked' as const };
          }

          if (!isLockedRemotely && item.is_blocked) {
            changed = true;
            return { ...item, is_blocked: false, status: 'active' as const };
          }

          return item;
        });
        return changed ? next : prev;
      });

      if (newlyBlocked.length > 0) {
        startAppBlockerService(newlyBlocked).catch(() => {});
        updateBlockedApps(newlyBlocked);
      }
    });

    return unsubscribe;
  }, [accountId]);
}
