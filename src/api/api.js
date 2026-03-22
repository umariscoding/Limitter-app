// src/api/api.js
import { BASE_URL, API } from '../config/config';

export const signupAPI = async (email, password, confirmPassword, name = "User") => {
  try {
    console.log('🔄 Signup API: Connecting to', BASE_URL);
    
    const res = await fetch(`${BASE_URL}${API.SIGNUP}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword, name }),
    });

    console.log('✅ Signup API: Response status', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Signup API HTTP Error:', res.status, errorText.substring(0, 500));
      throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await res.text();
      console.error('❌ Signup response is not JSON:', responseText.substring(0, 500));
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const data = await res.json();
    console.log('✅ Signup API: Response data:', data);
    return data;
  } catch (err) {
    console.error('❌ Signup API error:', err?.message);
    return { success: false, message: err?.message || "Signup failed" };
  }
};

export const loginAPI = async (email, password) => {
  try {
    console.log('🔄 Login API: Connecting to', BASE_URL);
    
    const res = await fetch(`${BASE_URL}${API.LogIn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('✅ Login API: Response status', res.status);
    console.log('✅ Login API: Response headers', res.headers);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Login API HTTP Error:', res.status);
      console.error('❌ Response body:', errorText.substring(0, 500));
      throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = res.headers.get('content-type');
    console.log('Content-Type:', contentType);

    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await res.text();
      console.error('❌ Response is not JSON:', responseText.substring(0, 500));
      throw new Error(`Invalid content type: ${contentType}. Expected JSON, got: ${responseText.substring(0, 100)}`);
    }

    const data = await res.json();
    console.log('✅ Login API: Parsed JSON:', data);

    return data;
  } catch (error) {
    console.error('❌ Login API error:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error type:', error?.constructor?.name);
    
    // Provide user-friendly message
    if (error?.message?.includes('JSON')) {
      throw new Error('Backend returned invalid response (not JSON). Check backend server logs');
    }
    if (error?.message?.includes('Network')) {
      throw new Error('Network error - check backend URL and internet connection');
    }
    if (error?.message?.includes('timeout')) {
      throw new Error('Request timeout - backend server may be down');
    }
    
    throw error;
  }
};