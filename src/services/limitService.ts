import { BASE_URL, API } from '../config/config';

// ===== LIMIT API CALLS =====

const buildJsonHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Avoid ngrok browser interstitial HTML responses that break response.json().
  if (BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
};

const parseJsonSafely = async (response: Response) => {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${raw?.slice(0, 160) || 'Invalid response from server'}`);
    }
    throw new Error('Server did not return valid JSON');
  }
};

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
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id,
        device_id,
        max_time_minutes,
        app_name: app_name || null,
        category: category || null,
      }),
    });

    const data = await parseJsonSafely(response);
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
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        limit_id,
        minutes_to_add,
      }),
    });

    const data = await parseJsonSafely(response);
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
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id,
        device_id,
        limit_id,
      }),
    });

    const data = await parseJsonSafely(response);
    console.log('✅ Override API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Override Error:', error);
    throw error;
  }
};

export const getLimitsAPI = async (user_id: string, device_id: string) => {
  try {
    const endpoint = `${BASE_URL}${API.GetLimits}`
      .replace(':user_id', encodeURIComponent(user_id))
      .replace(':device_id', encodeURIComponent(device_id));

    const response = await fetch(
      endpoint,
      {
        method: 'GET',
        headers: buildJsonHeaders(),
      }
    );

    const data = await parseJsonSafely(response);
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
      `${BASE_URL}${API.DeleteLimit}`.replace(':limit_id', encodeURIComponent(limit_id)),
      {
        method: 'DELETE',
        headers: buildJsonHeaders(),
      }
    );

    const data = await parseJsonSafely(response);
    console.log('✅ Delete Limit API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Delete Limit Error:', error);
    throw error;
  }
};
