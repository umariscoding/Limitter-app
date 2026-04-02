import { API } from "../config/config";
import axiosService from "./axiosService";

export interface OverrideBalanceResponse {
  planCode: string;
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

export const grantOverrideCreditsAPI = async (
  credits: number,
): Promise<{ grantedCredits: number; grantedRemaining: number }> => {
  return await axiosService.post(API.OverrideGrant, { credits });
};

export const getOverrideBalanceAPI = async (): Promise<OverrideBalanceResponse> => {
  return await axiosService.get<OverrideBalanceResponse>(API.OverrideBalance);
};

export const getOverrideHistoryAPI = async (
  limit = 50,
  offset = 0,
): Promise<OverrideHistoryResponse> => {
  return await axiosService.get<OverrideHistoryResponse>(
    `${API.OverrideHistory}?limit=${limit}&offset=${offset}`,
  );
};
