import { useRef } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI } from '../services/policyService';
import {
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
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

      // === STRICT RULE: HTTP writes ONLY metadata fields ===
      // setPolicies here sets httpPolicies inside PolicyContext.
      // The derived `policies` value is computed as:
      //   httpPolicies.map(p => selectPolicyState(rtdbLocks, p))
      // This means RTDB lock state automatically overlays on top — no merge needed here.
      // We set the array directly; we do NOT read or preserve previous UI state.
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

function startTimersInBackground(finalLimits: any[]) {
  // We use the RAW HTTP limits here (not the RTDB-merged result) because we only want
  // to start native timers for policies that are NOT currently blocked by RTDB.
  // useLockStateSync handles native blocker commands for locked policies.
  const appTimerPromises: Promise<any>[] = [];

  for (const limit of finalLimits) {
    if (limit.target_type !== 'app') continue;
    const pkg = limit.app_name || limit.package_name || (limit as any).packageName;
    if (!pkg) continue;

    const totalSeconds = Math.max(0, limit.max_time_minutes * 60);
    const usedSeconds = Math.max(0, (limit.time_used_minutes || 0) * 60);
    if (usedSeconds >= totalSeconds) continue;

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
    const usedSeconds = Math.max(0, (limit.time_used_minutes || 0) * 60);
    if (usedSeconds >= totalSeconds) continue;

    websiteTimers.push({ domain, durationSeconds: totalSeconds, usedSeconds });
  }

  if (websiteTimers.length > 0) {
    appTimerPromises.push(
      startBulkWebsiteTimers(websiteTimers).catch(err =>
        console.error('[PolicyFetcher] startBulkWebsiteTimers failed:', err),
      ),
    );
  }

  // Re-arm the native blocker for any RTDB-locked policies.
  // This is handled exclusively by useLockStateSync.
  // We intentionally do NOT call startAppBlockerService or updateBlockedApps here.

  Promise.all(appTimerPromises).catch(err =>
    console.error('[PolicyFetcher] timer startup error:', err),
  );
}
