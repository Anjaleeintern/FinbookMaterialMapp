import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ search, setSearch, onRefresh, toggleSidebar, onNavigateProfile }) => {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const topSafe = Platform.OS === 'web' ? 0 : insets.top;

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {/* Left: Hamburger (Desktop only) & Brand Logo */}
        <View style={styles.leftSection}>
          {!isMobile && (
            <TouchableOpacity onPress={toggleSidebar} style={styles.iconButton}>
              <Ionicons name="menu" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}

          <View style={[styles.brandContainer, isMobile && { marginLeft: 0 }]}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoLetter}>M</Text>
            </View>
            <Text style={styles.brandTitle} numberOfLines={1}>MaterialMApp</Text>
          </View>
        </View>

        {/* Desktop Center Search Bar */}
        {!isMobile && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search All Entries"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Right Actions */}
        <View style={styles.rightSection}>
          {isMobile && (
            <TouchableOpacity
              onPress={() => setMobileSearchOpen(!mobileSearchOpen)}
              style={styles.iconButton}
            >
              <Ionicons
                name={mobileSearchOpen ? 'close' : 'search'}
                size={20}
                color="#ffffff"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onRefresh} style={styles.iconButton} title="Refresh">
            <Ionicons name="refresh" size={20} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowProfileMenu(true)}
            style={styles.profileButton}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color="#ffffff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Menu with full-screen dismiss backdrop */}
      <Modal
        visible={showProfileMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowProfileMenu(false)}>
          <View style={[styles.backdrop, { paddingTop: topSafe + 56 }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.dropdownMenu, isMobile ? styles.dropdownMobile : styles.dropdownDesktop]}>
                <View style={styles.dropdownHeader}>
                  <View style={styles.dropdownUserRow}>
                    <View style={[styles.avatar, { width: 36, height: 36 }]}>
                      <Text style={[styles.avatarText, { fontSize: 16 }]}>{initial}</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.dropdownName}>{user?.name || 'User'}</Text>
                      <Text style={styles.dropdownEmail} numberOfLines={1}>
                        {user?.email || ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user?.role || 'operator'}</Text>
                  </View>
                </View>

                {onNavigateProfile && (
                  <TouchableOpacity
                    style={styles.profileNavButton}
                    onPress={() => {
                      setShowProfileMenu(false);
                      onNavigateProfile();
                    }}
                  >
                    <Ionicons name="person-circle-outline" size={20} color="#0284c7" />
                    <Text style={styles.profileNavText}>My Profile</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeMenuBtn}
                  onPress={() => setShowProfileMenu(false)}
                >
                  <Text style={styles.closeMenuText}>Close Menu</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Mobile Search Bar Expandable Drawer */}
      {isMobile && mobileSearchOpen && (
        <View style={styles.mobileSearchBar}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.mobileSearchInput}
            placeholder="Search Challan, Vehicle, Party..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            autoFocus={true}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#134e4a',
    zIndex: 100,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  logoLetter: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  searchContainer: {
    flex: 1,
    maxWidth: 480,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    outlineWidth: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    padding: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 12,
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownDesktop: {
    marginRight: 10,
  },
  dropdownMobile: {
    alignSelf: 'center',
    marginTop: 10,
    width: '90%',
    maxWidth: 320,
  },
  dropdownHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 10,
  },
  dropdownUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 10,
    color: '#0369a1',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profileNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  profileNavText: {
    marginLeft: 10,
    color: '#0284c7',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  logoutText: {
    marginLeft: 10,
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  closeMenuBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  closeMenuText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 40,
  },
  mobileSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    outlineWidth: 0,
  },
});
