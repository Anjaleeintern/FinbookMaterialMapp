import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export const ProfileView = React.memo(() => {
  const { user, logout, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [state, setState] = useState(user?.state || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  // Logout Confirmation Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // App OTA Updates Check State
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckManualUpdate = async () => {
    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) {
      const msg = 'Updates are automatically synced in the installed APK via EAS preview channel.';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('App Updates', msg);
      }
      return;
    }

    try {
      setCheckingUpdate(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          Alert.alert(
            'New Update Downloaded',
            'Latest changes have been downloaded! The app will reload now to apply them.',
            [
              {
                text: 'Restart Now',
                onPress: () => Updates.reloadAsync(),
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        Alert.alert('Up to Date', 'Your app is already running the latest version with all changes.');
      }
    } catch (err) {
      Alert.alert('Update Check', `Could not check updates: ${err?.message || err}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Sync user changes if user prop updates
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setState(user.state || '');
    }
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async () => {
    setProfileMsg({ type: '', text: '' });
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanState = state.trim();

    if (!cleanName) {
      setProfileMsg({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    if (!cleanEmail) {
      setProfileMsg({ type: 'error', text: 'Email cannot be empty.' });
      return;
    }

    try {
      setSavingProfile(true);
      const updated = await api.updateProfile({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        state: cleanState,
      });

      updateUser(updated);
      setProfileMsg({ type: 'success', text: 'Profile details saved successfully!' });
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async () => {
    setPwMsg({ type: '', text: '' });

    if (!currentPassword.trim()) {
      setPwMsg({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword.trim()) {
      setPwMsg({ type: 'error', text: 'Please enter your new password.' });
      return;
    }
    if (newPassword.length < 4) {
      setPwMsg({ type: 'error', text: 'New password must be at least 4 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }

    try {
      setChangingPw(true);
      const res = await api.changePassword(currentPassword, newPassword);
      setPwMsg({ type: 'success', text: res.message || 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setChangingPw(false);
    }
  };

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.innerWrap}>
        {/* 1. PROFILE HEADER CARD */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>

            <View style={styles.profileMeta}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user?.name || 'Operator'}
                </Text>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>Online</Text>
                </View>
              </View>

              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email || ''}
              </Text>

              <View style={styles.badgesRow}>
                {user?.company_name ? (
                  <View style={[styles.roleBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Text style={[styles.roleBadgeText, { color: '#16a34a' }]}>
                      {user.company_name}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {user?.role ? user.role.toUpperCase() : 'USER'}
                  </Text>
                </View>

                {user?.id ? (
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>
                      UID: {user.id.substring(user.id.length - 6).toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* 2. PROFILE EDIT DETAILS (Email, Mobile Number, State, Name) */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="person-outline" size={18} color="#0284c7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              <Text style={styles.sectionSubtitle}>
                Manage your name, login email, phone number, and state
              </Text>
            </View>
          </View>

          {profileMsg.text ? (
            <View
              style={[
                styles.alertBox,
                profileMsg.type === 'error' ? styles.alertError : styles.alertSuccess,
              ]}
            >
              <Ionicons
                name={profileMsg.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
                size={18}
                color={profileMsg.type === 'error' ? '#ef4444' : '#16a34a'}
              />
              <Text
                style={[
                  styles.alertText,
                  profileMsg.type === 'error' ? styles.alertTextError : styles.alertTextSuccess,
                ]}
              >
                {profileMsg.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.formGrid}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter full name"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number (Phone)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +91 98765 43210"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* State */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>State / Location</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="location" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Madhya Pradesh, Rajasthan"
                  placeholderTextColor="#94a3b8"
                  value={state}
                  onChangeText={setState}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingProfile && styles.btnDisabled]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            activeOpacity={0.85}
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="checkmark-done" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.saveBtnText}>
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. CHANGE PASSWORD SECTION */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="key-outline" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Change Password</Text>
              <Text style={styles.sectionSubtitle}>
                Update your account password for secure access
              </Text>
            </View>
          </View>

          {pwMsg.text ? (
            <View
              style={[
                styles.alertBox,
                pwMsg.type === 'error' ? styles.alertError : styles.alertSuccess,
              ]}
            >
              <Ionicons
                name={pwMsg.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
                size={18}
                color={pwMsg.type === 'error' ? '#ef4444' : '#16a34a'}
              />
              <Text
                style={[
                  styles.alertText,
                  pwMsg.type === 'error' ? styles.alertTextError : styles.alertTextSuccess,
                ]}
              >
                {pwMsg.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.formGrid}>
            {/* Current Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Current Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor="#94a3b8"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPw((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                New Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="shield-checkmark" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password (min. 4 chars)"
                  placeholderTextColor="#94a3b8"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPw((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showNewPw ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Confirm New Password <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="shield-checkmark" size={17} color="#94a3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94a3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPw((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.passwordBtn, changingPw && styles.btnDisabled]}
            onPress={handleChangePassword}
            disabled={changingPw}
            activeOpacity={0.85}
          >
            {changingPw ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="key" size={17} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.passwordBtnText}>
              {changingPw ? 'Updating...' : 'Update Password'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. APP VERSION & UPDATES SECTION */}
        <View style={styles.card}>
          <View style={styles.logoutRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.logoutTitle}>App Version & Updates</Text>
                <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#0284c7' }}>v1.0.0</Text>
                </View>
              </View>
              <Text style={styles.logoutDesc}>
                {Updates.isEnabled ? 'EAS Preview Channel • Instant OTA updates active' : 'Development Build • Direct auto-syncing'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: '#0284c7' }]}
              onPress={handleCheckManualUpdate}
              activeOpacity={0.85}
              disabled={checkingUpdate}
            >
              {checkingUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="cloud-download-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.logoutBtnText}>
                {checkingUpdate ? 'Checking...' : 'Check Updates'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. LOGOUT SECTION */}
        <View style={[styles.card, styles.cardDanger]}>
          <View style={styles.logoutRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoutTitle}>Session & Sign Out</Text>
              <Text style={styles.logoutDesc}>
                Securely log out of MaterialMApp from this device
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => setShowLogoutModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="log-out-outline" size={28} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Confirm Logout</Text>
            <Text style={styles.confirmDesc}>
              Are you sure you want to log out of your account?
            </Text>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmLogoutText}>Yes, Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  contentMobile: {
    padding: 14,
    paddingBottom: 36,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 720,
    gap: 16,
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
  },
  cardDanger: {
    borderColor: '#fee2e2',
    backgroundColor: '#fffafb',
  },

  // 1. Profile Header Card
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileMeta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  idBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  idBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },

  // Forms
  formGrid: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  required: {
    color: '#ef4444',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 8 : 6,
  },
  fieldIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    padding: 0,
    outlineStyle: 'none',
  },
  eyeBtn: {
    padding: 4,
  },

  // Alerts
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  alertSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  alertError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertText: {
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
  },
  alertTextSuccess: {
    color: '#15803d',
  },
  alertTextError: {
    color: '#b91c1c',
  },

  // Buttons
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 16,
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
  },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  passwordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 16,
    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
  },
  passwordBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.65,
  },

  // Logout Card
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  logoutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
  },
  logoutDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Confirm Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
  },
  confirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  confirmDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
