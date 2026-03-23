import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useUser } from './UserContext';
import { resolveCurrentDeviceId } from '../services/currentDeviceService';
import { getTotalUsageAPI, getWeeklyUsageAPI, getAppHistoryAPI } from '../services/usageAPI';
import { fetchTotalUsageWithCache, clearTotalUsageCache } from '../services/totalUsageCache';
import { getLimitsAPI } from '../services/limitService';

export interface WeeklyUsagePoint {
  key: string;
  label: string;
  fullLabel: string;
  date: string;
  minutes: number;
}

interface UsageContextType {
  // Total usage data
  totalUsage: { success: boolean; data?: any } | null;
  isLoadingTotal: boolean;
  
  // Weekly usage data
  weeklyUsage: WeeklyUsagePoint[];
  isLoadingWeekly: boolean;
  weeklyError: string | null;
  
  // Loading states
  isRefreshing: boolean;
  lastRefreshTime: number | null;
  
  // Device ID
  currentDeviceId: string | null;
  
  // Manual refresh methods
  refetchTotalUsage: (forceRefresh?: boolean) => Promise<void>;
  refetchWeeklyUsage: (forceRefresh?: boolean) => Promise<void>;
  refetchAllUsageData: (forceRefresh?: boolean) => Promise<void>;
  
  // Cache control
  invalidateCache: () => void;
  
  // Enable/disable auto-polling
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ✅ Robust field extraction for usage data
const extractUsageMinutes = (item: any): { minutes: number; fieldUsed: string } => {
  // Try each field name in priority order
  const fieldPriority = [
    'total_time_minutes',
    'total_minutes',
    'minutes',
    'usage_minutes',
    'time_used_minutes',
    'usedMinutes',
    'totalMinutes',
  ];

  for (const field of fieldPriority) {
    const value = item?.[field];
    const numValue = Number(value);
    
    // Check if the value exists and converts to a valid number
    if (value !== null && value !== undefined && !isNaN(numValue) && numValue >= 0) {
      return { minutes: numValue, fieldUsed: field };
    }
  }

  // Default fallback
  return { minutes: 0, fieldUsed: 'none' };
};

// ✅ Robust field extraction for date
const extractDate = (item: any): { date: string; fieldUsed: string } => {
  const datePriority = ['date', 'day', 'date_key', 'dateKey', 'usage_date'];

  for (const field of datePriority) {
    const value = item?.[field];
    
    if (value && typeof value === 'string' && value.trim().length > 0) {
      return { date: value.trim(), fieldUsed: field };
    }
  }

  // Default fallback
  return { date: '', fieldUsed: 'none' };
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekDatesMondayToSunday = (referenceDate = new Date()) => {
  const now = new Date(referenceDate);
  const jsDay = now.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  return Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + idx);
    return date;
  });
};

const buildEmptyWeek = (referenceDate = new Date()): WeeklyUsagePoint[] => {
  const weekDates = getWeekDatesMondayToSunday(referenceDate);
  return weekDates.map(date => {
    const dateKey = formatDateKey(date);
    const dayIndex = date.getDay();
    return {
      key: dateKey,
      label: DAY_NAMES[dayIndex]?.slice(0, 3) || 'Day',
      fullLabel: DAY_NAMES[dayIndex] || 'Unknown',
      date: dateKey,
      minutes: 0,
    };
  });
};

const parseHistoryDateKey = (item: any): string => {
  const direct = String(item?.date || item?.usage_date || item?.day || '').trim();
  if (direct) return direct;

  const fromTs = Number(item?.timestamp || item?.time || 0);
  if (fromTs > 0) {
    return formatDateKey(new Date(fromTs));
  }

  const fromIso = String(item?.created_at || item?.updated_at || item?.recorded_at || '').trim();
  if (fromIso) {
    const dt = new Date(fromIso);
    if (!isNaN(dt.getTime())) {
      return formatDateKey(dt);
    }
  }

  return '';
};

const parseHistoryMinutes = (item: any): number => {
  const minutes = Number(
    item?.total_time_minutes ??
    item?.total_minutes ??
    item?.minutes_to_add ??
    item?.minutes ??
    item?.usage_minutes ??
    item?.duration_minutes ??
    0
  );
  return Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
};

