import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDevicesAPI, registerDeviceAPI } from './deviceService';
import { Device } from '../interface/Device';

const CURRENT_DEVICE_KEY_PREFIX = 'APPGUARD_CURRENT_DEVICE_ID_';

const getStorageKey = (userId: string) => `${CURRENT_DEVICE_KEY_PREFIX}${userId}`;

const parseCreatedAt = (device: Device) => Number(device.created_at || 0);

export const resolveCurrentDeviceId = async (userId: string): Promise<string | null> => {
  if (!userId) return null;

  const storageKey = getStorageKey(userId);

  try {
    const [devicesResponse, cachedId] = await Promise.all([
      getDevicesAPI(userId),
      AsyncStorage.getItem(storageKey),
    ]);

    const devices = Array.isArray(devicesResponse?.data) ? devicesResponse.data : [];

    if (cachedId && devices.some(device => device.id === cachedId)) {
      return cachedId;
    }

    if (devices.length > 0) {
      const latest = [...devices].sort((a, b) => parseCreatedAt(b) - parseCreatedAt(a))[0];
      await AsyncStorage.setItem(storageKey, latest.id);
      return latest.id;
    }

    const deviceName = Platform.OS === 'android' ? 'Android Phone' : 'iPhone';
    const deviceOS = `${Platform.OS} ${String(Platform.Version)}`;

    await registerDeviceAPI(userId, deviceName, deviceOS);

    const refreshed = await getDevicesAPI(userId);
    const refreshedDevices = Array.isArray(refreshed?.data) ? refreshed.data : [];

    if (refreshedDevices.length === 0) {
      return null;
    }

    const latest = [...refreshedDevices].sort((a, b) => parseCreatedAt(b) - parseCreatedAt(a))[0];
    await AsyncStorage.setItem(storageKey, latest.id);
    return latest.id;
  } catch (error) {
    console.error('Failed to resolve current device id:', error);
    return null;
  }
};
