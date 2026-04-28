import AsyncStorage from '@react-native-async-storage/async-storage';
import { API } from "../config/config";
import axiosService from "./axiosService";

const POLICY_CACHE_KEY = '@limitter_cached_policies';

export const createPolicyAPI = async (data: {
  type: "website" | "app" | "category";
  targetKey: string;
  targetLabel: string;
  dailyLimitMinutes: number;
  scope?: "account" | "device";
  deviceIds?: string[];
  warningThresholds?: number[];
  lockMode?: "until_reset" | "duration" | "until_time";
  overrideEnabled?: boolean;
  dailyResetTimeLocal?: string;
  lockUntilTimestampMs?: number | null;
}) => {
  return await axiosService.post(API.Policies, data);
};

export const getCachedPolicies = async (): Promise<any | null> => {
  try {
    const cached = await AsyncStorage.getItem(POLICY_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const getPoliciesAPI = async () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await axiosService.get(`${API.Policies}?timezone=${encodeURIComponent(tz)}`);
    AsyncStorage.setItem(POLICY_CACHE_KEY, JSON.stringify(result)).catch(() => {});
    return result;
  } catch (error) {
    const cached = await getCachedPolicies();
    if (cached) return cached;
    throw error;
  }
};

export const getPolicyAPI = async (policyId: string) => {
  return await axiosService.get(`${API.Policies}/${policyId}`);
};

export const updatePolicyAPI = async (
  policyId: string,
  data: {
    dailyLimitMinutes?: number;
    targetLabel?: string;
    warningThresholds?: number[];
    lockMode?: string;
    overrideEnabled?: boolean;
    dailyResetTimeLocal?: string;
    lockUntilTimestampMs?: number | null;
  },
) => {
  return await axiosService.put(`${API.Policies}/${policyId}`, data);
};

// Manually lock a policy immediately. Optional untilTimestampMs overrides the
// policy's default end time for this single lock event.
export interface LockNowResponse {
  policy: any;
  policyState: any;
  blockedUntil: number;
}

export const lockNowAPI = async (
  policyId: string,
  untilTimestampMs?: number | null,
): Promise<LockNowResponse> => {
  const body: Record<string, any> = {};
  if (untilTimestampMs) body.untilTimestampMs = untilTimestampMs;
  return await axiosService.post<LockNowResponse>(
    `${API.Policies}/${policyId}/lock-now`,
    body,
  );
};

export const archivePolicyAPI = async (policyId: string) => {
  return await axiosService.delete(`${API.Policies}/${policyId}`);
};

export const restorePolicyAPI = async (policyId: string) => {
  return await axiosService.post(`${API.Policies}/${policyId}/restore`);
};

export const archiveAllPoliciesAPI = async () => {
  const policies = await getPoliciesAPI() as any[];
  const active = (policies || []).filter((p: any) => {
    const policy = p.policy || p;
    return policy.isActive && !policy.isArchived;
  });
  for (const p of active) {
    const id = (p.policy || p).policyId || p.id;
    if (id) await archivePolicyAPI(id);
  }
};
