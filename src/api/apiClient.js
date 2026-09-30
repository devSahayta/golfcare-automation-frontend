// src/api/apiClient.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

// Registered once from App.jsx with Kinde's getToken. Using an interceptor
// instead of a one-time header means every request fetches a fresh token
// right before it fires — no race with whichever page's effect happens to
// run first after login.
let tokenGetter = null;

export const registerTokenGetter = (fn) => {
  tokenGetter = fn;
};

api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error("Failed to attach auth token:", err);
    }
  }
  return config;
});

// Kept for compatibility — no longer the primary path, but harmless if
// anything else still calls it directly.
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export default api;
