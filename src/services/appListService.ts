
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
    if (!AppListModule) {
      console.warn('⚠️ AppListModule not available - ensure native bridge is linked');
      return [];
    }

    const apps = await AppListModule.getInstalledApps();
    console.log('✅ Installed apps fetched:', apps?.length || 0);
    
    return apps || [];
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
