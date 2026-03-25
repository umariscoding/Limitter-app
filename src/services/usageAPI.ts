import { API } from "../config/config";
import axiosService from "./axiosService";

/**
 * Record usage for a policy.
 * Returns: { policyId, usageTodayMinutes, remainingMinutes, isExhaustedToday, sessionsTodayCount }
 */
export const recordUsageAPI = async (
  policyId: string,
  deviceId: string,
  durationSeconds: number,
) => {
  return await axiosService.post(API.UsageRecord, {
    policyId,
    deviceId,
    durationSeconds,
  });
};

/**
 * Get remaining time for a specific policy.
 * Returns: { policyId, dailyLimitMinutes, usageTodayMinutes, remainingMinutes, isExhaustedToday }
 */
export const getRemainingTimeAPI = async (policyId: string) => {
  return await axiosService.get(`${API.UsageRemaining}/${encodeURIComponent(policyId)}`);
};

/**
 * Get all usage targets for a specific date.
 * Returns: { dateKey, targets: DailyUsageTarget[] }
 */
export const getDailyUsageAPI = async (dateKey: string) => {
  return await axiosService.get(`${API.UsageDaily}/${encodeURIComponent(dateKey)}`);
};

/**
 * Get weekly usage (last 7 days).
 * Returns: { days: [{ dateKey, totalMinutes, targets }] }
 */
export const getWeeklyUsageAPI = async () => {
  return await axiosService.get(API.UsageWeekly);
};
