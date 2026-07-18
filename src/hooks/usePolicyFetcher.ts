import { useRef } from 'react';
import { usePolicyContext } from '../context/PolicyContext';
import { getPoliciesAPI } from '../services/policyService';
import {
  startAppBlockerService,
  startAppUsageTimer,
  startBulkWebsiteTimers,
  updateBlockedApps,
  getNativeTimerStates,
  resetNativeTimerForReset,
  stopAllTimers,
  type NativeTimerState,
} from '../services/appBlockerService';
import { hydratePoliciesForUi } from '../helpers/helper';

// Reset-detection tolerance — covers tick lag (typically ≤30s between native
// session updates and server tick reports) plus modest clock skew. Anything
// larger than this means the server is structurally lower than native, which
// only happens after an authoritative reset (daily cron, admin action).
const RESET_DETECTION_TOLERANCE_SEC = 60;

// If server's usageTodayMinutes is significantly LOWER than what the native
// timer currently believes, an authoritative reset just happened (daily cron
// at the policy's daily_reset_time_local). Native's addTimers uses
// maxOf(existing, new) which would silently preserve the stale higher value,
// so we explicitly force-reset the affected timer to {usedSeconds=0,
// status="waiting"} BEFORE the existing startAppUsageTimer call re-seeds it.
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
      console.log(
        '[PolicyFetcher] Reset detected for',
        nativeKey,
        '— native',
        Math.round(nativeUsedSec),
        's, server',
        Math.round(serverUsedSec),
        's. Resyncing.',
      );
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

      // === STRICT RULE: HTTP writes ONLY metadata fields ===
      // setPolicies here sets httpPolicies inside PolicyContext.
      // The derived `policies` value is computed as:
      //   httpPolicies.map(p => selectPolicyState(rtdbLocks, manualLocks, p))
      // RTDB lock state and manual-lock markers automatically overlay on top —
      // no merge needed here. We set the array directly; we do NOT read or
      // preserve previous UI state.
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
  // Stop all native timers first so that any policies that were deleted on the server
  // are removed from native's timer list. Without this, old policies accumulate in
  // SharedPreferences and show up as extra "tracked" entries in the notification even
  // after the user deletes them (TimerStateManager.addTimers only merges, never removes).
  stopAllTimers()
    .catch(err => console.error('[PolicyFetcher] stopAllTimers failed:', err))
    .finally(() => {
      // Reconcile FIRST so any reset-detected timers are cleared to zero before
      // the merge-based arming below runs. Without this, a non-exhausted policy
      // that was just reset on the server would keep its stale higher usedSeconds
      // in native (TimerStateManager addTimers uses maxOf merge).
      reconcileNativeAfterReset(finalLimits)
        .catch(err => console.error('[PolicyFetcher] reconcile failed:', err))
        .finally(() => {
          armTimers(finalLimits).catch(err =>
            console.error('[PolicyFetcher] armTimers failed:', err),
          );
        });
    });
}

// Mirror tolerance of reconcileNativeAfterReset (60s) but applied in the
// inverse direction: native significantly LOWER than server means an override
// just reset native locally while the server's daily aggregate remains high.
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

// When native has been deliberately reset (e.g., by an override grant) but the
// server's time_used_minutes still reflects the pre-override aggregate, seeding
// addTimers with serverUsedSec gets MAX-merged on top of native's 0 and blocks
// the user almost immediately. Detect that case and prefer native's lower
// value so the user gets the fresh window the override granted.
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
  // We use the RAW HTTP limits here (not the RTDB-merged result) because we only want
  // to start native timers for policies that are NOT currently blocked by RTDB.
  // useLockStateSync handles native blocker commands for locked policies.
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
    const serverUsedSec = Math.max(0, (limit.time_used_minutes || 0) * 60);
    const rawDomain = String(domain).trim().toLowerCase();
    const usedSeconds = resolveSeedUsedSec(nativeUsedByKey, rawDomain, true, serverUsedSec);
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
