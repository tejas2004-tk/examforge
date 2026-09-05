import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client.js';

/** Role sets used by guards and by role-scoped UI. */
export const ROLES = ['ADMIN', 'TEACHER', 'STUDENT', 'PROCTOR'];

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      // Guards must not decide anything before the persisted state is read back,
      // or a hard refresh bounces a signed-in user to the login screen.
      hasHydrated: false,

      setAuth: (accessToken, user) =>
        set({ accessToken: accessToken ?? null, user: user ?? null, isAuthenticated: Boolean(accessToken) }),

      clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      /**
       * `roles` accepts a single role or a list. With no argument it only asks
       * whether anyone is signed in, which keeps call sites free of null checks.
       */
      hasPermission: (roles) => {
        const { isAuthenticated, user } = get();
        if (!isAuthenticated || !user?.role) return false;
        if (!roles) return true;
        const allowed = Array.isArray(roles) ? roles : [roles];
        return allowed.length === 0 || allowed.includes(user.role);
      },

      login: async (email, password, twoFactorCode) => {
        const { data } = await api.post('/auth/login', { email, password, twoFactorCode });
        const { accessToken, user } = data.data;
        set({ accessToken, user, isAuthenticated: true });
        return user;
      },

      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload);
        return data.data.user;
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // A failed logout call must still clear the client session; the token
          // is useless to us either way and leaving it stranded is worse.
        }
        set({ accessToken: null, user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me');
        set({ user: data.data.user, isAuthenticated: true });
        return data.data.user;
      },

      /** Merge a partial profile update without a round trip. */
      patchUser: (partial) =>
        set((state) => (state.user ? { user: { ...state.user, ...partial } } : {})),
    }),
    {
      name: 'examforge-auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
      onRehydrateStorage: () => (state, error) => {
        // Corrupt storage must not wedge the app in a permanent loading state,
        // so hydration is marked done on the failure path too.
        if (error || !state) {
          useAuthStore.setState({ hasHydrated: true });
          return;
        }
        state.setAuth(state.accessToken, state.user);
        state.setHasHydrated(true);
      },
    },
  ),
);

/** Selector helpers keep components subscribed to one slice rather than all. */
export const selectUser = (state) => state.user;
export const selectRole = (state) => state.user?.role ?? null;
export const selectIsAuthenticated = (state) => state.isAuthenticated;

/** Non-reactive permission check for route guards and event handlers. */
export const hasPermission = (roles) => useAuthStore.getState().hasPermission(roles);
