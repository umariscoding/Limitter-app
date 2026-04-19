import { Platform } from "react-native";
import type { BillingProvider, BillingPurchase, BillingProducts, PlanCode } from "./types";
import { GoogleProvider } from "./googleProvider";
import { AppleProvider } from "./appleProvider";
import { SUBSCRIPTION_SKUS, CONSUMABLE_SKUS, OVERRIDE_SKU, skuToPlan, isSubscriptionSku } from "./skus";

let provider: BillingProvider | null = null;
let initialized = false;

function getProvider(): BillingProvider {
  if (!provider) {
    provider = Platform.OS === "ios" ? new AppleProvider() : new GoogleProvider();
  }
  return provider;
}

export async function initBilling(): Promise<void> {
  if (initialized) return;
  await getProvider().init();
  initialized = true;
}

export async function endBilling(): Promise<void> {
  if (!initialized) return;
  await getProvider().end();
  initialized = false;
}

export async function fetchAvailableProducts(): Promise<BillingProducts> {
  return getProvider().getProducts(SUBSCRIPTION_SKUS, CONSUMABLE_SKUS);
}

export async function getActivePurchases(): Promise<BillingPurchase[]> {
  return getProvider().getActivePurchases();
}

export async function buySubscription(productId: string): Promise<BillingPurchase> {
  if (!initialized) await initBilling();
  return getProvider().buySubscription(productId);
}

export async function buyConsumable(productId: string): Promise<BillingPurchase> {
  if (!initialized) await initBilling();
  return getProvider().buyConsumable(productId);
}

export async function finishPurchase(purchase: BillingPurchase, isConsumable: boolean): Promise<void> {
  return getProvider().finishPurchase(purchase, isConsumable);
}

export { SUBSCRIPTION_SKUS, CONSUMABLE_SKUS, OVERRIDE_SKU, skuToPlan, isSubscriptionSku };
export { planToSku, isConsumableSku } from "./skus";
export type { BillingProvider, BillingProduct, BillingPurchase, BillingProducts, PlanCode } from "./types";
