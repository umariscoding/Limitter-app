import type {
  BillingProvider,
  BillingPurchase,
  BillingProducts,
} from "./types";

const NOT_AVAILABLE = new Error("Billing is temporarily disabled on this build");

export class GoogleProvider implements BillingProvider {
  async init(): Promise<void> {}
  async end(): Promise<void> {}
  async getProducts(): Promise<BillingProducts> {
    return { subscriptions: [], consumables: [] };
  }
  async getActivePurchases(): Promise<BillingPurchase[]> {
    return [];
  }
  async buySubscription(): Promise<BillingPurchase> {
    throw NOT_AVAILABLE;
  }
  async buyConsumable(): Promise<BillingPurchase> {
    throw NOT_AVAILABLE;
  }
  async finishPurchase(): Promise<void> {}
}
