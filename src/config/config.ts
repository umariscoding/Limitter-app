export const BASE_URL = "https://d76e-39-63-37-125.ngrok-free.app";

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

  UsageRecord: "/api/usage/record",
  UsageDaily: "/api/usage/daily",
  UsageWeekly: "/api/usage/weekly",
  UsageRemaining: "/api/usage/remaining",

  PlanLimits: "/api/account/plan-limits",

  OverrideUse: "/api/overrides/use",
  OverrideGrant: "/api/overrides/grant",
  OverrideHistory: "/api/overrides/history",
  OverrideBalance: "/api/overrides/balance",
};
