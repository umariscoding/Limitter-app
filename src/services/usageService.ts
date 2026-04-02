import { API } from "../config/config";
import axiosService from "./axiosService";

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
