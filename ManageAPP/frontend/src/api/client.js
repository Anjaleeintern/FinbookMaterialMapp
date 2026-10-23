import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Environment variables configured in frontend/.env (EXPO_PUBLIC_ prefix)
const DEPLOYED_PROD_URL = 'https://finbookmaterialmapp.onrender.com';
const LOCAL_DEV_PORT = '8001';
const PROXY_DEV_PORT = '8005';
const LOCAL_PC_IP = '192.168.1.14';

const ENV_BACKEND_HOST =
  process.env.EXPO_PUBLIC_BACKEND_HOST && process.env.EXPO_PUBLIC_BACKEND_HOST !== '192.168.1.15'
    ? process.env.EXPO_PUBLIC_BACKEND_HOST
    : LOCAL_PC_IP;

const ENV_BACKEND_PORT =
  process.env.EXPO_PUBLIC_BACKEND_PORT && process.env.EXPO_PUBLIC_BACKEND_PORT !== '8000'
    ? process.env.EXPO_PUBLIC_BACKEND_PORT
    : LOCAL_DEV_PORT;

const ENV_PROXY_PORT = process.env.EXPO_PUBLIC_PROXY_PORT || PROXY_DEV_PORT;

const getBaseUrl = () => {
  const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';

  // 1. PRODUCTION MODE: Always connect to the deployed backend URL
  if (!isDev) {
    const prodUrl =
      process.env.EXPO_PUBLIC_PROD_API_URL ||
      (process.env.EXPO_PUBLIC_API_URL &&
       !process.env.EXPO_PUBLIC_API_URL.includes('localhost') &&
       !process.env.EXPO_PUBLIC_API_URL.includes('127.0.0.1')
        ? process.env.EXPO_PUBLIC_API_URL
        : DEPLOYED_PROD_URL);
    return prodUrl.trim().replace(/\/+$/, '');
  }

  // 2. DEVELOPMENT MODE - Web:
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return `http://localhost:${ENV_BACKEND_PORT}`;
      }
      return `http://${host}:${ENV_BACKEND_PORT}`;
    }
    return `http://localhost:${ENV_BACKEND_PORT}`;
  }

  // 3. DEVELOPMENT MODE - Mobile (Expo Go / Emulator / Physical Device):
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

  // 3. Fallback to current laptop IP (192.168.1.14)
  if (!hostIp || hostIp === '192.168.1.15') {
    hostIp = LOCAL_PC_IP;
  }

  // Android Emulator standard loopback mapping
  if (Platform.OS === 'android' && (hostIp === 'localhost' || hostIp === '127.0.0.1')) {
    return `http://10.0.2.2:${ENV_BACKEND_PORT}`;
  }

  // For physical phones on Wi-Fi, connect through Bridge Proxy (8005) or Backend Port (8001)
  // Proxy 8005 runs on Node.js and reliably bypasses Windows Firewall
  return `http://${hostIp}:${ENV_PROXY_PORT}`;
};

