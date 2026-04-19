import { Platform } from "react-native";
import type { PlanCode } from "./types";

const GOOGLE_SUBS: Record<string, PlanCode> = {
  pro_monthly: "pro",
  elite_monthly: "elite",
};

const APPLE_SUBS: Record<string, PlanCode> = {
  pro_monthly: "pro",
  elite_monthly: "elite",
};

const GOOGLE_CONSUMABLES = ["override_1"] as const;
const APPLE_CONSUMABLES = ["override_1"] as const;

const SKU_MAP = Platform.OS === "ios"
  ? { subs: APPLE_SUBS, consumables: [...APPLE_CONSUMABLES] }
  : { subs: GOOGLE_SUBS, consumables: [...GOOGLE_CONSUMABLES] };

export const SUBSCRIPTION_SKUS = Object.keys(SKU_MAP.subs);
export const CONSUMABLE_SKUS = SKU_MAP.consumables;
export const OVERRIDE_SKU = SKU_MAP.consumables[0];

export function skuToPlan(productId: string): PlanCode {
  return SKU_MAP.subs[productId] ?? "free";
}

export function planToSku(plan: PlanCode): string | null {
  const entry = Object.entries(SKU_MAP.subs).find(([, p]) => p === plan);
  return entry ? entry[0] : null;
}

export function isSubscriptionSku(productId: string): boolean {
  return productId in SKU_MAP.subs;
}

export function isConsumableSku(productId: string): boolean {
  return SKU_MAP.consumables.includes(productId as any);
}
