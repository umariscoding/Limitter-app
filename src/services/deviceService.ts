import { API } from "../config/config";
import axiosService from "./axiosService";

export const registerDeviceAPI = async (
  installationId: string,
  platform: string,
  deviceType: string,
  deviceName: string,
  osVersion?: string,
  appVersion?: string,
) => {
  return await axiosService.post(API.RegisterDevice, {
    installationId,
    platform,
    deviceType,
    deviceName,
    osVersion,
    appVersion,
  });
};

export const getDevicesAPI = async () => {
  return await axiosService.get(API.GetDevices);
};

export const replaceDeviceAPI = async (
  oldDeviceId: string,
  installationId: string,
  platform: string,
  deviceType: string,
  deviceName: string,
  osVersion?: string,
  appVersion?: string,
) => {
  return await axiosService.post(API.ReplaceDevice, {
    oldDeviceId,
    installationId,
    platform,
    deviceType,
    deviceName,
    osVersion,
    appVersion,
  });
};
