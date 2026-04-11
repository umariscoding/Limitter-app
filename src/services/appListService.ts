import { NativeModules } from 'react-native';

const { AppListModule } = NativeModules;

export interface InstalledApp {
  packageName: string;
  appName: string;
  icon?: string;
}

let cachedApps: InstalledApp[] | null = null;

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

      return validApps;
    }

    return [];
  } catch {
    return [];
  }
};

export const getCachedApps = (): InstalledApp[] | null => cachedApps;

export const preloadInstalledApps = async (): Promise<InstalledApp[]> => {
  if (cachedApps) return cachedApps;
  const apps = await getInstalledApps();
  cachedApps = apps;
  return apps;
};
