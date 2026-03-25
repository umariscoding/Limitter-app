import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_USAGE_KEY = 'LIMITTER_LOCAL_USAGE_V1';

/**
 * Local usage store — persists usage per policy to AsyncStorage.
 * Works offline. Source of truth for local device usage.
 *
 * Structure: { [policyId]: { usedSeconds: number, updatedAt: number, dateKey: string } }
 */

interface LocalUsageEntry {
  usedSeconds: number;
  updatedAt: number;
  dateKey: string;
}

type LocalUsageMap = Record<string, LocalUsageEntry>;

const getTodayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Get all local usage data.
 */
export const getLocalUsage = async (): Promise<LocalUsageMap> => {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_USAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

/**
 * Get local usage for a specific policy (today only).
 * Returns 0 if no data or data is from a different day.
 */
export const getLocalUsageForPolicy = async (policyId: string): Promise<number> => {
  const all = await getLocalUsage();
  const entry = all[policyId];
  if (!entry) return 0;
  if (entry.dateKey !== getTodayKey()) return 0;
  return entry.usedSeconds;
};

/**
 * Set local usage for a policy (absolute value, not increment).
 */
export const setLocalUsageForPolicy = async (policyId: string, usedSeconds: number): Promise<void> => {
  try {
    const all = await getLocalUsage();
    all[policyId] = {
      usedSeconds,
      updatedAt: Date.now(),
      dateKey: getTodayKey(),
    };
    await AsyncStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save local usage:', err);
  }
};

/**
 * Get local usage for all policies (today only).
 * Returns map of { policyId: usedSeconds }.
 */
export const getAllLocalUsageToday = async (): Promise<Record<string, number>> => {
  const all = await getLocalUsage();
  const today = getTodayKey();
  const result: Record<string, number> = {};
  for (const [policyId, entry] of Object.entries(all)) {
    if (entry.dateKey === today) {
      result[policyId] = entry.usedSeconds;
    }
  }
  return result;
};

/**
 * Clear all local usage (e.g., on logout).
 */
export const clearLocalUsage = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(LOCAL_USAGE_KEY);
  } catch {}
};
