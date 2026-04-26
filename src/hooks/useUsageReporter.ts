import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeTimerTicks, subscribeTimerSessionEnd } from '../services/timerRealtimeService';
import { tickUsageAPI, recordUsageAPI } from '../services/usageService';
import { startAppBlockerService, updateBlockedApps, startAppUsageTimer, startWebsiteTimer } from '../services/appBlockerService';
import { usePolicyContext } from '../context/PolicyContext';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { onReconnect } from '../services/networkService';
import type { UIPolicy } from '../utils/policyMapper';

const TICK_INTERVAL_MS = 15_000;
const FLUSH_INTERVAL_MS = 2 * 60 * 1000; // flush to Firestore every 2 minutes
const STORAGE_KEY = 'limitter_unflushed_sessions';
const QUEUE_STORAGE_KEY = '@limitter_usage_queue';
const SAVE_DEBOUNCE_MS = 5_000;

interface PolicySession {
  policyId: string;
  packageName: string;
  targetKey: string;
  accumulatedSeconds: number;
  lastSentSeconds: number;
  lastFlushedSeconds: number;
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
    const entries: { pkg: string; policyId: string; accumulatedSeconds: number; targetKey?: string }[] = JSON.parse(raw);
    for (const entry of entries) {
      if (entry.accumulatedSeconds <= 0) continue;
      try {
        // Use tickUsageAPI (RTDB path) instead of recordUsageAPI (Firestore-only path).
        // This ensures the exhausted → setLockState path runs for sessions that
        // crashed right at the limit boundary.
        await tickUsageAPI({
          policyId: entry.policyId,
          deviceId,
          accumulatedSeconds: entry.accumulatedSeconds,
          deltaSeconds: entry.accumulatedSeconds, // treat full count as delta; server handles stale detection
          limitSeconds: 0, // server will use policy's own limit
          targetKey: entry.targetKey || entry.pkg || entry.policyId,
        });
        console.log(`[UsageReporter] Recover stale session success for ${entry.policyId}`);
      } catch (error: any) {
        console.error(`[UsageReporter] Recover stale session failure for ${entry.policyId}:`, error?.message || error);
      }
    }
  } catch (error: any) {
    console.error(`[UsageReporter] Failed to parse stale sessions:`, error?.message || error);
  }
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
  } catch (error) { 
    console.error('[replayUsageQueue] Corrupted queue data:', error);
  }

  if (usageQueue.length === 0) return;

  const remaining: QueueEntry[] = [];
  for (const entry of usageQueue) {
    if (entry.deltaSeconds <= 0) continue;
    try {
      await recordUsageAPI(entry.policyId, entry.deviceId, entry.deltaSeconds);
      console.log(`[UsageReporter] Replay queue success for ${entry.policyId}`);
    } catch (error: any) {
      console.error(`[UsageReporter] Replay queue failure for ${entry.policyId}:`, error?.message || error);
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

// ─── Module-level flush hook (callable from outside the React tree) ───
//
// Logout happens outside this hook's scope, but the last 0–14s of unflushed
// usage lives only inside its closures. We expose the tick + flush callbacks
// via module-level refs so `SettingsScreen.handleSignOut` can drain them
// BEFORE wiping native state. See `flushPendingUsage` below.

let activeTickHandler: (() => Promise<void>) | null = null;
let activeFlushHandler: (() => Promise<void>) | null = null;

export async function flushPendingUsage(timeoutMs: number = 5000): Promise<void> {
  const tick = activeTickHandler;
  const flush = activeFlushHandler;
  if (!tick && !flush) return;

  const drain = async () => {
    if (tick) await tick();
    if (flush) await flush();
  };

  // Race against a timeout so a slow/offline backend can't block logout.
  await Promise.race([
    drain(),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
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
  const policyByPackage = useRef<Map<string, { policyId: string; maxMinutes: number; targetKey: string }>>(new Map());
  useEffect(() => {
    const map = new Map<string, { policyId: string; maxMinutes: number; targetKey: string }>();
    for (const p of policies) {
      const pkg = getPolicyPackageKey(p);
      if (pkg && p.id) map.set(pkg, { policyId: p.id, maxMinutes: p.max_time_minutes, targetKey: pkg });
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

      try {
        const response = await tickUsageAPI({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          accumulatedSeconds: session.accumulatedSeconds,
          deltaSeconds: delta,
          limitSeconds: session.limitSeconds,
          targetKey: session.targetKey,
        });
        
        console.log(`[UsageReporter] Tick success for ${session.policyId} (target: ${session.targetKey}). Total: ${response.totalUsageSeconds}/${session.limitSeconds}`);

        if (response.wasReset) {
          session.accumulatedSeconds = 0;
          session.lastSentSeconds = 0;
          session.lastFlushedSeconds = 0;
          session.unsentDelta = 0;

          // Native timers do not automatically reset. We must restart them with 0 usedSeconds
          // so they don't incorrectly trigger a block based on yesterday's usage.
          const isWebsite = pkg.startsWith('website:');
          if (isWebsite) {
            const domain = pkg.replace('website:', '');
            startWebsiteTimer({ websiteUrl: domain, durationSeconds: session.limitSeconds }).catch(() => {});
          } else {
            startAppUsageTimer(pkg, session.targetKey, session.limitSeconds, 0).catch(() => {});
          }

          continue;
        }

        session.lastSentSeconds = session.accumulatedSeconds;
        session.unsentDelta = 0;

        const serverUsed = response.totalUsageSeconds || 0;
        const localUsed = session.accumulatedSeconds;
        if (serverUsed > localUsed) {
          session.accumulatedSeconds = serverUsed;
        }
      } catch (error: any) {
        console.error(`[UsageReporter] Tick failure for ${session.policyId} (target: ${session.targetKey}):`, error?.message || error);
        // Queue failed delta for replay on reconnect
        enqueueUsage({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          deltaSeconds: delta,
          timestamp: Date.now(),
        });
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
    const toFlush = entries.filter(([_, s]) => s.accumulatedSeconds > s.lastFlushedSeconds);
    if (toFlush.length === 0) return;

    flushingRef.current = true;

    for (const [_, session] of toFlush) {
      const flushDelta = session.accumulatedSeconds - session.lastFlushedSeconds;
      if (flushDelta <= 0) continue;

      try {
        await recordUsageAPI(session.policyId, currentDeviceId, flushDelta);
        session.lastFlushedSeconds = session.accumulatedSeconds;
        console.log(`[UsageReporter] Flush success for ${session.policyId}`);
      } catch (error: any) {
        console.error(`[UsageReporter] Flush failure for ${session.policyId}:`, error?.message || error);
        enqueueUsage({
          policyId: session.policyId,
          deviceId: currentDeviceId,
          deltaSeconds: flushDelta,
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

      const rawPkg = String(event.package).trim().toLowerCase();
      const policyInfo = policyByPackage.current.get(rawPkg)
        || policyByPackage.current.get(`website:${rawPkg}`);
      
      if (!policyInfo) {
        // Log missing policy to identify 404 silent failures
        // We only want to log it occasionally to avoid spamming the console
        if (Math.random() < 0.05) {
          console.warn(`[UsageReporter] No policy found for package: ${rawPkg}`);
        }
        return;
      }

      const existing = sessionsRef.current.get(rawPkg);
      if (existing) {
        existing.accumulatedSeconds += 1;
        existing.unsentDelta += 1;
      } else {
        sessionsRef.current.set(rawPkg, {
          policyId: policyInfo.policyId,
          packageName: rawPkg,
          targetKey: policyInfo.targetKey,
          accumulatedSeconds: 1,
          lastSentSeconds: 0,
          lastFlushedSeconds: 0,
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

  useEffect(() => {
    const unsub = subscribeTimerSessionEnd(() => {
      sendTick.current();
    });
    return () => unsub();
  }, []);

  // Expose flush handlers to `flushPendingUsage` (above) so the logout flow
  // can drain unflushed usage before native state is cleared. Cleared on
  // unmount so a stale closure from a previous mount never fires after
  // sign-out.
  useEffect(() => {
    activeTickHandler = () => sendTick.current();
    activeFlushHandler = () => flushToFirestore.current();
    return () => {
      activeTickHandler = null;
      activeFlushHandler = null;
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
