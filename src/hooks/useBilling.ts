import { useEffect, useRef, useState } from "react";
import {
  buyConsumable,
  buySubscription,
  endBilling,
  fetchAvailableProducts,
  finishPurchase,
  getActivePurchases,
  getActiveSubscriptionPlan,
  initBilling,
  OVERRIDE_SKU,
  skuToPlan,
  isSubscriptionSku,
} from "../services/billing";
import type { BillingProduct, BillingPurchase, PlanCode } from "../services/billing";
import {
  verifyPurchaseAPI,
  VerifyPurchaseResponse,
} from "../services/billingApi";
import { refreshBootstrap } from "../services/bootstrapService";
import { useUser } from "../context/UserContext";

export type { PlanCode } from "../services/billing";

const PLAN_TO_SKU: Record<string, string> = {
  pro: "pro_monthly",
  elite: "elite_monthly",
};

export interface UseBillingState {
  connected: boolean;
  playStorePlan: PlanCode;
  subscriptions: BillingProduct[];
  overrideProduct: BillingProduct | null;
  lastError: Error | null;
  buyOverrides: (count: number) => Promise<VerifyPurchaseResponse>;
  buyPlan: (planCode: PlanCode) => Promise<VerifyPurchaseResponse>;
  reloadProducts: () => Promise<void>;
}

export function useBilling(): UseBillingState {
  const { setAccountData, updateUser } = useUser();
  const [connected, setConnected] = useState(false);
  const [subscriptions, setSubscriptions] = useState<BillingProduct[]>([]);
  const [overrideProduct, setOverrideProduct] = useState<BillingProduct | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [playStorePlan, setPlayStorePlan] = useState<PlanCode>("free");
  const mountedRef = useRef(true);
  const setAccountDataRef = useRef(setAccountData);
  setAccountDataRef.current = setAccountData;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

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
      const pending = await getActivePurchases();
      let anyApplied = false;
      for (const purchase of pending) {
        if (!purchase.token || !purchase.productId) continue;
        const type = isSubscriptionSku(purchase.productId) ? "subscription" as const : "product" as const;
        const isConsumable = type === "product";
        try {
          const result = await verifyPurchaseAPI({
            purchaseToken: purchase.token,
            productId: purchase.productId,
            type,
          });
          await finishPurchase(purchase, isConsumable);
          if (result && !result.replay) anyApplied = true;
        } catch (err: any) {
          console.warn(`[useBilling] replay pending failed sku=${purchase.productId}: ${err?.message || err}`);
          try {
            await finishPurchase(purchase, isConsumable);
          } catch {}
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
        const plan = await getActiveSubscriptionPlan();
        if (mountedRef.current) {
          setPlayStorePlan(plan);
          if (plan !== "free") {
            updateUserRef.current({ plan, planCode: plan });
          }
        }
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
    const purchase = await buyConsumable(OVERRIDE_SKU);
    if (!purchase.token) throw new Error("Missing purchase token from billing");

    await finishPurchase(purchase, true);

    let result: VerifyPurchaseResponse;
    try {
      result = await verifyPurchaseAPI({
        purchaseToken: purchase.token,
        productId: OVERRIDE_SKU,
        type: "product",
      });
    } catch (err: any) {
      console.warn(`[useBilling] verify override failed, purchase succeeded on store: ${err?.message || err}`);
      result = { replay: false, appliedCredits: count } as VerifyPurchaseResponse;
    }

    await applyRefreshedDataRef.current();
    return result;
  });

  const buyPlanRef = useRef(async (planCode: PlanCode): Promise<VerifyPurchaseResponse> => {
    setLastError(null);
    const sku = PLAN_TO_SKU[planCode];
    if (!sku) throw new Error(`Unsupported plan: ${planCode}`);

    const purchase = await buySubscription(sku);
    if (!purchase.token) throw new Error("Missing purchase token from billing");

    await finishPurchase(purchase, false);

    let result: VerifyPurchaseResponse;
    try {
      result = await verifyPurchaseAPI({
        purchaseToken: purchase.token,
        productId: sku,
        type: "subscription",
      });
    } catch (err: any) {
      console.warn(`[useBilling] verify subscription failed, purchase succeeded on store: ${err?.message || err}`);
      result = { replay: false } as VerifyPurchaseResponse;
      updateUserRef.current({ plan: planCode, planCode });
    }

    setPlayStorePlan(planCode);
    await applyRefreshedDataRef.current();
    return result;
  });

  return {
    connected,
    playStorePlan,
    subscriptions,
    overrideProduct,
    lastError,
    buyOverrides: buyOverridesRef.current,
    buyPlan: buyPlanRef.current,
    reloadProducts: reloadProductsRef.current,
  };
}
