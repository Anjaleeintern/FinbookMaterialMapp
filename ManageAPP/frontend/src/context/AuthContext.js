import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, setAuthToken, setOnUnauthorized } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSessionExpired = useCallback(() => {
    console.warn('[Auth] Session expired or invalid, clearing authentication state');
    setAuthToken(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('materialmapp_token');
    }
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleSessionExpired);
  }, [handleSessionExpired]);

  useEffect(() => {
    // Check if token exists in storage or auto-login with default session
    const initAuth = async () => {
      try {
        const savedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('materialmapp_token') : null;
        if (savedToken) {
          setAuthToken(savedToken);
          setToken(savedToken);
          const userData = await api.getMe();
          setUser(userData);
        }
      } catch (err) {
        console.warn('Auto auth validation failed:', err);
        handleSessionExpired();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [handleSessionExpired]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setAuthToken(data.access_token);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('materialmapp_token', data.access_token);
    }
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('materialmapp_token');
    }
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((newUserData) => {
    setUser((prev) => ({ ...prev, ...newUserData }));
  }, []);

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

