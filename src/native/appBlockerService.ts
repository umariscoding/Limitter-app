import { LimitterModule } from './limitterNativeModules';

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

export interface NativeTimerState {
  package: string;
  name?: string;
  remainingSeconds?: number;
  status?: string;
}

export interface WebsiteBlockerStatus {
  overlayEnabled: boolean;
  accessibilityEnabled: boolean;
  ready: boolean;
  targetDomain?: string;
}

export const startAppUsageTimer = async (
  packageName: string,
  appName: string,
  durationSeconds: number
) => {
  try {
    if (!LimitterModule?.sendCommand) {
      console.warn('⚠️ LimitterModule.sendCommand not available');
      return { success: false, message: 'Native timer module not available' };
    }

    const safeDuration = Math.max(1, Math.floor(durationSeconds));
    const response = await LimitterModule.sendCommand('START_TIMERS', {
      apps: [
        {
          package: packageName,
          appName,
          duration: String(safeDuration),
        },
      ],
    });

    if (response === 'PERMISSION_OVERLAY_REQUIRED' || response === 'PERMISSION_USAGE_REQUIRED') {
      return { success: false, message: response };
    }

    console.log('✅ Native timer started for', appName, `(${packageName})`, safeDuration, 'seconds');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to start native timer:', error);
    return { success: false, message: 'Failed to start native timer' };
  }
};

export const startAppClockTimer = async (
  packageName: string,
  appName: string,
  hour24: number,
  minute: number
) => {
  try {
    if (!LimitterModule?.startClockTimer) {
      console.warn('⚠️ LimitterModule.startClockTimer not available');
      return { success: false, message: 'Native clock timer module not available' };
    }

    const response = await LimitterModule.startClockTimer({
      apps: [
        {
          package: packageName,
          appName,
          hour: Math.max(0, Math.min(23, Math.floor(hour24))),
          minute: Math.max(0, Math.min(59, Math.floor(minute))),
        },
      ],
    });

    if (response === 'PERMISSION_OVERLAY_REQUIRED' || response === 'PERMISSION_USAGE_REQUIRED') {
      return { success: false, message: response };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to start clock timer:', error);
    return { success: false, message: 'Failed to start exact-time timer' };
  }
};

export const startWebsiteTimer = async ({
  websiteUrl,
  durationSeconds,
  blockAtTimestampMs,
}: {
  websiteUrl: string;
  durationSeconds?: number;
  blockAtTimestampMs?: number;
}) => {
  try {
    if (!LimitterModule?.startWebsiteTimer) {
      console.warn('⚠️ LimitterModule.startWebsiteTimer not available');
      return { success: false, message: 'Native website timer module not available' };
    }

    const response = await LimitterModule.startWebsiteTimer({
      websiteUrl,
      durationSeconds:
        typeof durationSeconds === 'number'
          ? Math.max(1, Math.floor(durationSeconds))
          : undefined,
      blockAtTimestampMs:
        typeof blockAtTimestampMs === 'number'
          ? Math.max(1, Math.floor(blockAtTimestampMs))
          : undefined,
    });

    if (
      response === 'PERMISSION_OVERLAY_REQUIRED' ||
      response === 'PERMISSION_USAGE_REQUIRED' ||
      response === 'PERMISSION_ACCESSIBILITY_REQUIRED'
    ) {
      return { success: false, message: response };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to start website timer:', error);
    return { success: false, message: 'Failed to start website timer' };
  }
};

export const getWebsiteBlockerStatus = async (): Promise<WebsiteBlockerStatus> => {
  try {
    if (!LimitterModule?.getWebsiteBlockerStatus) {
      return {
        overlayEnabled: false,
        accessibilityEnabled: false,
        ready: false,
      };
    }

    const response = await LimitterModule.getWebsiteBlockerStatus();
    return {
      overlayEnabled: Boolean(response?.overlayEnabled),
      accessibilityEnabled: Boolean(response?.accessibilityEnabled),
      ready: Boolean(response?.ready),
      targetDomain: response?.targetDomain ? String(response.targetDomain) : undefined,
    };
  } catch (error) {
    console.error('❌ Failed to read website blocker status:', error);
    return {
      overlayEnabled: false,
      accessibilityEnabled: false,
      ready: false,
    };
  }
};

export const grantTemporaryOverrideAccess = async (
  packageName: string,
  appName: string,
  minutes = 5
) => {
  const safeSeconds = Math.max(60, Math.floor(minutes * 60));
  return startAppUsageTimer(packageName, appName, safeSeconds);
};

export const startAppBlockerService = async (
  blockedAppsList: Array<{ package_name: string; app_name: string; blocked_until_timestamp?: number }>
) => {
  try {
    if (!LimitterModule?.sendCommand) {
      console.warn('⚠️ LimitterModule.sendCommand not available - native bridge not linked');
      return false;
    }

    // Store blocked apps locally
    const now = Date.now();
    blockedAppsList.forEach(app => {
      if (app.blocked_until_timestamp && app.blocked_until_timestamp > now) {
        blockedApps.set(app.package_name, {
          blockedUntil: app.blocked_until_timestamp,
          appName: app.app_name,
        });
      }
    });

    console.log('✅ AppBlocker started with', blockedApps.size, 'blocked apps');

    // Push currently blocked apps to native service so overlay enforcement is immediate.
    for (const app of blockedAppsList) {
      if (app.blocked_until_timestamp && app.blocked_until_timestamp > now) {
        await LimitterModule.sendCommand('BLOCK_APP', {
          package: app.package_name,
          appName: app.app_name,
        });
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to start AppBlocker:', error);
    return false;
  }
};

export const stopAppBlockerService = async () => {
  try {
    if (LimitterModule?.sendCommand) {
      const result = await LimitterModule.sendCommand('STOP', null);
      console.log('✅ AppBlocker stopped');
      return Boolean(result);
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

    // Trigger native block flow if needed.
    if (LimitterModule?.sendCommand) {
      try {
        await LimitterModule.sendCommand('BLOCK_APP', {
          package: packageName,
          appName: blockedInfo.appName,
        });
      } catch (error) {
        console.error('Error triggering native block:', error);
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

export const getNativeTimerStates = async (): Promise<NativeTimerState[]> => {
  try {
    if (!LimitterModule?.getActiveTimers) {
      return [];
    }

    const result = await LimitterModule.getActiveTimers();
    if (!Array.isArray(result)) return [];

    return result.map((item: any) => ({
      package: String(item?.package || '').trim(),
      name: item?.name ? String(item.name) : undefined,
      remainingSeconds:
        typeof item?.remainingSeconds === 'number'
          ? item.remainingSeconds
          : Number(item?.remainingSeconds || 0),
      status: item?.status ? String(item.status).toLowerCase() : undefined,
    }));
  } catch (error) {
    console.warn('Failed to read native timer states:', error);
    return [];
  }
};

export const getNativeBlockedPackages = async (): Promise<Set<string>> => {
  const timers = await getNativeTimerStates();
  const set = new Set<string>();

  timers.forEach(timer => {
    const pkg = String(timer.package || '').trim().toLowerCase();
    if (!pkg) return;

    if (String(timer.status || '').toLowerCase() === 'blocked') {
      set.add(pkg);
    }
  });

  return set;
};
