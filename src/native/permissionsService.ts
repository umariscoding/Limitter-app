import {
  Platform,
  Alert,
  Linking,
  AppState,
  type AppStateStatus,
} from "react-native";

import { LimitterModule, warnIfCustomNativeMissing } from "./limitterNativeModules";

// Must match android/app/src/main/res/values/strings.xml app_name (launcher + Usage access list).
const ANDROID_APP_LABEL = "Limitter";

const ANDROID_PACKAGE_ID = "com.limitter";

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
      title: 'Enable Usage Access',
      message:
        'Find "' + ANDROID_APP_LABEL + '" in the list and turn ON usage access.\n\n' +
        'Xiaomi (Redmi/POCO): Settings > Apps > Special app access > Usage data access > find ' + ANDROID_APP_LABEL + ' > turn ON.\n\n' +
        'If not there: Settings > Apps > Manage apps > find ' + ANDROID_APP_LABEL + ' > Other permissions > Usage access > Allow.\n\n' +
        'Package: ' + ANDROID_PACKAGE_ID,
    };
  }
  if (step === 'overlay') {
    return {
      title: 'Display over other apps',
      message:
        ANDROID_APP_LABEL + ' needs permission to draw over other apps when a limit is reached.\n\n' +
        'On the next screen, find ' + ANDROID_APP_LABEL + ' and allow display over other apps.',
    };
  }
  return {
    title: 'Battery / background',
    message:
      'For reliable timers in the background, allow ' + ANDROID_APP_LABEL + ' to ignore battery optimization.\n\n' +
      'On the next screen, tap Allow if you want maximum reliability.',
  };
}

function promptStep(step: PermissionStep): Promise<PromptChoice> {
  const { title, message } = stepCopy(step);
  return new Promise((resolve) => {
    if (step === "usage") {
      Alert.alert(title, message, [
        { text: "This app's settings", onPress: () => resolve("appinfo") },
        { text: "Usage access list", onPress: () => resolve("open") },
      ], { cancelable: false });
      return;
    }
    Alert.alert(title, message, [
      { text: "Open settings", onPress: () => resolve("open") },
    ], { cancelable: false });
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
