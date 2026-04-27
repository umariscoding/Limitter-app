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
      // When native is in "blocked" status its `remaining` saturates at 0 and
      // computed used would jump to the full quota. Skip — backend remains
      // the source of truth for cumulative usage, and PolicyCard uses the
      // manual-lock snapshot for display during locks. Same reason as the
      // merge function's blocked-skip in policyMapper.
      const isBlockedStatus =
        event.isBlocked === true || String(event.status || '').toLowerCase() === 'blocked';
      if (isBlockedStatus) return;

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
      // Intentionally do NOT mutate time_used_minutes on TIMER_BLOCKED.
      // Forcing it to max conflated quota-exhaustion-blocking with manual-lock
      // blocking and broke the snapshot freeze (the locked card would show
      // 2m/2m instead of the frozen pre-lock value). The is_blocked flag is
      // propagated via RTDB / HTTP / manual-lock-marker through PolicyContext;
      // this listener no longer needs to touch the usage value.
    });

    return () => {
      unsubTick();
      unsubBlocked();
    };
  }, [setState]);
}
