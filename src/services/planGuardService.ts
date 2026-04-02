import { API } from "../config/config";
import axiosService from "./axiosService";

export interface PlanLimits {
  planCode: string;
  maxPolicies: number | null;
  currentPolicies: number;
  policiesRemaining: number | null;
  maxDevices: number;
  currentDevices: number;
  devicesRemaining: number;
  customTimers: boolean;
  freeOverridesPerMonth: number;
  overrideCostUsd: number;
}

let cachedLimits: PlanLimits | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

const fetchFresh = async (): Promise<PlanLimits> => {
  const data = await axiosService.get<PlanLimits>(API.PlanLimits);
  cachedLimits = data;
  cacheTimestamp = Date.now();
  return data;
};

export const getPlanLimits = async (forceRefresh = false): Promise<PlanLimits> => {
  if (!forceRefresh && cachedLimits && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedLimits;
  }
  return fetchFresh();
};

export const invalidatePlanCache = () => {
  cachedLimits = null;
  cacheTimestamp = 0;
};

export const canCreatePolicy = async (): Promise<{
  allowed: boolean;
  reason?: string;
  limits: PlanLimits;
}> => {
  const limits = await getPlanLimits();

  if (limits.maxPolicies !== null && limits.policiesRemaining !== null && limits.policiesRemaining <= 0) {
    return {
      allowed: false,
      reason: `Your ${limits.planCode.toUpperCase()} plan allows ${limits.maxPolicies} limits. Upgrade for more.`,
      limits,
    };
  }

  return { allowed: true, limits };
};

export const canRegisterDevice = async (): Promise<{
  allowed: boolean;
  reason?: string;
  limits: PlanLimits;
}> => {
  const limits = await getPlanLimits();

  if (limits.devicesRemaining <= 0) {
    return {
      allowed: false,
      reason: `Your ${limits.planCode.toUpperCase()} plan allows ${limits.maxDevices} device${limits.maxDevices > 1 ? 's' : ''}. Upgrade for more.`,
      limits,
    };
  }

  return { allowed: true, limits };
};

export const canUseCustomTimers = async (): Promise<boolean> => {
  const limits = await getPlanLimits();
  return limits.customTimers;
};

export const enforceDailyLimitMinutes = async (requestedMinutes: number): Promise<number> => {
  const limits = await getPlanLimits();
  if (!limits.customTimers) return 60;
  return requestedMinutes;
};

export const getPlanCode = async (): Promise<string> => {
  const limits = await getPlanLimits();
  return limits.planCode;
};

export const upgradePlanAPI = async (
  planCode: "free" | "pro" | "elite",
): Promise<{ accountId: string; planCode: string }> => {
  const result = await axiosService.post<{ accountId: string; planCode: string }>(
    API.UpgradePlan,
    { planCode },
  );
  invalidatePlanCache();
  return result;
};
