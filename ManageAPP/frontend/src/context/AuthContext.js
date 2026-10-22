import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

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
        setAuthToken(null);
        setToken(null);
        setUser(null);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('materialmapp_token');
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

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

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

