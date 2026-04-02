import { NativeModules, Platform } from "react-native";

export const LimitterModule = NativeModules.LimitterModule as
  | (typeof NativeModules)["LimitterModule"]
  | undefined;

export const TimerEventModule = NativeModules.TimerEventModule as
  | (typeof NativeModules)["TimerEventModule"]
  | undefined;

let warnedMissingCustomNative = false;

export function warnIfCustomNativeMissing(): void {
  if (Platform.OS !== "android") return;
  if (warnedMissingCustomNative) return;
  if (LimitterModule?.checkPermissions != null && TimerEventModule != null) return;

  warnedMissingCustomNative = true;
}
