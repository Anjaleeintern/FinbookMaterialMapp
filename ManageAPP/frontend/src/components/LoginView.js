import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  StatusBar,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const weighbridgeHero = require('../../assets/weighbridge_hero.jpg');
const operationsHero = require('../../assets/operations_hero.jpg');

export const LoginView = () => {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  // Screens: 'landing' | 'login' | 'register'
  const [screen, setScreen] = useState('landing');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [suc, setSuc] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Input refs for direct focus without re-render glitches
  const emailRef = useRef(null);
  const pwRef = useRef(null);
  const nameRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Keyboard listener to keep password and action buttons visible when typing
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates?.height || 260);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToInput = (yOffset = 180) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  // Debouncing ref to prevent multiple clicks / double execution
  const isSubmitting = useRef(false);

  // Clean, instantaneous screen transition without jarring 0-opacity fade flicker
  const go = useCallback((to) => {
    if (screen === to) return;
    setErr('');
    setSuc('');
    setPassword('');
    setScreen(to);
  }, [screen]);

  const doLogin = async () => {
    if (loading || isSubmitting.current) return;
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) {
      setErr('Please enter your email and password.');
      return;
    }
    isSubmitting.current = true;
    setLoading(true);
    setErr('');
    try {
      await login(e, p);
    } catch (error) {
      setErr(error.message || 'Invalid email or password.');
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const doRegister = async () => {
    if (loading || isSubmitting.current) return;
    const n = name.trim();
    const e = email.trim();
    const p = password.trim();
    if (!n) {
      setErr('Please enter your full name.');
      return;
    }
    if (!e || !p) {
      setErr('Please enter email and password.');
      return;
    }
    if (p.length < 4) {
      setErr('Password must be at least 4 characters.');
      return;
    }
    isSubmitting.current = true;
    setLoading(true);
    setErr('');
    setSuc('');
    try {
      await api.register(e, p, n);
      setSuc('Account created! Signing in...');
      await login(e, p);
    } catch (error) {
      setErr(error.message || 'Registration failed.');
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const isDesktop = winW >= 560;
  const heroHeight = Math.min(Math.max(winH * 0.28, 200), 260);

  // Accurate Status Bar Top Padding for Phone (Android punch-hole, iOS notch, Web)
  const androidStatusBar = Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 0;
  const topSafePadding = Math.max(insets?.top || 0, androidStatusBar, Platform.OS === 'web' ? 14 : 0);
  const bottomSafePadding = Math.max(insets?.bottom || 0, 24);

  return (
    <SafeAreaView style={st.outer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
        style={st.keyboardView}
      >
        {/* Device frame container for real app view */}
        <View
          style={[
            st.deviceContainer,
            isDesktop ? st.deviceDesktopFrame : { overflow: 'visible' },
          ]}
        >

          {/* ════════════ TOP APP BAR (Padded below phone status bar) ════════════ */}
          <View style={[st.topBar, { paddingTop: topSafePadding + 8 }]}>
            {screen === 'landing' ? (
              <>
                <View style={st.brandMini}>
                  <View style={st.logoMini}>
                    <Text style={st.logoMiniT}>M</Text>
                  </View>
                  <Text style={st.brandMiniT}>MaterialMApp</Text>
                </View>
                <View style={st.topRightBtns}>
                  <TouchableOpacity
                    style={st.pillOutline}
                    onPress={() => go('login')}
                    activeOpacity={0.8}
                  >
                    <Text style={st.pillOutlineT}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.pillFill}
                    onPress={() => go('register')}
                    activeOpacity={0.85}
                  >
                    <Text style={st.pillFillT}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : screen === 'login' ? (
              <>
                <TouchableOpacity
                  style={st.backCircle}
                  onPress={() => go('landing')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={22} color="#0f172a" />
                </TouchableOpacity>
                <View style={st.topRightBtns}>
                  <TouchableOpacity style={st.pillOutlineActive} activeOpacity={1}>
                    <Text style={st.pillOutlineActiveT}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.pillFill}
                    onPress={() => go('register')}
                    activeOpacity={0.85}
                  >
                    <Text style={st.pillFillT}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={st.backCircle}
                  onPress={() => go('login')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={22} color="#0f172a" />
                </TouchableOpacity>
                <View style={st.topRightBtns}>
                  <TouchableOpacity
                    style={st.pillOutline}
                    onPress={() => go('login')}
                    activeOpacity={0.8}
                  >
                    <Text style={st.pillOutlineT}>Login</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* ════════════ SCROLLABLE CONTENT ════════════ */}
          <ScrollView
            ref={scrollViewRef}
            style={st.scroll}
            contentContainerStyle={[
              st.scrollContent,
              {
                paddingBottom: keyboardHeight > 0
                  ? keyboardHeight + 80
                  : bottomSafePadding + 32,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={st.animatedWrap}>

              {/* ──────────────────────────────────────────────────────── */}
              {/* SCREEN 1: COMPLETE FIRST LANDING PAGE                   */}
              {/* ──────────────────────────────────────────────────────── */}
              {screen === 'landing' && (
                <View style={st.landingContainer}>

                  {/* Brand Block */}
                  <View style={st.brandBlock}>
                    <View style={st.logoBadge}>
                      <Text style={st.logoBadgeText}>M</Text>
                    </View>
                    <Text style={st.brandTitle}>MaterialMApp</Text>
                    <View style={st.tagPill}>
                      <Text style={st.tagPillText}>Quarry & Weighbridge Dispatch</Text>
                    </View>
                    <Text style={st.heroTagline}>
                      Fast vehicle entries, automated delivery challans, and live sales reports.
                    </Text>
                  </View>

                  {/* Hero 1: 3D Weighbridge Truck Image */}
                  <View
                    style={[
                      st.heroCard,
                      { height: heroHeight },
                    ]}
                  >
                    <Image
                      source={weighbridgeHero}
                      style={st.heroImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Pagination Dots & Skip Button */}
                  <View style={st.dotSkipRow}>
                    <View style={st.dotsGroup}>
                      <View style={st.dotActive} />
                      <View style={st.dotInactive} />
                      <View style={st.dotInactive} />
                    </View>
                    <TouchableOpacity
                      onPress={() => go('login')}
                      style={st.skipBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={st.skipBtnText}>Skip <Ionicons name="chevron-forward" size={13} color="#0284c7" /></Text>
                    </TouchableOpacity>
                  </View>

                  {/* Divider */}
                  <View style={st.dividerSoft}>
                    <View style={st.dividerLine} />
                    <View style={st.dividerDot} />
                    <View style={st.dividerLine} />
                  </View>

                  {/* Section 2: Simplify Your Material Operations */}
                  <View style={st.simplifyHeader}>
                    <Text style={st.simplifyTitle}>
                      Simplify Your{'\n'}Material Operations
                    </Text>
                    <Text style={st.simplifySubtitle}>
                      Streamline end-to-end dispatch, gross weighing, and tare management seamlessly.
                    </Text>
                  </View>

                  {/* Hero 2: 3D Operations Illustration */}
                  <View
                    style={[
                      st.heroCardSecondary,
                      { height: heroHeight * 0.85 },
                    ]}
                  >
                    <Image
                      source={operationsHero}
                      style={st.heroImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* 3 Feature Cards */}
                  <View style={st.featuresList}>
                    {/* Feature 1 */}
                    <View style={st.featureItem}>
                      <View style={[st.featureIconWrap, { backgroundColor: '#e0f2fe' }]}>
                        <Ionicons name="car-sport-outline" size={22} color="#0284c7" />
                      </View>
                      <View style={st.featureTexts}>
                        <Text style={st.featureHeading}>Quick Vehicle Entries</Text>
                        <Text style={st.featureDesc}>Capture vehicle details in seconds</Text>
                      </View>
                    </View>

                    {/* Feature 2 */}
                    <View style={st.featureItem}>
                      <View style={[st.featureIconWrap, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="document-text-outline" size={22} color="#16a34a" />
                      </View>
                      <View style={st.featureTexts}>
                        <Text style={st.featureHeading}>Automated Challans</Text>
                        <Text style={st.featureDesc}>Generate delivery challans instantly</Text>
                      </View>
                    </View>

                    {/* Feature 3 */}
                    <View style={st.featureItem}>
                      <View style={[st.featureIconWrap, { backgroundColor: '#f3e8ff' }]}>
                        <Ionicons name="bar-chart-outline" size={22} color="#7c3aed" />
                      </View>
                      <View style={st.featureTexts}>
                        <Text style={st.featureHeading}>Live Sales Reports</Text>
                        <Text style={st.featureDesc}>Track your business in real-time</Text>
                      </View>
                    </View>
                  </View>

                  {/* Bottom Action CTAs */}
                  <View style={st.bottomActions}>
                    <TouchableOpacity
                      style={st.primaryButton}
                      onPress={() => go('login')}
                      activeOpacity={0.88}
                    >
                      <Text style={st.primaryButtonText}>Get Started</Text>
                      <Ionicons name="arrow-forward" size={19} color="#ffffff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => go('login')}
                      style={st.secondaryTextBtn}
                      activeOpacity={0.75}
                    >
                      <Text style={st.secondaryText}>
                        Already have an account? <Text style={st.highlightText}>Sign In</Text>
                      </Text>
                    </TouchableOpacity>

                    <View style={st.trustBadges}>
                      <Text style={st.trustText}>⚡ Instant Dispatch  •  📊 Live Sync  •  🔒 Secure</Text>
                    </View>
                  </View>

                </View>
              )}

              {/* ──────────────────────────────────────────────────────── */}
              {/* SCREEN 2: LOGIN (Welcome Back!)                          */}
              {/* ──────────────────────────────────────────────────────── */}
              {screen === 'login' && (
                <View style={st.formContainer}>
                  
                  {/* Brand Block */}
                  <View style={st.brandBlockCompact}>
                    <View style={st.logoBadgeSmall}>
                      <Text style={st.logoBadgeSmallText}>M</Text>
                    </View>
                    <Text style={st.brandTitleSmall}>MaterialMApp</Text>
                    <View style={st.tagPillSmall}>
                      <Text style={st.tagPillSmallText}>Quarry & Weighbridge Dispatch</Text>
                    </View>
                  </View>

                  {/* Heading */}
                  <View style={st.formHeadingBox}>
                    <Text style={st.formTitle}>Welcome Back!</Text>
                    <Text style={st.formSub}>Sign in to continue to your account</Text>
                  </View>

                  {/* Banners */}
                  {err ? (
                    <View style={st.errorBanner}>
                      <Ionicons name="alert-circle" size={17} color="#ef4444" />
                      <Text style={st.errorBannerText}>{err}</Text>
                    </View>
                  ) : null}
                  {suc ? (
                    <View style={st.successBanner}>
                      <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
                      <Text style={st.successBannerText}>{suc}</Text>
                    </View>
                  ) : null}

                  {/* Email Input */}
                  <View style={st.inputGroup}>
                    <Text style={st.inputLabel}>Email Address</Text>
                    <View style={st.inputBox}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={st.inputIcon} />
                      <TextInput
                        ref={emailRef}
                        style={st.textInput}
                        placeholder="Enter your email address"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => pwRef.current?.focus()}
                        onFocus={() => scrollToInput(60)}
                      />
                      {email ? (
                        <TouchableOpacity
                          onPress={() => setEmail('')}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password Input */}
                  <View style={st.inputGroup}>
                    <Text style={st.inputLabel}>Password</Text>
                    <View style={st.inputBox}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={st.inputIcon} />
                      <TextInput
                        ref={pwRef}
                        style={st.textInput}
                        placeholder="Enter your password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="password"
                        autoComplete="current-password"
                        returnKeyType="done"
                        onSubmitEditing={doLogin}
                        onFocus={() => scrollToInput(160)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPw((v) => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showPw ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign In Button */}
                  <TouchableOpacity
                    style={[st.primaryButton, loading && { opacity: 0.75 }]}
                    onPress={doLogin}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={st.primaryButtonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>


                  {/* Bottom Link */}
                  <View style={st.switchLinkBox}>
                    <Text style={st.switchLinkMuted}>Don't have an account? </Text>
                    <TouchableOpacity
                      onPress={() => go('register')}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={st.switchLinkActive}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={st.trustBadges}>
                    <Text style={st.trustText}>🔒 256-bit SSL Encrypted • Weighbridge Connected</Text>
                  </View>

                </View>
              )}

              {/* ──────────────────────────────────────────────────────── */}
              {/* SCREEN 3: REGISTER (Create Your Account)                 */}
              {/* ──────────────────────────────────────────────────────── */}
              {screen === 'register' && (
                <View style={st.formContainer}>

                  {/* Brand Block */}
                  <View style={[st.brandBlockCompact, keyboardHeight > 0 && { marginBottom: 6 }]}>
                    <View style={[st.logoBadgeSmall, keyboardHeight > 0 && { width: 38, height: 38, marginBottom: 4 }]}>
                      <Text style={[st.logoBadgeSmallText, keyboardHeight > 0 && { fontSize: 20 }]}>M</Text>
                    </View>
                    <Text style={[st.brandTitleSmall, keyboardHeight > 0 && { fontSize: 18 }]}>MaterialMApp</Text>
                    {keyboardHeight === 0 && (
                      <View style={st.tagPillSmall}>
                        <Text style={st.tagPillSmallText}>Quarry & Weighbridge Dispatch</Text>
                      </View>
                    )}
                  </View>

                  {/* Heading */}
                  <View style={[st.formHeadingBox, keyboardHeight > 0 && { marginBottom: 12, marginTop: 2 }]}>
                    <Text style={[st.formTitle, keyboardHeight > 0 && { fontSize: 20 }]}>Create Your Account</Text>
                    <Text style={st.formSub}>Get started with your business account</Text>
                  </View>

                  {/* Banners */}
                  {err ? (
                    <View style={st.errorBanner}>
                      <Ionicons name="alert-circle" size={17} color="#ef4444" />
                      <Text style={st.errorBannerText}>{err}</Text>
                    </View>
                  ) : null}
                  {suc ? (
                    <View style={st.successBanner}>
                      <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
                      <Text style={st.successBannerText}>{suc}</Text>
                    </View>
                  ) : null}

                  {/* Full Name Input */}
                  <View style={st.inputGroup}>
                    <Text style={st.inputLabel}>Full Name</Text>
                    <View style={st.inputBox}>
                      <Ionicons name="person-outline" size={18} color="#64748b" style={st.inputIcon} />
                      <TextInput
                        ref={nameRef}
                        style={st.textInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#94a3b8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => emailRef.current?.focus()}
                        onFocus={() => scrollToInput(40)}
                      />
                      {name ? (
                        <TouchableOpacity
                          onPress={() => setName('')}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Email Input */}
                  <View style={st.inputGroup}>
                    <Text style={st.inputLabel}>Email Address</Text>
                    <View style={st.inputBox}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={st.inputIcon} />
                      <TextInput
                        ref={emailRef}
                        style={st.textInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => pwRef.current?.focus()}
                        onFocus={() => scrollToInput(120)}
                      />
                      {email ? (
                        <TouchableOpacity
                          onPress={() => setEmail('')}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password Input */}
                  <View style={st.inputGroup}>
                    <Text style={st.inputLabel}>Password</Text>
                    <View style={st.inputBox}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={st.inputIcon} />
                      <TextInput
                        ref={pwRef}
                        style={st.textInput}
                        placeholder="Create a password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPw}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        returnKeyType="done"
                        onSubmitEditing={doRegister}
                        onFocus={() => scrollToInput(220)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPw((v) => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showPw ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign Up Button */}
                  <TouchableOpacity
                    style={[st.primaryButton, loading && { opacity: 0.75 }]}
                    onPress={doRegister}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={st.primaryButtonText}>Sign Up</Text>
                    )}
                  </TouchableOpacity>

                  {/* Terms Note */}
                  <View style={st.termsBox}>
                    <Text style={st.termsText}>
                      By continuing, you agree to our{' '}
                      <Text style={st.termsLink}>Terms & Conditions</Text> and{' '}
                      <Text style={st.termsLink}>Privacy Policy</Text>
                    </Text>
                  </View>

                  {/* Switch Link */}
                  <View style={st.switchLinkBox}>
                    <Text style={st.switchLinkMuted}>Already have an account? </Text>
                    <TouchableOpacity
                      onPress={() => go('login')}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={st.switchLinkActive}>Sign In</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              )}

            </View>
          </ScrollView>


        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────
// COMPLETE DESIGN SYSTEM & STYLES
// ─────────────────────────────────────────
const st = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  deviceContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  deviceDesktopFrame: {
    maxWidth: 440,
    marginHorizontal: 'auto',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },


  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    minHeight: 52,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.6)',
  },
  brandMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMini: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMiniT: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  brandMiniT: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  topRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOutline: {
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillOutlineT: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },
  pillOutlineActive: {
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillOutlineActiveT: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },
  pillFill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  pillFillT: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Scroll Layout */
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  animatedWrap: {
    width: '100%',
    minHeight: '100%',
  },

  /* ── LANDING PAGE STYLES ── */
  landingContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.6,
  },
  tagPill: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 13,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 5,
    marginBottom: 8,
  },
  tagPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f766e',
  },
  heroTagline: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 10,
  },

  /* Hero Cards */
  heroCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.15)',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  heroCardSecondary: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(2,132,199,0.15)',
    marginBottom: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },

  /* Dot Skip Row */
  dotSkipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  dotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0d9488',
  },
  dotInactive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },

  /* Divider */
  dividerSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },

  /* Simplify Header */
  simplifyHeader: {
    marginBottom: 16,
  },
  simplifyTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  simplifySubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },

  /* Feature Cards */
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTexts: {
    flex: 1,
  },
  featureHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  featureDesc: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },

  /* Bottom Actions */
  bottomActions: {
    marginTop: 8,
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryTextBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryText: {
    fontSize: 14,
    color: '#64748b',
  },
  highlightText: {
    color: '#0284c7',
    fontWeight: '700',
  },
  trustBadges: {
    marginTop: 8,
    alignItems: 'center',
  },
  trustText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* ── FORM STYLES (Login & Register) ── */
  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  brandBlockCompact: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoBadgeSmall: {
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
    shadowRadius: 8,
    elevation: 4,
  },
  logoBadgeSmallText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  brandTitleSmall: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  tagPillSmall: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 14,
    marginTop: 4,
    alignSelf: 'center',
  },
  tagPillSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
  formHeadingBox: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  formSub: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },

  /* Input fields */
  inputGroup: {
    marginBottom: 14,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 50,
    paddingVertical: 0,
    fontSize: 14.5,
    color: '#0f172a',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },

  /* Quick Demo Login Pill */
  quickDemoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 10,
  },
  quickDemoText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284c7',
  },

  /* OR Divider */
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
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
    letterSpacing: 0.6,
  },

  /* OTP Button */
  otpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
  },
  otpButtonText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Switch Links */
  switchLinkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 6,
  },
  switchLinkMuted: {
    fontSize: 14,
    color: '#64748b',
  },
  switchLinkActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },

  /* Terms */
  termsBox: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#0284c7',
    fontWeight: '600',
  },

  /* Error / Success Banners */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
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
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  successBannerText: {
    fontSize: 12.5,
    color: '#15803d',
    fontWeight: '600',
    flex: 1,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
