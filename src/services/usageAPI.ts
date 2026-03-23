import { BASE_URL } from '../config/config';

const buildJsonHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

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
      throw new Error(`HTTP ${response.status}: ${raw?.slice(0, 160) || 'Invalid response'}`);
    }
    throw new Error('Server did not return valid JSON');
  }
};

// Record app usage to backend
export const recordUsageAPI = async (
  user_id: string,
  device_id: string,
  app_name: string,
  category_id: string | null,
  minutes_to_add: number
) => {
  try {
    const response = await fetch(`${BASE_URL}/api/usage/record`, {
      method: 'POST',
      headers: buildJsonHeaders(),
      body: JSON.stringify({
        user_id,
        device_id,
        app_name,
        category_id: category_id || null,
        minutes_to_add,
      }),
    });

    const data = await parseJsonSafely(response);
    console.log('✅ Record Usage API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Record Usage Error:', error);
    throw error;
  }
};

// Get daily usage for device
export const getDailyUsageAPI = async (
  user_id: string,
  device_id: string,
  date: string
) => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/usage/daily/${encodeURIComponent(user_id)}/${encodeURIComponent(device_id)}/${encodeURIComponent(date)}`,
      {
        method: 'GET',
        headers: buildJsonHeaders(),
      }
    );

    const data = await parseJsonSafely(response);
    console.log('✅ Get Daily Usage API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Get Daily Usage Error:', error);
    throw error;
  }
};

// Get app usage history
export const getAppHistoryAPI = async (
  user_id: string,
  app_name: string
) => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/usage/history/${encodeURIComponent(user_id)}/${encodeURIComponent(app_name)}`,
      {
        method: 'GET',
        headers: buildJsonHeaders(),
      }
    );

    const data = await parseJsonSafely(response);
    console.log('✅ Get App History API Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Get App History Error:', error);
    throw error;
  }
};

// Get weekly usage breakdown (last 7 days)
export const getWeeklyUsageAPI = async (
  user_id: string,
  device_id: string
) => {
  try {
    const url = `${BASE_URL}/api/usage/weekly/${encodeURIComponent(user_id)}/${encodeURIComponent(device_id)}`;
    console.log('🌐 [getWeeklyUsageAPI] Making request to:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: buildJsonHeaders(),
    });

    console.log('📡 [getWeeklyUsageAPI] Response status:', response.status);
    console.log('   Response headers:', {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    const data = await parseJsonSafely(response);
    
    console.log('✅ [getWeeklyUsageAPI] Parsed response:', {
      hasData: !!data,
      dataType: typeof data,
      keys: data ? Object.keys(data) : [],
      dataArray: Array.isArray(data?.data),
      dataLength: Array.isArray(data?.data) ? data.data.length : 'N/A',
      fullData: JSON.stringify(data, null, 2),
    });

    return data;
  } catch (error) {
    console.error('❌ [getWeeklyUsageAPI] Fetch error:', {
      message: String(error),
      error: error instanceof Error ? error.stack : 'Unknown error',
    });
    throw error;
  }
};

// Get total usage from backend (lifetime accumulated usage)
export const getTotalUsageAPI = async (user_id: string) => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/usage/total/${encodeURIComponent(user_id)}`,
      {
        method: 'GET',
        headers: buildJsonHeaders(),
      }
    );

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}`;
      console.warn(`⚠️ Get Total Usage failed: ${errorMsg}`);
      return {
        success: false,
        errorMessage: errorMsg,
        data: null,
      };
    }

    const data = await parseJsonSafely(response);
    console.log('✅ Get Total Usage API Response:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Get Total Usage Error:', error);
    return {
      success: false,
      errorMessage: String(error),
      data: null,
    };
  }
};
