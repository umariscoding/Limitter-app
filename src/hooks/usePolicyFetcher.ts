import { useRef } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI } from '../services/policyService';
import {
  startAppUsageTimer,
  startBulkWebsiteTimers,
  stopAllTimers,
  syncUsageToNative,
} from '../services/appBlockerService';
import { hydratePoliciesForUi } from '../helpers/helper';

export function usePolicyFetcher() {
  const { setPolicies, setIsLoading, setLastFetchedAt } = usePolicyContext();

  const depsRef = useRef({ setPolicies, setIsLoading, setLastFetchedAt });
  depsRef.current = { setPolicies, setIsLoading, setLastFetchedAt };

  const fetchPolicies = useRef(async () => {
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
        console.error('[PolicyFetcher] Failed to fetch policies:', error?.message || error);
        setIsLoading(false);
        return;
      }
    }

    try {
      const httpLimits = await hydratePoliciesForUi(policiesResult);

      setPolicies(httpLimits);
      setLastFetchedAt(Date.now());
      setIsLoading(false);

      startTimersInBackground(httpLimits);
    } catch (err: any) {
      console.error('[PolicyFetcher] Error reconciling policies:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }).current;

  return { fetchPolicies };
}

async function syncServerToNative(limits: any[]): Promise<void> {
  const timers: Array<{ package: string; appName: string; usedSeconds: number; durationSeconds: number }> = [];

  for (const limit of limits) {
    const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!pkg) continue;

    const rawPkg = String(pkg).trim().toLowerCase();
    const isWebsite = limit.target_type === 'website';
    const nativeKey = isWebsite
      ? rawPkg.startsWith('website:') ? rawPkg : `website:${rawPkg}`
      : rawPkg;

    const serverUsedSec = Math.round(Math.max(0, (limit.time_used_minutes || 0) * 60));
    const durationSeconds = Math.max(0, Math.round(limit.max_time_minutes * 60));

    if (durationSeconds <= 0) continue;

    timers.push({
      package: nativeKey,
      appName: limit.target_label || rawPkg,
      usedSeconds: serverUsedSec,
      durationSeconds,
    });
  }

  if (timers.length > 0) {
    await syncUsageToNative(timers);
  }
}

function startTimersInBackground(finalLimits: any[]) {
  // Stop all native timers first so that any policies that were deleted on the server
  // are removed from native's timer list. Without this, old policies accumulate in
  // SharedPreferences and show up as extra "tracked" entries in the notification even
  // after the user deletes them (TimerStateManager.addTimers only merges, never removes).
  stopAllTimers()
    .catch(err => console.error('[PolicyFetcher] stopAllTimers failed:', err))
    .finally(() => {
      syncServerToNative(finalLimits)
        .catch(err => console.error('[PolicyFetcher] syncServerToNative failed:', err))
        .finally(() => {
          armTimers(finalLimits).catch(err =>
            console.error('[PolicyFetcher] armTimers failed:', err),
          );
        });
    });
}

async function armTimers(finalLimits: any[]) {
  const appTimerPromises: Promise<any>[] = [];

  for (const limit of finalLimits) {
    if (limit.target_type !== 'app') continue;
    const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!pkg) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const serverUsedSec = Math.max(0, (limit.time_used_minutes || 0) * 60);

    appTimerPromises.push(
      startAppUsageTimer(pkg, limit.target_label || pkg, totalSeconds, serverUsedSec).catch(err =>
        console.error('[PolicyFetcher] startAppUsageTimer failed:', err),
      ),
    );
  }

  const websiteTimers: Array<{ domain: string; durationSeconds: number; usedSeconds?: number }> = [];
  for (const limit of finalLimits) {
    if (limit.target_type !== 'website') continue;
    const domain = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!domain) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const serverUsedSec = Math.max(0, (limit.time_used_minutes || 0) * 60);

    websiteTimers.push({ domain, durationSeconds: totalSeconds, usedSeconds: serverUsedSec });
  }

  if (websiteTimers.length > 0) {
    appTimerPromises.push(
      startBulkWebsiteTimers(websiteTimers).catch(err =>
        console.error('[PolicyFetcher] startBulkWebsiteTimers failed:', err),
      ),
    );
  }

  await Promise.all(appTimerPromises);
}
