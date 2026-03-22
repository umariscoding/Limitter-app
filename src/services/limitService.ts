import { BASE_URL, API } from '../config/config';

// ===== LIMIT API CALLS =====

export const createLimitAPI = async (
  user_id: string,
  device_id: string,
  max_time_minutes: number,
  app_name?: string | null,
  category?: string | null
) => {
  try {
    const response = await fetch(`${BASE_URL}${API.CreateLimit}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        device_id,
        max_time_minutes,
        app_name: app_name || null,
        category: category || null,
      }),
    });

    const data = await response.json();
    console.log('✅ Create Limit API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Create Limit Error:', error);
    throw error;
  }
};

export const updateUsageAPI = async (limit_id: string, minutes_to_add: number) => {
  try {
    const response = await fetch(`${BASE_URL}${API.UpdateUsage}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit_id,
        minutes_to_add,
      }),
    });

    const data = await response.json();
    console.log('✅ Update Usage API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Update Usage Error:', error);
    throw error;
  }
};

export const useOverrideAPI = async (
  user_id: string,
  device_id: string,
  limit_id: string
) => {
  try {
    const response = await fetch(`${BASE_URL}${API.Override}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        device_id,
        limit_id,
      }),
    });

    const data = await response.json();
    console.log('✅ Override API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Override Error:', error);
    throw error;
  }
};

export const getLimitsAPI = async (user_id: string, device_id: string) => {
  try {
    const response = await fetch(
      `${BASE_URL}${API.GetLimits}`.replace(':user_id', user_id).replace(':device_id', device_id),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    console.log('✅ Get Limits API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Get Limits Error:', error);
    throw error;
  }
};

export const deleteLimitAPI = async (limit_id: string) => {
  try {
    const response = await fetch(
      `${BASE_URL}${API.DeleteLimit}`.replace(':limit_id', limit_id),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    console.log('✅ Delete Limit API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Delete Limit Error:', error);
    throw error;
  }
};
