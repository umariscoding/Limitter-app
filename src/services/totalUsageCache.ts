import { getTotalUsageAPI } from './usageAPI';

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 3 * 60 * 1000; // 3 minutes default cache

/**
 * Fetch total usage with built-in caching.
 * Returns cached result if valid, otherwise fetches fresh from backend.
 */
export const fetchTotalUsageWithCache = async (
  userId: string,
  forceRefresh = false
): Promise<{ success: boolean; data?: any; errorMessage?: string }> => {
  const cacheKey = `total-usage:${userId}`;

  // Check if cache is valid
  if (!forceRefresh) {
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      console.log('📦 Returning cached total usage');
      return {
        success: cached.data.success ?? true,
        data: cached.data.data,
        errorMessage: cached.data.errorMessage,
      };
    }
  }

  console.log('🔄 Fetching fresh total usage from backend...');
  const response = await getTotalUsageAPI(userId);

  // Cache the response
  CACHE.set(cacheKey, {
    data: response,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });

  return response;
};

/**
 * Clear cache for a specific user or all users
 */
export const clearTotalUsageCache = (userId?: string) => {
  if (userId) {
    CACHE.delete(`total-usage:${userId}`);
    console.log(`🗑️ Cleared cache for user ${userId}`);
  } else {
    CACHE.clear();
    console.log('🗑️ Cleared all cache');
  }
};

/**
 * Check if cache is still valid
 */
export const isCacheValid = (userId: string): boolean => {
  const cached = CACHE.get(`total-usage:${userId}`);
  return cached ? Date.now() < cached.expiresAt : false;
};
