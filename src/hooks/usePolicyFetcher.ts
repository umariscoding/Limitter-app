import { useRef } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI } from '../services/policyService';
import {
  startAppUsageTimer,
  startBulkWebsiteTimers,
  getNativeTimerStates,
  resetNativeTimerForReset,
  syncUsageToNative,
  type NativeTimerState,
} from '../services/appBlockerService';
import { hydratePoliciesForUi } from '../helpers/helper';

const RESET_DETECTION_TOLERANCE_SEC = 60;

async function reconcileNativeAfterReset(limits: any[]): Promise<void> {
  let nativeStates: NativeTimerState[];
  try {
    nativeStates = await getNativeTimerStates();
  } catch (err) {
    console.error('[PolicyFetcher] reconcile: getNativeTimerStates failed:', err);
    return;
  }
  if (nativeStates.length === 0) return;

  const nativeByPkg = new Map<string, NativeTimerState>();
  for (const t of nativeStates) {
    const k = String(t.package || '').trim().toLowerCase();
    if (k) nativeByPkg.set(k, t);
  }

  for (const limit of limits) {
    const rawPkg = String(
      limit.app_name || limit.package_name || limit.packageName || '',
    )
      .trim()
      .toLowerCase();
    if (!rawPkg) continue;

    const isWebsite = limit.target_type === 'website';
    const nativeKey = isWebsite
      ? rawPkg.startsWith('website:')
        ? rawPkg
        : `website:${rawPkg}`
      : rawPkg;
    const native = nativeByPkg.get(nativeKey);
    if (!native) continue;

    const budgetSec = Math.max(0, Number(native.liveTimerUsageBudgetSeconds || 0));
    const remainingSec = Math.max(0, Number(native.remainingSeconds || 0));
    const nativeUsedSec = Math.max(0, budgetSec - remainingSec);
    const serverUsedSec = Math.max(0, (limit.time_used_minutes || 0) * 60);

    if (nativeUsedSec - serverUsedSec > RESET_DETECTION_TOLERANCE_SEC) {
      await resetNativeTimerForReset(nativeKey, limit.target_label || rawPkg);
    }
  }
}

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

      await syncServerToNative(httpLimits);

      setPolicies(httpLimits);
      setLastFetchedAt(Date.now());
      setIsLoading(false);

      armTimersInBackground(httpLimits);
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

function armTimersInBackground(finalLimits: any[]) {
  reconcileNativeAfterReset(finalLimits)
    .catch(err => console.error('[PolicyFetcher] reconcile failed:', err))
    .finally(() => {
      armTimers(finalLimits).catch(err =>
        console.error('[PolicyFetcher] armTimers failed:', err),
      );
    });
}

const OVERRIDE_DETECTION_TOLERANCE_SEC = 60;

async function buildNativeUsedByKey(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const states = await getNativeTimerStates();
    for (const s of states) {
      const k = String(s.package || '').trim().toLowerCase();
      if (!k) continue;
      const budget = Math.max(0, Number(s.liveTimerUsageBudgetSeconds) || 0);
      const remaining = Math.max(0, Number(s.remainingSeconds) || 0);
      map.set(k, Math.max(0, budget - remaining));
    }
  } catch (err) {
    console.error('[PolicyFetcher] buildNativeUsedByKey failed:', err);
  }
  return map;
}

function resolveSeedUsedSec(
  nativeUsedByKey: Map<string, number>,
  rawPkg: string,
  isWebsite: boolean,
  serverUsedSec: number,
): number {
  const nativeKey = isWebsite
    ? rawPkg.startsWith('website:') ? rawPkg : `website:${rawPkg}`
    : rawPkg;
  const nativeUsed = nativeUsedByKey.get(nativeKey);
  if (nativeUsed === undefined) return serverUsedSec;
  if (serverUsedSec - nativeUsed > OVERRIDE_DETECTION_TOLERANCE_SEC) return nativeUsed;
  return serverUsedSec;
}

async function armTimers(finalLimits: any[]) {
  const nativeUsedByKey = await buildNativeUsedByKey();
  const appTimerPromises: Promise<any>[] = [];

  for (const limit of finalLimits) {
    if (limit.target_type !== 'app') continue;
    const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!pkg) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const serverUsedSec = Math.max(0, (limit.time_used_minutes || 0) * 60);
    const rawPkg = String(pkg).trim().toLowerCase();
    const usedSeconds = resolveSeedUsedSec(nativeUsedByKey, rawPkg, false, serverUsedSec);

    appTimerPromises.push(
      startAppUsageTimer(pkg, limit.target_label || pkg, totalSeconds, usedSeconds).catch(err =>
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
    const rawDomain = String(domain).trim().toLowerCase();
    const usedSeconds = resolveSeedUsedSec(nativeUsedByKey, rawDomain, true, serverUsedSec);

    websiteTimers.push({ domain, durationSeconds: totalSeconds, usedSeconds });
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
