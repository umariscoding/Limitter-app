export const BASE_URL = "https://5f49-119-154-232-139.ngrok-free.app";

export const API = {
  SetupAccount: "/api/auth/setup-account",
  Bootstrap: "/api/auth/bootstrap",
  Login: "/api/auth/login",
  Logout: "/api/auth/logout",
  ResendVerification: "/api/auth/resend-verification",
  ForgotPassword: "/api/auth/forgot-password",

  RegisterDevice: "/api/devices/register",
  GetDevices: "/api/devices",

  Policies: "/api/policies",

  UsageTick: "/api/usage/tick",
  UsageRecord: "/api/usage/record",
  UsageDaily: "/api/usage/daily",
  UsageWeekly: "/api/usage/weekly",
  UsageRemaining: "/api/usage/remaining",

  AccountProfile: "/api/account/profile",
  PlanLimits: "/api/account/plan-limits",
  UpgradePlan: "/api/account/upgrade-plan",

  OverrideUse: "/api/overrides/use",
  OverrideGrant: "/api/overrides/grant",
  OverrideHistory: "/api/overrides/history",
  OverrideBalance: "/api/overrides/balance",
};
