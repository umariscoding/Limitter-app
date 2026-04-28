import { useEffect, useRef } from 'react';
import type { UIPolicy } from '../utils/policyMapper';

const POST_RESET_BUFFER_MS = 2_000;
const MAX_SLEEP_MS = 6 * 60 * 60 * 1000;

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
        const resetAt = policy.next_reset_at_ms;
        if (resetAt && resetAt > now && resetAt < earliest) {
          earliest = resetAt;
        }
      }

      if (!Number.isFinite(earliest)) return;

      const sleepMs = Math.max(1_000, Math.min(MAX_SLEEP_MS, earliest + POST_RESET_BUFFER_MS - now));

      timer = setTimeout(() => {
        try {
          onResetDueRef.current();
        } catch (err) {
          console.error('[useResetSchedule] onResetDue threw:', err);
        }
        schedule();
      }, sleepMs);
    };

    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [policies]);
}
