import { API } from "../config/config";
import axiosService from "./axiosService";

export interface OverrideBalanceResponse {
  planCode: string;
  unlimited: boolean;
  freeOverridesPerMonth: number;
  freeUsedThisMonth: number;
  freeRemaining: number;
  grantedCredits: number;
  grantedUsed: number;
  grantedRemaining: number;
  totalAvailable: number;
  overrideCostUsd: number;
  totalUsedThisMonth: number;
  totalAmountSpentThisMonth: number;
}

export interface OverrideRecordResponse {
  overrideId: string;
  accountId: string;
  deviceId: string;
  policyId: string;
  dateKey: string;
  targetKey: string;
  type: string;
  source: string;
  mode: string;
  status: string;
  activatedAt: any;
  createdAt: any;
}

export interface OverrideHistoryResponse {
  overrides: OverrideRecordResponse[];
  count: number;
  nextCursor: string | null;
}

export const useOverrideAPI = async (
  policyId: string,
  deviceId: string,
): Promise<OverrideRecordResponse> => {
  return await axiosService.post<OverrideRecordResponse>(API.OverrideUse, {
    policyId,
    deviceId,
  });
};

export const getOverrideBalanceAPI = async (): Promise<OverrideBalanceResponse> => {
  return await axiosService.get<OverrideBalanceResponse>(API.OverrideBalance);
};

export const getOverrideHistoryAPI = async (
  limit = 50,
  cursor?: string,
): Promise<OverrideHistoryResponse> => {
  const query = `limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
  return await axiosService.get<OverrideHistoryResponse>(
    `${API.OverrideHistory}?${query}`,
  );
};
