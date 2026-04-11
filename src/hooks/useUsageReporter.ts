import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeTimerTicks } from '../services/timerRealtimeService';
import { tickUsageAPI, recordUsageAPI } from '../services/usageService';
import { startAppBlockerService, updateBlockedApps } from '../services/appBlockerService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { onReconnect } from '../services/networkService';
import type { UIPolicy } from '../utils/policyMapper';

const TICK_INTERVAL_MS = 15_000;
const FLUSH_INTERVAL_MS = 2 * 60 * 1000; // flush to Firestore every 2 minutes
const STORAGE_KEY = 'limitter_unflushed_sessions';
const QUEUE_STORAGE_KEY = '@limitter_usage_queue';
const SAVE_DEBOUNCE_MS = 5_000;

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

// ─── AsyncStorage backup (crash protection) ───

async function saveSessionsToStorage(sessions: Map<string, PolicySession>) {
  const entries = Array.from(sessions.entries())
    .filter(([_, s]) => s.accumulatedSeconds > 0)
    .map(([pkg, s]) => ({
      pkg,
      policyId: s.policyId,
      accumulatedSeconds: s.accumulatedSeconds,
      targetKey: s.targetKey,
    }));

  if (entries.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function recoverAndFlushStaleSessions(deviceId: string) {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  await AsyncStorage.removeItem(STORAGE_KEY);

  try {
    const entries: { pkg: string; policyId: string; accumulatedSeconds: number }[] = JSON.parse(raw);
    for (const entry of entries) {
      if (entry.accumulatedSeconds <= 0) continue;
      try {
        await recordUsageAPI(entry.policyId, deviceId, entry.accumulatedSeconds);
      } catch { /* best effort */ }
    }
  } catch { /* corrupted data, ignore */ }
}

// ─── Persistent usage queue (survives app close + offline) ───

interface QueueEntry {
  policyId: string;
  deviceId: string;
  deltaSeconds: number;
  timestamp: number;
}

let usageQueue: QueueEntry[] = [];
let queueSaveTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueUsage(entry: QueueEntry) {
  usageQueue.push(entry);
  // Debounced save to AsyncStorage
  if (queueSaveTimer) clearTimeout(queueSaveTimer);
  queueSaveTimer = setTimeout(() => {
    AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(usageQueue)).catch(() => {});
  }, SAVE_DEBOUNCE_MS);
}

async function replayUsageQueue() {
  // Load persisted queue entries (from previous app session)
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const persisted: QueueEntry[] = JSON.parse(raw);
      // Merge persisted with in-memory (avoid duplicates by timestamp)
      const existingTs = new Set(usageQueue.map(e => e.timestamp));
      for (const entry of persisted) {
        if (!existingTs.has(entry.timestamp)) usageQueue.push(entry);
      }
    }
  } catch { /* corrupted data */ }

  if (usageQueue.length === 0) return;

  const remaining: QueueEntry[] = [];
  for (const entry of usageQueue) {
    if (entry.deltaSeconds <= 0) continue;
    try {
      await recordUsageAPI(entry.policyId, entry.deviceId, entry.deltaSeconds);
    } catch {
      remaining.push(entry); // Keep for next retry
    }
  }

  usageQueue = remaining;
  if (remaining.length === 0) {
    AsyncStorage.removeItem(QUEUE_STORAGE_KEY).catch(() => {});
  } else {
    AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining)).catch(() => {});
  }
}

// ─── Hook ───

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

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const policyByPackage = useRef<Map<string, { policyId: string; maxMinutes: number }>>(new Map());
  useEffect(() => {
    const map = new Map<string, { policyId: string; maxMinutes: number }>();
    for (const p of policies) {
      const pkg = getPolicyPackageKey(p);
      if (pkg && p.id) map.set(pkg, { policyId: p.id, maxMinutes: p.max_time_minutes });
    }
    policyByPackage.current = map;
  }, [policies]);

  // Recover crashed sessions on mount
  useEffect(() => {
    if (!deviceId) return;
    recoverAndFlushStaleSessions(deviceId);
  }, [deviceId]);

  // ─── Send tick to Realtime DB (every 15s) ───

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
      const locallyExhausted = () =>
        session.limitSeconds > 0 && session.accumulatedSeconds >= session.limitSeconds;

      const enforceBlock = () => {
        setPoliciesRef.current(prev =>
          prev.map(item => {
            if (getPolicyPackageKey(item) !== pkg) return item;
            return { ...item, is_blocked: true, status: 'blocked' as const };
          }),
        );
        const blockedUntil = Date.now() + 24 * 60 * 60 * 1000;
        const payload = [{
          package_name: pkg,
          app_name: session.targetKey,
          blocked_until_timestamp: blockedUntil,
        }];
        startAppBlockerService(payload);
        updateBlockedApps(payload);
      };

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

        if (response.isExhausted || locallyExhausted()) {
          enforceBlock();
        }
      } catch {
        // Queue failed delta for replay on reconnect
        enqueueUsage({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          deltaSeconds: delta,
          timestamp: Date.now(),
        });
        if (locallyExhausted()) {
          enforceBlock();
        }
      }
    }

    tickingRef.current = false;
  };

  // ─── Flush to Firestore (every 2 min + on background) ───

  const flushToFirestore = useRef(async () => {});
  flushToFirestore.current = async () => {
    const currentDeviceId = deviceIdRef.current;
    if (!currentDeviceId) return;
    if (flushingRef.current) return;

    const entries = Array.from(sessionsRef.current.entries());
    const toFlush = entries.filter(([_, s]) => s.accumulatedSeconds > 0);
    if (toFlush.length === 0) return;

    flushingRef.current = true;

    for (const [_, session] of toFlush) {
      const seconds = session.accumulatedSeconds;
      if (seconds <= 0) continue;

      try {
        await recordUsageAPI(session.policyId, currentDeviceId, seconds);
        session.accumulatedSeconds = 0;
        session.lastSentSeconds = 0;
        session.unsentDelta = 0;
        session.sessionId = generateSessionId();
        session.startedAt = Date.now();
      } catch {
        // Queue failed flush for replay on reconnect
        enqueueUsage({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          deltaSeconds: seconds,
          timestamp: Date.now(),
        });
      }
    }

    await AsyncStorage.removeItem(STORAGE_KEY);
    flushingRef.current = false;
  };

  // ─── Native timer tick listener ───

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

      // Debounced save to AsyncStorage for crash protection
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        saveSessionsToStorage(sessionsRef.current);
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubTick();
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  // Tick interval (15s → Realtime DB)
  useEffect(() => {
    const interval = setInterval(() => sendTick.current(), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Flush interval (2 min → Firestore)
  useEffect(() => {
    const interval = setInterval(() => flushToFirestore.current(), FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // App state changes
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

  // Replay queued usage on reconnect
  useEffect(() => {
    const unsub = onReconnect(() => {
      replayUsageQueue();
    });
    return unsub;
  }, []);
}
