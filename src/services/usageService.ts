import { API } from "../config/config";
import axiosService from "./axiosService";
import { realtimeDB } from "../config/firebase";
import { ref, get } from "firebase/database";

export interface UsageRecordResponse {
  policyId: string;
  usageTodayMinutes: number;
  remainingMinutes: number;
  isExhaustedToday: boolean;
  sessionsTodayCount: number;
}

export interface UsageRemainingResponse {
  policyId: string;
  dailyLimitMinutes: number;
  usageTodayMinutes: number;
  remainingMinutes: number;
  isExhaustedToday: boolean;
}

export interface UsageTickResponse {
  policyId: string;
  accumulatedSeconds: number;
  totalUsageSeconds: number;
  limitSeconds: number;
  remainingSeconds: number;
  isExhausted: boolean;
  wasReset?: boolean;
}

export const tickUsageAPI = async (data: {
  policyId: string;
  deviceId: string;
  accumulatedSeconds: number;
  deltaSeconds: number;
  limitSeconds: number;
  targetKey: string;
}): Promise<UsageTickResponse> => {
  return await axiosService.post<UsageTickResponse>(API.UsageTick, data);
};

export const recordUsageAPI = async (
  policyId: string,
  deviceId: string,
  durationSeconds: number,
): Promise<UsageRecordResponse> => {
  return await axiosService.post<UsageRecordResponse>(API.UsageRecord, {
    policyId,
    deviceId,
    durationSeconds,
  });
};

export const getRemainingAPI = async (
  policyId: string,
): Promise<UsageRemainingResponse> => {
  return await axiosService.get<UsageRemainingResponse>(
    `${API.UsageRemaining}/${policyId}`,
  );
};

export interface WeeklyDay {
  dateKey: string;
  totalMinutes: number;
}

export const getWeeklyUsageAPI = async (accountId?: string): Promise<WeeklyDay[]> => {
  const result = await axiosService.get<{ days: WeeklyDay[] }>(API.UsageWeekly);
  const days = result.days || [];

  // Merge live Realtime DB usage into today's bar
  if (accountId && days.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const todayIdx = days.findIndex(d => d.dateKey === today);
    if (todayIdx !== -1) {
      const liveMinutes = await getLiveTodayMinutes(accountId, today);
      if (liveMinutes > days[todayIdx].totalMinutes) {
        days[todayIdx].totalMinutes = liveMinutes;
      }
    }
  }

  return days;
};

async function getLiveTodayMinutes(accountId: string, todayKey: string): Promise<number> {
  try {
    const totalsRef = ref(realtimeDB, `live/accounts/${accountId}/usageTotals`);
    const snapshot = await get(totalsRef);
    if (!snapshot.exists()) return 0;

    const totals = snapshot.val() as Record<string, {
      totalSeconds?: number;
      dateKey?: string;
    }>;

    let liveSeconds = 0;
    for (const policyId in totals) {
      const entry = totals[policyId];
      if (entry.dateKey === todayKey && entry.totalSeconds) {
        liveSeconds += entry.totalSeconds;
      }
    }

    return Math.round(liveSeconds / 60);
  } catch (err: any) {
    console.error(`[UsageService] Error fetching live today minutes for account ${accountId}:`, err?.message || err);
    return 0;
  }
}
