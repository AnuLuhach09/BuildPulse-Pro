import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

/**
 * Axios Client with JWT Interceptors
 *
 * WHY interceptors:
 * - REQUEST interceptor: Automatically attaches Authorization header
 *   from Zustand store — no need to pass tokens manually in every hook.
 * - RESPONSE interceptor: On 401 (token expired), silently refreshes
 *   the access token and retries the original request. The user never
 *   sees an error for a simple token expiry.
 */

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Include httpOnly cookies (refresh token)
  timeout: 30_000,
});

// Track if we're currently refreshing (prevent multiple simultaneous refreshes)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// ── Request Interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(
        '/api/v1/auth/refresh',
        {},
        { withCredentials: true }
      );
      const { accessToken } = response.data.data;
      useAuthStore.getState().setAccessToken(accessToken);
      processQueue(null, accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
