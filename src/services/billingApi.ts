import { API } from "../config/config";
import axiosService from "./axiosService";

export type BillingProductType = "subscription" | "product";

export interface VerifyPurchasePayload {
  purchaseToken: string;
  productId: string;
  type: BillingProductType;
}

export interface PurchaseRecordResponse {
  purchaseToken: string;
  productId: string;
  productType: BillingProductType;
  status: "verified" | "applied" | "consumed" | "revoked" | "failed";
  appliedCredits: number | null;
  orderId: string | null;
  purchaseTimeMillis: number | null;
  quantity: number;
}

export interface SubscriptionStateResponse {
  planCode: "free" | "pro" | "elite";
  status: string;
  provider: "google_play" | null;
  productId: string | null;
  autoRenewing: boolean;
  expiryTimeMillis: number | null;
  startTimeMillis: number | null;
  lastVerifiedAt: any;
}

export interface VerifyPurchaseResponse {
  replay: boolean;
  purchase: PurchaseRecordResponse;
  subscription: SubscriptionStateResponse | null;
  appliedCredits: number | null;
}

export interface ListPurchasesResponse {
  purchases: PurchaseRecordResponse[];
  count: number;
  nextCursor: string | null;
}

export const verifyPurchaseAPI = async (
  payload: VerifyPurchasePayload,
): Promise<VerifyPurchaseResponse> => {
  return await axiosService.post<VerifyPurchaseResponse>(
    API.BillingVerifyPurchase,
    payload,
  );
};

export const refreshBillingAPI = async (): Promise<{
  subscription: SubscriptionStateResponse | null;
}> => {
  return await axiosService.post<{ subscription: SubscriptionStateResponse | null }>(
    API.BillingRefresh,
  );
};

export const listPurchasesAPI = async (
  limit = 50,
  cursor?: string,
): Promise<ListPurchasesResponse> => {
  const parts = [`limit=${encodeURIComponent(String(limit))}`];
  if (cursor) parts.push(`cursor=${encodeURIComponent(cursor)}`);
  return await axiosService.get<ListPurchasesResponse>(
    `${API.BillingPurchases}?${parts.join("&")}`,
  );
};

export const registerFcmTokenAPI = async (
  deviceId: string,
  fcmToken: string,
): Promise<{ success: boolean }> => {
  return await axiosService.post<{ success: boolean }>(API.DeviceFcmToken, {
    deviceId,
    fcmToken,
  });
};
