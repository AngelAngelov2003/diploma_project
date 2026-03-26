import axios from "axios";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
});

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
    const message =
      error.response?.data?.error || error.response?.data || "";

    if (
      status === 401 &&
      typeof message === "string" &&
      message.toLowerCase().includes("token")
    ) {
      localStorage.removeItem("token");
    }

    return Promise.reject(error);
  }
);

export default api;