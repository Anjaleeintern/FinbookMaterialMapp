import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const AUTH_FILE_NAME = 'materialmapp_session.json';
const AUTH_TOKEN_KEY = 'materialmapp_token';
const AUTH_USER_KEY = 'materialmapp_user';

/**
 * Returns the native sandbox file path for persistent authentication storage on Android/iOS.
 * Returns null on Web.
 */
const getNativeAuthFilePath = () => {
  if (Platform.OS === 'web' || !FileSystem?.documentDirectory) {
    return null;
  }
  return `${FileSystem.documentDirectory}${AUTH_FILE_NAME}`;
};

/**
 * Persists the authentication session (JWT token + User object) permanently across app restarts.
 * Works on Mobile (Android / iOS via FileSystem sandbox) and Web (via localStorage).
 */
export const saveAuthSession = async (token, user = null) => {
  if (!token) return;
  try {
    const payload = JSON.stringify({
      token,
      user,
      savedAt: Date.now(),
    });

    // 1. Web LocalStorage persistence
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        if (user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        }
      } catch (webErr) {
        console.warn('[authStorage] Web localStorage save failed:', webErr);
      }
    }

    // 2. Mobile Native File Storage persistence (Android / iOS)
    const filePath = getNativeAuthFilePath();
    if (filePath) {
      await FileSystem.writeAsStringAsync(filePath, payload, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  } catch (err) {
    console.warn('[authStorage] saveAuthSession error:', err);
  }
};

/**
 * Retrieves the stored session on app startup.
 * Returns { token: string, user: object | null } or null.
 */
export const getAuthSession = async () => {
  try {
    // 1. Check Mobile Native File Storage first
    const filePath = getNativeAuthFilePath();
    if (filePath) {
      try {
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(filePath, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.token) {
              return {
                token: parsed.token,
                user: parsed.user || null,
              };
            }
          }
        }
      } catch (nativeErr) {
        console.warn('[authStorage] Native session read error:', nativeErr);
      }
    }

    // 2. Check Web LocalStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const userRaw = localStorage.getItem(AUTH_USER_KEY);
        if (token) {
          let user = null;
          if (userRaw) {
            try {
              user = JSON.parse(userRaw);
            } catch (e) {}
          }
          return { token, user };
        }
      } catch (webErr) {
        console.warn('[authStorage] Web session read error:', webErr);
      }
    }
  } catch (err) {
    console.warn('[authStorage] getAuthSession error:', err);
  }
  return null;
};

/**
 * Clears the session permanently when user explicitly taps Logout.
 */
export const clearAuthSession = async () => {
  try {
    // 1. Clear Web LocalStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      } catch (e) {}
    }

    // 2. Clear Mobile Native File Storage
    const filePath = getNativeAuthFilePath();
    if (filePath) {
      try {
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      } catch (nativeErr) {
        console.warn('[authStorage] Native session delete error:', nativeErr);
      }
    }
  } catch (err) {
    console.warn('[authStorage] clearAuthSession error:', err);
  }
};
