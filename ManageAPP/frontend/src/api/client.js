import { Platform, NativeModules } from 'react-native';

// Environment variables configured in frontend/.env (EXPO_PUBLIC_ prefix)
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const ENV_BACKEND_HOST = process.env.EXPO_PUBLIC_BACKEND_HOST || '192.168.1.15';
const ENV_BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '8000';
const ENV_PROXY_PORT = process.env.EXPO_PUBLIC_PROXY_PORT || '8005';

const getBaseUrl = () => {
  // If an explicit API URL is set in .env, prioritize it
  if (ENV_API_URL && ENV_API_URL.trim()) {
    return ENV_API_URL.trim().replace(/\/+$/, '');
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return `http://localhost:${ENV_BACKEND_PORT}`;
      }
      // When opened on mobile browser using PC's Wi-Fi IP
      return `http://${host}:${ENV_PROXY_PORT}`;
    }
    return `http://localhost:${ENV_BACKEND_PORT}`;
  }

  // Real Android / iOS phone in Expo Go:
  let hostIp = null;

  // 1. Auto-detect host IP from Metro bundler's scriptURL (Guaranteed in React Native / Expo Go)
  if (NativeModules?.SourceCode?.scriptURL) {
    const match = NativeModules.SourceCode.scriptURL.match(/https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      hostIp = match[1];
    }
  }

  // 2. Check Expo Constants fields
  if (!hostIp) {
    try {
      const Constants = require('expo-constants').default || require('expo-constants');
      const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.debuggerHost ||
        Constants.manifest2?.extra?.expoGo?.debuggerHost ||
        Constants.manifest2?.extra?.expoClient?.hostUri ||
        Constants.manifest?.debuggerHost ||
        (Constants.experienceUrl ? Constants.experienceUrl.replace(/^[^:]+:\/\//, '') : null);
      if (hostUri) {
        hostIp = hostUri.split(':')[0];
      }
    } catch (e) {}
  }

  // 3. Fallback to host configured in .env
  if (!hostIp) {
    hostIp = ENV_BACKEND_HOST;
  }

  // Connect to port configured in .env
  return `http://${hostIp}:${ENV_PROXY_PORT}`;
};

const BASE_URL = getBaseUrl();
console.log('[API] Connecting to backend at:', BASE_URL);

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};

export const api = {
  // Auth
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email, password, name) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  getMe: () => request('/api/auth/me'),
  logout: () =>
    request('/api/auth/logout', {
      method: 'POST',
    }),

  // Masters
  getMasters: () => request('/api/masters'),
  getMastersDetails: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category && params.category !== 'All') q.append('category', params.category);
    if (params.search) q.append('search', params.search);
    if (params.status && params.status !== 'All') q.append('status', params.status);
    const qs = q.toString();
    return request(`/api/masters/all${qs ? `?${qs}` : ''}`);
  },
  addMasterItem: (category, value, status = 'Active') =>
    request('/api/masters', {
      method: 'POST',
      body: JSON.stringify({ category, value, status }),
    }),
  updateMasterItem: (id, data) =>
    request(`/api/masters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  bulkAddMasters: (category, items, status = 'Active') =>
    request('/api/masters/bulk', {
      method: 'POST',
      body: JSON.stringify({ category, items, status }),
    }),
  bulkDeleteMasters: (ids) =>
    request('/api/masters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  deleteMasterItem: (category, value) =>
    request(`/api/masters?category=${encodeURIComponent(category)}&value=${encodeURIComponent(value)}`, {
      method: 'DELETE',
    }),

  // Entries
  getEntries: (search = '') =>
    request(`/api/entries${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getNextChallan: () => request('/api/entries/next-challan'),
  createEntry: (entryData) =>
    request('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entryData),
    }),
  getSummary: () => request('/api/entries/summary'),
  deleteEntry: (id, savedIn) =>
    request(`/api/entries/${id}${savedIn ? `?saved_in=${encodeURIComponent(savedIn)}` : ''}`, {
      method: 'DELETE',
    }),
  bulkDeleteEntries: (items) =>
    request('/api/entries/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(Array.isArray(items) && typeof items[0] === 'string' ? { ids: items } : { items }),
    }),

  // Excel Bulk Import & Template
  getTemplateDownloadUrl: () => `${BASE_URL}/api/entries/template`,
  importExcel: async (file, previewOnly = false, defaultTypeMode = null, selectedSheets = null) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };

    let url = `${BASE_URL}/api/entries/import-excel?preview_only=${previewOnly ? 'true' : 'false'}`;
    if (defaultTypeMode && defaultTypeMode !== 'auto') {
      url += `&default_type_mode=${encodeURIComponent(defaultTypeMode)}`;
    }
    if (selectedSheets && selectedSheets.length > 0) {
      const sheetsStr = Array.isArray(selectedSheets) ? selectedSheets.join(',') : selectedSheets;
      url += `&selected_sheets=${encodeURIComponent(sheetsStr)}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || `Excel upload failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },
};
