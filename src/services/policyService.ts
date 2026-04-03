import { API } from "../config/config";
import axiosService from "./axiosService";

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
}) => {
  return await axiosService.post(API.Policies, data);
};

export const getPoliciesAPI = async () => {
  return await axiosService.get(API.Policies);
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
  },
) => {
  return await axiosService.put(`${API.Policies}/${policyId}`, data);
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
