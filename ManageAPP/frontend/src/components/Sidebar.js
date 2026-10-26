import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
    { id: 'entries', label: 'All Entries', icon: 'flash' },
    { id: 'masters', label: 'Masters Management', icon: 'layers-outline' },
    { id: 'profile', label: 'Profile', icon: 'person-circle-outline' },
  ];

  const handleSelect = (id) => {
    setActiveTab(id);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const menuContent = (
    <View style={[styles.sidebar, isMobile && styles.mobileDrawer]}>
      <View>
        {isMobile && (
          <View style={styles.mobileHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoLetter}>M</Text>
              </View>
              <Text style={styles.brandTitle}>MaterialMApp</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuContainer}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isActive && styles.activeMenuItem]}
                onPress={() => handleSelect(item.id)}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? '#0284c7' : '#475569'}
                  style={styles.menuIcon}
                />
                <Text style={[styles.menuLabel, isActive && styles.activeMenuLabel]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>MaterialMApp v1.0.0</Text>
        <Text style={styles.subVersionText}>Direct MongoDB Routing</Text>
      </View>
    </View>
  );

  // On mobile screens, sidebar is completely removed (bottom navigation bar is used)
  if (isMobile) {
    return null;
  }

  if (!isOpen) return null;

  return menuContent;
};

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  mobileDrawer: {
    width: 280,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flexDirection: 'row',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoLetter: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  brandTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  menuContainer: {
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  activeMenuItem: {
    backgroundColor: '#e0f2fe',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  activeMenuLabel: {
    color: '#0284c7',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  versionText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  subVersionText: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 2,
  },
});
