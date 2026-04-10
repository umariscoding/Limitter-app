import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getDevicesAPI, registerDeviceAPI } from "../services/deviceService";
import { getOrCreateInstallationId } from "../auth/firebaseAuthService";
import { canRegisterDevice } from "../services/planGuardService";

const CURRENT_DEVICE_KEY = "@limitter_current_device_id";

export const resolveCurrentDeviceId = async (_userId?: string): Promise<string | null> => {
  try {
    const cachedId = await AsyncStorage.getItem(CURRENT_DEVICE_KEY);

    const devicesData: any = await getDevicesAPI();
    const devices = Array.isArray(devicesData)
      ? devicesData
      : Array.isArray(devicesData?.devices)
        ? devicesData.devices
        : [];

    if (cachedId && devices.some((d: any) => d.deviceId === cachedId)) {
      return cachedId;
    }

    if (devices.length > 0) {
      const deviceId = devices[0].deviceId || devices[0].id;
      await AsyncStorage.setItem(CURRENT_DEVICE_KEY, deviceId);
      return deviceId;
    }

    const check = await canRegisterDevice();
    if (!check.allowed) {
      throw new Error(check.reason || "Device limit reached for your plan.");
    }

    const installationId = await getOrCreateInstallationId();
    const deviceName = Platform.OS === "android" ? "Android Phone" : "iPhone";
    const osVersion = String(Platform.Version);

    await registerDeviceAPI(
      installationId,
      Platform.OS === "ios" ? "ios" : "android",
      "phone",
      deviceName,
      osVersion,
    );

    const refreshedData: any = await getDevicesAPI();
    const refreshedDevices = Array.isArray(refreshedData)
      ? refreshedData
      : Array.isArray(refreshedData?.devices)
        ? refreshedData.devices
        : [];

    if (refreshedDevices.length === 0) return null;

    const deviceId = refreshedDevices[0].deviceId || refreshedDevices[0].id;
    await AsyncStorage.setItem(CURRENT_DEVICE_KEY, deviceId);
    return deviceId;
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('plan') || msg.includes('Device limit') || msg.includes('device limit')) {
      throw error;
    }
    return null;
  }
};
