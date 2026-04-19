import { useRef } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI, getCachedPolicies } from '../services/policyService';
import {
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
} from '../services/appBlockerService';
import { hydratePoliciesForUi } from '../helpers/helper';
import { setLastNativeUpdateAt } from './useLockStateSync';

export function usePolicyFetcher() {
  const { setPolicies, setIsLoading, setLastFetchedAt } = usePolicyContext();

  const depsRef = useRef({ setPolicies, setIsLoading, setLastFetchedAt });
  depsRef.current = { setPolicies, setIsLoading, setLastFetchedAt };

  const fetchPolicies = useRef(async (options?: {
    overriddenPackage?: string;
    matchesLimitPackage?: (item: any, pkg: string) => boolean;
  }) => {
    const { setPolicies, setIsLoading, setLastFetchedAt } = depsRef.current;

    let policiesResult: any;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        policiesResult = await getPoliciesAPI();
        break;
      } catch (error: any) {
        const status = error?.response?.status;
        if (attempt < MAX_RETRIES - 1 && (status === 503 || status === 502)) {
          await new Promise<void>(r => setTimeout(r, 1000));
          continue;
        }
        setIsLoading(false);
        return;
      }
    }

    try {
      const reconciledLimits = await hydratePoliciesForUi(policiesResult);

      let finalLimits = reconciledLimits;

      const reconcileWithContext = (prev: any[]) => {
        const prevMap = new Map(prev.map((p: any) => [p.id, p]));
        return reconciledLimits.map((item: any) => {
          const existing = prevMap.get(item.id);
          if (!existing) return item;

          const freshUsed = item.time_used_minutes || 0;
          const existingUsed = existing.time_used_minutes || 0;
          const time_used_minutes = Math.max(freshUsed, existingUsed);

          const is_blocked = item.is_blocked || (existing.is_blocked && freshUsed > 0);
          const status = is_blocked ? 'blocked' as const : item.status;

          return { ...item, time_used_minutes, is_blocked, status };
        });
      };

      if (options?.overriddenPackage && options?.matchesLimitPackage) {
        const overriddenPkg = options.overriddenPackage;
        const match = options.matchesLimitPackage;

        setPolicies(prev => {
          const merged = reconcileWithContext(prev);
          finalLimits = merged.map((item: any) =>
            match(item, overriddenPkg)
              ? { ...item, is_blocked: false, time_used_minutes: 0, status: 'active' }
              : item,
          );
          return finalLimits;
        });
        setLastNativeUpdateAt(Date.now());
      } else {
        setPolicies(prev => {
          finalLimits = reconcileWithContext(prev);
          return finalLimits;
        });
        setLastNativeUpdateAt(Date.now());
      }

      setLastFetchedAt(Date.now());
      setIsLoading(false);

      startTimersInBackground(finalLimits);
    } catch { /* silenced */ }
    finally {
      setIsLoading(false);
    }
  }).current;

  return { fetchPolicies };
}

function startTimersInBackground(finalLimits: any[]) {
  const blockedAppsList = finalLimits
    .filter((l: any) => l.is_blocked && l.app_name)
    .map((l: any) => ({
      package_name: l.app_name || l.package_name || l.packageName,
      app_name: l.app_name || l.package_name || l.packageName,
      blocked_until_timestamp: l.blocked_until_timestamp,
    }));

  if (blockedAppsList.length > 0) {
    startAppBlockerService(blockedAppsList).catch(() => {});
  }
  updateBlockedApps(blockedAppsList);

  const appTimerPromises: Promise<any>[] = [];
  for (const limit of finalLimits) {
    if (limit.is_blocked) continue;
    if (limit.target_type !== 'app') continue;
    const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!pkg) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const usedSeconds = Math.max(0, (limit.time_used_minutes || 0) * 60);
    if (usedSeconds >= totalSeconds) continue;
    appTimerPromises.push(
      startAppUsageTimer(pkg, limit.target_label || pkg, totalSeconds, usedSeconds).catch(() => {}),
    );
  }

  const websiteTimersToStart: Array<{ domain: string; durationSeconds: number }> = [];
  for (const limit of finalLimits) {
    if (limit.is_blocked) continue;
    if (limit.target_type !== 'website') continue;
    const domain = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!domain) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const usedSeconds = Math.max(0, (limit.time_used_minutes || 0) * 60);
    if (usedSeconds >= totalSeconds) continue;
    websiteTimersToStart.push({ domain, durationSeconds: totalSeconds, usedSeconds });
  }

  if (websiteTimersToStart.length > 0) {
    appTimerPromises.push(
      startBulkWebsiteTimers(websiteTimersToStart).catch(() => {}),
    );
  }

  Promise.all(appTimerPromises).catch(() => {});
}
