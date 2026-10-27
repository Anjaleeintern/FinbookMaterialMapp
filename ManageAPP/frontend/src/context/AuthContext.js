import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, setAuthToken, setOnUnauthorized } from '../api/client';
import { saveAuthSession, getAuthSession, clearAuthSession } from '../services/authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSessionExpired = useCallback(async () => {
    console.warn('[Auth] Session expired or logged out, clearing authentication state');
    setAuthToken(null);
    await clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleSessionExpired);
  }, [handleSessionExpired]);

  useEffect(() => {
    let isMounted = true;
    // Check if persistent token & user session exists in local storage
    const initAuth = async () => {
      try {
        const session = await getAuthSession();
        if (session?.token) {
          setAuthToken(session.token);
          if (isMounted) {
            setToken(session.token);
            // Immediately restore cached user profile so the app loads directly without flashing login!
            if (session.user) {
              setUser(session.user);
            }
          }

          // Validate or refresh user profile in background
          try {
            const userData = await api.getMe();
            if (isMounted) {
              setUser(userData);
              await saveAuthSession(session.token, userData);
            }
          } catch (netErr) {
            // Only force logout if the server explicitly returned 401 Unauthorized
            const statusCode = netErr?.status || netErr?.response?.status;
            if (statusCode === 401) {
              console.warn('[Auth] Server rejected token with 401:', netErr);
              await handleSessionExpired();
            } else {
              // Network error or offline - keep the user logged in seamlessly!
              console.log('[Auth] Background validation skipped (offline/network), keeping persistent session');
            }
          }
        }
      } catch (err) {
        console.warn('Auto auth validation error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, [handleSessionExpired]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setAuthToken(data.access_token);
    await saveAuthSession(data.access_token, data.user);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore network error on logout
    }
    setAuthToken(null);
    await clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((newUserData) => {
    setUser((prev) => {
      const updated = { ...prev, ...newUserData };
      if (token) {
        saveAuthSession(token, updated);
      }
      return updated;
    });
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, updateUser }),
    [user, token, loading, login, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

