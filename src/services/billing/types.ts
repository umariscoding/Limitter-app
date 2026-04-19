export type PlanCode = "free" | "pro" | "elite";

export interface BillingProduct {
  id: string;
  title: string;
  price: string;
  currency: string;
  offerToken?: string;
  raw: any;
}

export interface BillingPurchase {
  productId: string;
  token: string | null;
  raw: any;
}

export interface BillingProducts {
  subscriptions: BillingProduct[];
  consumables: BillingProduct[];
}

export interface BillingProvider {
  init(): Promise<void>;
  end(): Promise<void>;
  getProducts(subscriptionSkus: string[], consumableSkus: string[]): Promise<BillingProducts>;
  getActivePurchases(): Promise<BillingPurchase[]>;
  buySubscription(productId: string): Promise<BillingPurchase>;
  buyConsumable(productId: string): Promise<BillingPurchase>;
  finishPurchase(purchase: BillingPurchase, isConsumable: boolean): Promise<void>;
}
