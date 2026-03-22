// Backend Diagnostic Utility - helps debug connection issues
import { BASE_URL } from '../config/config';

export const diagnoseBackend = async () => {
  console.log('🔍 Starting backend diagnosis...');
  
  const results = {
    baseUrl: BASE_URL,
    ping: false,
    apiReachable: false,
    jsonValid: false,
    fullError: null as string | null,
  };

  try {
    // Test 1: Basic connectivity
    console.log('📡 Test 1: Pinging backend at', BASE_URL);
    const pingRes = await fetch(`${BASE_URL}/`, {
      method: 'GET',
    });
    results.ping = pingRes.ok;
    console.log('✅ Ping status:', pingRes.status);

    // Test 2: Check auth endpoint
    console.log('📡 Test 2: Checking /api/auth/login endpoint');
    const authRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
    });
    results.apiReachable = true;
    console.log('✅ Auth endpoint status:', authRes.status);

    // Test 3: Check response is JSON
    const contentType = authRes.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await authRes.json();
      results.jsonValid = true;
      console.log('✅ Response is valid JSON');
      console.log('Response:', data);
    } else {
      const text = await authRes.text();
      console.error('❌ Response is NOT JSON. Content-Type:', contentType);
      console.error('Response body:', text.substring(0, 500));
    }
  } catch (error: any) {
    results.fullError = error?.message || 'Unknown error';
    console.error('❌ Diagnosis failed:', error?.message);
  }

  console.log('📊 Diagnosis Results:', results);
  return results;
};
