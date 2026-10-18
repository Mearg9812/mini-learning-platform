import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// The "Interceptor" stops the driver right before he leaves React...
api.interceptors.request.use((config) => {
  // 1. Check if we have a token saved in the browser's Local Storage
  const token = localStorage.getItem("token");

  // 2. If we do, slap it onto the request headers!
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 3. Let the driver go!
  return config;
});

export default api;
