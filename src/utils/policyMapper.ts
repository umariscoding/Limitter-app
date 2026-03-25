/**
 * Shared policy data mapping used by ALL screens.
 * Single source of truth for how API data → UI data.
 */

export interface UIPolicy {
  id: string;
  app_name: string;
  package_name: string;
  packageName: string;
  category: string | null;
  target_label: string;
  target_type: 'app' | 'website' | 'category';
  max_time_minutes: number;
  time_used_minutes: number;
  is_blocked: boolean;
  status: 'active' | 'inactive' | 'blocked';
  blocked_until_timestamp: number;
  created_at: number;
}

/**
 * Maps API response item { policy, policyState } → UIPolicy
 */
export function mapPolicyToUI(item: any): UIPolicy {
  const p = item.policy || item;
  const state = item.policyState || {};

  const usedMinutes = Number(state.usageTodayMinutes) || 0;
  // Can't be exhausted with zero usage
  const isExhausted = state.isExhaustedToday === true && usedMinutes > 0;

  let status: 'active' | 'inactive' | 'blocked' = 'inactive';
  if (isExhausted) status = 'blocked';
  else if (usedMinutes > 0) status = 'active';

  return {
    id: p.policyId,
    app_name: p.targetKey,
    package_name: p.targetKey,
    packageName: p.targetKey,
    category: p.type === 'category' ? p.targetLabel : null,
    target_label: p.targetLabel,
    target_type: p.type,
    max_time_minutes: p.dailyLimitMinutes,
    time_used_minutes: usedMinutes,
    is_blocked: isExhausted,
    status,
    blocked_until_timestamp: 0,
    created_at: p.createdAt?._seconds ? p.createdAt._seconds * 1000 : Date.now(),
  };
}

/**
 * Format usage time with seconds precision.
 * Examples: "0s", "45s", "2m 30s", "1h 5m"
 */
export function formatUsageTime(minutes: number): string {
  if (minutes === 0) return '0s';
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${h}h ${m}m` : `${h}h`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Format limit time (whole minutes).
 * Examples: "30m", "1h", "1h 30m"
 */
export function formatLimitTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

/**
 * Format remaining time with seconds precision.
 */
export function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) return '0s left';
  return `${formatUsageTime(minutes)} left`;
}

/**
 * Merge local + server usage: take max(local, server) per policy.
 * This is the "most restrictive" rule — prevents bypass via offline.
 */
export function mergeUsage(
  policies: UIPolicy[],
  localUsage: Record<string, number>, // policyId → usedSeconds
): UIPolicy[] {
  return policies.map(p => {
    const localSec = localUsage[p.id] || 0;
    const serverSec = p.time_used_minutes * 60;
    const maxUsedSec = Math.max(localSec, serverSec);
    const usedMinutes = maxUsedSec / 60;
    const limitMin = Number(p.max_time_minutes) || 0;
    const maxSeconds = limitMin * 60;
    const isBlocked = maxSeconds > 0 && maxUsedSec >= maxSeconds;

    let status: 'active' | 'inactive' | 'blocked' = 'inactive';
    if (isBlocked) status = 'blocked';
    else if (usedMinutes > 0) status = 'active';

    return {
      ...p,
      time_used_minutes: usedMinutes,
      is_blocked: isBlocked,
      status,
    };
  });
}
