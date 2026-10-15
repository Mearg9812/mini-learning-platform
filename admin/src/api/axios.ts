import axios from "axios";

// Create a custom delivery driver pointing to our Node backend
const api = axios.create({
  baseURL: "http://localhost:3000",
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
