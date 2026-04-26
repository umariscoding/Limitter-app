export const BASE_URL = "https://9fc7-182-190-164-9.ngrok-free.app";
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
