import AsyncStorage from '@react-native-async-storage/async-storage';

export type LimitHistoryType = 'blocked' | 'override';

export interface LimitHistoryEntry {
  id: string;
  appName: string;
  packageName: string;
  timestamp: number;
  type: LimitHistoryType;
  overrideUsed: boolean;
}

const HISTORY_KEY = 'APPGUARD_LIMIT_HISTORY_V1';
const OVERRIDE_COUNT_KEY = 'APPGUARD_OVERRIDE_COUNT_V1';
let historyCache: LimitHistoryEntry[] | null = null;

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('History listener error:', error);
    }
  });
};

export const subscribeLimitHistory = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLimitHistory = async (): Promise<LimitHistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) {
      historyCache = historyCache || [];
      return historyCache;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      historyCache = historyCache || [];
      return historyCache;
    }

    const sanitized = parsed
      .filter(item => item && typeof item === 'object')
      .map((item: any) => ({
        id: String(item.id || `${item.packageName || 'unknown'}_${item.type || 'blocked'}_${item.timestamp || Date.now()}`),
        appName: String(item.appName || item.packageName || 'Unknown App'),
        packageName: String(item.packageName || 'unknown.package'),
        timestamp: Number(item.timestamp || Date.now()),
        type: item.type === 'override' ? 'override' : 'blocked',
        overrideUsed: Boolean(item.overrideUsed),
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 500) as LimitHistoryEntry[];

    historyCache = sanitized;
    return sanitized;
  } catch (error) {
    console.error('Failed to read limit history:', error);
    return historyCache || [];
  }
};

export const addLimitHistoryEntry = async (
  entry: Omit<LimitHistoryEntry, 'id'>
): Promise<LimitHistoryEntry> => {
  const newEntry: LimitHistoryEntry = {
    id: `${entry.packageName}_${entry.type}_${entry.timestamp}`,
    ...entry,
  };

  const history = await getLimitHistory();

  // Deduplicate same event if emitted multiple times in quick succession.
  const alreadyExists = history.some(
    item =>
      item.packageName === newEntry.packageName &&
      item.type === newEntry.type &&
      Math.abs(item.timestamp - newEntry.timestamp) < 2000
  );

  if (!alreadyExists) {
    const updated = [newEntry, ...history].slice(0, 500);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    historyCache = updated;
    notify();
  }

  return newEntry;
};

export const getOverrideCount = async (): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_COUNT_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch (error) {
    console.error('Failed to read override count:', error);
    return 0;
  }
};

export const incrementOverrideCount = async (): Promise<number> => {
  const current = await getOverrideCount();
  const next = current + 1;
  await AsyncStorage.setItem(OVERRIDE_COUNT_KEY, String(next));
  notify();
  return next;
};
