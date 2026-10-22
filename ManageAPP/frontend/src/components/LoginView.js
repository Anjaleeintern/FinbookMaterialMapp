import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
  Platform,
  Modal,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const weighbridgeHero = require('../../assets/weighbridge_hero.jpg');
const operationsHero = require('../../assets/operations_hero.jpg');

export const LoginView = () => {
  const { login } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Step state: 'slide1' | 'slide2' | 'login' | 'register'
  const [currentStep, setCurrentStep] = useState('slide1');

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

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle float animation for illustrations
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Gentle pulse for the brand M badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Smooth slide + fade transition between screens
  const transitionTo = (newStep, direction = 'next') => {
    setErrorMsg('');
    setSuccessMsg('');
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === 'next' ? -24 : 24,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(newStep);
      slideAnim.setValue(direction === 'next' ? 24 : -24);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
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
      setErrorMsg('Password should be at least 4 characters.');
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
      setOtpMsg('OTP sent to ' + otpPhone.trim() + '. (Demo: use default login or 123456)');
    }, 800);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainPhoneWrapper, !isMobile && styles.desktopCardWrapper]}>
          <Animated.View
            style={[
              styles.animatedPane,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* ======================================================== */}
            {/* SCREEN 1: ONBOARDING SLIDE 1 (Weighbridge Hero)          */}
            {/* ======================================================== */}
            {currentStep === 'slide1' && (
              <View style={styles.screenInner}>
                {/* Brand Header */}
                <View style={styles.brandHeaderCenter}>
                  <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                    <Text style={styles.logoLetter}>M</Text>
                  </Animated.View>
                  <Text style={styles.brandTitle}>MaterialMApp</Text>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Quarry & Weighbridge Dispatch</Text>
                  </View>
                  <Text style={styles.slideSubtitle}>
                    Fast vehicle entries, automated delivery challans, and live sales reports.
                  </Text>
                </View>

                {/* 3D Weighbridge Hero Illustration with floating micro-animation */}
                <Animated.View
                  style={[
                    styles.heroImageContainer,
                    { transform: [{ translateY: floatAnim }] },
                  ]}
                >
                  <Image
                    source={weighbridgeHero}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                </Animated.View>

                {/* Bottom Row: 3-Dot Indicators & Skip > */}
                <View style={styles.onboardingBottomRow}>
                  <View style={styles.dotsGroup}>
                    <View style={[styles.dot, styles.dotActive]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>

                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => transitionTo('login', 'next')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipBtnText}>Skip &gt;</Text>
                  </TouchableOpacity>
                </View>

                {/* Touch forward helper */}
                <TouchableOpacity
                  style={styles.slideForwardTapArea}
                  onPress={() => transitionTo('slide2', 'next')}
                  activeOpacity={1}
                />
              </View>
            )}

            {/* ======================================================== */}
            {/* SCREEN 2: ONBOARDING SLIDE 2 (Operations & Features)     */}
            {/* ======================================================== */}
            {currentStep === 'slide2' && (
              <View style={styles.screenInner}>
                {/* 3D Operations Hero Illustration */}
                <Animated.View
                  style={[
                    styles.heroImageContainerSlide2,
                    { transform: [{ translateY: floatAnim }] },
                  ]}
                >
                  <Image
                    source={operationsHero}
                    style={styles.heroImageSlide2}
                    resizeMode="cover"
                  />
                </Animated.View>

                {/* Section Title */}
                <View style={styles.slide2Header}>
                  <Text style={styles.slide2Title}>Simplify Your{'\n'}Material Operations</Text>
                </View>

                {/* 3 Value Proposition Cards (matching reference screenshot) */}
                <View style={styles.featureCardsCol}>
                  {/* Feature 1 */}
                  <View style={styles.featureCardRow}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="git-branch-outline" size={20} color="#0284c7" />
                    </View>
                    <View style={styles.featureTextCol}>
                      <Text style={styles.featureTitle}>Quick Vehicle Entries</Text>
                      <Text style={styles.featureSubtitle}>Capture vehicle details in seconds</Text>
                    </View>
                  </View>

                  {/* Feature 2 */}
                  <View style={styles.featureCardRow}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#dcfce7' }]}>
                      <Ionicons name="document-text-outline" size={20} color="#16a34a" />
                    </View>
                    <View style={styles.featureTextCol}>
                      <Text style={styles.featureTitle}>Automated Challans</Text>
                      <Text style={styles.featureSubtitle}>Generate delivery challans instantly</Text>
                    </View>
                  </View>

                  {/* Feature 3 */}
                  <View style={styles.featureCardRow}>
                    <View style={[styles.featureIconWrap, { backgroundColor: '#f3e8ff' }]}>
                      <Ionicons name="bar-chart-outline" size={20} color="#7c3aed" />
                    </View>
                    <View style={styles.featureTextCol}>
                      <Text style={styles.featureTitle}>Live Sales Reports</Text>
                      <Text style={styles.featureSubtitle}>Track your business in real-time</Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Row: Back | 3-Dots | Next > */}
                <View style={styles.onboardingBottomRow}>
                  <TouchableOpacity
                    style={styles.backTextBtn}
                    onPress={() => transitionTo('slide1', 'back')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backTextBtnLabel}>Back</Text>
                  </TouchableOpacity>

                  <View style={styles.dotsGroup}>
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.dotActive]} />
                    <View style={styles.dot} />
                  </View>

                  <TouchableOpacity
                    style={styles.nextPillBtn}
                    onPress={() => transitionTo('login', 'next')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nextPillBtnText}>Next &gt;</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* SCREEN 3: SIGN IN (Welcome Back!)                        */}
            {/* ======================================================== */}
            {currentStep === 'login' && (
              <View style={styles.screenInner}>
                {/* Top Bar: Login | Sign Up Toggle */}
                <View style={styles.topToggleRow}>
                  <TouchableOpacity
                    style={styles.toggleTextLink}
                    onPress={() => transitionTo('slide1', 'back')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={18} color="#64748b" />
                  </TouchableOpacity>

                  <View style={styles.topPillSwitch}>
                    <View style={styles.topPillActive}>
                      <Text style={styles.topPillActiveText}>Login</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.topPillInactive}
                      onPress={() => transitionTo('register', 'next')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.topPillInactiveText}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Brand Header */}
                <View style={styles.brandHeaderCenter}>
                  <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                    <Text style={styles.logoLetter}>M</Text>
                  </Animated.View>
                  <Text style={styles.brandTitle}>MaterialMApp</Text>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Quarry & Weighbridge Dispatch</Text>
                  </View>
                </View>

                {/* Form Titles */}
                <View style={styles.formHeaderBlock}>
                  <Text style={styles.mainHeading}>Welcome Back!</Text>
                  <Text style={styles.subHeading}>Sign in to continue to your account</Text>
                </View>

                {/* Error Banner */}
                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* Email Input */}
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedInput === 'loginEmail' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons name="mail-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
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
                      <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedInput === 'loginPassword' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons name="lock-closed-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
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
                        size={18}
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
                  onPress={() => setOtpModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="phone-portrait-outline" size={17} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryOtpBtnText}>Continue with OTP</Text>
                </TouchableOpacity>

                {/* Bottom Sign Up Link */}
                <View style={styles.bottomLinkRow}>
                  <Text style={styles.bottomLinkMuted}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => transitionTo('register', 'next')}>
                    <Text style={styles.bottomLinkAction}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* SCREEN 4: SIGN UP (Create Your Account)                  */}
            {/* ======================================================== */}
            {currentStep === 'register' && (
              <View style={styles.screenInner}>
                {/* Top Bar: Back Arrow & Login Button */}
                <View style={styles.topToggleRow}>
                  <TouchableOpacity
                    style={styles.toggleTextLink}
                    onPress={() => transitionTo('login', 'back')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={20} color="#0f172a" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topLoginTextBtn}
                    onPress={() => transitionTo('login', 'back')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.topLoginTextBtnLabel}>Login</Text>
                  </TouchableOpacity>
                </View>

                {/* Brand Header */}
                <View style={styles.brandHeaderCenter}>
                  <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                    <Text style={styles.logoLetter}>M</Text>
                  </Animated.View>
                  <Text style={styles.brandTitle}>MaterialMApp</Text>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Quarry & Weighbridge Dispatch</Text>
                  </View>
                </View>

                {/* Form Titles */}
                <View style={styles.formHeaderBlock}>
                  <Text style={styles.mainHeading}>Create Your Account</Text>
                  <Text style={styles.subHeading}>Get started with your business account</Text>
                </View>

                {/* Error Banner */}
                {errorMsg ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* Success Banner */}
                {successMsg ? (
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                    <Text style={styles.successBannerText}>{successMsg}</Text>
                  </View>
                ) : null}

                {/* Full Name Input */}
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedInput === 'regName' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons name="person-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
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
                      <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Email Address Input */}
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedInput === 'regEmail' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons name="mail-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
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
                      <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputFieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View
                    style={[
                      styles.inputBox,
                      focusedInput === 'regPassword' && styles.inputBoxFocused,
                    ]}
                  >
                    <Ionicons name="lock-closed-outline" size={17} color="#64748b" style={styles.inputLeadingIcon} />
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
                        size={18}
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

                {/* Terms and Privacy Policy Note */}
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

          {/* Decorative Subtle Wave Curves at bottom (matching reference UI) */}
          <View style={styles.waveContainer} pointerEvents="none">
            <Svg width="100%" height="90" viewBox="0 0 375 90" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="waveGrad1" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#e0f2fe" stopOpacity="0.55" />
                  <Stop offset="1" stopColor="#ccfbf1" stopOpacity="0.55" />
                </LinearGradient>
                <LinearGradient id="waveGrad2" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#ccfbf1" stopOpacity="0.4" />
                  <Stop offset="1" stopColor="#f0fdfa" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Path
                d="M0,28 C90,62 190,10 285,42 C330,58 355,44 375,36 L375,90 L0,90 Z"
                fill="url(#waveGrad1)"
              />
              <Path
                d="M0,48 C80,20 185,72 275,38 C325,18 355,34 375,40 L375,90 L0,90 Z"
                fill="url(#waveGrad2)"
              />
            </Svg>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* OTP MODAL DIALOG                                         */}
      {/* ======================================================== */}
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
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPhoneWrapper: {
    width: '100%',
    maxWidth: 420,
    minHeight: '100%',
    backgroundColor: '#ffffff',
    position: 'relative',
    paddingBottom: 24,
  },
  desktopCardWrapper: {
    marginVertical: 20,
    borderRadius: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  animatedPane: {
    flex: 1,
    width: '100%',
  },
  screenInner: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },

  /* Top Toggle Row */
  topToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    height: 40,
  },
  toggleTextLink: {
    padding: 6,
  },
  topPillSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  topPillActive: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topPillActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  topPillInactive: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0284c7',
  },
  topPillInactiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  topLoginTextBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  topLoginTextBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },

  /* Brand Header Block */
  brandHeaderCenter: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  logoBadge: {
    width: 48,
    height: 48,
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
    fontSize: 26,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  tagBadge: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
    marginTop: 4,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
  },
  slideSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },

  /* 3D Hero Illustrations */
  heroImageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginVertical: 14,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageContainerSlide2: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginVertical: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  heroImageSlide2: {
    width: '100%',
    height: '100%',
  },
  slideForwardTapArea: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    bottom: 60,
  },

  /* Slide 2 Specifics */
  slide2Header: {
    marginTop: 6,
    marginBottom: 12,
  },
  slide2Title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  featureCardsCol: {
    gap: 10,
    marginBottom: 16,
  },
  featureCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  featureSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },

  /* Onboarding Bottom Controls */
  onboardingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
    height: 46,
  },
  dotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#0d9488',
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },
  backTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backTextBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  nextPillBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  nextPillBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Form Titles & Inputs */
  formHeaderBlock: {
    marginBottom: 14,
  },
  mainHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subHeading: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 3,
  },
  inputFieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputBoxFocused: {
    borderColor: '#0284c7',
    borderWidth: 1.5,
    backgroundColor: '#f8fafc',
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    fontSize: 13.5,
    color: '#0f172a',
    outlineWidth: 0,
  },

  /* Buttons */
  primaryActionBtn: {
    backgroundColor: '#0284c7',
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  orText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  secondaryOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
  },
  secondaryOtpBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Bottom Links */
  bottomLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  bottomLinkMuted: {
    fontSize: 12.5,
    color: '#64748b',
  },
  bottomLinkAction: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  termsNoteWrap: {
    marginTop: 14,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  termsNoteText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsNoteLink: {
    color: '#0284c7',
    fontWeight: '600',
  },

  /* Alerts */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '500',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  successBannerText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
    flex: 1,
  },

  /* Wave decoration */
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
    padding: 18,
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
    fontSize: 11.5,
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
