import { recordUsageAPI } from './usageAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_BUFFER_KEY = 'LIMITTER_USAGE_BUFFER_V2';
const USAGE_SYNC_INTERVAL = 60000; // 1 minute

interface UsageEntry {
  policyId: string;
  deviceId: string;
  durationSeconds: number;
  timestamp: number;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Add usage to local buffer for batching.
 */
export const addUsageToBuffer = async (
  policyId: string,
  deviceId: string,
  durationSeconds: number,
): Promise<void> => {
  try {
    const buffer = await getUsageBuffer();

    buffer.push({
      policyId,
      deviceId,
      durationSeconds,
      timestamp: Date.now(),
    });

    // Keep only last 100 entries
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }

    await AsyncStorage.setItem(USAGE_BUFFER_KEY, JSON.stringify(buffer));
  } catch (error) {
    console.error('Failed to add usage to buffer:', error);
  }
};

/**
 * Get all buffered usage entries.
 */
export const getUsageBuffer = async (): Promise<UsageEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(USAGE_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read usage buffer:', error);
    return [];
  }
};

/**
 * Sync buffered usage to backend.
 * Aggregates by policyId+deviceId to reduce API calls.
 */
export const syncUsageBuffer = async (): Promise<void> => {
  try {
    const buffer = await getUsageBuffer();
    if (buffer.length === 0) return;

    // Aggregate by policyId+deviceId
    const aggregated = new Map<string, UsageEntry>();

    for (const entry of buffer) {
      const key = `${entry.policyId}:${entry.deviceId}`;
      const existing = aggregated.get(key);

      if (existing) {
        existing.durationSeconds += entry.durationSeconds;
        existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      } else {
        aggregated.set(key, { ...entry });
      }
    }

    let syncedCount = 0;
    for (const entry of aggregated.values()) {
      try {
        await recordUsageAPI(entry.policyId, entry.deviceId, entry.durationSeconds);
        syncedCount++;
      } catch (error) {
        console.warn(`Failed to sync usage for policy ${entry.policyId}:`, error);
      }
    }

    if (syncedCount === aggregated.size) {
      await AsyncStorage.removeItem(USAGE_BUFFER_KEY);
    }
  } catch (error) {
    console.error('Usage sync failed:', error);
  }
};

/**
 * Start periodic sync of usage buffer.
 */
export const startUsageSync = (): void => {
  if (syncInterval) return;

  setTimeout(() => void syncUsageBuffer(), 10000);

  syncInterval = setInterval(() => {
    void syncUsageBuffer();
  }, USAGE_SYNC_INTERVAL);
};

/**
 * Stop periodic sync.
 */
export const stopUsageSync = (): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
};

/**
 * Force immediate sync.
 */
export const forceUsageSync = async (): Promise<void> => {
  await syncUsageBuffer();
};
