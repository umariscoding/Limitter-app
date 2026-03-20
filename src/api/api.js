// src/api/api.js
const BASE_URL = "https://nonremediably-nonbearded-miguel.ngrok-free.dev"; // ngrok URL

export const signupAPI = async (email, password) => {
  try {
    const res = await fetch(`${BASE_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch (err) {
    console.error("Signup API Error:", err);
    return null;
  }
};

export const loginAPI = async (email, password) => {
  try {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch (err) {
    console.error("Login API Error:", err);
    return null;
  }
};