import { API, BASE_URL } from "../config/config.ts";
export const loginService = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}${API.LogIn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return res.json();
};
export const signupService = async (email: string, password: string, name: string) => {
  const res = await fetch(`${BASE_URL}${API.SIGNUP}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, name }),
  });

  return res.json();
};