export const UsageContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useUser();
  
  // State management
  const [totalUsage, setTotalUsage] = useState<{ success: boolean; data?: any } | null>(null);
  const [isLoadingTotal, setIsLoadingTotal] = useState(true);
  
  const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsagePoint[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(true);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  // Refs for cleanup and polling
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoRefreshingRef = useRef<boolean>(false);
  const weeklyRetryBlockedUntilRef = useRef<number>(0);
  const lastWeeklyErrorSignatureRef = useRef<string>('');
  const dayRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getTodayMinutesFromActivity = useCallback(async (): Promise<number> => {
    if (!user?.uid || !currentDeviceId) return 0;
    try {
      const response = await getLimitsAPI(user.uid, currentDeviceId);
      const rows = Array.isArray(response?.data) ? response.data : [];
      return rows.reduce((sum: number, row: any) => {
        return sum + Math.max(0, Number(row?.time_used_minutes ?? row?.used_minutes ?? 0));
      }, 0);
    } catch (error) {
      console.warn('⚠️ [UsageContext] Could not fetch today usage from activity limits:', error);
      return 0;
    }
  }, [user?.uid, currentDeviceId]);

  const applyTodayUsageToWeek = useCallback(async (baseWeek: WeeklyUsagePoint[]) => {
    const week = baseWeek.length ? baseWeek : buildEmptyWeek();
    const todayKey = formatDateKey(new Date());
    const todayMinutes = await getTodayMinutesFromActivity();
    return week.map(point =>
      point.date === todayKey ? { ...point, minutes: Math.max(0, todayMinutes) } : point
    );
  }, [getTodayMinutesFromActivity]);

  const buildWeeklyFromHistory = useCallback(async (): Promise<WeeklyUsagePoint[]> => {
    if (!user?.uid || !currentDeviceId) {
      return buildEmptyWeek();
    }

    const emptyWeek = buildEmptyWeek();
    const weekKeys = new Set(emptyWeek.map(item => item.date));
    const byDate: Record<string, number> = {};
    emptyWeek.forEach(item => {
      byDate[item.date] = 0;
    });

    try {
      const limitsResponse = await getLimitsAPI(user.uid, currentDeviceId);
      const limits = Array.isArray(limitsResponse?.data) ? limitsResponse.data : [];
      const appNames: string[] = Array.from(
        new Set(
          limits
            .map((row: any) => String(row?.app_name || row?.package_name || row?.packageName || '').trim())
            .filter((name: string) => !!name)
        )
      );

      await Promise.all(
        appNames.map(async appName => {
          try {
            const historyResp = await getAppHistoryAPI(user.uid, appName);
            const historyRows = Array.isArray(historyResp?.data)
              ? historyResp.data
              : Array.isArray(historyResp)
                ? historyResp
                : [];

            historyRows.forEach((row: any) => {
              const dateKey = parseHistoryDateKey(row);
              if (!dateKey || !weekKeys.has(dateKey)) return;
              byDate[dateKey] = (byDate[dateKey] || 0) + parseHistoryMinutes(row);
            });
          } catch (err) {
            console.warn(`⚠️ [UsageContext] App history fetch failed for ${appName}:`, err);
          }
        })
      );
    } catch (err) {
      console.warn('⚠️ [UsageContext] Could not build weekly from app history:', err);
    }

    return emptyWeek.map(item => ({
      ...item,
      minutes: Math.max(0, Number(byDate[item.date] || 0)),
    }));
  }, [user?.uid, currentDeviceId]);

  // ✅ Resolve device ID once when user changes
  useEffect(() => {
    const resolveDeviceId = async () => {
      console.log('🔍 [UsageContext] Device ID resolution started');
      
      if (!user?.uid) {
        console.log('⚠️ [UsageContext] No user UID available for device resolution');
        setCurrentDeviceId(null);
        return;
      }

      console.log('📱 [UsageContext] Resolving device ID for user:', user.uid);

      try {
        const resolvedId = await resolveCurrentDeviceId(user.uid);
        console.log('✅ [UsageContext] Device ID resolved:', {
          deviceId: resolvedId,
          isNull: resolvedId === null,
          isUndefined: resolvedId === undefined,
          type: typeof resolvedId,
        });
        setCurrentDeviceId(resolvedId || null);
      } catch (error) {
        console.error('❌ [UsageContext] Failed to resolve device ID:', {
          error: String(error),
          errorStack: error instanceof Error ? error.stack : 'N/A',
        });
        setCurrentDeviceId(null);
      }
    };

    resolveDeviceId();
  }, [user?.uid]);

  // ✅ Fetch total usage from backend
  const refetchTotalUsage = useCallback(
    async (forceRefresh = false) => {
      if (!user?.uid) {
        console.log('⚠️ [TotalUsage] Missing user UID for total usage fetch');
        setTotalUsage(null);
        setIsLoadingTotal(false);
        return;
      }

      setIsLoadingTotal(true);
      console.log('📊 [TotalUsage] Fetching total usage', { forceRefresh, userId: user.uid });

      try {
        console.log('🔄 [TotalUsage] Calling fetchTotalUsageWithCache...');
        const response = await fetchTotalUsageWithCache(user.uid, forceRefresh);
        
        console.log('✅ [TotalUsage] Response received:', {
          success: response.success,
          hasData: !!response.data,
          dataType: typeof response.data,
          errorMessage: response.errorMessage,
          fullResponse: JSON.stringify(response, null, 2),
        });

        setTotalUsage(response);
      } catch (error) {
        console.error('❌ [TotalUsage] Failed to fetch total usage:', {
          message: String(error),
          errorStack: error instanceof Error ? error.stack : 'N/A',
        });
        setTotalUsage({ success: false, data: null });
      } finally {
        setIsLoadingTotal(false);
      }
    },
    [user?.uid]
  );

  // ✅ Fetch weekly usage from backend
  const refetchWeeklyUsage = useCallback(
    async (forceRefresh = false) => {
      const now = Date.now();
      if (!forceRefresh && now < weeklyRetryBlockedUntilRef.current) {
        const remainingMs = weeklyRetryBlockedUntilRef.current - now;
        console.log('ℹ️ [WeeklyUsage] Skipping weekly fetch due to temporary retry backoff', {
          remainingMs,
        });
        setIsLoadingWeekly(false);
        return;
      }

      if (!user?.uid || !currentDeviceId) {
        console.log('⚠️ Missing user UID or device ID for weekly usage fetch');
        console.log('   user?.uid:', user?.uid);
        console.log('   currentDeviceId:', currentDeviceId);
        setWeeklyUsage([]);
        setIsLoadingWeekly(false);
        return;
      }

      setIsLoadingWeekly(true);
      console.log('📊 [UsageContext] Starting weekly usage fetch...');
      console.log('   userId:', user.uid);
      console.log('   deviceId:', currentDeviceId);

      try {
        console.log('🔄 [API] Calling getWeeklyUsageAPI()...');
        const response = await getWeeklyUsageAPI(user.uid, currentDeviceId);
        
        console.log('📦 [API Response] Raw response:', {
          hasResponse: !!response,
          hasData: !!response?.data,
          dataType: typeof response?.data,
          isArray: Array.isArray(response?.data),
          fullResponse: JSON.stringify(response, null, 2),
        });

        const responseErrorText = String(response?.error || response?.message || '');
        const isIndexMissingError =
          response?.success === false &&
          (responseErrorText.includes('FAILED_PRECONDITION') || responseErrorText.includes('requires an index'));

        if (isIndexMissingError) {
          const signature = `index-missing:${responseErrorText}`;
          if (lastWeeklyErrorSignatureRef.current !== signature) {
            lastWeeklyErrorSignatureRef.current = signature;
            console.warn('⚠️ [WeeklyUsage] Backend Firestore index is missing for weekly usage query.');
            console.warn('⚠️ [WeeklyUsage] Create the index from backend error message URL, then retry.');
          }

          setWeeklyError('Weekly API unavailable, showing history-based usage.');
          const historyWeek = await buildWeeklyFromHistory();
          const fallbackWithToday = await applyTodayUsageToWeek(historyWeek);
          setWeeklyUsage(fallbackWithToday);
          weeklyRetryBlockedUntilRef.current = Date.now() + 5 * 60 * 1000;
          setIsLoadingWeekly(false);
          return;
        }

        if (!response || !response.data) {
          console.warn('⚠️ [Validation] Weekly usage API returned invalid response');
          console.warn('   Response:', response);
          setWeeklyError('Weekly API returned empty response, showing history-based usage.');
          const historyWeek = await buildWeeklyFromHistory();
          const fallbackWithToday = await applyTodayUsageToWeek(historyWeek);
          setWeeklyUsage(fallbackWithToday);
          setIsLoadingWeekly(false);
          return;
        }

        setWeeklyError(null);
        weeklyRetryBlockedUntilRef.current = 0;
        lastWeeklyErrorSignatureRef.current = '';

        console.log('✅ [Validation] Response is valid, proceeding with transformation');

        const weekDates = getWeekDatesMondayToSunday();
        console.log('📅 [Computed] Week dates (Mon-Sun):', weekDates.map(formatDateKey));

        const dateToUsage: Record<string, number> = {};
        const dataItems = Array.isArray(response.data) ? response.data : [response.data];

        console.log('🔍 [Processing] Data items count:', dataItems.length);
        console.log('   Data items:', JSON.stringify(dataItems, null, 2));

        // Extract usage by date from backend response with improved field mapping
        const fieldMap: Record<number, { dateField: string; minutesField: string }> = {};
        
        dataItems.forEach((item: any, idx: number) => {
          const { date: dateField, fieldUsed: dateFieldName } = extractDate(item);
          const { minutes: minutesValue, fieldUsed: minutesFieldName } = extractUsageMinutes(item);

          fieldMap[idx] = { dateField: dateFieldName, minutesField: minutesFieldName };

          console.log(`   [Item ${idx}]`);
          console.log(`     Date field: "${dateField}" (from: ${dateFieldName})`);
          console.log(`     Minutes: ${minutesValue} (from: ${minutesFieldName})`);
          console.log(`     Raw item: ${JSON.stringify(item)}`);

          if (dateField && minutesValue >= 0) {
            // Ensure we're storing valid numbers
            const existingValue = dateToUsage[dateField] || 0;
            dateToUsage[dateField] = Math.max(existingValue, minutesValue);
            console.log(`     ✅ Stored: dateToUsage["${dateField}"] = ${minutesValue}`);
          } else {
            console.warn(`     ⚠️ Skipped: Invalid date="${dateField}" or minutes=${minutesValue}`);
          }
        });

        console.log('🗺️ [Field Mapping] Used field names:', fieldMap);
        console.log('📋 [Extracted] Date-to-usage map:', dateToUsage);
        console.log('   Total entries:', Object.keys(dateToUsage).length);
        console.log('   Entries with non-zero usage:', Object.entries(dateToUsage).filter(([_, m]) => m > 0).length);

        // Map 7 days to WeeklyUsagePoint format with validation
        const weeklyResults: WeeklyUsagePoint[] = weekDates.map(date => {
          const dateKey = formatDateKey(date);
          const rawMinutes = dateToUsage[dateKey];
          
          // Ensure we have a valid number
          const minutes = typeof rawMinutes === 'number' && !isNaN(rawMinutes) && rawMinutes >= 0
            ? rawMinutes
            : 0;

          const dayIndex = date.getDay();
          const label = DAY_NAMES[dayIndex]?.slice(0, 3) || 'Day';
          const fullLabel = DAY_NAMES[dayIndex] || 'Unknown';

          return {
            key: dateKey,
            label,
            fullLabel,
            date: dateKey,
            minutes: Math.max(0, minutes), // Ensure non-negative
          };
        });

        console.log('📊 [Transformed] Final weekly usage points:', JSON.stringify(weeklyResults, null, 2));
        console.log('📈 [Chart Summary]:', {
          totalPoints: weeklyResults.length,
          pointsWithData: weeklyResults.filter(p => p.minutes > 0).length,
          minMinutes: Math.min(...weeklyResults.map(p => p.minutes)),
          maxMinutes: Math.max(...weeklyResults.map(p => p.minutes)),
          allPointsValid: weeklyResults.every(p => 
            typeof p.minutes === 'number' && !isNaN(p.minutes) && p.minutes >= 0
          ),
        });

        const adjustedWeeklyResults = await applyTodayUsageToWeek(weeklyResults);
        setWeeklyUsage(adjustedWeeklyResults);
        console.log('✅ [State] Weekly usage state updated successfully');
      } catch (error) {
        console.error('❌ [Error] Failed to fetch weekly usage analytics:', error);
        console.error('   Error details:', {
          message: String(error),
          stack: error instanceof Error ? error.stack : 'N/A',
        });
        setWeeklyError('Failed to fetch weekly API, showing history-based usage.');
        const historyWeek = await buildWeeklyFromHistory();
        const fallbackWithToday = await applyTodayUsageToWeek(historyWeek);
        setWeeklyUsage(fallbackWithToday);
      } finally {
        setIsLoadingWeekly(false);
      }
    },
    [user?.uid, currentDeviceId, applyTodayUsageToWeek, buildWeeklyFromHistory]
  );

  // ✅ Refetch both total and weekly usage
  const refetchAllUsageData = useCallback(
    async (forceRefresh = false) => {
      console.log('🔄 [RefetchAll] Starting refetch of all usage data', { forceRefresh });
      setIsRefreshing(true);
      try {
        const startTime = Date.now();
        await Promise.all([
          refetchTotalUsage(forceRefresh),
          refetchWeeklyUsage(forceRefresh),
        ]);
        const elapsed = Date.now() - startTime;
        setLastRefreshTime(Date.now());
        console.log(`✅ [RefetchAll] All usage data refreshed successfully (${elapsed}ms)`);
      } catch (error) {
        console.error('❌ [RefetchAll] Error refreshing usage data:', error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [refetchTotalUsage, refetchWeeklyUsage]
  );

  // ✅ Invalidate cache and force refresh
  const invalidateCache = useCallback(() => {
    if (user?.uid) {
      console.log('🗑️ [Cache] Invalidating cache for user:', user.uid);
      clearTotalUsageCache(user.uid);
      console.log('🔄 [Cache] Triggering force refresh after cache invalidation');
      void refetchAllUsageData(true);
    } else {
      console.warn('⚠️ [Cache] Cannot invalidate cache - no user UID');
    }
  }, [user?.uid, refetchAllUsageData]);

  // ✅ Auto-refresh with polling
  const startAutoRefresh = useCallback(
    (intervalMs = 30000) => {
      if (isAutoRefreshingRef.current) {
        console.log('⚠️ [AutoRefresh] Already running, skipping duplicate start');
        return;
      }

      console.log(`🔄 [AutoRefresh] Starting auto-refresh polling (every ${intervalMs}ms)`);
      isAutoRefreshingRef.current = true;

      // Fetch immediately
      console.log('📊 [AutoRefresh] Initial fetch on start');
      void refetchAllUsageData();

      // Setup interval
      autoRefreshIntervalRef.current = setInterval(() => {
        console.log(`📊 [AutoRefresh] Polling triggered (interval: ${intervalMs}ms)`);
        void refetchAllUsageData();
      }, intervalMs);
    },
    [refetchAllUsageData]
  );

  // ✅ Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshIntervalRef.current) {
      console.log('⏹️ [AutoRefresh] Stopping auto-refresh polling');
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
      isAutoRefreshingRef.current = false;
      console.log('✅ [AutoRefresh] Auto-refresh stopped');
    } else {
      console.log('ℹ️ [AutoRefresh] No active auto-refresh to stop');
    }
  }, []);

  // ✅ Fetch once when user login + device resolved (no polling)
  useEffect(() => {
    if (!user?.uid || !currentDeviceId) {
      return;
    }

    console.log('🚀 [UsageContext] User/device ready, fetching usage once');
    void refetchAllUsageData(true);
  }, [user?.uid, currentDeviceId, refetchAllUsageData]);

  // ✅ Auto-refresh weekly graph on day change (midnight rollover)
  useEffect(() => {
    if (!user?.uid || !currentDeviceId) {
      return;
    }

    const scheduleNextDayRefresh = () => {
      if (dayRefreshTimeoutRef.current) {
        clearTimeout(dayRefreshTimeoutRef.current);
      }

      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());

      dayRefreshTimeoutRef.current = setTimeout(() => {
        console.log('🗓️ [UsageContext] Day changed, refreshing weekly usage');
        void refetchWeeklyUsage(true);
        scheduleNextDayRefresh();
      }, delay);
    };

    scheduleNextDayRefresh();

    return () => {
      if (dayRefreshTimeoutRef.current) {
        clearTimeout(dayRefreshTimeoutRef.current);
      }
    };
  }, [user?.uid, currentDeviceId, refetchWeeklyUsage]);

  const value: UsageContextType = {
    totalUsage,
    isLoadingTotal,
    weeklyUsage,
    isLoadingWeekly,
    weeklyError,
    isRefreshing,
    lastRefreshTime,
    currentDeviceId,
    refetchTotalUsage,
    refetchWeeklyUsage,
    refetchAllUsageData,
    invalidateCache,
    startAutoRefresh,
    stopAutoRefresh,
  };

  return (
    <UsageContext.Provider value={value}>
      {children}
    </UsageContext.Provider>
  );
};

export const useUsageContext = () => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsageContext must be used within UsageContextProvider');
  }
  return context;
};
