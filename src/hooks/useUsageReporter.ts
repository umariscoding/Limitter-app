import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { subscribeTimerTicks } from '../services/timerRealtimeService';
import { recordUsageAPI, type UsageRecordResponse } from '../services/usageService';
import { startAppBlockerService, updateBlockedApps } from '../services/appBlockerService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import type { UIPolicy } from '../utils/policyMapper';

const FLUSH_INTERVAL_MS = 15_000;
const SYNC_DRIFT_THRESHOLD_MINUTES = 3 / 60;

interface PolicyAccumulator {
  policyId: string;
  packageName: string;
  accumulatedSeconds: number;
  localUsedMinutes: number;
}

export function useUsageReporter(
  policies: UIPolicy[],
  deviceId: string | undefined,
) {
  const { setPolicies } = usePolicyContext();
  const accumulatorRef = useRef<Map<string, PolicyAccumulator>>(new Map());
  const deviceIdRef = useRef(deviceId);
  const flushingRef = useRef(false);
  const setPoliciesRef = useRef(setPolicies);

  deviceIdRef.current = deviceId;
  setPoliciesRef.current = setPolicies;

  const policyIdByPackage = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const p of policies) {
      const pkg = getPolicyPackageKey(p);
      if (pkg && p.id) map.set(pkg, p.id);
    }
    policyIdByPackage.current = map;
  }, [policies]);

  const flushRef = useRef(async () => {});
  flushRef.current = async () => {
    const currentDeviceId = deviceIdRef.current;
    if (!currentDeviceId) return;
    if (flushingRef.current) return;

    const entries = Array.from(accumulatorRef.current.entries());
    const toFlush = entries.filter(([_, acc]) => acc.accumulatedSeconds >= 1);
    if (toFlush.length === 0) return;

    flushingRef.current = true;

    const results: Array<{ packageName: string; response: UsageRecordResponse }> = [];

    for (const [pkg, acc] of toFlush) {
      const seconds = Math.floor(acc.accumulatedSeconds);
      if (seconds <= 0) continue;

      try {
        const response = await recordUsageAPI(acc.policyId, currentDeviceId, seconds);
        acc.accumulatedSeconds = Math.max(0, acc.accumulatedSeconds - seconds);
        results.push({ packageName: pkg, response });
      } catch {
        // keep accumulated seconds for next flush
      }
    }

    if (results.length > 0) {
      setPoliciesRef.current(prev => {
        let updated = [...prev];
        const blockedPkgs: Array<{ package_name: string; app_name: string }> = [];

        for (const { packageName, response } of results) {
          updated = updated.map(item => {
            if (getPolicyPackageKey(item) !== packageName) return item;

            const serverMinutes = response.usageTodayMinutes;
            const localMinutes = item.time_used_minutes || 0;

            let resolvedUsed = localMinutes;
            if (serverMinutes > localMinutes + SYNC_DRIFT_THRESHOLD_MINUTES) {
              resolvedUsed = serverMinutes;
            }

            const isBlocked = response.isExhaustedToday;

            if (isBlocked) {
              blockedPkgs.push({
                package_name: item.app_name || item.package_name,
                app_name: item.target_label || item.app_name,
              });
            }

            return {
              ...item,
              time_used_minutes: resolvedUsed,
              is_blocked: isBlocked,
              status: isBlocked ? 'blocked' as const : item.status,
            };
          });
        }

        if (blockedPkgs.length > 0) {
          startAppBlockerService(blockedPkgs);
          updateBlockedApps(blockedPkgs);
        }

        return updated;
      });
    }

    flushingRef.current = false;
  };

  useEffect(() => {
    const unsubTick = subscribeTimerTicks(event => {
      if (!event?.package) return;

      const isBlocked = event.isBlocked === true
        || String(event.status || '').toLowerCase() === 'blocked'
        || (event.remaining !== undefined && event.remaining <= 0);

      if (isBlocked) return;

      const pkg = String(event.package).trim().toLowerCase();
      const policyId = policyIdByPackage.current.get(pkg);
      if (!policyId) return;

      const existing = accumulatorRef.current.get(pkg);
      if (existing) {
        existing.accumulatedSeconds += 1;
        existing.localUsedMinutes = (existing.localUsedMinutes || 0) + 1 / 60;
      } else {
        accumulatorRef.current.set(pkg, {
          policyId,
          packageName: pkg,
          accumulatedSeconds: 1,
          localUsedMinutes: 1 / 60,
        });
      }
    });

    return unsubTick;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => flushRef.current(), FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
        flushRef.current();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
