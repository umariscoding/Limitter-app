
import { NativeModules } from 'react-native';

const { AppListModule } = NativeModules;
const { LimitterModule } = NativeModules;

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

    if (LimitterModule?.getInstalledApps) {
      const apps = await LimitterModule.getInstalledApps();
      const normalized = (apps || []).map((app: any) => ({
        appName: app.appName || app.name || '',
        packageName: app.packageName || app.package || '',
      }));

      const validApps = normalized.filter(
        (app: InstalledApp) => app.appName.length > 0 && app.packageName.length > 0
      );

      console.log('✅ Installed apps fetched via LimitterModule:', validApps.length);
      return validApps;
    }

    console.warn('⚠️ No installed-app native module available');
    return [];
  } catch (error) {
    console.error('❌ Failed to get installed apps:', error);
    return [];
  }
};

export const searchApps = async (query: string): Promise<InstalledApp[]> => {
  try {
    const apps = await getInstalledApps();
    const lowerQuery = query.toLowerCase();
    return apps.filter(app =>
      app.appName.toLowerCase().includes(lowerQuery) ||
      app.packageName.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    console.error('❌ App search failed:', error);
    return [];
  }
};

export const getAppByPackageName = async (packageName: string): Promise<InstalledApp | null> => {
  try {
    const apps = await getInstalledApps();
    return apps.find(app => app.packageName === packageName) || null;
  } catch (error) {
    console.error('❌ Failed to get app by package:', error);
    return null;
  }
};
