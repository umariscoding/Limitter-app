// Client mirror of server-side timeWindow helpers. Used for:
//   - validating user input in create/edit forms
//   - converting "HH:MM today/tomorrow" picker values into absolute timestamps
//   - displaying the next reset boundary
//
// Server is the source of truth — these helpers must stay numerically aligned
// with limitter-api/src/utils/timeWindow.ts.

export interface PolicyTimeWindowSource {
  dailyResetTimeLocal?: string | null;
  lockUntilTimestampMs?: number | null;
}

export function parseHHMM(value: string | null | undefined): { hour: number; minute: number } {
  if (!value || typeof value !== 'string') return { hour: 0, minute: 0 };
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return { hour, minute };
}

export function isValidHHMM(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

export function formatHHMM(hour: number, minute: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const m = Math.max(0, Math.min(59, Math.floor(minute)));
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
}

// Builds an absolute epoch ms from a "HH:MM today/tomorrow" pair.
// Interpreted in the device's local timezone (matches what the user sees on
// their picker).
export function hhmmToTimestampMs(
  hhmm: string,
  day: 'today' | 'tomorrow',
  now: Date = new Date(),
): number {
  const { hour, minute } = parseHHMM(hhmm);
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(hour, minute);
  if (day === 'tomorrow') {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

// Validates a user-supplied absolute "block until" timestamp.
const MAX_END_TIME_MS = 7 * 24 * 60 * 60 * 1000;
export function validateUntilTimestamp(
  value: unknown,
  now: number = Date.now(),
): { ok: true; value: number } | { ok: false; reason: string } {
  if (value === null || value === undefined) return { ok: true, value: 0 };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, reason: 'End time must be a valid timestamp' };
  }
  const v = Math.floor(value);
  if (v <= now) return { ok: false, reason: 'End time must be in the future' };
  if (v - now > MAX_END_TIME_MS) {
    return { ok: false, reason: 'End time cannot be more than 7 days away' };
  }
  return { ok: true, value: v };
}

// Display helper: "06:00 (in 3h 12m)" etc.
export function formatRelativeTime(targetMs: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, targetMs - now);
  const totalMin = Math.round(diffMs / 60000);
  if (totalMin < 1) return 'now';
  if (totalMin < 60) return `in ${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}
