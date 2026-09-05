import { create } from 'zustand';
import axios from 'axios';

let initPromise = null;

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isInitialized: false,

  setAuth: (user, accessToken) => set({ user, accessToken, isInitialized: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => set({ user: null, accessToken: null, isInitialized: true }),
  setInitialized: (isInitialized) => set({ isInitialized }),

  checkAuth: async () => {
    // If already initialized, return cached user
    if (get().isInitialized) {
      return get().user;
    }
    // Prevent duplicate concurrent requests
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      try {
        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );
        if (data?.data?.accessToken) {
          const user = data.data.user || null;
          const accessToken = data.data.accessToken;
          set({ user, accessToken, isInitialized: true });
          return user;
        }
      } catch {
        // Refresh failed (no cookie, expired, etc.) — clean guest state
        set({ user: null, accessToken: null, isInitialized: true });
      } finally {
        set({ isInitialized: true });
        initPromise = null;
      }
      return null;
    })();

    return initPromise;
  },
}));
