import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client.js';

export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAuth: (accessToken, user) =>
        set({ accessToken, user, isAuthenticated: Boolean(accessToken) }),

      clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),

      login: async (email, password, twoFactorCode) => {
        const { data } = await api.post('/auth/login', { email, password, twoFactorCode });
        set({
          accessToken: data.data.accessToken,
          user: data.data.user,
          isAuthenticated: true,
        });
        return data.data.user;
      },

      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload);
        return data.data.user;
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // ignore network errors during logout
        }
        set({ accessToken: null, user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me');
        set({ user: data.data.user, isAuthenticated: true });
        return data.data.user;
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'examforge-auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setAuth(state.accessToken, state.user);
          state.setHasHydrated(true);
        }
      },
    },
  ),
);
