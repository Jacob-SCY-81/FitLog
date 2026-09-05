import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';

const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 10000, // 10秒超时防止弱网无限制挂起
});

// --- Refresh queue (prevents multiple concurrent refresh calls) ---
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// --- Response interceptor: auto-retry on network error & auto-refresh on 401 ---
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Auto-retry on network failure or timeout for idempotent/safe requests
    if (
      (!error.response || error.code === 'ECONNABORTED' || error.response?.status === 503) &&
      originalRequest &&
      !originalRequest._networkRetry &&
      (originalRequest.method === 'get' || originalRequest.headers?.['Idempotency-Key'])
    ) {
      originalRequest._networkRetry = true;
      await new Promise(r => setTimeout(r, 600));
      return apiClient(originalRequest);
    }

    // 2. Only attempt refresh for 401s that aren't already auth requests
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh during auth calls (login, refresh itself)
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
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
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
      const newToken = data.data.accessToken;
      const newUser = data.data.user;
      if (newUser) {
        useAuthStore.getState().setAuth(newUser, newToken);
      } else {
        useAuthStore.getState().setAccessToken(newToken);
      }
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// --- Request interceptor: attach access token ---
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
