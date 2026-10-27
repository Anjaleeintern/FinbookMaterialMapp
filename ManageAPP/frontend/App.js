import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Navbar } from './src/components/Navbar';
import { Sidebar } from './src/components/Sidebar';
import { AllEntriesView } from './src/components/AllEntriesView';
import { DeliveryEntriesFormModal } from './src/components/DeliveryEntriesFormModal';
import { ExcelImportModal } from './src/components/ExcelImportModal';
import { MastersView } from './src/components/MastersView';
import { DashboardView } from './src/components/DashboardView';
import { ProfileView } from './src/components/ProfileView';
import { LoginView } from './src/components/LoginView';
import { PartyWiseSalesModal } from './src/components/PartyWiseSalesModal';
import { EntryInvoicePdfModal } from './src/components/EntryInvoicePdfModal';
import { TopDownloadBanner } from './src/components/TopDownloadBanner';
import * as Updates from 'expo-updates';
import { api } from './src/api/client';
import './style.css';

const AppLoadingScreen = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.97,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.65,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, fadeAnim]);

  return (
    <View style={styles.loadingScreenRoot}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.loadingScreenContent}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center' }}>
          <Image
            source={require('./assets/app-logo.png')}
            style={styles.loadingLogoImage}
            resizeMode="contain"
          />
        </Animated.View>
        <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 24 }} />
        <Animated.Text style={[styles.loadingScreenText, { opacity: fadeAnim }]}>
          Loading MaterialMApp...
        </Animated.Text>
      </View>
    </View>
  );
};

