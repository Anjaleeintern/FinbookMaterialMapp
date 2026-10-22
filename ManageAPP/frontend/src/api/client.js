import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Environment variables configured in frontend/.env (EXPO_PUBLIC_ prefix)
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://finbookmaterialmapp.onrender.com';
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    const url = `${BASE_URL}/api/masters/import-file?preview=${preview ? 'true' : 'false'}&default_category=${encodeURIComponent(defaultCategory)}`;
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
  getMasterTemplateUrl: (format = 'xlsx') => `${BASE_URL}/api/masters/template?format=${format}`,
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
    let url = `${BASE_URL}/api/entries/import-excel?preview_only=${previewOnly ? 'true' : 'false'}`;
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
