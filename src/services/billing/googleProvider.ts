import * as RNIap from "react-native-iap";
import type {
  BillingProvider,
  BillingProduct,
  BillingPurchase,
  BillingProducts,
} from "./types";

const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

let updateSub: RNIap.EventSubscription | null = null;
let errorSub: RNIap.EventSubscription | null = null;
let pending: {
  resolve: (p: RNIap.Purchase) => void;
  reject: (e: Error) => void;
  sku?: string;
  timer?: ReturnType<typeof setTimeout>;
} | null = null;

function clearPending() {
  if (pending?.timer) clearTimeout(pending.timer);
  pending = null;
}

function handlePurchaseUpdate(purchase: RNIap.Purchase) {
  if (!pending) return;
  if (pending.sku && purchase.productId && purchase.productId !== pending.sku) return;
  const { resolve } = pending;
  clearPending();
  resolve(purchase);
}

function handlePurchaseError(error: RNIap.PurchaseError) {
  if (!pending) return;
  const { reject } = pending;
  clearPending();
  const err: any = new Error(error?.message || "Purchase failed");
  err.code = error?.code;
  reject(err);
}

function waitForPurchase(sku: string): Promise<RNIap.Purchase> {
  if (pending) clearPending();
  return new Promise<RNIap.Purchase>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending && pending.timer === timer) {
        clearPending();
        reject(new Error("Purchase timed out"));
      }
    }, PURCHASE_TIMEOUT_MS);
    pending = { resolve, reject, sku, timer };
  });
}

function mapPurchase(p: RNIap.Purchase): BillingPurchase {
  const anyP = p as any;
  return {
    productId: p.productId,
    token: anyP.purchaseToken || anyP.purchaseTokenAndroid || anyP.transactionReceipt || null,
    raw: p,
  };
}

function mapProduct(p: any): BillingProduct {
  return {
    id: p.productId,
    title: p.title || p.name || "",
    price: p.localizedPrice || p.oneTimePurchaseOfferDetails?.formattedPrice || "",
    currency: p.currency || "",
    offerToken: p.subscriptionOfferDetailsAndroid?.[0]?.offerToken,
    raw: p,
  };
}

export class GoogleProvider implements BillingProvider {
  async init(): Promise<void> {
    await RNIap.initConnection();
    try {
      const stale = await RNIap.getAvailablePurchases();
      for (const p of stale) {
        const isConsumable = !p.productId || !["pro_monthly", "elite_monthly"].includes(p.productId);
        try {
          await RNIap.finishTransaction({ purchase: p, isConsumable });
        } catch {}
      }
    } catch {}
    if (!updateSub && !errorSub) {
      updateSub = RNIap.purchaseUpdatedListener(handlePurchaseUpdate);
      errorSub = RNIap.purchaseErrorListener(handlePurchaseError);
    }
  }

  async end(): Promise<void> {
    if (updateSub) { updateSub.remove(); updateSub = null; }
    if (errorSub) { errorSub.remove(); errorSub = null; }
    try { await RNIap.endConnection(); } catch {}
    clearPending();
  }

  async getProducts(
    subscriptionSkus: string[],
    consumableSkus: string[],
  ): Promise<BillingProducts> {
    const [subResult, consumableResult] = await Promise.all([
      RNIap.fetchProducts({ skus: subscriptionSkus, type: "subs" }),
      RNIap.fetchProducts({ skus: consumableSkus, type: "in-app" }),
    ]);
    const subAny = subResult as any;
    const conAny = consumableResult as any;
    const subscriptions = (subAny?.subscriptions ?? []).map(mapProduct);
    const consumables = (conAny?.products ?? []).map(mapProduct);
    return { subscriptions, consumables };
  }

  async getActivePurchases(): Promise<BillingPurchase[]> {
    try {
      const purchases = await RNIap.getAvailablePurchases();
      return purchases.map(mapPurchase);
    } catch {
      return [];
    }
  }

  async buySubscription(productId: string): Promise<BillingPurchase> {
    const result = await RNIap.fetchProducts({
      skus: [productId],
      type: "subs",
    });
    const sub = (result as any)?.subscriptions?.[0] as any;
    const offerToken = sub?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;

    let existingToken: string | undefined;
    try {
      const active = await RNIap.getAvailablePurchases();
      const existingSub = active.find(
        (p) =>
          p.productId !== productId &&
          ["pro_monthly", "elite_monthly"].includes(p.productId || ""),
      );
      if (existingSub) {
        const anyP = existingSub as any;
        existingToken = anyP.purchaseToken || anyP.purchaseTokenAndroid || undefined;
      }
    } catch {}

    const googleRequest: any = {
      skus: [productId],
      ...(offerToken ? { offerToken } : {}),
    };
    if (existingToken) {
      googleRequest.purchaseTokenAndroid = existingToken;
      googleRequest.prorationModeAndroid = 1;
    }

    const purchasePromise = waitForPurchase(productId);
    await RNIap.requestPurchase({
      request: { google: googleRequest },
      type: "subs",
    });
    return mapPurchase(await purchasePromise);
  }

  async buyConsumable(productId: string): Promise<BillingPurchase> {
    const purchasePromise = waitForPurchase(productId);
    await RNIap.requestPurchase({
      request: { google: { skus: [productId] } },
      type: "in-app",
    });
    return mapPurchase(await purchasePromise);
  }

  async finishPurchase(purchase: BillingPurchase, isConsumable: boolean): Promise<void> {
    try {
      await RNIap.finishTransaction({ purchase: purchase.raw, isConsumable });
    } catch (err: any) {
      console.warn(`[GoogleProvider] finishTransaction failed sku=${purchase.productId}: ${err?.message || err}`);
    }
  }
}