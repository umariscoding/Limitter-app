import {
  Platform,
  Linking,
  AppState,
  PermissionsAndroid,
  type AppStateStatus,
} from "react-native";
import { showAlert } from '../components/AppAlert';

import { LimitterModule, warnIfCustomNativeMissing } from "../config/nativeModules";

// Must match android/app/src/main/res/values/strings.xml app_name (launcher + Usage access list).
const ANDROID_APP_LABEL = "Limitter";


export interface PermissionStatus {
  overlay: boolean;
  usage: boolean;
  battery: boolean;
  accessibility: boolean;
}

type PermissionStep = "usage" | "overlay" | "battery";

type PromptChoice = "open" | "appinfo";

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
      await LimitterModule.requestBatteryOptimizationExemption();
      return;
    }
    await Linking.openSettings();
  } catch {
    await Linking.openSettings();
  }
}

function stepCopy(step: PermissionStep): { title: string; message: string } {
  if (step === 'usage') {
    return {
      title: 'Usage Access Required',
      message:
        ANDROID_APP_LABEL + ' needs usage access to track your app screen time.\n\n' +
        'On the next screen, find "' + ANDROID_APP_LABEL + '" and turn it ON.',
    };
  }
  if (step === 'overlay') {
    return {
      title: 'Overlay Permission Required',
      message:
        ANDROID_APP_LABEL + ' needs this to show a block screen when your time limit is reached.\n\n' +
        'On the next screen, find "' + ANDROID_APP_LABEL + '" and allow it.',
    };
  }
  return {
    title: 'Background Access',
    message:
      ANDROID_APP_LABEL + ' needs to run in the background so your timers stay accurate.\n\n' +
      'Tap Allow on the next screen.',
  };
}

function promptStep(step: PermissionStep): Promise<PromptChoice> {
  const { title, message } = stepCopy(step);
  return new Promise((resolve) => {
    if (step === "usage") {
      showAlert(title, message, [
        { text: "This app's settings", onPress: () => resolve("appinfo") },
        { text: "Usage access list", onPress: () => resolve("open") },
      ]);
      return;
    }
    showAlert(title, message, [
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

export const requestRequiredPermissions = async (): Promise<PermissionStatus> => {
  let status = await checkPermissions();

  if (Platform.OS !== "android") return status;

  if (Number(Platform.Version) >= 33) {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch { /* best effort */ }
  }

  for (;;) {
    const step = getFirstMissingStep(status);
    if (!step) return status;

    const choice = await promptStep(step);

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
