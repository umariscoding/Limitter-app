import type { NativeTimerState } from '../services/appBlockerService';

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
  _nativeBudgetSeconds?: number;
}

function humanizePackageName(packageName: string): string {
  const generic = new Set(['com', 'org', 'net', 'io', 'android', 'app', 'apps', 'mobile', 'lite']);
  const parts = packageName.split('.').filter(p => !generic.has(p.toLowerCase()));
  const name = parts[parts.length - 1] || packageName.split('.')[1] || packageName;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function mapPolicyToUI(item: any): UIPolicy {
  const p = item.policy || item;
  const state = item.policyState || {};

  const usedMinutes = Number(state.usageTodayMinutes) || 0;
  const isExhausted = !!state.isExhaustedToday && usedMinutes > 0;

  let status: 'active' | 'inactive' | 'blocked' = 'inactive';
  if (isExhausted) status = 'blocked';
  else if (usedMinutes > 0) status = 'active';

  const label = p.targetLabel && p.targetLabel !== p.targetKey
    ? p.targetLabel
    : p.type === 'app'
      ? humanizePackageName(p.targetKey)
      : p.targetLabel || p.targetKey;

  return {
    id: p.policyId,
    app_name: p.targetKey,
    package_name: p.targetKey,
    packageName: p.targetKey,
    category: p.type === 'category' ? p.targetLabel : null,
    target_label: label,
    target_type: p.type,
    max_time_minutes: p.dailyLimitMinutes,
    time_used_minutes: usedMinutes,
    is_blocked: isExhausted,
    status,
    blocked_until_timestamp: 0,
    created_at: p.createdAt?._seconds ? p.createdAt._seconds * 1000 : Date.now(),
  };
}

export function formatUsageTime(minutes: number): string {
  if (minutes <= 0) return '0s';
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function formatLimitTime(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded >= 60) {
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (rounded <= 0) return '< 1m';
  return `${rounded}m`;
}

export function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) return '0s left';
  return `${formatUsageTime(minutes)} left`;
}

export function getPolicyPackageKey(item: any): string {
  let raw = String(item?.app_name || item?.package_name || item?.packageName || '')
    .trim()
    .toLowerCase();
  if (item?.target_type === 'website') {
    raw = raw.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    if (!raw.startsWith('website:')) {
      return `website:${raw}`;
    }
  }
  return raw;
}

export function resolvePolicyBlockedState(item: any): boolean {
  if (typeof item?.is_blocked === 'boolean') return item.is_blocked;

  const rawStatus = String(item?.status_text || item?.status || '')
    .trim()
    .toLowerCase();
  if (rawStatus.includes('block')) return true;
  if (rawStatus.includes('active') || rawStatus.includes('running') || rawStatus.includes('unblocked')) {
    return false;
  }

  const blockedUntil = Number(item?.blocked_until_timestamp || 0);
  if (blockedUntil > Date.now()) return true;

  const maxMinutes = Number(item?.max_time_minutes || 0);
  const usedMinutes = Number(item?.time_used_minutes || 0);
  if (maxMinutes <= 0) return false;
  return usedMinutes >= maxMinutes;
}

export function normalizeUiPolicy(item: UIPolicy): UIPolicy {
  return {
    ...item,
    is_blocked: resolvePolicyBlockedState(item),
  };
}

export function mergeBlockedOverlaysIntoPolicies(
  normalizedPolicies: UIPolicy[],
  nativeBlockedPackages: Set<string>,
): UIPolicy[] {
  return normalizedPolicies.map(item => {
    const key = getPolicyPackageKey(item);
    if (nativeBlockedPackages.has(key)) {
      return { ...item, is_blocked: true };
    }
    return item;
  });
}

export type NativeTimerForLiveTimerUsageMerge = Pick<
  NativeTimerState,
  'package' | 'remainingSeconds' | 'liveTimerUsageBudgetSeconds' | 'status'
>;

export function mergeLiveTimerUsageIntoPolicies(
  policies: UIPolicy[],
  timers: NativeTimerForLiveTimerUsageMerge[],
): UIPolicy[] {
  const byPkg = new Map<string, NativeTimerForLiveTimerUsageMerge>();
  timers.forEach(t => {
    const k = String(t.package || '')
      .trim()
      .toLowerCase();
    if (k) byPkg.set(k, t);
  });

  return policies.map(item => {
    if (item.target_type !== 'app' && item.target_type !== 'website') return item;
    const key = getPolicyPackageKey(item);
    const timer = byPkg.get(key);
    if (!timer) return item;

    const budget = Math.max(0, Number(timer.liveTimerUsageBudgetSeconds) || 0);
    const remaining = Math.max(0, Number(timer.remainingSeconds) || 0);
    const liveTimerUsageSec = Math.max(0, Math.min(budget, budget - remaining));

    const used = Number(item.time_used_minutes) || 0;
    const maxMin = Number(item.max_time_minutes) || 0;
    const mergedUsed = maxMin > 0
      ? Math.min(used + liveTimerUsageSec / 60, maxMin)
      : used + liveTimerUsageSec / 60;

    let is_blocked = item.is_blocked;
    let status = item.status;
    if (maxMin > 0 && mergedUsed >= maxMin) {
      is_blocked = true;
      status = 'blocked';
    }

    return {
      ...item,
      time_used_minutes: mergedUsed,
      is_blocked,
      status,
      _nativeBudgetSeconds: budget > 0 ? budget : undefined,
    };
  });
}
