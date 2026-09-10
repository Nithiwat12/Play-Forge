import axios from "axios";
import { useAuthStore } from "../stores/authStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach the JWT (persisted by authStore) to every request. The server
// also accepts the httpOnly cookie it sets on login, but sending the
// header explicitly keeps this working even if cookies are blocked.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown, fallback = "เกิดข้อผิดพลาดบางอย่าง"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}