const MainApp = () => {
  const { user, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [createdInvoiceEntry, setCreatedInvoiceEntry] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [directPartySalesMonth, setDirectPartySalesMonth] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'party-sales') {
        return params.get('month') || 'all';
      }
    }
    return null;
  });

  const [entries, setEntries] = useState([]);
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entriesFilter, setEntriesFilter] = useState(null);

  // Track visited tabs: lazy-mount tabs on their first visit, then keep them alive in memory for 0ms instant smooth switching
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['dashboard']));

  const handleSelectTab = useCallback((tab) => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

  // Proactively check and apply EAS OTA preview updates on app startup
  useEffect(() => {
    let active = true;
    const checkAndApplyUpdates = async () => {
      if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) {
        return;
      }
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('[Updates] New preview update detected, downloading...');
          const fetchResult = await Updates.fetchUpdateAsync();
          if (fetchResult.isNew && active) {
            console.log('[Updates] Download complete. Reloading app with latest changes...');
            await Updates.reloadAsync();
          }
        }
      } catch (err) {
        console.log('[Updates] Auto-update check:', err?.message || err);
      }
    };

    checkAndApplyUpdates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Debounce search input by 300ms to avoid firing heavy API and re-render cycles on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Separate masters fetch from entries search
  const loadMasters = useCallback(async () => {
    if (!user) return;
    try {
      const mastersData = await api.getMasters();
      setMasters(mastersData);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  }, [user]);

  const loadEntries = useCallback(async (query = '') => {
    if (!user) return;
    setLoading(true);
    try {
      const entriesData = await api.getEntries(query);
      setEntries(entriesData);
    } catch (err) {
      console.error('Error fetching entries:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadData = useCallback(async () => {
    await Promise.all([loadMasters(), loadEntries(debouncedSearch)]);
  }, [loadMasters, loadEntries, debouncedSearch]);

  useEffect(() => {
    if (user) {
      loadMasters();
    }
  }, [user, loadMasters]);

  useEffect(() => {
    if (user) {
      loadEntries(debouncedSearch);
    }
  }, [user, debouncedSearch, loadEntries]);

  // Stable callbacks so child tab views wrapped in React.memo never re-render unnecessarily
  const handleOpenAddModal = useCallback(() => {
    setEditingEntry(null);
    setIsModalOpen(true);
  }, []);
  const handleOpenEditModal = useCallback((entry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  }, []);
  const handleCloseAddModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingEntry(null);
  }, []);
  const handleOpenImportModal = useCallback(() => setIsImportModalOpen(true), []);
  const handleCloseImportModal = useCallback(() => setIsImportModalOpen(false), []);
  const handleNavigateMasters = useCallback(() => handleSelectTab('masters'), [handleSelectTab]);
  const handleNavigateEntries = useCallback((filterInfo) => {
    if (filterInfo) {
      setEntriesFilter(filterInfo);
    }
    handleSelectTab('entries');
  }, [handleSelectTab]);
  const handleNavigateProfile = useCallback(() => handleSelectTab('profile'), [handleSelectTab]);
  const handleToggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleEntryCreatedSuccess = useCallback((savedItem) => {
    loadData();
    if (savedItem) {
      const entryObj = savedItem.entry || savedItem;
      setCreatedInvoiceEntry(entryObj);
      setIsInvoiceModalOpen(true);
    }
  }, [loadData]);

  const handleOpenInvoiceModal = useCallback((entry) => {
    setCreatedInvoiceEntry(entry);
    setIsInvoiceModalOpen(true);
  }, []);

  const handleCloseInvoiceModal = useCallback(() => {
    setIsInvoiceModalOpen(false);
    setCreatedInvoiceEntry(null);
  }, []);

  if (authLoading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <LoginView />;
  }

  // Standalone dedicated window page for Party-wise Sales if opened in new tab/window
  if (directPartySalesMonth !== null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <PartyWiseSalesModal
          visible={true}
          isDirectPage={true}
          entries={entries}
          initialMonth={directPartySalesMonth === 'all' ? null : directPartySalesMonth}
          onClose={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = window.location.pathname;
            } else {
              setDirectPartySalesMonth(null);
            }
          }}
        />
      </View>
    );
  }

  // Safe top padding for notch / status bar across Android & iOS
  const topPadding =
    Platform.OS === 'web'
      ? 0
      : Math.max(insets.top || 0, Platform.OS === 'android' ? 24 : 0);
  // Safe bottom padding for navigation bar / gesture pill
  const bottomPadding = Platform.OS === 'web' ? 0 : (insets.bottom || 0);

  return (
    <View style={[styles.rootContainer, { paddingTop: topPadding }]}>
      <StatusBar style="light" backgroundColor="#134e4a" />
      <TopDownloadBanner />

      {/* Top Navbar */}
      <Navbar
        search={search}
        setSearch={setSearch}
        onRefresh={loadData}
        toggleSidebar={handleToggleSidebar}
        onNavigateProfile={handleNavigateProfile}
      />

      {/* Main Layout */}
      <View style={styles.mainLayout}>
        {!isMobile && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={handleSelectTab}
            isOpen={sidebarOpen}
            onClose={handleCloseSidebar}
          />
        )}

        {/* Dynamic Tab View: Visited tabs stay mounted in memory with absolute pinning for 0ms instant smooth switching */}
        <View style={styles.contentArea}>
          {visitedTabs.has('dashboard') && (
            <View
              style={[
                styles.tabPane,
                activeTab === 'dashboard' ? styles.tabPaneActive : styles.tabPaneHidden,
              ]}
              pointerEvents={activeTab === 'dashboard' ? 'auto' : 'none'}
            >
              <DashboardView
                entries={entries}
                onOpenAddModal={handleOpenAddModal}
                onNavigateMasters={handleNavigateMasters}
                onNavigateEntries={handleNavigateEntries}
              />
            </View>
          )}

          {visitedTabs.has('entries') && (
            <View
              style={[
                styles.tabPane,
                activeTab === 'entries' ? styles.tabPaneActive : styles.tabPaneHidden,
              ]}
              pointerEvents={activeTab === 'entries' ? 'auto' : 'none'}
            >
              <AllEntriesView
                entries={entries}
                loading={loading}
                onOpenAddModal={handleOpenAddModal}
                onOpenImportModal={handleOpenImportModal}
                onViewInvoice={handleOpenInvoiceModal}
                onEditEntry={handleOpenEditModal}
                onRefresh={loadData}
                initialFilter={entriesFilter}
              />
            </View>
          )}

          {visitedTabs.has('masters') && (
            <View
              style={[
                styles.tabPane,
                activeTab === 'masters' ? styles.tabPaneActive : styles.tabPaneHidden,
              ]}
              pointerEvents={activeTab === 'masters' ? 'auto' : 'none'}
            >
              <MastersView
                masters={masters}
                onRefresh={loadMasters}
              />
            </View>
          )}

          {visitedTabs.has('profile') && (
            <View
              style={[
                styles.tabPane,
                activeTab === 'profile' ? styles.tabPaneActive : styles.tabPaneHidden,
              ]}
              pointerEvents={activeTab === 'profile' ? 'auto' : 'none'}
            >
              <ProfileView />
            </View>
          )}
        </View>
      </View>

      {/* Mobile Bottom Navigation Bar: Fixed height, permanent indicators, zero layout shifting */}
      {isMobile && (
        <View style={[styles.bottomBar, { height: 58 + Math.max(bottomPadding, 0), paddingBottom: Math.max(bottomPadding, 0) }]}>
          {/* 1. Dashboard */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'dashboard' ? 'home' : 'home-outline'}
              size={22}
              color={activeTab === 'dashboard' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'dashboard' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Dashboard
            </Text>
            <View
              style={[
                styles.activeTabIndicator,
                { backgroundColor: activeTab === 'dashboard' ? '#0284c7' : 'transparent' },
              ]}
            />
          </TouchableOpacity>

          {/* 2. All Entries */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('entries')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'entries' ? 'list' : 'list-outline'}
              size={22}
              color={activeTab === 'entries' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'entries' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              All Entries
            </Text>
            <View
              style={[
                styles.activeTabIndicator,
                { backgroundColor: activeTab === 'entries' ? '#0284c7' : 'transparent' },
              ]}
            />
          </TouchableOpacity>

          {/* 3. Masters */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('masters')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'masters' ? 'layers' : 'layers-outline'}
              size={22}
              color={activeTab === 'masters' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'masters' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Masters
            </Text>
            <View
              style={[
                styles.activeTabIndicator,
                { backgroundColor: activeTab === 'masters' ? '#0284c7' : 'transparent' },
              ]}
            />
          </TouchableOpacity>

          {/* 4. Profile */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('profile')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
              size={22}
              color={activeTab === 'profile' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'profile' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Profile
            </Text>
            <View
              style={[
                styles.activeTabIndicator,
                { backgroundColor: activeTab === 'profile' ? '#0284c7' : 'transparent' },
              ]}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery Entry Form Modal */}
      <DeliveryEntriesFormModal
        visible={isModalOpen}
        onClose={handleCloseAddModal}
        onSuccess={handleEntryCreatedSuccess}
        masters={masters}
        initialData={editingEntry}
      />

      {/* Excel / CSV Bulk Import Modal */}
      <ExcelImportModal
        visible={isImportModalOpen}
        onClose={handleCloseImportModal}
        onSuccess={loadData}
      />

      {/* Invoice / Delivery Slip PDF Modal (Tally & Stripe Style, View, Download, Share) */}
      <EntryInvoicePdfModal
        visible={isInvoiceModalOpen}
        entry={createdInvoiceEntry}
        company={user?.company_name || (user?.name ? `${user.name}'s Organization` : "Admin's Organization")}
        user={user}
        onClose={handleCloseInvoiceModal}
      />
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#134e4a',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
  },
  tabPane: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  tabPaneActive: {
    opacity: 1,
    zIndex: 1,
    display: 'flex',
  },
  tabPaneHidden: {
    opacity: 0,
    zIndex: -1,
    display: 'none',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 2,
  },
  bottomTabText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomTabTextActive: {
    color: '#0284c7',
  },
  activeTabIndicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
    marginTop: 3,
  },
  loadingScreenRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreenContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingLogoImage: {
    width: 200,
    height: 138,
  },
  loadingScreenText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.3,
  },
});
