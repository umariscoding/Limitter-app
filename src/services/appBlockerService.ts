import { NativeModules, NativeEventEmitter } from 'react-native';

const { AppBlockerModule } = NativeModules;
const appBlockerEmitter = AppBlockerModule ? new NativeEventEmitter(AppBlockerModule) : null;

export interface BlockedAppAlert {
  packageName: string;
  appName: string;
  blockedUntil: string; // ISO timestamp
}

/**
 * SERVICE: Monitor foreground app and enforce blocking
 * Requires native Android module + Accessibility Service permissions
 */

let backgroundTaskId: string | null = null;
let blockedApps: Map<string, { blockedUntil: number; appName: string }> = new Map();

export const startAppBlockerService = async (
  blockedAppsList: Array<{ package_name: string; app_name: string; blocked_until_timestamp?: number }>
) => {
  try {
    if (!AppBlockerModule) {
      console.warn('⚠️ AppBlockerModule not available - native bridge not linked');
      return false;
    }

    // Store blocked apps locally
    blockedAppsList.forEach(app => {
      if (app.blocked_until_timestamp && app.blocked_until_timestamp > Date.now()) {
        blockedApps.set(app.package_name, {
          blockedUntil: app.blocked_until_timestamp,
          appName: app.app_name,
        });
      }
    });

    console.log('✅ AppBlocker started with', blockedApps.size, 'blocked apps');

    // Register for foreground app changes
    if (appBlockerEmitter) {
      appBlockerEmitter.addListener(
        'onForegroundAppChanged',
        (event: { packageName: string; appName: string }) => {
          handleForegroundAppChange(event);
        }
      );
    }

    // Start native service
    const result = await AppBlockerModule.startMonitoring();
    return result.success;
  } catch (error) {
    console.error('❌ Failed to start AppBlocker:', error);
    return false;
  }
};

export const stopAppBlockerService = async () => {
  try {
    if (AppBlockerModule) {
      const result = await AppBlockerModule.stopMonitoring();
      console.log('✅ AppBlocker stopped');
      return result.success;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to stop AppBlocker:', error);
    return false;
  }
};

export const handleForegroundAppChange = async (event: { packageName: string; appName: string }) => {
  const { packageName, appName } = event;

  const blockedInfo = blockedApps.get(packageName);

  if (blockedInfo && blockedInfo.blockedUntil > Date.now()) {
    console.log(`🚫 BLOCKED: User tried to open ${appName} (${packageName}) - Time limit active`);

    // Show blocking overlay
    if (AppBlockerModule) {
      try {
        await AppBlockerModule.showBlockingOverlay({
          appName: blockedInfo.appName,
          packageName,
          message: 'This app is blocked. Time limit reached.',
        });
      } catch (error) {
        console.error('Error showing overlay:', error);
      }
    }

    return true; // App was blocked
  }

  console.log(`✅ ALLOWED: ${appName} is not blocked`);
  return false; // App was allowed
};

export const updateBlockedApps = (newList: Array<{ package_name: string; app_name: string; blocked_until_timestamp?: number }>) => {
  blockedApps.clear();
  newList.forEach(app => {
    if (app.blocked_until_timestamp && app.blocked_until_timestamp > Date.now()) {
      blockedApps.set(app.package_name, {
        blockedUntil: app.blocked_until_timestamp,
        appName: app.app_name,
      });
    }
  });
  console.log('✅ Blocked apps list updated:', blockedApps.size, 'apps');
};

export const isAppBlocked = (packageName: string): boolean => {
  const blockedInfo = blockedApps.get(packageName);
  if (blockedInfo && blockedInfo.blockedUntil > Date.now()) {
    return true;
  }
  return false;
};
