import { Platform } from "react-native";

// export const BASE_URL = Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";
export const BASE_URL = "https://nonremediably-nonbearded-miguel.ngrok-free.dev";
export const API = {
  // Auth
  SetupAccount: "/api/auth/setup-account",
  Bootstrap: "/api/auth/bootstrap",
  Login: "/api/auth/login",
  Logout: "/api/auth/logout",
  ResendVerification: "/api/auth/resend-verification",
  ForgotPassword: "/api/auth/forgot-password",

  // Devices
  RegisterDevice: "/api/devices/register",
  GetDevices: "/api/devices",

  // Policies (Phase 3+)
  Policies: "/api/policies",

  // Usage (Phase 4+)
  UsageRecord: "/api/usage/record",
  UsageDaily: "/api/usage/daily",
  UsageWeekly: "/api/usage/weekly",
  UsageRemaining: "/api/usage/remaining",

  // Overrides (Phase 5+)
  OverrideUse: "/api/overrides/use",
  OverrideHistory: "/api/overrides/history",
  OverrideBalance: "/api/overrides/balance",
};
