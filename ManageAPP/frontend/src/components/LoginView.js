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
  SafeAreaView,
  StatusBar,
  Dimensions,
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Screen flow: 'onboard1' -> 'onboard2' -> 'login' -> 'register'
  // Default starts at onboarding slide 1 (Screen 1 from reference)
  const [activeScreen, setActiveScreen] = useState('onboard1');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  // OTP Modal
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
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
    // Float for hero images
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const navigateTo = (screen, direction = 'next') => {
    setErrorMsg('');
    setSuccessMsg('');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction === 'next' ? -30 : 30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setActiveScreen(screen);
      slideAnim.setValue(direction === 'next' ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
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
    if (!name.trim()) { setErrorMsg('Please enter your full name.'); return; }
    if (!email.trim() || !password.trim()) { setErrorMsg('Please enter both email and password.'); return; }
    if (password.length < 4) { setErrorMsg('Password must be at least 4 characters.'); return; }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.register(email.trim(), password.trim(), name.trim());
      setSuccessMsg('Account created! Signing in...');
      await login(email.trim(), password.trim());
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = () => {
    if (!otpPhone.trim()) { setOtpMsg('Please enter your mobile number or email.'); return; }
    setOtpLoading(true);
    setOtpMsg('');
    setTimeout(() => { setOtpLoading(false); setOtpSent(true); setOtpMsg(`OTP sent to ${otpPhone.trim()}. (Demo: 123456)`); }, 700);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setOtpMsg('Please enter the 6-digit OTP.'); return; }
    setOtpLoading(true);
    try {
      await login('admin@materialmapp.com', 'admin123');
      setOtpModalVisible(false);
    } catch (err) { setOtpMsg('OTP verification failed.'); }
    finally { setOtpLoading(false); }
  };

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.kav}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ═══ FULL SCREEN CANVAS ═══ */}
          <View style={[s.canvas, { minHeight: screenHeight }]}>

            {/* ─── TOP BAR (conditionally rendered per screen) ─── */}
            {activeScreen === 'login' && (
              <View style={s.topBar}>
                <View style={{ width: 40 }} />
                <View style={s.topBarRight}>
                  <TouchableOpacity style={s.loginPillOutline} activeOpacity={0.8}>
                    <Text style={s.loginPillOutlineText}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.signUpPill}
                    onPress={() => navigateTo('register', 'next')}
                    activeOpacity={0.85}
                  >
                    <Text style={s.signUpPillText}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeScreen === 'register' && (
              <View style={s.topBar}>
                <TouchableOpacity
                  style={s.backBtn}
                  onPress={() => navigateTo('login', 'back')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={26} color="#0f172a" />
                </TouchableOpacity>
                <View style={s.topBarRight}>
                  <TouchableOpacity
                    style={s.loginPillOutline}
                    onPress={() => navigateTo('login', 'back')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.loginPillOutlineText}>Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(activeScreen === 'onboard1' || activeScreen === 'onboard2') && (
              <View style={s.topBar}>
                <View style={{ width: 40 }} />
                <View style={{ width: 40 }} />
              </View>
            )}

            {/* ─── ANIMATED CONTENT AREA ─── */}
            <Animated.View
              style={[
                s.contentArea,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
              ]}
            >

              {/* ═══════════════════════════════════════════════ */}
              {/* SCREEN 1: ONBOARDING SLIDE 1                   */}
              {/* ═══════════════════════════════════════════════ */}
              {activeScreen === 'onboard1' && (
                <View style={s.screenInner}>
                  {/* Brand */}
                  <View style={s.brandCenter}>
                    <Animated.View style={[s.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                      <Text style={s.logoLetter}>M</Text>
                    </Animated.View>
                    <Text style={s.brandName}>MaterialMApp</Text>
                    <Text style={s.brandTagline}>Quarry & Weighbridge Dispatch</Text>
                  </View>

                  {/* Description */}
                  <Text style={s.onboardDesc}>
                    Fast vehicle entries, automated delivery challans, and live sales reports.
                  </Text>

                  {/* Hero Image */}
                  <Animated.View style={[s.heroWrap, { transform: [{ translateY: floatAnim }] }]}>
                    <Image source={weighbridgeHero} style={s.heroImg} resizeMode="cover" />
                  </Animated.View>

                  {/* Bottom: Dots + Skip */}
                  <View style={s.onboardBottom}>
                    <View style={s.dotsRow}>
                      <View style={[s.dot, s.dotActive]} />
                      <View style={s.dot} />
                    </View>
                    <TouchableOpacity
                      style={s.skipBtn}
                      onPress={() => navigateTo('login', 'next')}
                      activeOpacity={0.7}
                    >
                      <Text style={s.skipBtnText}>Skip {'>'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ═══════════════════════════════════════════════ */}
              {/* SCREEN 2: ONBOARDING SLIDE 2                   */}
              {/* ═══════════════════════════════════════════════ */}
              {activeScreen === 'onboard2' && (
                <View style={s.screenInner}>
                  {/* Hero Image */}
                  <Animated.View style={[s.heroWrap2, { transform: [{ translateY: floatAnim }] }]}>
                    <Image source={operationsHero} style={s.heroImg} resizeMode="cover" />
                  </Animated.View>

                  {/* Title */}
                  <Text style={s.slide2Title}>Simplify Your{'\n'}Material Operations</Text>

                  {/* Feature Cards */}
                  <View style={s.featuresCol}>
                    <View style={s.featureRow}>
                      <View style={[s.featureIcon, { backgroundColor: '#e0f2fe' }]}>
                        <Ionicons name="git-branch-outline" size={20} color="#0284c7" />
                      </View>
                      <View style={s.featureTextCol}>
                        <Text style={s.featureTitle}>Quick Vehicle Entries</Text>
                        <Text style={s.featureSub}>Capture vehicle details in seconds</Text>
                      </View>
                    </View>

                    <View style={s.featureRow}>
                      <View style={[s.featureIcon, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="document-text-outline" size={20} color="#16a34a" />
                      </View>
                      <View style={s.featureTextCol}>
                        <Text style={s.featureTitle}>Automated Challans</Text>
                        <Text style={s.featureSub}>Generate delivery challans instantly</Text>
                      </View>
                    </View>

                    <View style={s.featureRow}>
                      <View style={[s.featureIcon, { backgroundColor: '#f3e8ff' }]}>
                        <Ionicons name="bar-chart-outline" size={20} color="#7c3aed" />
                      </View>
                      <View style={s.featureTextCol}>
                        <Text style={s.featureTitle}>Live Sales Reports</Text>
                        <Text style={s.featureSub}>Track your business in real-time</Text>
                      </View>
                    </View>
                  </View>

                  {/* Bottom: Back + Dots + Next */}
                  <View style={s.onboardBottom2}>
                    <TouchableOpacity
                      style={s.backTextBtn}
                      onPress={() => navigateTo('onboard1', 'back')}
                      activeOpacity={0.7}
                    >
                      <Text style={s.backTextBtnLabel}>Back</Text>
                    </TouchableOpacity>

                    <View style={s.dotsRow}>
                      <View style={s.dot} />
                      <View style={[s.dot, s.dotActive]} />
                    </View>

                    <TouchableOpacity
                      style={s.nextPill}
                      onPress={() => navigateTo('login', 'next')}
                      activeOpacity={0.85}
                    >
                      <Text style={s.nextPillText}>Next {'>'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ═══════════════════════════════════════════════ */}
              {/* SCREEN 3: LOGIN (WELCOME BACK!)                */}
              {/* ═══════════════════════════════════════════════ */}
              {activeScreen === 'login' && (
                <View style={s.screenInner}>
                  {/* Brand */}
                  <View style={s.brandCenter}>
                    <Animated.View style={[s.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                      <Text style={s.logoLetter}>M</Text>
                    </Animated.View>
                    <Text style={s.brandName}>MaterialMApp</Text>
                    <Text style={s.brandTagline}>Quarry & Weighbridge Dispatch</Text>
                  </View>

                  {/* Form */}
                  <View style={s.formBlock}>
                    <Text style={s.formTitle}>Welcome Back!</Text>
                    <Text style={s.formSubtitle}>Sign in to continue to your account</Text>
                  </View>

                  {errorMsg ? (
                    <View style={s.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                      <Text style={s.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}
                  {successMsg ? (
                    <View style={s.successBanner}>
                      <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                      <Text style={s.successText}>{successMsg}</Text>
                    </View>
                  ) : null}

                  {/* Email */}
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Email Address</Text>
                    <View style={[s.inputBox, focusedInput === 'le' && s.inputBoxFocus]}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={s.inputIcon} />
                      <TextInput
                        style={s.textInput}
                        placeholder="Enter your email address"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('le')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {email ? (
                        <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password */}
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Password</Text>
                    <View style={[s.inputBox, focusedInput === 'lp' && s.inputBoxFocus]}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={s.inputIcon} />
                      <TextInput
                        style={s.textInput}
                        placeholder="Enter your password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('lp')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign In */}
                  <TouchableOpacity
                    style={[s.primaryBtn, loading && { opacity: 0.7 }]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Sign In</Text>}
                  </TouchableOpacity>

                  {/* OR */}
                  <View style={s.orRow}>
                    <View style={s.orLine} />
                    <Text style={s.orText}>OR</Text>
                    <View style={s.orLine} />
                  </View>

                  {/* OTP */}
                  <TouchableOpacity
                    style={s.otpBtn}
                    onPress={() => { setOtpMsg(''); setOtpSent(false); setOtpCode(''); setOtpModalVisible(true); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="phone-portrait-outline" size={18} color="#0284c7" style={{ marginRight: 8 }} />
                    <Text style={s.otpBtnText}>Continue with OTP</Text>
                  </TouchableOpacity>

                  {/* Bottom link */}
                  <View style={s.bottomLink}>
                    <Text style={s.bottomLinkMuted}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigateTo('register', 'next')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                      <Text style={s.bottomLinkAction}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ═══════════════════════════════════════════════ */}
              {/* SCREEN 4: REGISTER (CREATE YOUR ACCOUNT)       */}
              {/* ═══════════════════════════════════════════════ */}
              {activeScreen === 'register' && (
                <View style={s.screenInner}>
                  {/* Brand */}
                  <View style={s.brandCenter}>
                    <Animated.View style={[s.logoBadge, { transform: [{ scale: logoPulse }] }]}>
                      <Text style={s.logoLetter}>M</Text>
                    </Animated.View>
                    <Text style={s.brandName}>MaterialMApp</Text>
                    <Text style={s.brandTagline}>Quarry & Weighbridge Dispatch</Text>
                  </View>

                  <View style={s.formBlock}>
                    <Text style={s.formTitle}>Create Your Account</Text>
                    <Text style={s.formSubtitle}>Get started with your business account</Text>
                  </View>

                  {errorMsg ? (
                    <View style={s.errorBanner}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                      <Text style={s.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}

                  {/* Full Name */}
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Full Name</Text>
                    <View style={[s.inputBox, focusedInput === 'rn' && s.inputBoxFocus]}>
                      <Ionicons name="person-outline" size={18} color="#64748b" style={s.inputIcon} />
                      <TextInput
                        style={s.textInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#94a3b8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        onFocus={() => setFocusedInput('rn')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {name ? (
                        <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Email */}
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Email Address</Text>
                    <View style={[s.inputBox, focusedInput === 're' && s.inputBoxFocus]}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={s.inputIcon} />
                      <TextInput
                        style={s.textInput}
                        placeholder="Enter your email"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('re')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      {email ? (
                        <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {/* Password */}
                  <View style={s.fieldGroup}>
                    <Text style={s.fieldLabel}>Password</Text>
                    <View style={[s.inputBox, focusedInput === 'rp' && s.inputBoxFocus]}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={s.inputIcon} />
                      <TextInput
                        style={s.textInput}
                        placeholder="Create a password"
                        placeholderTextColor="#94a3b8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        onFocus={() => setFocusedInput('rp')}
                        onBlur={() => setFocusedInput(null)}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sign Up */}
                  <TouchableOpacity
                    style={[s.primaryBtn, loading && { opacity: 0.7 }]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Sign Up</Text>}
                  </TouchableOpacity>

                  {/* Terms */}
                  <View style={s.termsWrap}>
                    <Text style={s.termsText}>
                      By continuing, you agree to our{' '}
                      <Text style={s.termsLink}>Terms &amp; Conditions</Text> and{' '}
                      <Text style={s.termsLink}>Privacy Policy</Text>
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* ─── DECORATIVE WAVE AT BOTTOM ─── */}
            <View style={s.waveWrap} pointerEvents="none">
              <Svg width="100%" height="90" viewBox="0 0 375 90" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="w1" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#e0f2fe" stopOpacity="0.7" />
                    <Stop offset="1" stopColor="#ccfbf1" stopOpacity="0.7" />
                  </LinearGradient>
                  <LinearGradient id="w2" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#ccfbf1" stopOpacity="0.5" />
                    <Stop offset="1" stopColor="#f0fdfa" stopOpacity="0.9" />
                  </LinearGradient>
                </Defs>
                <Path d="M0,30 C90,58 190,12 285,40 C330,54 355,42 375,36 L375,90 L0,90 Z" fill="url(#w1)" />
                <Path d="M0,48 C80,22 185,66 275,38 C325,20 355,32 375,40 L375,90 L0,90 Z" fill="url(#w2)" />
              </Svg>
            </View>
          </View>
        </ScrollView>

        {/* ─── OTP MODAL ─── */}
        <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
          <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setOtpModalVisible(false)}>
            <TouchableOpacity style={s.modalBox} activeOpacity={1} onPress={e => Platform.OS === 'web' && e?.stopPropagation?.()}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Continue with OTP</Text>
                  <Text style={s.modalSub}>Quick login via one-time verification</Text>
                </View>
                <TouchableOpacity style={s.modalClose} onPress={() => setOtpModalVisible(false)}>
                  <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              {otpMsg ? (
                <View style={[s.errorBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Ionicons name="information-circle" size={16} color="#15803d" />
                  <Text style={[s.errorText, { color: '#15803d' }]}>{otpMsg}</Text>
                </View>
              ) : null}
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Mobile Number or Email</Text>
                <View style={s.inputBox}>
                  <Ionicons name="call-outline" size={17} color="#64748b" style={s.inputIcon} />
                  <TextInput style={s.textInput} placeholder="+91 98765 43210 or email" placeholderTextColor="#94a3b8" value={otpPhone} onChangeText={setOtpPhone} autoCapitalize="none" />
                </View>
              </View>
              {otpSent && (
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>6-Digit OTP</Text>
                  <View style={s.inputBox}>
                    <Ionicons name="key-outline" size={17} color="#64748b" style={s.inputIcon} />
                    <TextInput style={s.textInput} placeholder="Enter 6-digit code" placeholderTextColor="#94a3b8" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" />
                  </View>
                </View>
              )}
              <TouchableOpacity style={[s.primaryBtn, otpLoading && { opacity: 0.7 }]} onPress={otpSent ? handleVerifyOtp : handleSendOtp} disabled={otpLoading}>
                {otpLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>{otpSent ? 'Verify & Sign In' : 'Send OTP'}</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : {}),
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  /* Full-screen canvas */
  canvas: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    position: 'relative',
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 4,
    minHeight: 50,
    zIndex: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPillOutline: {
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
  },
  loginPillOutlineText: {
    color: '#0284c7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  signUpPill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  signUpPillText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Animated content */
  contentArea: {
    flex: 1,
    width: '100%',
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
  },

  /* Brand */
  brandCenter: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  logoLetter: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
    marginTop: 3,
  },

  /* Onboarding Screen 1 */
  onboardDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  heroWrap: {
    width: '100%',
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginBottom: 20,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  onboardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#0d9488',
    borderRadius: 4,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },

  /* Onboarding Screen 2 */
  heroWrap2: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  slide2Title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  featuresCol: {
    gap: 12,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  featureSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  onboardBottom2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  backTextBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backTextBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  nextPill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  nextPillText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Form (Login & Register) */
  formBlock: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 3,
  },

  /* Input Fields */
  fieldGroup: {
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
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  inputBoxFocus: {
    borderColor: '#0284c7',
    borderWidth: 1.5,
    backgroundColor: '#f0f9ff',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: 50,
    fontSize: 14,
    color: '#0f172a',
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: '#0284c7',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
  },
  orRow: {
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
    letterSpacing: 0.5,
  },
  otpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#ffffff',
  },
  otpBtnText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  bottomLinkMuted: {
    fontSize: 14,
    color: '#64748b',
  },
  bottomLinkAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  termsWrap: {
    marginTop: 18,
    alignItems: 'center',
    paddingHorizontal: 10,
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

  /* Banners */
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
  errorText: {
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
  successText: {
    fontSize: 12.5,
    color: '#15803d',
    fontWeight: '600',
    flex: 1,
  },

  /* Wave */
  waveWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },

  /* Modal */
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
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
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
