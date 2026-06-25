import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT_MS = 1000 * 60 *30;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when the session is forcibly ended (e.g. logged in on another device).
  const [sessionMessage, setSessionMessage] = useState('');
  const logoutRef = useRef(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('token');
  }, []);

  useEffect(() => {
    async function init() {
      let authenticated = await fetchMe();

      if (!authenticated) {
        try {
          await api.post('/auth/refresh');
          authenticated = await fetchMe();
        } catch {
          setUser(null);
        }
      }

      setLoading(false);
    }
    init();
  }, [fetchMe]);

  const login = async (email, password) => {
    setSessionMessage('');
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  };

  // Authenticated admins/super-admins create accounts; this does NOT change the
  // current session (the new account is not auto-logged-in).
  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data.user;
  };

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  logoutRef.current = logout;

  useEffect(() => {
    const handleInactivityTimeout = () => {
      setUser(null);
      setSessionMessage('Your session expired due to inactivity. Please sign in again.');
    };

    const handleSessionRevoked = () => {
      setUser(null);
      setSessionMessage(
        'You were signed out because your account was used on another device.'
      );
    };

    window.addEventListener('auth:inactivity-timeout', handleInactivityTimeout);
    window.addEventListener('auth:session-revoked', handleSessionRevoked);
    return () => {
      window.removeEventListener('auth:inactivity-timeout', handleInactivityTimeout);
      window.removeEventListener('auth:session-revoked', handleSessionRevoked);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logoutRef.current?.();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isAdminOnly = user?.role === ROLES.ADMIN;
  const isAdmin = user?.role === ROLES.ADMIN || isSuperAdmin;
  const isUser = user?.role === ROLES.USER;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionMessage,
        clearSessionMessage: () => setSessionMessage(''),
        login,
        register,
        logout,
        fetchMe,
        isSuperAdmin,
        isAdminOnly,
        isAdmin,
        isUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
