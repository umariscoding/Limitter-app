import { NativeModules } from 'react-native';

const { AppListModule } = NativeModules;

export interface InstalledApp {
  packageName: string;
  appName: string;
  icon?: string;
}

/**
 * SERVICE: Fetch installed apps from device
 * Requires native Android module: react-native-installed-apps or custom bridge
 */

export const getInstalledApps = async (): Promise<InstalledApp[]> => {
  try {
    if (AppListModule?.getInstalledApps) {
      const apps = await AppListModule.getInstalledApps();
      const normalized = (apps || []).map((app: any) => ({
        appName: app.appName || app.name || '',
        packageName: app.packageName || app.package || '',
      }));

      const validApps = normalized.filter(
        (app: InstalledApp) => app.appName.length > 0 && app.packageName.length > 0
      );

      console.log('✅ Installed apps fetched via AppListModule:', validApps.length);
      return validApps;
    }

    console.warn('⚠️ AppListModule not available');
    return [];
  } catch (error) {
    console.error('❌ Failed to get installed apps:', error);
    return [];
  }
};
