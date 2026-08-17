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
  notifications: boolean;
}

type PermissionStep = "notifications" | "usage" | "overlay" | "battery";

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
    if (step === "notifications") {
      // No dedicated settings screen for a single permission — app info's
      // notification toggle is the fallback once the direct system prompt
      // has already been denied once (see requestRequiredPermissions).
      await openApplicationDetailsSettings();
      return;
    }
    await Linking.openSettings();
  } catch {
    await Linking.openSettings();
  }
}

function stepCopy(step: PermissionStep): { title: string; message: string } {
  if (step === 'notifications') {
    return {
      title: 'Notifications Required',
      message:
        ANDROID_APP_LABEL + ' shows your active limits and remaining time in a notification, ' +
        'with the ability to override right from it. Please allow notifications.',
    };
  }
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
  if (!status.notifications) return "notifications";
  if (!status.usage) return "usage";
  if (!status.overlay) return "overlay";
  if (!status.battery) return "battery";
  return null;
}

async function checkNotificationsGranted(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 33) return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    return false;
  }
}

export const checkPermissions = async (): Promise<PermissionStatus> => {
  if (Platform.OS !== "android") {
    return { overlay: true, usage: true, battery: true, accessibility: true, notifications: true };
  }

  const notifications = await checkNotificationsGranted();

  if (!LimitterModule?.checkPermissions) {
    warnIfCustomNativeMissing();
    return {
      overlay: false,
      usage: false,
      battery: false,
      accessibility: false,
      notifications,
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
      notifications,
    };
  } catch {
    return {
      overlay: false,
      usage: false,
      battery: false,
      accessibility: false,
      notifications,
    };
  }
};

export const requestRequiredPermissions = async (): Promise<PermissionStatus> => {
  let status = await checkPermissions();

  if (Platform.OS !== "android") return status;

  for (;;) {
    const step = getFirstMissingStep(status);
    if (!step) return status;

    if (step === "notifications") {
      // Unlike usage/overlay/battery, this can be granted with a direct
      // system dialog — no settings navigation needed on the first attempt.
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch { /* best effort */ }
      status = await checkPermissions();
      if (status.notifications) continue;

      // Already denied once — the system won't show the dialog again, so
      // fall back to the same settings-prompt flow as the other steps.
      const choice = await promptStep(step);
      const waiter = waitForNextForeground();
      if (choice === "appinfo") {
        await openApplicationDetailsSettings();
      } else {
        await openStepSettings(step);
      }
      await waiter;
      status = await checkPermissions();
      continue;
    }

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
