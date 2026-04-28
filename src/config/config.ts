export const BASE_URL = "https://limitter-api-production.up.railway.app";
export const API = {
  SetupAccount: "/api/auth/setup-account",
  Bootstrap: "/api/auth/bootstrap",
  Login: "/api/auth/login",
  Logout: "/api/auth/logout",
  ResendVerification: "/api/auth/resend-verification",
  ForgotPassword: "/api/auth/forgot-password",

  RegisterDevice: "/api/devices/register",
  GetDevices: "/api/devices",
  DeviceFcmToken: "/api/devices/fcm-token",
  ReplaceDevice: "/api/devices/replace",

  Policies: "/api/policies",

  UsageTick: "/api/usage/tick",
  UsageRecord: "/api/usage/record",
  UsageDaily: "/api/usage/daily",
  UsageWeekly: "/api/usage/weekly",
  UsageRemaining: "/api/usage/remaining",

  AccountProfile: "/api/account/profile",
  PlanLimits: "/api/account/plan-limits",

  OverrideUse: "/api/overrides/use",
  OverrideHistory: "/api/overrides/history",
  OverrideBalance: "/api/overrides/balance",

  BillingVerifyPurchase: "/api/billing/verify-purchase",
  BillingRefresh: "/api/billing/refresh",
  BillingPurchases: "/api/billing/purchases",
};
