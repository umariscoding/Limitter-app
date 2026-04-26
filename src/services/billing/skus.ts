import { Platform } from "react-native";
import type { BillingCycle, PlanCode } from "./types";

interface SubMeta {
  plan: PlanCode;
  cycle: BillingCycle;
}

const GOOGLE_SUBS: Record<string, SubMeta> = {
  pro_monthly: { plan: "pro", cycle: "monthly" },
  pro_yearly: { plan: "pro", cycle: "yearly" },
  elite_monthly: { plan: "elite", cycle: "monthly" },
  elite_yearly: { plan: "elite", cycle: "yearly" },
  ultra_elite_monthly: { plan: "ultra_elite", cycle: "monthly" },
  ultra_elite_yearly: { plan: "ultra_elite", cycle: "yearly" },
};

const APPLE_SUBS: Record<string, SubMeta> = {
  pro_monthly: { plan: "pro", cycle: "monthly" },
  pro_yearly: { plan: "pro", cycle: "yearly" },
  elite_monthly: { plan: "elite", cycle: "monthly" },
  elite_yearly: { plan: "elite", cycle: "yearly" },
  ultra_elite_monthly: { plan: "ultra_elite", cycle: "monthly" },
  ultra_elite_yearly: { plan: "ultra_elite", cycle: "yearly" },
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
  return SKU_MAP.subs[productId]?.plan ?? "free";
}

export function skuToPlanCycle(productId: string): SubMeta | null {
  return SKU_MAP.subs[productId] ?? null;
}

export function planToSku(plan: PlanCode, cycle: BillingCycle = "monthly"): string | null {
  const entry = Object.entries(SKU_MAP.subs).find(
    ([, meta]) => meta.plan === plan && meta.cycle === cycle
  );
  return entry ? entry[0] : null;
}

export function isSubscriptionSku(productId: string): boolean {
  return productId in SKU_MAP.subs;
}

export function isConsumableSku(productId: string): boolean {
  return SKU_MAP.consumables.includes(productId as any);
}
