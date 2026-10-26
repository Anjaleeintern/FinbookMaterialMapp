import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { downloadService } from '../services/downloadService';

export const TopDownloadBanner = () => {
  const [downloadState, setDownloadState] = useState(() => downloadService.getState());
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to download events
  useEffect(() => {
    const unsubscribe = downloadService.subscribe((state) => {
      setDownloadState(state);
    });
    return unsubscribe;
  }, []);

  // Slide animation in/out
  useEffect(() => {
    if (downloadState.visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [downloadState.visible, slideAnim]);

  // Pulse animation while downloading
  useEffect(() => {
    if (downloadState.status === 'downloading') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.97,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [downloadState.status, pulseAnim]);

  if (!downloadState.visible) {
    return null;
  }

  const topInset =
    Platform.OS === 'web'
      ? 12
      : Math.max(insets?.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24) + 6;

  const isCompleted = downloadState.status === 'completed';
  const isError = downloadState.status === 'error';
  const isDownloading = downloadState.status === 'downloading';

  const handlePressBanner = () => {
    if (isCompleted) {
      downloadService.openCurrentFile();
    }
  };

  const handleDismiss = (e) => {
    e?.stopPropagation?.();
    downloadService.dismiss();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          top: topInset,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={isCompleted ? 0.85 : 1}
        onPress={handlePressBanner}
        style={[
          styles.container,
          isDownloading && styles.containerDownloading,
          isCompleted && styles.containerCompleted,
          isError && styles.containerError,
        ]}
      >
        {/* Left Icon */}
        <View style={styles.iconContainer}>
          {isDownloading && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </Animated.View>
          )}
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={26} color="#34d399" />
          )}
          {isError && (
            <Ionicons name="alert-circle" size={26} color="#f87171" />
          )}
        </View>

        {/* Center Content */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.titleText,
                isCompleted && styles.titleCompleted,
                isError && styles.titleError,
              ]}
              numberOfLines={1}
            >
              {isDownloading && '⬇️ Downloading File...'}
              {isCompleted && '✅ Download Complete • Tap to Open'}
              {isError && '❌ Download Failed'}
            </Text>
          </View>
          <Text
            style={[
              styles.filenameText,
              isCompleted && styles.filenameCompleted,
            ]}
            numberOfLines={1}
          >
            {downloadState.filename || 'Report file'}
          </Text>
          {isError && downloadState.error && (
            <Text style={styles.errorSubtext} numberOfLines={1}>
              {downloadState.error}
            </Text>
          )}
        </View>

        {/* Right Actions */}
        <View style={styles.actionContainer}>
          {isCompleted && (
            <View style={styles.openBtnBadge}>
              <Ionicons name="folder-open-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.openBtnText}>Open</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Subtle Animated Bottom Accent Bar for in-progress download */}
        {isDownloading && (
          <View style={styles.bottomAccentTrack}>
            <View style={styles.bottomAccentBar} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999999,
    elevation: 99999,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  containerDownloading: {
    backgroundColor: '#0f172a',
    borderColor: '#0284c7',
  },
  containerCompleted: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  containerError: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  titleCompleted: {
    color: '#ecfdf5',
  },
  titleError: {
    color: '#fef2f2',
  },
  filenameText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  filenameCompleted: {
    color: '#a7f3d0',
    fontWeight: '600',
  },
  errorSubtext: {
    fontSize: 10,
    color: '#fca5a5',
    marginTop: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  openBtnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  openBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bottomAccentTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
  },
  bottomAccentBar: {
    width: '60%',
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
});
