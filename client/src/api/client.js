import axios from "axios";
import { API_BASE_URL } from "./config";
import { toast } from "react-toastify";

const api = axios.create({ baseURL: API_BASE_URL });

const isAuthRoute = (url) => {
  const u = String(url || "");
  return (
    u.includes("/auth/login") ||
    u.includes("/auth/register") ||
    u.includes("/auth/forgot-password") ||
    u.includes("/auth/reset-password")
  );
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const skipErrorToast = Boolean(error.config?.skipErrorToast);

    if (status === 401 && !isAuthRoute(url)) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") window.location.href = "/login";
      return Promise.reject(error);
    }

    if (!skipErrorToast && !isAuthRoute(url) && status && status >= 500) {
      toast.error("Server error. Please try again.");
    }

    return Promise.reject(error);
  }
);

export default api;