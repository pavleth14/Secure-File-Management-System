import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const code = error.response?.data?.code;

    if (code === 'INACTIVITY_TIMEOUT') {
      window.dispatchEvent(new CustomEvent('auth:inactivity-timeout'));
    }

    // The account was signed in on another device — force this session out.
    if (code === 'SESSION_REVOKED') {
      window.dispatchEvent(new CustomEvent('auth:session-revoked'));
    }

    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      code !== 'INACTIVITY_TIMEOUT' &&
      code !== 'SESSION_REVOKED' &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/register') &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/logout')
    ) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = api
          .post('/auth/refresh')
          .catch((err) => {
            throw err;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
