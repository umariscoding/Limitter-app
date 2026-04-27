import { useEffect, useRef } from 'react';
import type { UIPolicy } from '../utils/policyMapper';
import { nextResetTimestamp, isValidHHMM } from '../utils/timeWindow';

// Buffer added on top of the computed next-reset moment before firing the
// callback, to give the backend cron a chance to actually perform the reset
// before we refetch. Backend cron resolution is assumed minute-level; 60s is
// conservative. Tighten if backend confirms sub-minute scheduling.
const POST_RESET_BUFFER_MS = 60_000;

// Hard cap on a single setTimeout. JS timers can fire late if the value is
// absurdly large; we re-schedule periodically as a safety net.
const MAX_SLEEP_MS = 6 * 60 * 60 * 1000; // 6 hours

// Schedules a single setTimeout for the earliest next-reset moment across all
// passed policies. When that moment fires, calls onResetDue (typically
// fetchLimits). After the call, recomputes for the new earliest moment.
//
// Drift-free: every scheduling cycle uses Date.now() afresh and computes the
// next absolute reset timestamp from the policy's HH:MM. No accumulating
// intervals.
export function useResetSchedule(policies: UIPolicy[], onResetDue: () => void): void {
  const onResetDueRef = useRef(onResetDue);
  onResetDueRef.current = onResetDue;

  useEffect(() => {
    if (!policies || policies.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const now = Date.now();
      let earliest = Number.POSITIVE_INFINITY;

      for (const policy of policies) {
        const hhmm = policy.daily_reset_time_local;
        if (!isValidHHMM(hhmm)) continue;
        const ts = nextResetTimestamp(hhmm, new Date(now));
        if (ts < earliest) earliest = ts;
      }

      if (!Number.isFinite(earliest)) return;

      const sleepMs = Math.max(1_000, Math.min(MAX_SLEEP_MS, earliest + POST_RESET_BUFFER_MS - now));

      timer = setTimeout(() => {
        try {
          onResetDueRef.current();
        } catch (err) {
          console.error('[useResetSchedule] onResetDue threw:', err);
        }
        // Re-schedule for whatever the new earliest moment is. If policies
        // updated (and thus this effect re-ran), the new schedule will already
        // have replaced this one, so the recursive call is benign.
        schedule();
      }, sleepMs);
    };

    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [policies]);
}
