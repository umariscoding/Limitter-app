import { useCallback } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI } from '../services/policyService';
import {
  getNativeTimerStates,
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
} from '../services/appBlockerService';
import { hydratePoliciesForUi } from '../helpers/helper';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { setLastNativeUpdateAt } from './useLockStateSync';

export function usePolicyFetcher() {
  const { setPolicies, setIsLoading, setLastFetchedAt } = usePolicyContext();

  const fetchPolicies = useCallback(async (options?: {
    overriddenPackage?: string;
    matchesLimitPackage?: (item: any, pkg: string) => boolean;
  }) => {
    let policiesResult: any;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        policiesResult = await getPoliciesAPI();
        break;
      } catch (error: any) {
        const status = error?.response?.status;
        if (attempt < MAX_RETRIES - 1 && (status === 503 || status === 502)) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise<void>(r => setTimeout(r, delayMs));
          continue;
        }
        setIsLoading(false);
        return;
      }
    }

    try {
      const reconciledLimits = await hydratePoliciesForUi(policiesResult);

      // Merge: preserve is_blocked=true from real-time hooks when API data is stale.
      // Uses functional update to get the LATEST context state.
      // Captures merged result in finalLimits for downstream timer/blocker logic.
      let finalLimits = reconciledLimits;

      // Reconcile fresh API data with existing context:
      // - time_used_minutes: never go backwards (take the higher value)
      // - is_blocked: preserve if context was blocked and API is stale
      // - If hydrated usage is 0 (new day / no usage), use fresh value as-is
      const reconcileWithContext = (prev: any[]) => {
        const prevMap = new Map(prev.map((p: any) => [p.id, p]));
        return reconciledLimits.map((item: any) => {
          const existing = prevMap.get(item.id);
          if (!existing) return item;

          // Usage: never go backwards within the same day.
          // If hydrated value is 0, it's a new day or no activity → use fresh value.
          const freshUsed = item.time_used_minutes || 0;
          const existingUsed = existing.time_used_minutes || 0;
          const time_used_minutes = freshUsed > 0
            ? Math.max(freshUsed, existingUsed)
            : freshUsed;

          // Blocked: preserve if context was blocked and API lost it (same day)
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
          // Override path: explicitly unblock + reset the overridden package
          finalLimits = merged.map((item: any) =>
            match(item, overriddenPkg)
              ? { ...item, is_blocked: false, time_used_minutes: 0, status: 'active' }
              : item,
          );
          return finalLimits;
        });
        setLastNativeUpdateAt(Date.now());

        const overriddenLimit = finalLimits.find((l: any) => match(l, overriddenPkg));
        if (overriddenLimit && overriddenLimit.target_type === 'app') {
          const pkg = overriddenLimit.app_name || overriddenLimit.package_name;
          const budgetSeconds = overriddenLimit.max_time_minutes * 60;
          if (pkg && budgetSeconds > 0) {
            try {
              await startAppUsageTimer(pkg, overriddenLimit.target_label || pkg, budgetSeconds);
            } catch (_) { /* silenced */ }
          }
        }
      } else {
        // Normal refresh
        setPolicies(prev => {
          finalLimits = reconcileWithContext(prev);
          return finalLimits;
        });
        setLastNativeUpdateAt(Date.now());
      }

      // ALL downstream logic uses finalLimits (merged data)
      const blockedAppsList = finalLimits
        .filter((l: any) => l.is_blocked && l.app_name)
        .map((l: any) => ({
          package_name: l.app_name || l.package_name || l.packageName,
          app_name: l.app_name || l.package_name || l.packageName,
          blocked_until_timestamp: l.blocked_until_timestamp,
        }));

      if (blockedAppsList.length > 0) {
        await startAppBlockerService(blockedAppsList);
      }
      updateBlockedApps(blockedAppsList);

      const activeTimers = await getNativeTimerStates();
      const activePackages = new Set(
        activeTimers
          .filter(t => (t.remainingSeconds || 0) > 0)
          .map(t => String(t.package || '').trim().toLowerCase()),
      );

      for (const limit of finalLimits) {
        if (limit.is_blocked) continue;
        if (limit.target_type !== 'app') continue;
        const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
        if (!pkg) continue;
        if (activePackages.has(String(pkg).trim().toLowerCase())) continue;

        const remainingSeconds = Math.max(
          0,
          (limit.max_time_minutes - (limit.time_used_minutes || 0)) * 60,
        );
        if (remainingSeconds <= 0) continue;
        try {
          await startAppUsageTimer(pkg, limit.target_label || pkg, remainingSeconds);
        } catch (_) { /* silenced */ }
      }

      // Start website timers for active website policies
      const websiteTimersToStart: Array<{ domain: string; durationSeconds: number }> = [];
      for (const limit of finalLimits) {
        if (limit.is_blocked) continue;
        if (limit.target_type !== 'website') continue;
        const domain = limit.app_name || limit.package_name || (limit as any).packageName;
        if (!domain) continue;
        const key = `website:${String(domain).trim().toLowerCase()}`;
        if (activePackages.has(key)) continue;

        const remainingSeconds = Math.max(
          0,
          (limit.max_time_minutes - (limit.time_used_minutes || 0)) * 60,
        );
        if (remainingSeconds <= 0) continue;
        websiteTimersToStart.push({ domain, durationSeconds: remainingSeconds });
      }
      if (websiteTimersToStart.length > 0) {
        try {
          await startBulkWebsiteTimers(websiteTimersToStart);
        } catch (_) { /* silenced */ }
      }

      setLastFetchedAt(Date.now());
    } catch (_) { /* silenced */ }
    finally {
      setIsLoading(false);
    }
  }, [setPolicies, setIsLoading, setLastFetchedAt]);

  return { fetchPolicies };
}
