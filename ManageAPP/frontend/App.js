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
import { AboutView } from './src/components/AboutView';
import { LoginView } from './src/components/LoginView';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [entries, setEntries] = useState([]);
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mastersData, entriesData] = await Promise.all([
        api.getMasters(),
        api.getEntries(search),
      ]);
      setMasters(mastersData);
      setEntries(entriesData);
    } catch (err) {
      console.error('Error fetching data from backend:', err);
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

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
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Layout */}
      <View style={styles.mainLayout}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <View style={styles.contentArea}>
          {activeTab === 'dashboard' && (
            <DashboardView
              entries={entries}
              onOpenAddModal={() => setIsModalOpen(true)}
              onNavigateMasters={() => setActiveTab('masters')}
            />
          )}

          {activeTab === 'entries' && (
            <AllEntriesView
              entries={entries}
              loading={loading}
              onOpenAddModal={() => setIsModalOpen(true)}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'masters' && (
            <MastersView
              masters={masters}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'about' && <AboutView />}
        </View>
      </View>

      {/* Mobile Bottom Navigation Bar with exact Symmetrical Flex Insets */}
      {isMobile && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomPadding, 6) }]}>
          {/* 1. About */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => setActiveTab('about')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'about' ? 'information-circle' : 'information-circle-outline'}
              size={20}
              color={activeTab === 'about' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'about' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              About
            </Text>
          </TouchableOpacity>

          {/* 2. Dashboard */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => setActiveTab('dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'}
              size={20}
              color={activeTab === 'dashboard' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'dashboard' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Dashboard
            </Text>
          </TouchableOpacity>

          {/* Center Add Button inside its own flex slot */}
          <View style={styles.centerAddSlot}>
            <TouchableOpacity
              style={styles.centerAddBtn}
              onPress={() => setIsModalOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={26} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* 3. Entries */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => setActiveTab('entries')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'entries' ? 'flash' : 'flash-outline'}
              size={20}
              color={activeTab === 'entries' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'entries' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Entries
            </Text>
          </TouchableOpacity>

          {/* 4. Masters */}
          <TouchableOpacity
            style={styles.bottomTab}
            onPress={() => setActiveTab('masters')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'masters' ? 'layers' : 'layers-outline'}
              size={20}
              color={activeTab === 'masters' ? '#0284c7' : '#64748b'}
            />
            <Text
              style={[styles.bottomTabText, activeTab === 'masters' && styles.bottomTabTextActive]}
              numberOfLines={1}
            >
              Masters
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery Entry Form Modal */}
      <DeliveryEntriesFormModal
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        masters={masters}
      />

      {/* Excel / CSV Bulk Import Modal */}
      <ExcelImportModal
        visible={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
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
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 2,
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
    paddingVertical: 4,
  },
  bottomTabText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomTabTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  centerAddSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
});
