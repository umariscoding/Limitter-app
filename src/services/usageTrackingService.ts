import { recordUsageAPI } from './usageAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_BUFFER_KEY = 'APPGUARD_USAGE_BUFFER_V1';
const USAGE_SYNC_INTERVAL = 60000; // 1 minute

interface UsageEntry {
  user_id: string;
  device_id: string;
  app_name: string;
  category_id: string | null;
  minutes_to_add: number;
  timestamp: number;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Add usage to local buffer for batching
 */
export const addUsageToBuffer = async (
  user_id: string,
  device_id: string,
  app_name: string,
  category_id: string | null,
  minutes_to_add: number
): Promise<void> => {
  try {
    const buffer: UsageEntry[] = await getUsageBuffer();

    const entry: UsageEntry = {
      user_id,
      device_id,
      app_name,
      category_id,
      minutes_to_add,
      timestamp: Date.now(),
    };

    buffer.push(entry);

    // Keep only last 100 entries to avoid memory bloat
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }

    await AsyncStorage.setItem(USAGE_BUFFER_KEY, JSON.stringify(buffer));
    console.log('✅ Usage recorded to buffer:', app_name, minutes_to_add, 'min');
  } catch (error) {
    console.error('❌ Failed to add usage to buffer:', error);
  }
};

/**
 * Get all buffered usage entries
 */
export const getUsageBuffer = async (): Promise<UsageEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(USAGE_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('❌ Failed to read usage buffer:', error);
    return [];
  }
};

/**
 * Sync buffered usage to backend
 */
export const syncUsageBuffer = async (): Promise<void> => {
  try {
    const buffer = await getUsageBuffer();
    if (buffer.length === 0) {
      console.log('📊 Usage buffer empty, nothing to sync');
      return;
    }

    console.log(`📊 Syncing ${buffer.length} usage entries to backend...`);

    // Aggregate by app to reduce API calls
    const aggregated = new Map<string, UsageEntry>();

    for (const entry of buffer) {
      const key = `${entry.user_id}:${entry.device_id}:${entry.app_name}`;
      const existing = aggregated.get(key);

      if (existing) {
        existing.minutes_to_add += entry.minutes_to_add;
        // Keep the latest timestamp
        existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
      } else {
        aggregated.set(key, { ...entry });
      }
    }

    // Send aggregated entries
    let syncedCount = 0;
    for (const entry of aggregated.values()) {
      try {
        await recordUsageAPI(
          entry.user_id,
          entry.device_id,
          entry.app_name,
          entry.category_id,
          entry.minutes_to_add
        );
        syncedCount++;
      } catch (error) {
        console.warn(`⚠️ Failed to sync usage for ${entry.app_name}:`, error);
        // Continue syncing other entries even if one fails
      }
    }

    if (syncedCount === aggregated.size) {
      // Clear buffer only if all syncs succeeded
      await AsyncStorage.removeItem(USAGE_BUFFER_KEY);
      console.log('✅ Usage buffer synced and cleared');
    } else {
      console.warn(`⚠️ Partial sync: ${syncedCount}/${aggregated.size} entries synced`);
    }
  } catch (error) {
    console.error('❌ Usage sync failed:', error);
  }
};

/**
 * Start periodic sync of usage buffer
 */
export const startUsageSync = (): void => {
  if (syncInterval) {
    console.log('⚠️ Usage sync already running');
    return;
  }

  console.log('🔄 Starting periodic usage sync (every 1 minute)');

  // Initial sync after 10 seconds
  setTimeout(() => {
    void syncUsageBuffer();
  }, 10000);

  // Periodic sync every USAGE_SYNC_INTERVAL
  syncInterval = setInterval(() => {
    void syncUsageBuffer();
  }, USAGE_SYNC_INTERVAL);
};

/**
 * Stop periodic sync
 */
export const stopUsageSync = (): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Stopped usage sync');
  }
};

/**
 * Force immediate sync
 */
export const forceUsageSync = async (): Promise<void> => {
  console.log('⚡ Force syncing usage...');
  await syncUsageBuffer();
};
