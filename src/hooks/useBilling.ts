import { useEffect, useRef, useState } from "react";
import {
  buyOverridePack,
  buySubscription,
  endBilling,
  fetchAvailableProducts,
  finishIAPTransaction,
  getPendingPurchases,
  getPurchaseToken,
  initBilling,
  Product,
  Purchase,
  Subscription,
} from "../services/billingService";
import {
  verifyPurchaseAPI,
  VerifyPurchaseResponse,
} from "../services/billingApi";
import { refreshBootstrap } from "../services/bootstrapService";
import { useUser } from "../context/UserContext";

export type PlanCode = "pro" | "elite";

const PLAN_TO_PRODUCT: Record<PlanCode, string> = {
  pro: "pro_monthly",
  elite: "elite_monthly",
};

export interface UseBillingState {
  connected: boolean;
  subscriptions: Subscription[];
  overrideProduct: Product | null;
  lastError: Error | null;
  buyOverrides: (count: number) => Promise<VerifyPurchaseResponse>;
  buyPlan: (planCode: PlanCode) => Promise<VerifyPurchaseResponse>;
  reloadProducts: () => Promise<void>;
}

export function useBilling(): UseBillingState {
  const { setAccountData } = useUser();
  const [connected, setConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [overrideProduct, setOverrideProduct] = useState<Product | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const setAccountDataRef = useRef(setAccountData);
  setAccountDataRef.current = setAccountData;

  const applyRefreshedDataRef = useRef(async () => {
    try {
      const data = await refreshBootstrap();
      setAccountDataRef.current(data);
    } catch (err: any) {
      console.warn(`[useBilling] post-purchase refresh failed: ${err?.message || err}`);
    }
  });

  const reloadProductsRef = useRef(async () => {
    try {
      const { subscriptions: subs, consumables } = await fetchAvailableProducts();
      if (!mountedRef.current) return;
      setSubscriptions(subs);
      setOverrideProduct(consumables[0] || null);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLastError(err);
    }
  });

  const replayPendingRef = useRef(async () => {
    try {
      const pending = await getPendingPurchases();
      let anyApplied = false;
      for (const purchase of pending) {
        const token = getPurchaseToken(purchase);
        const productId = purchase.productId;
        if (!token || !productId) continue;
        const type: "subscription" | "product" =
          productId === "override_1" ? "product" : "subscription";
        try {
          const result = await verifyPurchaseAPI({
            purchaseToken: token,
            productId,
            type,
          });
          await finishIAPTransaction(purchase, type === "product");
          if (result && !result.replay) anyApplied = true;
        } catch (err: any) {
          console.warn(
            `[useBilling] replay pending failed sku=${productId}: ${err?.message || err}`,
          );
        }
      }
      if (anyApplied) {
        await applyRefreshedDataRef.current();
      }
    } catch (err: any) {
      console.warn(`[useBilling] replayPending failed: ${err?.message || err}`);
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        await initBilling();
        if (!mountedRef.current) return;
        setConnected(true);
        await reloadProductsRef.current();
        await replayPendingRef.current();
      } catch (err: any) {
        if (!mountedRef.current) return;
        setLastError(err);
        setConnected(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      endBilling().catch(() => {});
    };
  }, []);

  const buyOverridesRef = useRef(async (count: number): Promise<VerifyPurchaseResponse> => {
    setLastError(null);
    const purchase: Purchase = await buyOverridePack(count);
    const token = getPurchaseToken(purchase);
    if (!token) {
      throw new Error("Missing purchase token from Play Billing");
    }

    let result: VerifyPurchaseResponse;
    try {
      result = await verifyPurchaseAPI({
        purchaseToken: token,
        productId: "override_1",
        type: "product",
      });
    } catch (err: any) {
      setLastError(err);
      throw err;
    }

    await finishIAPTransaction(purchase, true);
    await applyRefreshedDataRef.current();

    return result;
  });

  const buyPlanRef = useRef(async (planCode: PlanCode): Promise<VerifyPurchaseResponse> => {
    setLastError(null);
    const productId = PLAN_TO_PRODUCT[planCode];
    if (!productId) {
      throw new Error(`Unsupported plan: ${planCode}`);
    }

    const purchase: Purchase = await buySubscription(productId);
    const token = getPurchaseToken(purchase);
    if (!token) {
      throw new Error("Missing purchase token from Play Billing");
    }

    let result: VerifyPurchaseResponse;
    try {
      result = await verifyPurchaseAPI({
        purchaseToken: token,
        productId,
        type: "subscription",
      });
    } catch (err: any) {
      setLastError(err);
      throw err;
    }

    await finishIAPTransaction(purchase, false);
    await applyRefreshedDataRef.current();

    return result;
  });

  return {
    connected,
    subscriptions,
    overrideProduct,
    lastError,
    buyOverrides: buyOverridesRef.current,
    buyPlan: buyPlanRef.current,
    reloadProducts: reloadProductsRef.current,
  };
}
