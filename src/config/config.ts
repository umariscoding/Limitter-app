export const BASE_URL = "https://e156-119-156-123-51.ngrok-free.app";

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

  OverrideUse: "/api/overrides/use",
  OverrideHistory: "/api/overrides/history",
  OverrideBalance: "/api/overrides/balance",
};