let activeBaseUrl = getBaseUrl();
console.log(`[API] Mode: ${typeof __DEV__ !== 'undefined' && __DEV__ ? 'Development (Local)' : 'Production (Deployed)'} | Connecting to:`, activeBaseUrl);

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const fetchWithTimeout = async (url, options, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

const request = async (endpoint, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetchWithTimeout(`${activeBaseUrl}${endpoint}`, {
      ...options,
      headers,
    }, 6000);
  } catch (err) {
    // If on mobile and connection to primary port timed out or failed, try the alternate port
    if (Platform.OS !== 'web' && activeBaseUrl.includes('192.168.')) {
      const fallbackUrl = activeBaseUrl.includes(`:${ENV_PROXY_PORT}`)
        ? activeBaseUrl.replace(`:${ENV_PROXY_PORT}`, `:${ENV_BACKEND_PORT}`)
        : activeBaseUrl.replace(`:${ENV_BACKEND_PORT}`, `:${ENV_PROXY_PORT}`);
      console.warn(`[API] Connection to ${activeBaseUrl} failed (${err.message}), trying fallback: ${fallbackUrl}`);
      try {
        response = await fetchWithTimeout(`${fallbackUrl}${endpoint}`, {
          ...options,
          headers,
        }, 6000);
        // Switch to working URL for future calls
        activeBaseUrl = fallbackUrl;
      } catch (fallbackErr) {
        throw new Error(`Mobile connection failed. Please ensure your phone is connected to the same Wi-Fi as your laptop (${LOCAL_PC_IP}).`);
      }
    } else {
      throw err;
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
};

// Universal Multipart File Upload Helper (Native FileSystem.uploadAsync for Mobile, FormData + fetch for Web)
const uploadMultipartFile = async (url, file, extraParams = {}) => {
  // 1. Native Mobile Devices (Android / iOS): stream file natively from disk via OkHttp/NSURLSession
  if (Platform.OS !== 'web' && file && file.uri) {
    try {
      const mimeType =
        file.mimeType ||
        file.type ||
        (file.name?.toLowerCase().endsWith('.csv')
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const stringParams = {};
      if (extraParams) {
        Object.keys(extraParams).forEach((k) => {
          stringParams[k] = String(extraParams[k]);
        });
      }

      const uploadResult = await FileSystem.uploadAsync(url, file.uri, {
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        httpMethod: 'POST',
        fieldName: 'file',
        mimeType,
        parameters: stringParams,
        headers: {
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });

      let data = null;
      try {
        data = JSON.parse(uploadResult.body);
      } catch (e) {
        data = null;
      }

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        const errorMsg =
          data?.detail || data?.message || `File upload failed with status ${uploadResult.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (nativeErr) {
      // If error was already an API/HTTP error or file read error, rethrow
      if (nativeErr.message && !nativeErr.message.includes('uploadAsync')) {
        throw nativeErr;
      }
      console.warn('Native FileSystem upload error, attempting fallback:', nativeErr);
    }
  }

  // 2. Web Browser & Fallback: Standard browser FormData + fetch
  const formData = new FormData();
  if (file && file.uri && Platform.OS !== 'web') {
    formData.append('file', {
      uri: file.uri,
      name: file.name || 'sheet.xlsx',
      type:
        file.mimeType ||
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } else {
    formData.append('file', file);
  }

  if (extraParams) {
    Object.keys(extraParams).forEach((key) => {
      formData.append(key, String(extraParams[key]));
    });
  }

  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Upload failed with status ${response.status}`;
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
  importMasterFile: (file, preview = true, defaultCategory = 'VehicleNo') => {
    const url = `${activeBaseUrl}/api/masters/import-file?preview=${preview ? 'true' : 'false'}&default_category=${encodeURIComponent(defaultCategory)}`;
    return uploadMultipartFile(url, file, {
      preview: preview ? 'true' : 'false',
      default_category: defaultCategory,
    });
  },
  importMasterPasted: (rawText, defaultCategory = 'VehicleNo', preview = true) =>
    request('/api/masters/import-pasted', {
      method: 'POST',
      body: JSON.stringify({
        raw_text: rawText,
        default_category: defaultCategory,
        preview: !!preview,
      }),
    }),
  getMasterTemplateUrl: (format = 'xlsx') => `${activeBaseUrl}/api/masters/template?format=${format}`,
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
  getTemplateDownloadUrl: () => `${activeBaseUrl}/api/entries/template`,
  importExcel: async (file, previewOnly = false, defaultTypeMode = null, selectedSheets = null) => {
    let url = `${activeBaseUrl}/api/entries/import-excel?preview_only=${previewOnly ? 'true' : 'false'}`;
    if (defaultTypeMode && defaultTypeMode !== 'auto') {
      url += `&default_type_mode=${encodeURIComponent(defaultTypeMode)}`;
    }
    if (selectedSheets && selectedSheets.length > 0) {
      const sheetsStr = Array.isArray(selectedSheets) ? selectedSheets.join(',') : selectedSheets;
      url += `&selected_sheets=${encodeURIComponent(sheetsStr)}`;
    }

    return uploadMultipartFile(url, file);
  },
};
