import { getNativeTimerStates, nativeBlockedPackagesFromTimers } from "../native/appBlockerService";
import {
  mapPolicyToUI,
  normalizeUiPolicy,
  mergeBlockedOverlaysIntoPolicies,
  mergeLiveTimerUsageIntoPolicies,
  type UIPolicy,
} from "../utils/policyMapper";

export interface InstalledAppLike {
  appName: string;
  packageName: string;
}

export function filterInstalledApps(apps: InstalledAppLike[], query: string): InstalledAppLike[] {
  if (!query) return apps.slice(0, 30);
  const q = query.toLowerCase();
  return apps
    .filter(app => app.appName.toLowerCase().includes(q) || app.packageName.toLowerCase().includes(q))
    .slice(0, 30);
}

export function formatTotalUsageFromLimits(limits: Array<{ time_used_minutes?: number; used_minutes?: number }>): string {
  const totalMinutes = limits.reduce((sum, item) => {
    return sum + Math.max(0, Number(item?.time_used_minutes ?? item?.used_minutes ?? 0));
  }, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

export type DashboardTimerType = "combined" | "single" | "clock";

export function toHour24(clockHour: string, clockPeriod: "AM" | "PM"): number {
  const hour12 = Math.max(1, Math.min(12, Number(clockHour || "12")));
  let hour24 = hour12 % 12;
  if (clockPeriod === "PM") hour24 += 12;
  return hour24;
}

export function calculateTotalSecondsFromInputs(input: {
  timerType: DashboardTimerType;
  hours: string;
  minutes: string;
  seconds: string;
  singleTimerValue: string;
  singleTimerUnit: "seconds" | "minutes" | "hours";
  clockHour: string;
  clockMinute: string;
  clockPeriod: "AM" | "PM";
}): number {
  if (input.timerType === "clock") {
    const hour24 = toHour24(input.clockHour, input.clockPeriod);
    const minute = Math.max(0, Math.min(59, Number(input.clockMinute || "0")));
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour24, minute, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return Math.ceil((target.getTime() - now.getTime()) / 1000);
  }

  if (input.timerType === "combined") {
    const h = Number(input.hours || "0");
    const m = Number(input.minutes || "0");
    const s = Number(input.seconds || "0");
    return h * 3600 + m * 60 + s;
  }

  const val = Number(input.singleTimerValue || "0");
  if (input.singleTimerUnit === "hours") return val * 3600;
  if (input.singleTimerUnit === "minutes") return val * 60;
  return val;
}

export function clockTargetTimestampMs(clockHour: string, clockMinute: string, clockPeriod: "AM" | "PM"): number {
  const hour24 = toHour24(clockHour, clockPeriod);
  const minute = Math.max(0, Math.min(59, Number(clockMinute || "0")));
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour24, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
}

export async function hydratePoliciesForUi(policiesResult: any): Promise<UIPolicy[]> {
  const rows = Array.isArray(policiesResult) ? policiesResult : [];
  const mapped = rows.map(mapPolicyToUI);
  const sorted = [...mapped].sort((a, b) => b.created_at - a.created_at);
  const normalized = sorted.map(normalizeUiPolicy);
  const nativeTimers = await getNativeTimerStates();
  const nativeBlockedPackages = nativeBlockedPackagesFromTimers(nativeTimers);

  let merged = mergeBlockedOverlaysIntoPolicies(normalized, nativeBlockedPackages);
  merged = mergeLiveTimerUsageIntoPolicies(merged, nativeTimers);

  return merged;
}
