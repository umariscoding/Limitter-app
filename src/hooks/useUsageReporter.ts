import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { subscribeTimerTicks } from '../services/timerRealtimeService';
import { tickUsageAPI, recordUsageAPI } from '../services/usageService';
import { startAppBlockerService, updateBlockedApps } from '../services/appBlockerService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import type { UIPolicy } from '../utils/policyMapper';

const TICK_INTERVAL_MS = 15_000;

const generateSessionId = () =>
  `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

interface PolicySession {
  policyId: string;
  packageName: string;
  targetKey: string;
  sessionId: string;
  startedAt: number;
  accumulatedSeconds: number;
  lastSentSeconds: number;
  limitSeconds: number;
  unsentDelta: number;
}

export function useUsageReporter(
  policies: UIPolicy[],
  deviceId: string | undefined,
  _accountId: string | undefined,
) {
  const { setPolicies } = usePolicyContext();
  const sessionsRef = useRef<Map<string, PolicySession>>(new Map());
  const deviceIdRef = useRef(deviceId);
  const setPoliciesRef = useRef(setPolicies);
  const tickingRef = useRef(false);
  const flushingRef = useRef(false);

  deviceIdRef.current = deviceId;
  setPoliciesRef.current = setPolicies;

  const policyByPackage = useRef<Map<string, { policyId: string; maxMinutes: number }>>(new Map());
  useEffect(() => {
    const map = new Map<string, { policyId: string; maxMinutes: number }>();
    for (const p of policies) {
      const pkg = getPolicyPackageKey(p);
      if (pkg && p.id) map.set(pkg, { policyId: p.id, maxMinutes: p.max_time_minutes });
    }
    policyByPackage.current = map;
  }, [policies]);

  const sendTick = useRef(async () => {});
  sendTick.current = async () => {
    const currentDeviceId = deviceIdRef.current;
    if (!currentDeviceId) return;
    if (tickingRef.current) return;

    const entries = Array.from(sessionsRef.current.entries());
    const toTick = entries.filter(([_, s]) => s.unsentDelta > 0);
    if (toTick.length === 0) return;

    tickingRef.current = true;

    for (const [pkg, session] of toTick) {
      const delta = session.unsentDelta;
      try {
        const response = await tickUsageAPI({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          sessionId: session.sessionId,
          accumulatedSeconds: session.accumulatedSeconds,
          deltaSeconds: delta,
          limitSeconds: session.limitSeconds,
          targetKey: session.targetKey,
          startedAt: session.startedAt,
        });
        session.lastSentSeconds = session.accumulatedSeconds;
        session.unsentDelta = 0;

        if (response.isExhausted) {
          setPoliciesRef.current(prev =>
            prev.map(item => {
              if (getPolicyPackageKey(item) !== pkg) return item;
              return { ...item, is_blocked: true, status: 'blocked' as const };
            }),
          );

          startAppBlockerService([{ package_name: pkg, app_name: session.targetKey }]);
          updateBlockedApps([{ package_name: pkg, app_name: session.targetKey }]);
        }
      } catch { /* retry next interval */ }
    }

    tickingRef.current = false;
  };

  const flushToFirestore = useRef(async () => {});
  flushToFirestore.current = async () => {
    const currentDeviceId = deviceIdRef.current;
    if (!currentDeviceId) return;
    if (flushingRef.current) return;

    const entries = Array.from(sessionsRef.current.entries());
    const toFlush = entries.filter(([_, s]) => s.accumulatedSeconds > 0);
    if (toFlush.length === 0) return;

    flushingRef.current = true;

    for (const [pkg, session] of toFlush) {
      const seconds = session.accumulatedSeconds;
      if (seconds <= 0) continue;

      try {
        await recordUsageAPI(session.policyId, currentDeviceId, seconds);
        session.accumulatedSeconds = 0;
        session.lastSentSeconds = 0;
        session.sessionId = generateSessionId();
        session.startedAt = Date.now();
      } catch { /* retry next time */ }
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
      const policyInfo = policyByPackage.current.get(pkg);
      if (!policyInfo) return;

      const existing = sessionsRef.current.get(pkg);
      if (existing) {
        existing.accumulatedSeconds += 1;
        existing.unsentDelta += 1;
      } else {
        sessionsRef.current.set(pkg, {
          policyId: policyInfo.policyId,
          packageName: pkg,
          targetKey: pkg,
          sessionId: generateSessionId(),
          startedAt: Date.now(),
          accumulatedSeconds: 1,
          lastSentSeconds: 0,
          limitSeconds: policyInfo.maxMinutes * 60,
          unsentDelta: 1,
        });
      }
    });

    return unsubTick;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => sendTick.current(), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        sendTick.current();
        flushToFirestore.current();
      }
      if (nextState === 'active') {
        sendTick.current();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
