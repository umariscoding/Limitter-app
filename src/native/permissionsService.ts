import {
  Platform,
  Alert,
  Linking,
  AppState,
  type AppStateStatus,
} from "react-native";

import { LimitterModule, warnIfCustomNativeMissing } from "./limitterNativeModules";

/** Must match android/app/src/main/res/values/strings.xml app_name (launcher + Usage access list). */
const ANDROID_APP_LABEL = "Limitter";

const ANDROID_PACKAGE_ID = "com.appguard2";

export interface PermissionStatus {
  overlay: boolean;
  usage: boolean;
  /** True when app is exempt from battery optimization (recommended for timers). */
  battery: boolean;
  accessibility: boolean;
}

type PermissionStep = "usage" | "overlay" | "battery";

type PromptChoice = "later" | "open" | "appinfo";

function waitForNextForeground(): Promise<void> {
  return new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        sub.remove();
        resolve();
      }
    });
  });
}

async function openApplicationDetailsSettings(): Promise<void> {
  try {
    if (LimitterModule?.openApplicationDetailsSettings) {
      await LimitterModule.openApplicationDetailsSettings();
      return;
    }
    await Linking.openSettings();
  } catch {
    await Linking.openSettings();
  }
}

async function openStepSettings(step: PermissionStep): Promise<void> {
  try {
    if (step === "usage" && LimitterModule?.openUsageAccessSettings) {
      await LimitterModule.openUsageAccessSettings();
      return;
    }
    if (step === "overlay" && LimitterModule?.openOverlaySettings) {
      await LimitterModule.openOverlaySettings();
      return;
    }
    if (step === "battery" && LimitterModule?.requestBatteryOptimizationExemption) {
      LimitterModule.requestBatteryOptimizationExemption();
      return;
    }
    await Linking.openSettings();
  } catch {
    await Linking.openSettings();
  }
}

function stepCopy(step: PermissionStep): { title: string; message: string } {
  switch (step) {
    case "usage":
      return {
        title: "Usage access (not a service)",
        message:
          `This is not under Accessibility. On the Usage access screen you should see one row named “${ANDROID_APP_LABEL}” (same name as the app icon).\n\n` +
          `Turn ON “Permit usage access” for that row. If the list is long, scroll — it is sorted alphabetically under “L”.\n\n` +
          `Technical id (for search/support): ${ANDROID_PACKAGE_ID}\n\n` +
          `If you still don’t see ${ANDROID_APP_LABEL}: tap “This app’s settings” to confirm Android recognizes this install, then try “Usage access list” again.\n\n` +
          `Samsung: Special access → Usage data access. Xiaomi: App management → App permissions → Other permissions → Usage access.`,
      };
    case "overlay":
      return {
        title: "Display over other apps",
        message:
          `${ANDROID_APP_LABEL} needs permission to draw over other apps when a limit is reached.\n\n` +
          `On the next screen, find ${ANDROID_APP_LABEL} and allow display over other apps.`,
      };
    case "battery":
      return {
        title: "Battery / background",
        message:
          `For reliable timers in the background, allow ${ANDROID_APP_LABEL} to ignore battery optimization.\n\n` +
          `On the next screen, tap Allow if you want maximum reliability.`,
      };
  }
}

function promptStep(step: PermissionStep): Promise<PromptChoice> {
  const { title, message } = stepCopy(step);
  return new Promise((resolve) => {
    if (step === "usage") {
      Alert.alert(title, message, [
        { text: "Later", style: "cancel", onPress: () => resolve("later") },
        { text: "This app’s settings", onPress: () => resolve("appinfo") },
        { text: "Usage access list", onPress: () => resolve("open") },
      ]);
      return;
    }
    Alert.alert(title, message, [
      { text: "Later", style: "cancel", onPress: () => resolve("later") },
      { text: "Open settings", onPress: () => resolve("open") },
    ]);
  });
}

function getFirstMissingStep(status: PermissionStatus): PermissionStep | null {
  if (!status.usage) return "usage";
  if (!status.overlay) return "overlay";
  if (!status.battery) return "battery";
  return null;
}

export const checkPermissions = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== "android") {
    return { overlay: true, usage: true, battery: true, accessibility: true };
  }

  if (!LimitterModule?.checkPermissions) {
    warnIfCustomNativeMissing();
    return {
      overlay: false,
      usage: false,
      battery: false,
      accessibility: false,
    };
  }

  try {
    const res = await LimitterModule.checkPermissions();
    // Native returns batteryOptimized=true when the app is still subject to optimization (not exempt).
    const batteryOptimized = !!res?.batteryOptimized;
    return {
      overlay: !!res?.overlay,
      usage: !!res?.usage,
      battery: !batteryOptimized,
      accessibility: !!res?.accessibility,
    };
  } catch {
    return {
      overlay: false,
      usage: false,
      battery: false,
      accessibility: false,
    };
  }
};

/**
 * Walks required Android special permissions one at a time.
 * After each settings screen, re-checks when the user returns to the app.
 */
export const requestRequiredPermissions = async (): Promise<PermissionStatus> => {
  let status = await checkPermissions();

  if (Platform.OS !== "android") return status;

  for (;;) {
    const step = getFirstMissingStep(status);
    if (!step) return status;

    const choice = await promptStep(step);
    if (choice === "later") return status;

    const waiter = waitForNextForeground();
    if (choice === "appinfo") {
      await openApplicationDetailsSettings();
    } else {
      await openStepSettings(step);
    }
    await waiter;

    status = await checkPermissions();
  }
};
