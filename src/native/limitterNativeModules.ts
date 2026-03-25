import { NativeModules, Platform } from "react-native";

/**
 * Custom native binaries (LimitterPackage). Not present in Expo Go — only in dev/prod builds.
 */
export const LimitterModule = NativeModules.LimitterModule as
  | (typeof NativeModules)["LimitterModule"]
  | undefined;

export const TimerEventModule = NativeModules.TimerEventModule as
  | (typeof NativeModules)["TimerEventModule"]
  | undefined;

let warnedMissingCustomNative = false;

/** Call when you detect missing Limitter/Timer native APIs (e.g. Expo Go or stale install). */
export function warnIfCustomNativeMissing(): void {
  if (Platform.OS !== "android") return;
  if (warnedMissingCustomNative) return;
  if (LimitterModule?.checkPermissions != null && TimerEventModule != null) return;

  warnedMissingCustomNative = true;
  console.warn(
    "[Limitter] Native LimitterModule / TimerEventModule are missing in this app binary. " +
      "Expo Go does not include them. Fix: from Limitter-app run `npx expo run:android` once to compile and install " +
      "the dev client, then use `npx expo start --dev-client` and open that app (not Expo Go). " +
      "Rebuild after changing Kotlin/Java.",
  );
}
