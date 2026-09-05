import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const { response } = error;

    if (response?.status === 401 && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAuth(data.data.accessToken, data.data.user);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
