import { Platform } from "react-native";
import * as RNIap from "react-native-iap";

export type Purchase = RNIap.Purchase;
export type Subscription = RNIap.Subscription;
export type Product = RNIap.Product;

export const SUBSCRIPTION_SKUS = ["pro_monthly", "elite_monthly"] as const;
export const CONSUMABLE_SKUS = ["override_1"] as const;

const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

let initialized = false;
let updateSub: ReturnType<typeof RNIap.purchaseUpdatedListener> | null = null;
let errorSub: ReturnType<typeof RNIap.purchaseErrorListener> | null = null;
let pending: {
  resolve: (p: Purchase) => void;
  reject: (e: Error) => void;
  sku?: string;
  timer?: ReturnType<typeof setTimeout>;
} | null = null;

function clearPending() {
  if (pending?.timer) clearTimeout(pending.timer);
  pending = null;
}

function handlePurchaseUpdate(purchase: Purchase) {
  if (!pending) return;
  if (pending.sku && purchase.productId && purchase.productId !== pending.sku) {
    return;
  }
  const { resolve } = pending;
  clearPending();
  resolve(purchase);
}

function handlePurchaseError(error: any) {
  if (!pending) return;
  const { reject } = pending;
  clearPending();
  const err: any = new Error(error?.message || "Purchase failed");
  err.code = error?.code;
  reject(err);
}

function attachListeners() {
  if (updateSub || errorSub) return;
  updateSub = RNIap.purchaseUpdatedListener(handlePurchaseUpdate);
  errorSub = RNIap.purchaseErrorListener(handlePurchaseError);
}

function detachListeners() {
  if (updateSub) {
    updateSub.remove();
    updateSub = null;
  }
  if (errorSub) {
    errorSub.remove();
    errorSub = null;
  }
}

export async function initBilling(): Promise<void> {
  if (initialized) return;
  if (Platform.OS !== "android") return;
  await RNIap.initConnection();
  attachListeners();
  initialized = true;
}

export async function endBilling(): Promise<void> {
  if (!initialized) return;
  detachListeners();
  try {
    await RNIap.endConnection();
  } catch {}
  initialized = false;
  clearPending();
}

export async function fetchAvailableProducts(): Promise<{
  subscriptions: Subscription[];
  consumables: Product[];
}> {
  if (Platform.OS !== "android") {
    return { subscriptions: [], consumables: [] };
  }
  const [subs, consumables] = await Promise.all([
    RNIap.getSubscriptions({ skus: [...SUBSCRIPTION_SKUS] }),
    RNIap.getProducts({ skus: [...CONSUMABLE_SKUS] }),
  ]);
  return { subscriptions: subs, consumables };
}

export async function getPendingPurchases(): Promise<Purchase[]> {
  if (Platform.OS !== "android") return [];
  try {
    return await RNIap.getAvailablePurchases();
  } catch {
    return [];
  }
}

function waitForPurchase(sku: string): Promise<Purchase> {
  if (pending) {
    clearPending();
  }
  return new Promise<Purchase>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending && pending.timer === timer) {
        clearPending();
        reject(new Error("Purchase timed out"));
      }
    }, PURCHASE_TIMEOUT_MS);
    pending = { resolve, reject, sku, timer };
  });
}

export async function buySubscription(productId: string): Promise<Purchase> {
  if (Platform.OS !== "android") {
    throw new Error("Subscriptions are Android-only in this build");
  }
  if (!initialized) await initBilling();

  const subs = await RNIap.getSubscriptions({ skus: [productId] });
  const sub = subs[0] as RNIap.SubscriptionAndroid | undefined;
  const offerToken = sub?.subscriptionOfferDetails?.[0]?.offerToken;

  const purchasePromise = waitForPurchase(productId);

  const options: RNIap.RequestSubscriptionAndroid = {
    sku: productId,
    ...(offerToken
      ? { subscriptionOffers: [{ sku: productId, offerToken }] }
      : {}),
  } as any;

  await RNIap.requestSubscription(options);
  return purchasePromise;
}

export async function buyOverridePack(count: number): Promise<Purchase> {
  if (Platform.OS !== "android") {
    throw new Error("In-app purchases are Android-only in this build");
  }
  if (!initialized) await initBilling();

  const capped = Math.max(1, Math.min(20, Math.floor(count)));
  const purchasePromise = waitForPurchase("override_1");

  await RNIap.requestPurchase({
    sku: "override_1",
    quantity: capped,
  } as any);

  return purchasePromise;
}

export async function finishIAPTransaction(
  purchase: Purchase,
  isConsumable: boolean,
): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await RNIap.finishTransaction({ purchase, isConsumable });
  } catch (err: any) {
    console.warn(
      `[billingService] finishTransaction failed sku=${purchase.productId}: ${err?.message || err}`,
    );
  }
}

export function getPurchaseToken(purchase: Purchase): string | null {
  const anyPurchase = purchase as any;
  return (
    anyPurchase.purchaseToken ||
    anyPurchase.purchaseTokenAndroid ||
    null
  );
}
