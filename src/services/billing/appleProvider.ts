import type {
  BillingProvider,
  BillingPurchase,
  BillingProducts,
} from "./types";

export class AppleProvider implements BillingProvider {
  async init(): Promise<void> {
    // TODO: implement Apple IAP init
  }

  async end(): Promise<void> {
    // TODO: implement Apple IAP teardown
  }

  async getProducts(): Promise<BillingProducts> {
    return { subscriptions: [], consumables: [] };
  }

  async getActivePurchases(): Promise<BillingPurchase[]> {
    return [];
  }

  async buySubscription(_productId: string): Promise<BillingPurchase> {
    throw new Error("Apple billing not implemented yet");
  }

  async buyConsumable(_productId: string): Promise<BillingPurchase> {
    throw new Error("Apple billing not implemented yet");
  }

  async finishPurchase(): Promise<void> {
    // TODO: implement Apple finishTransaction
  }
}
