import { LimitterModule } from '../config/nativeModules';

let blockedApps: Map<string, { blockedUntil: number; appName: string }> = new Map();

export const stopAllTimers = async () => {
  try {
    if (LimitterModule?.sendCommand) {
      await LimitterModule.sendCommand('STOP', {});
    }
  } catch (error) { 
    console.error('[stopAllTimers] Native error:', error);
  }
  blockedApps.clear();
};

export interface NativeTimerState {
  package: string;
  name?: string;
  remainingSeconds?: number;
  liveTimerUsageBudgetSeconds?: number;
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
  durationSeconds: number,
  usedSeconds: number = 0
) => {
  try {
    if (!LimitterModule?.sendCommand) {
      return { success: false, message: 'Native timer module not available' };
    }

    const safeDuration = Math.max(1, Math.floor(durationSeconds));
    const safeUsed = Math.max(0, Math.floor(usedSeconds));
    const response = await LimitterModule.sendCommand('START_TIMERS', {
      apps: [
        {
          package: packageName,
          appName,
          duration: String(safeDuration),
          usedSeconds: String(safeUsed),
        },
      ],
    });

    if (response === 'PERMISSION_OVERLAY_REQUIRED' || response === 'PERMISSION_USAGE_REQUIRED') {
      return { success: false, message: response };
    }

    return { success: true };
  } catch {
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
  } catch {
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
  } catch {
    return { success: false, message: 'Failed to start website timer' };
  }
};

export const startBulkWebsiteTimers = async (
  websites: Array<{ domain: string; durationSeconds: number; usedSeconds?: number }>,
): Promise<boolean> => {
  try {
    if (!LimitterModule?.sendCommand || websites.length === 0) return false;

    const websitesMaps = websites.map(w => ({
      domain: w.domain,
      duration: String(w.durationSeconds),
      usedSeconds: String(w.usedSeconds || 0),
    }));

    await LimitterModule.sendCommand('START_WEBSITE_TIMERS', { websites: websitesMaps });
    return true;
  } catch {
    return false;
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
  } catch {
    return {
      overlayEnabled: false,
      accessibilityEnabled: false,
      ready: false,
    };
  }
};

// Reset the native timer to a fresh window. UNBLOCK_APP sets usedSeconds=0 and status=waiting
// on the existing entry, preserving durationSeconds (the original limit), so the user gets
// another full max_time_minutes of usage before the limit re-blocks.
export const grantTemporaryOverrideAccess = async (
  packageName: string,
  _appName: string,
  _minutes = 5
) => {
  try {
    if (LimitterModule?.sendCommand) {
      await LimitterModule.sendCommand('UNBLOCK_APP', { package: packageName });
    }
  } catch (error) { 
    console.error('[grantTemporaryOverrideAccess] Native error:', error);
  }
  blockedApps.delete(packageName);
  return { success: true };
};

export const grantTemporaryWebsiteOverride = async (
  domain: string,
  _minutes = 5
) => {
  const nativeKey = `website:${domain.toLowerCase()}`;
  try {
    if (LimitterModule?.sendCommand) {
      await LimitterModule.sendCommand('UNBLOCK_APP', { package: nativeKey });
    }
  } catch (error) { 
    console.error('[grantTemporaryWebsiteOverride] Native error:', error);
  }
  blockedApps.delete(nativeKey);
  return { success: true };
};

export const startAppBlockerService = async (
  blockedAppsList: Array<{ package_name: string; app_name: string; blocked_until_timestamp?: number }>
) => {
  try {
    if (!LimitterModule?.sendCommand) {
      return false;
    }

    const now = Date.now();
    blockedAppsList.forEach(app => {
      if (app.blocked_until_timestamp && app.blocked_until_timestamp > now) {
        blockedApps.set(app.package_name, {
          blockedUntil: app.blocked_until_timestamp,
          appName: app.app_name,
        });
      }
    });

    for (const app of blockedAppsList) {
      if (app.blocked_until_timestamp && app.blocked_until_timestamp > now) {
        await LimitterModule.sendCommand('BLOCK_APP', {
          package: app.package_name,
          appName: app.app_name,
        });
      }
    }

    return true;
  } catch {
    return false;
  }
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
};

export async function getNativeTimerStates(): Promise<NativeTimerState[]> {
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
      liveTimerUsageBudgetSeconds:
        typeof item?.liveTimerUsageBudgetSeconds === 'number'
          ? item.liveTimerUsageBudgetSeconds
          : Number(item?.liveTimerUsageBudgetSeconds || 0),
      status: item?.status ? String(item.status).toLowerCase() : undefined,
    }));
  } catch {
    return [];
  }
}

export function nativeBlockedPackagesFromTimers(timers: NativeTimerState[]): Set<string> {
  const set = new Set<string>();
  timers.forEach(timer => {
    const pkg = String(timer.package || '').trim().toLowerCase();
    if (!pkg) return;
    if (String(timer.status || '').toLowerCase() === 'blocked') {
      set.add(pkg);
      if (!pkg.startsWith('website:')) {
        set.add(`website:${pkg}`);
      }
    }
  });
  return set;
}

export const getNativeBlockedPackages = async (): Promise<Set<string>> => {
  return nativeBlockedPackagesFromTimers(await getNativeTimerStates());
};
