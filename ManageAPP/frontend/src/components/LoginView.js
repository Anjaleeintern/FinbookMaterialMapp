import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export const LoginView = () => {
  const { login } = useAuth();

  // Active view: 'login' (Screen 3: Welcome Back) | 'register' (Screen 4: Create Your Account)
  const [activeTab, setActiveTab] = useState('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  // OTP Modal State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMsg, setOtpMsg] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle pulse animation for the M logo badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Smooth transition between Login and Register
  const transitionTo = (newTab, direction = 'next') => {
    setErrorMsg('');
    setSuccessMsg('');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === 'next' ? -20 : 20,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveTab(newTab);
      slideAnim.setValue(direction === 'next' ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await login(email.trim(), password.trim());
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.register(email.trim(), password.trim(), name.trim());
      setSuccessMsg('Account created successfully! Signing in...');
      await login(email.trim(), password.trim());
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = () => {
    if (!otpPhone.trim()) {
      setOtpMsg('Please enter your mobile number or email.');
      return;
    }
    setOtpLoading(true);
    setOtpMsg('');
    setTimeout(() => {
      setOtpLoading(false);
      setOtpSent(true);
      setOtpMsg(`OTP sent to ${otpPhone.trim()}. (Demo code: 123456)`);
    }, 700);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setOtpMsg('Please enter the 6-digit OTP code.');
      return;
    }
    setOtpLoading(true);
    try {
      await login('admin@materialmapp.com', 'admin123');
      setOtpModalVisible(false);
    } catch (err) {
      setOtpMsg('OTP verification failed. Please try password login.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Full-Screen Phone Canvas */}
          <View style={styles.phoneCanvas}>
            {/* Top Bar Row */}
            <View style={styles.topBarRow}>
              {activeTab === 'register' ? (
                <TouchableOpacity
                  style={styles.topBackArrowBtn}
                  onPress={() => transitionTo('login', 'back')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={24} color="#0f172a" />
                </TouchableOpacity>
              ) : (
                <View style={styles.topBarPlaceholder} />
              )}

              {/* Top Right: Login & Sign Up buttons */}
              <View style={styles.topAuthButtonGroup}>
                {activeTab === 'register' ? (
                  <TouchableOpacity
                    style={styles.topLoginOutlineBtn}
                    onPress={() => transitionTo('login', 'back')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.topLoginOutlineBtnText}>Login</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.topTabBtn}
                      onPress={() => {}}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.topTabBtnTextActive}>Login</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.topSignUpPillBtn}
                      onPress={() => transitionTo('register', 'next')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.topSignUpPillBtnText}>Sign Up</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Brand Header */}
            <View style={styles.brandHeaderCenter}>
              <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                <Text style={styles.logoLetter}>M</Text>
              </Animated.View>
              <Text style={styles.brandTitle}>MaterialMApp</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>Quarry &amp; Weighbridge Dispatch</Text>
              </View>
            </View>

            {/* Animated Form Content */}
            <Animated.View
              style={[
                styles.animatedPane,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              {activeTab === 'login' ? (
                /* SCREEN 3: WELCOME BACK! */
                <View style={styles.formContainer}>
                  <View style={styles.formHeaderBlock}>
                    <Text style={styles.mainHeading}>Welcome Back!</Text>
                    <Text style={styles.subHeading}>Sign in to continue to your account</Text>
                  </View>

                  {errorMsg ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                      <Text style={styles.errorBannerText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {successMsg ? (
                    <View style={styles.successBanner}>
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={styles.successBannerText}>{successMsg}</Text>
                    </View>
                  ) : null}

                  {/* Email */}
                  <View style={styles.inputFieldGroup}>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <View
                      style={[
                        styles.inputBox,
                        focusedInput === 'loginEmail' && styles.inputBoxFocused,
                      ]}
                    >
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputLeadingIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your email address"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('loginEmail')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {email ? (
                        <TouchableOpacity
                          onPress={() => setEmail('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password */}
                  <View style={styles.inputFieldGroup}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View
                      style={[
                        styles.inputBox,
                        focusedInput === 'loginPassword' && styles.inputBoxFocused,
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputLeadingIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('loginPassword')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={19}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign In Button */}
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, loading && { opacity: 0.75 }]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryActionBtnText}>Sign In</Text>
                    )}
                  </TouchableOpacity>

                  {/* OR Divider */}
                  <View style={styles.orDividerRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.orLine} />
                  </View>

                  {/* Continue with OTP Button */}
                  <TouchableOpacity
                    style={styles.secondaryOtpBtn}
                    onPress={() => {
                      setOtpMsg('');
                      setOtpSent(false);
                      setOtpCode('');
                      setOtpModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="phone-portrait-outline" size={18} color="#0284c7" style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryOtpBtnText}>Continue with OTP</Text>
                  </TouchableOpacity>

                  {/* Bottom link: Don't have an account? Sign Up */}
                  <View style={styles.bottomLinkRow}>
                    <Text style={styles.bottomLinkMuted}>Don't have an account? </Text>
                    <TouchableOpacity
                      onPress={() => transitionTo('register', 'next')}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={styles.bottomLinkAction}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* SCREEN 4: CREATE YOUR ACCOUNT */
                <View style={styles.formContainer}>
                  <View style={styles.formHeaderBlock}>
                    <Text style={styles.mainHeading}>Create Your Account</Text>
                    <Text style={styles.subHeading}>Get started with your business account</Text>
                  </View>

                  {errorMsg ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                      <Text style={styles.errorBannerText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {successMsg ? (
                    <View style={styles.successBanner}>
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={styles.successBannerText}>{successMsg}</Text>
                    </View>
                  ) : null}

                  {/* Full Name */}
                  <View style={styles.inputFieldGroup}>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <View
                      style={[
                        styles.inputBox,
                        focusedInput === 'regName' && styles.inputBoxFocused,
                      ]}
                    >
                      <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputLeadingIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#94a3b8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        onFocus={() => setFocusedInput('regName')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {name ? (
                        <TouchableOpacity
                          onPress={() => setName('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Email */}
                  <View style={styles.inputFieldGroup}>
                    <Text style={styles.fieldLabel}>Email Address</Text>
                    <View
                      style={[
                        styles.inputBox,
                        focusedInput === 'regEmail' && styles.inputBoxFocused,
                      ]}
                    >
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputLeadingIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('regEmail')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {email ? (
                        <TouchableOpacity
                          onPress={() => setEmail('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password */}
                  <View style={styles.inputFieldGroup}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View
                      style={[
                        styles.inputBox,
                        focusedInput === 'regPassword' && styles.inputBoxFocused,
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputLeadingIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Create a password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('regPassword')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={19}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign Up Button */}
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, loading && { opacity: 0.75 }]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryActionBtnText}>Sign Up</Text>
                    )}
                  </TouchableOpacity>

                  {/* Terms Note */}
                  <View style={styles.termsNoteWrap}>
                    <Text style={styles.termsNoteText}>
                      By continuing, you agree to our{' '}
                      <Text style={styles.termsNoteLink}>Terms &amp; Conditions</Text> and{' '}
                      <Text style={styles.termsNoteLink}>Privacy Policy</Text>
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Decorative Curved Wave at bottom edge */}
            <View style={styles.waveContainer} pointerEvents="none">
              <Svg width="100%" height="80" viewBox="0 0 375 80" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="waveGrad1" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#e0f2fe" stopOpacity="0.7" />
                    <Stop offset="1" stopColor="#ccfbf1" stopOpacity="0.7" />
                  </LinearGradient>
                  <LinearGradient id="waveGrad2" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#ccfbf1" stopOpacity="0.5" />
                    <Stop offset="1" stopColor="#f0fdfa" stopOpacity="0.9" />
                  </LinearGradient>
                </Defs>
                <Path
                  d="M0,25 C90,52 190,10 285,36 C330,50 355,38 375,32 L375,80 L0,80 Z"
                  fill="url(#waveGrad1)"
                />
                <Path
                  d="M0,42 C80,18 185,62 275,34 C325,16 355,28 375,35 L375,80 L0,80 Z"
                  fill="url(#waveGrad2)"
                />
              </Svg>
            </View>
          </View>
        </ScrollView>

        {/* OTP Modal Dialog */}
        <Modal
          visible={otpModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setOtpModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setOtpModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalBox}
              activeOpacity={1}
              onPress={(e) => Platform.OS === 'web' && e?.stopPropagation && e.stopPropagation()}
            >
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitle}>Continue with OTP</Text>
                  <Text style={styles.modalSubtitle}>Quick login via one-time verification</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setOtpModalVisible(false)}
                >
                  <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {otpMsg ? (
                <View style={[styles.errorBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Ionicons name="information-circle" size={16} color="#15803d" />
                  <Text style={[styles.errorBannerText, { color: '#15803d' }]}>{otpMsg}</Text>
                </View>
              ) : null}

              <View style={styles.inputFieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number or Email</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="call-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="+91 98765 43210 or email"
                    placeholderTextColor="#94a3b8"
                    value={otpPhone}
                    onChangeText={setOtpPhone}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {otpSent && (
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>6-Digit OTP</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="key-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter 6-digit code (e.g. 123456)"
                      placeholderTextColor="#94a3b8"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryActionBtn, otpLoading && { opacity: 0.75 }]}
                onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                disabled={otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>
                    {otpSent ? 'Verify & Sign In' : 'Send OTP'}
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? { minHeight: '100vh', height: '100%' } : {}),
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? { minHeight: '100vh', height: '100%' } : {}),
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  /* Full screen phone canvas - fills 100% on phone, max 440px on large desktop screen */
  phoneCanvas: {
    width: '100%',
    maxWidth: 440,
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#ffffff',
    justifyContent: 'flex-start',
    paddingBottom: 24,
    position: 'relative',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : {}),
  },

  /* Top Navigation Bar */
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 14 : 8,
    paddingBottom: 4,
    minHeight: 48,
    zIndex: 10,
  },
  topBarPlaceholder: {
    width: 38,
    height: 38,
  },
  topBackArrowBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAuthButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topTabBtnTextActive: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  topSignUpPillBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  topSignUpPillBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  topLoginOutlineBtn: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topLoginOutlineBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Brand Header */
  brandHeaderCenter: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  logoBadge: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  logoLetter: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  tagBadge: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 16,
    marginTop: 5,
  },
  tagBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f766e',
  },

  /* Animated Form Pane */
  animatedPane: {
    width: '100%',
  },
  formContainer: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 20,
  },
  formHeaderBlock: {
    marginBottom: 16,
  },
  mainHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subHeading: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 3,
  },

  /* Input Fields */
  inputFieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputBoxFocused: {
    borderColor: '#0284c7',
    borderWidth: 1.5,
    backgroundColor: '#f0f9ff',
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#0f172a',
    outlineWidth: 0,
  },

  /* Buttons */
  primaryActionBtn: {
    backgroundColor: '#0284c7',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  secondaryOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
  },
  secondaryOtpBtnText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  bottomLinkMuted: {
    fontSize: 13.5,
    color: '#64748b',
  },
  bottomLinkAction: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  termsNoteWrap: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  termsNoteText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsNoteLink: {
    color: '#0284c7',
    fontWeight: '600',
  },

  /* Alert Banners */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12.5,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  successBannerText: {
    fontSize: 12.5,
    color: '#15803d',
    fontWeight: '600',
    flex: 1,
  },

  /* Curved Wave at bottom */
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },

  /* OTP Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
