import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Centralized state store for active and completed downloads
let currentState = {
  visible: false,
  status: 'idle', // 'idle' | 'downloading' | 'completed' | 'error'
  filename: '',
  title: '',
  fileUri: null,
  mimeType: null,
  error: null,
  progress: null,
};

const listeners = new Set();
let autoDismissTimer = null;

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentState });
    } catch (err) {
      console.warn('[DownloadService] Listener error:', err);
    }
  });
};

const setState = (partialState) => {
  currentState = { ...currentState, ...partialState };
  notifyListeners();
};

const getUTI = (mimeType = '', filename = '') => {
  const lower = (mimeType || '').toLowerCase();
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (lower.includes('pdf') || ext === 'pdf') return 'com.adobe.pdf';
  if (lower.includes('spreadsheet') || lower.includes('excel') || ext === 'xlsx') return 'com.microsoft.excel.xlsx';
  if (lower.includes('csv') || ext === 'csv') return 'public.comma-separated-values-text';
  return undefined;
};

export const downloadService = {
  getState: () => ({ ...currentState }),

  subscribe: (listener) => {
    listeners.add(listener);
    listener({ ...currentState });
    return () => listeners.delete(listener);
  },

  dismiss: () => {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
    setState({ visible: false, status: 'idle' });
  },

  openCurrentFile: async () => {
    const { fileUri, mimeType, filename } = currentState;
    if (!fileUri) return false;
    return downloadService.openFile(fileUri, mimeType, filename);
  },

  openFile: async (fileUri, mimeType = '', filename = '') => {
    if (!fileUri) return false;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(fileUri, '_blank');
        return true;
      }
      return false;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType || undefined,
          dialogTitle: `Open / Save ${filename || 'File'}`,
          UTI: getUTI(mimeType, filename),
        });
        return true;
      } else {
        await Linking.openURL(fileUri);
        return true;
      }
    } catch (err) {
      console.warn('[DownloadService] Error opening file:', err);
      try {
        await Linking.openURL(fileUri);
        return true;
      } catch (linkErr) {
        console.error('[DownloadService] Linking fallback failed:', linkErr);
        return false;
      }
    }
  },

  /**
   * Register a locally prepared file (e.g., PDF generated on-device) as completed download
   */
  registerCompletedDownload: async ({
    fileUri,
    filename = 'download.pdf',
    mimeType = 'application/pdf',
    title = 'Document Downloaded',
    openImmediately = true,
  }) => {
    if (autoDismissTimer) clearTimeout(autoDismissTimer);

    setState({
      visible: true,
      status: 'completed',
      filename,
      title: title || `${filename} Ready`,
      fileUri,
      mimeType,
      error: null,
      progress: 100,
    });

    if (openImmediately) {
      setTimeout(async () => {
        try {
          await downloadService.openFile(fileUri, mimeType, filename);
        } catch (err) {
          console.warn('[DownloadService] Auto open failed:', err);
        }
      }, 300);
    }

    // Keep visible for 12 seconds so user can click anytime
    autoDismissTimer = setTimeout(() => {
      setState({ visible: false, status: 'idle' });
    }, 12000);

    return fileUri;
  },

  /**
   * Download a remote file from an API endpoint URL with top banner progress & native open
   */
  downloadFile: async ({
    url,
    filename = 'download',
    mimeType = 'application/octet-stream',
    title = 'Downloading File...',
    headers = {},
    openImmediately = true,
  }) => {
    if (autoDismissTimer) clearTimeout(autoDismissTimer);

    setState({
      visible: true,
      status: 'downloading',
      filename,
      title: title || `Downloading ${filename}...`,
      fileUri: null,
      mimeType,
      error: null,
      progress: null,
    });

    try {
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        const blob = await response.blob();
        if (typeof window !== 'undefined') {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

          setState({
            visible: true,
            status: 'completed',
            filename,
            title: 'Download Complete',
            fileUri: blobUrl,
            mimeType,
            error: null,
          });

          autoDismissTimer = setTimeout(() => {
            setState({ visible: false, status: 'idle' });
          }, 8000);

          return blobUrl;
        }
        return null;
      }

      // Mobile (Android & iOS): Download directly using expo-file-system legacy API
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const targetUri = `${baseDir}${filename}`;

      // Download file to local app storage
      const downloadResult = await FileSystem.downloadAsync(url, targetUri, {
        headers: headers || {},
      });

      if (!downloadResult || !downloadResult.uri) {
        throw new Error('Download failed: No file URI received');
      }

      const localUri = downloadResult.uri;

      setState({
        visible: true,
        status: 'completed',
        filename,
        title: 'Download Complete • Tap to Open',
        fileUri: localUri,
        mimeType,
        error: null,
        progress: 100,
      });

      if (openImmediately) {
        setTimeout(async () => {
          try {
            await downloadService.openFile(localUri, mimeType, filename);
          } catch (err) {
            console.warn('[DownloadService] Open after download failed:', err);
          }
        }, 300);
      }

      // Keep top banner visible for 12 seconds so user can tap to re-open anytime
      autoDismissTimer = setTimeout(() => {
        setState({ visible: false, status: 'idle' });
      }, 12000);

      return localUri;
    } catch (err) {
      console.error('[DownloadService] Download error:', err);
      setState({
        visible: true,
        status: 'error',
        filename,
        title: 'Download Failed',
        fileUri: null,
        mimeType,
        error: err.message || 'Network download error',
      });

      autoDismissTimer = setTimeout(() => {
        setState({ visible: false, status: 'idle' });
      }, 8000);

      throw err;
    }
  },
};
