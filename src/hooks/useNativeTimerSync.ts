import { useEffect } from 'react';
import { subscribeTimerTicks, subscribeTimerBlocked } from '../services/timerRealtimeService';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { setLastNativeUpdateAt } from './useLockStateSync';

function nativeKeyMatches(policyKey: string, eventPkg: string): boolean {
  if (policyKey === eventPkg) return true;
  if (policyKey === `website:${eventPkg}`) return true;
  return false;
}

export function useNativeTimerSync(
  setState: React.Dispatch<React.SetStateAction<any[]>>,
) {
  useEffect(() => {
    const unsubTick = subscribeTimerTicks(event => {
      if (!event?.package) return;
      const eventPkg = String(event.package).trim().toLowerCase();
      setLastNativeUpdateAt(Date.now());

      setState(prev => {
        let changed = false;
        const next = prev.map(item => {
          if (!nativeKeyMatches(getPolicyPackageKey(item), eventPkg)) return item;

          const maxSeconds = Number(item.max_time_minutes || 0) * 60;
          const remaining = Math.max(0, Number(event.remaining || 0));
          const consumedSeconds = Math.min(
            Math.max(0, maxSeconds - remaining),
            maxSeconds,
          );
          const newUsedMinutes = consumedSeconds / 60;
          const eventBlocked =
            typeof event.isBlocked === 'boolean'
              ? event.isBlocked
              : String(event.status || '').toLowerCase() === 'blocked';
          const isBlocked = eventBlocked ? true : item.is_blocked;
          const newStatus = isBlocked
            ? 'blocked'
            : consumedSeconds > 0
              ? 'active'
              : item.status;

          if (
            Math.abs(item.time_used_minutes - newUsedMinutes) < 0.01 &&
            item.is_blocked === isBlocked &&
            item.status === newStatus
          ) {
            return item;
          }

          changed = true;
          return {
            ...item,
            time_used_minutes: newUsedMinutes,
            is_blocked: isBlocked,
            status: newStatus,
          };
        });
        return changed ? next : prev;
      });
    });

    const unsubBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      const eventPkg = String(event.package).trim().toLowerCase();
      setLastNativeUpdateAt(Date.now());

      setState(prev => {
        let changed = false;
        const next = prev.map(item => {
          if (!nativeKeyMatches(getPolicyPackageKey(item), eventPkg)) return item;
          if (item.is_blocked && item.status === 'blocked' && item.time_used_minutes === item.max_time_minutes) {
            return item;
          }
          changed = true;
          return {
            ...item,
            is_blocked: true,
            status: 'blocked',
            time_used_minutes: item.max_time_minutes,
          };
        });
        return changed ? next : prev;
      });
    });

    return () => {
      unsubTick();
      unsubBlocked();
    };
  }, [setState]);
}
