import axios from "axios";
import { API_BASE_URL } from "./config";

const AUTH_EXPIRED_EVENT = "app:auth-expired";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let authRedirectInProgress = false;

const isAuthFailure = (status, message) => {
  if (status === 401) return true;

  const normalized = String(message || "").toLowerCase();
  return (
    status === 403 &&
    (normalized.includes("token") || normalized.includes("authorization"))
  );
};

const isAuthRoute = (url = "") =>
  /\/auth\/(login|register)\/?$/i.test(String(url));

const handleExpiredSession = (message) => {
  localStorage.removeItem("token");

  if (typeof window === "undefined" || authRedirectInProgress) {
    return;
  }

  authRedirectInProgress = true;

  sessionStorage.setItem(
    "auth_expired_message",
    message || "Your session expired. Please sign in again."
  );

  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        message: message || "Your session expired. Please sign in again.",
      },
    })
  );

  window.location.replace("/login");
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    const requestUrl = error.config?.url || "";

    if (isAuthRoute(requestUrl)) {
      return Promise.reject(error);
    }

    if (isAuthFailure(status, message)) {
      handleExpiredSession(message);
    }

    return Promise.reject(error);
  }
);

export { AUTH_EXPIRED_EVENT };
export default api;