import { useEffect } from 'react';
import { subscribeTimerTicks, subscribeTimerBlocked } from '../services/timerRealtimeService';
import { getPolicyPackageKey } from '../utils/policyMapper';

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
          if (Math.abs(item.time_used_minutes - newUsedMinutes) < 0.01) {
            return item;
          }

          changed = true;
          return {
            ...item,
            time_used_minutes: newUsedMinutes,
          };
        });
        return changed ? next : prev;
      });
    });

    const unsubBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      const eventPkg = String(event.package).trim().toLowerCase();

      setState(prev => {
        let changed = false;
        const next = prev.map(item => {
          if (!nativeKeyMatches(getPolicyPackageKey(item), eventPkg)) return item;
          if (item.time_used_minutes === item.max_time_minutes) {
            return item;
          }
          changed = true;
          return {
            ...item,
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
