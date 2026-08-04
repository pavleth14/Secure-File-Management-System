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
      // #region agent log
      fetch('http://127.0.0.1:7879/ingest/afe47dc1-7518-4b22-8821-40057cec5169',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a0e42e'},body:JSON.stringify({sessionId:'a0e42e',location:'client.js:interceptor:401',message:'401 intercepted — attempting refresh',data:{url:original.url,code,hasRefreshPromise:Boolean(refreshPromise)},timestamp:Date.now(),hypothesisId:'H2',runId:'pre-fix'})}).catch(()=>{});
      // #endregion

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
        // #region agent log
        fetch('http://127.0.0.1:7879/ingest/afe47dc1-7518-4b22-8821-40057cec5169',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a0e42e'},body:JSON.stringify({sessionId:'a0e42e',location:'client.js:interceptor:refresh-ok',message:'refresh succeeded — retrying request',data:{url:original.url},timestamp:Date.now(),hypothesisId:'H2',runId:'pre-fix'})}).catch(()=>{});
        // #endregion
        return api(original);
      } catch (refreshErr) {
        // #region agent log
        fetch('http://127.0.0.1:7879/ingest/afe47dc1-7518-4b22-8821-40057cec5169',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a0e42e'},body:JSON.stringify({sessionId:'a0e42e',location:'client.js:interceptor:refresh-fail',message:'refresh failed — rejecting original',data:{url:original.url,refreshStatus:refreshErr.response?.status,refreshCode:refreshErr.response?.data?.code},timestamp:Date.now(),hypothesisId:'H2',runId:'pre-fix'})}).catch(()=>{});
        // #endregion
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
