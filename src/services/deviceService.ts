import { BASE_URL, API } from '../config/config';
import { Device } from '../interface/Device';

export const registerDeviceAPI = async (
  user_id: string,
  device_name: string,
  device_os: string
) => {
  try {
    const response = await fetch(`${BASE_URL}${API.RegisterDevice}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        device_name,
        device_os,
      }),
    });

    const data = await response.json();
    console.log('✅ Register Device API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Register Device Error:', error);
    throw error;
  }
};

export const getDevicesAPI = async (user_id: string): Promise<{ success?: boolean; data?: Device[]; message?: string }> => {
  try {
    const response = await fetch(
      `${BASE_URL}${API.GetDevices}`.replace(':user_id', user_id),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    console.log('✅ Get Devices API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Get Devices Error:', error);
    throw error;
  }
};
