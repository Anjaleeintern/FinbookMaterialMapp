import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
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
import { api } from './src/api/client';
import './style.css';

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

  const handleSelectTab = useCallback((tab) => {
    setActiveTab(tab);
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
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
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

      {/* Top Navbar */}
      <Navbar
        search={search}
        setSearch={setSearch}
        onRefresh={loadData}
        toggleSidebar={handleToggleSidebar}
        onNavigateProfile={() => handleSelectTab('profile')}
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

        {/* Dynamic Active Tab View: Only active tab is mounted in DOM for maximum 60FPS mobile performance */}
        <View style={styles.contentArea}>
          {activeTab === 'dashboard' && (
            <View style={styles.tabPane}>
              <DashboardView
                entries={entries}
                onOpenAddModal={handleOpenAddModal}
                onNavigateMasters={handleNavigateMasters}
                onNavigateEntries={() => handleSelectTab('entries')}
              />
            </View>
          )}

          {activeTab === 'entries' && (
            <View style={styles.tabPane}>
              <AllEntriesView
                entries={entries}
                loading={loading}
                onOpenAddModal={handleOpenAddModal}
                onOpenImportModal={handleOpenImportModal}
                onViewInvoice={handleOpenInvoiceModal}
                onEditEntry={handleOpenEditModal}
                onRefresh={loadData}
              />
            </View>
          )}

          {activeTab === 'masters' && (
            <View style={styles.tabPane}>
              <MastersView
                masters={masters}
                onRefresh={loadMasters}
              />
            </View>
          )}

          {activeTab === 'profile' && (
            <View style={styles.tabPane}>
              <ProfileView />
            </View>
          )}
        </View>
      </View>

      {/* Mobile Bottom Navigation Bar: Dashboard, All Entries, Masters, Profile */}
      {isMobile && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomPadding, 6) }]}>
          {/* 1. Dashboard */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('dashboard')}
            activeOpacity={0.75}
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
            {activeTab === 'dashboard' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 2. All Entries */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('entries')}
            activeOpacity={0.75}
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
            {activeTab === 'entries' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 3. Masters */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('masters')}
            activeOpacity={0.75}
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
            {activeTab === 'masters' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {/* 4. Profile */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => handleSelectTab('profile')}
            activeOpacity={0.75}
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
            {activeTab === 'profile' && <View style={styles.activeTabIndicator} />}
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
        company={user?.company_name || 'STONE QUARRY & CRUSHER'}
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
  },
  tabPane: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabPaneHidden: {
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
    paddingTop: 8,
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
    paddingVertical: 2,
    position: 'relative',
  },
  bottomTabText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomTabTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  activeTabIndicator: {
    width: 36,
    height: 3,
    backgroundColor: '#0284c7',
    borderRadius: 2,
    marginTop: 4,
  },
});
