import type { NativeTimerState } from '../services/appBlockerService';
import type { LiveLockEvent } from '../services/timerRealtimeService';

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
  daily_reset_time_local: string;
  lock_until_timestamp_ms: number | null;
  _nativeBudgetSeconds?: number;
  // lockVersion and updatedAt are SERVER-ONLY — never mutated by client code.
  lockVersion?: number;
  updatedAt?: number;
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
    daily_reset_time_local: typeof p.dailyResetTimeLocal === 'string' ? p.dailyResetTimeLocal : '00:00',
    lock_until_timestamp_ms: typeof p.lockUntilTimestampMs === 'number' ? p.lockUntilTimestampMs : null,
    // Do NOT set lockVersion/updatedAt here — they are read-only from the server.
  };
}



export function selectPolicyState(rtdbLocks: Record<string, LiveLockEvent>, httpState: UIPolicy): UIPolicy {
  const key = getPolicyPackageKey(httpState);
  const rawKey = key.replace(/^website:/, '');

  // Check both prefixed and unprefixed keys — RTDB stores by policyId but
  // subscribeLockState returns the full lock object including targetKey.
  const lock = rtdbLocks[key] || rtdbLocks[rawKey];
  const now = Date.now();
  const isLockedRemotely =
    lock && lock.isLocked && typeof lock.blockedUntil === 'number' && lock.blockedUntil > now;

  // === PATH 1: RTDB says locked → lock wins unconditionally ===
  if (isLockedRemotely) {
    if (!httpState.is_blocked) {
      console.warn('[selectPolicyState] RTDB LOCK OVERRIDE HTTP STATE', key);
    }
    return {
      ...httpState,
      is_blocked: true,
      status: 'blocked',
      blocked_until_timestamp: lock.blockedUntil as number,
    };
  }

  // === PATH 2: RTDB has NO active lock ===
  // The HTTP `isExhaustedToday` flag is a valid usage signal (not a lock).
  // We preserve it: if HTTP says the usage quota is exhausted but RTDB has no
  // live lock, the policy is exhausted but NOT blocked (override may still apply).
  // We only clear the lock-specific fields.
  if (httpState.is_blocked) {
    console.warn('[selectPolicyState] RTDB UNLOCK OVERRIDE HTTP LOCK STATE', key);
  }

  return {
    ...httpState,
    is_blocked: false,
    // Keep the usage-derived status from HTTP (e.g. 'active'/'inactive') but
    // clear 'blocked' since RTDB is the only authority for that.
    status: httpState.status === 'blocked' ? 'active' : httpState.status,
    blocked_until_timestamp: 0,
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

export function normalizeNativePackageKey(pkg: string, targetType?: string): string {
  const raw = String(pkg || '').trim().toLowerCase();
  if (targetType === 'website') {
    const cleaned = raw.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    return cleaned.startsWith('website:') ? cleaned : `website:${cleaned}`;
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
  _nativeBlockedPackages: Set<string>,
): UIPolicy[] {
  // Server is the ONLY source of truth for blocked state.
  // We no longer rely on local native blocked packages to determine UI status.
  return normalizedPolicies;
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
    const k = String(t.package || '').trim().toLowerCase();
    if (!k) return;

    byPkg.set(k, t);
  });
  return policies.map(item => {
    if (item.target_type !== 'app' && item.target_type !== 'website') return item;
    const key = getPolicyPackageKey(item);
    const timer = byPkg.get(key);

    if (!timer) return item;

    const budget = Math.max(0, Number(timer.liveTimerUsageBudgetSeconds) || 0);
    const remaining = Math.max(0, Number(timer.remainingSeconds) || 0);
    const liveTimerUsageSec = Math.max(0, Math.min(budget, budget - remaining));
    const maxMin = Number(item.max_time_minutes) || 0;
    
    // Server is the absolute source of truth for is_blocked and status.
    // Only use local native timers to smoothly interpolate time_used_minutes for the progress bar.
    if (item.is_blocked) {
      return {
        ...item,
        time_used_minutes: maxMin > 0 ? maxMin : liveTimerUsageSec / 60,
        _nativeBudgetSeconds: budget > 0 ? budget : undefined,
      };
    }

    const nativeUsedMinutes = liveTimerUsageSec / 60;
    const cappedUsed = maxMin > 0 ? Math.min(nativeUsedMinutes, maxMin) : nativeUsedMinutes;
    const backendUsed = Number(item.time_used_minutes) || 0;
    const bestUsed = Math.max(cappedUsed, backendUsed);

    return {
      ...item,
      time_used_minutes: bestUsed,
      // Never override server's unblocked status, just update the visual usage.
      _nativeBudgetSeconds: budget > 0 ? budget : undefined,
    };
  });
}
