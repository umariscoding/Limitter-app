import { useEffect } from 'react';
import { subscribeTimerTicks, subscribeTimerBlocked } from '../services/timerRealtimeService';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { setLastNativeUpdateAt } from './useLockStateSync';

export function useNativeTimerSync(
  setState: React.Dispatch<React.SetStateAction<any[]>>,
) {
  useEffect(() => {
    const unsubTick = subscribeTimerTicks(event => {
      if (!event?.package) return;
      const eventPkg = String(event.package).trim().toLowerCase();
      setLastNativeUpdateAt(Date.now());

      setState(prev =>
        prev.map(item => {
          if (getPolicyPackageKey(item) !== eventPkg) return item;

          const maxSeconds = Number(item.max_time_minutes || 0) * 60;
          const budgetSeconds =
            item._nativeBudgetSeconds || maxSeconds;
          const remaining = Math.max(0, Number(event.remaining || 0));
          const consumedSeconds = Math.min(
            Math.max(0, budgetSeconds - remaining),
            maxSeconds,
          );
          const eventBlocked =
            typeof event.isBlocked === 'boolean'
              ? event.isBlocked
              : String(event.status || '').toLowerCase() === 'blocked';

          // Timer ticks can only UPGRADE to blocked, never downgrade.
          // Unblocking is handled by fetchPolicies (fresh API data / overrides).
          const isBlocked = eventBlocked ? true : item.is_blocked;

          return {
            ...item,
            time_used_minutes: consumedSeconds / 60,
            is_blocked: isBlocked,
            status: isBlocked
              ? 'blocked'
              : consumedSeconds > 0
                ? 'active'
                : item.status,
          };
        }),
      );
    });

    const unsubBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      const eventPkg = String(event.package).trim().toLowerCase();
      setLastNativeUpdateAt(Date.now());

      setState(prev =>
        prev.map(item =>
          getPolicyPackageKey(item) === eventPkg
            ? { ...item, is_blocked: true, status: 'blocked' }
            : item,
        ),
      );
    });

    return () => {
      unsubTick();
      unsubBlocked();
    };
  }, [setState]);
}
