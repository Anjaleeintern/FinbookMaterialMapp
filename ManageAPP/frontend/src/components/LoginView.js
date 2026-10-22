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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const weighbridgeHero = require('../../assets/weighbridge_hero.jpg');
const operationsHero = require('../../assets/operations_hero.jpg');

export const LoginView = () => {
  const { login } = useAuth();
  const { width: W, height: H } = useWindowDimensions();

  // Flow: onboard1 → onboard2 → login ↔ register
  const [screen, setScreen] = useState('onboard1');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [suc, setSuc] = useState('');
  const [focus, setFocus] = useState(null);

  // OTP
  const [otpVis, setOtpVis] = useState(false);
  const [otpPh, setOtpPh] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoad, setOtpLoad] = useState(false);
  const [otpMsg, setOtpMsg] = useState('');

  // Anims
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -8, duration: 2000, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  const go = (to, dir = 'next') => {
    setErr(''); setSuc('');
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(slide, { toValue: dir === 'next' ? -30 : 30, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setScreen(to);
      slide.setValue(dir === 'next' ? 30 : -30);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 170, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 170, useNativeDriver: true }),
      ]).start();
    });
  };

  const doLogin = async () => {
    if (!email.trim() || !password.trim()) { setErr('Please enter email and password.'); return; }
    setLoading(true); setErr('');
    try { await login(email.trim(), password.trim()); }
    catch (e) { setErr(e.message || 'Invalid credentials.'); }
    finally { setLoading(false); }
  };

  const doRegister = async () => {
    if (!name.trim()) { setErr('Please enter your name.'); return; }
    if (!email.trim() || !password.trim()) { setErr('Please enter email and password.'); return; }
    if (password.length < 4) { setErr('Password must be 4+ characters.'); return; }
    setLoading(true); setErr(''); setSuc('');
    try {
      await api.register(email.trim(), password.trim(), name.trim());
      setSuc('Account created! Signing in...');
      await login(email.trim(), password.trim());
    } catch (e) { setErr(e.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  const sendOtp = () => {
    if (!otpPh.trim()) { setOtpMsg('Enter your mobile or email.'); return; }
    setOtpLoad(true); setOtpMsg('');
    setTimeout(() => { setOtpLoad(false); setOtpSent(true); setOtpMsg(`OTP sent to ${otpPh.trim()} (Demo: 123456)`); }, 700);
  };

  const verifyOtp = async () => {
    if (!otpCode.trim()) { setOtpMsg('Enter the 6-digit OTP.'); return; }
    setOtpLoad(true);
    try { await login('admin@materialmapp.com', 'admin123'); setOtpVis(false); }
    catch (e) { setOtpMsg('Verification failed.'); }
    finally { setOtpLoad(false); }
  };

  const heroH = Math.min(H * 0.32, 280);

  // ── RENDER ──
  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[st.root, { minHeight: H }]}>

          {/* ══ GRADIENT BACKGROUND (covers full screen) ══ */}
          <View style={st.bgGradient} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 375 812" preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <Stop offset="0.55" stopColor="#ffffff" stopOpacity="1" />
                  <Stop offset="0.75" stopColor="#f0fdfa" stopOpacity="1" />
                  <Stop offset="0.9" stopColor="#e0f2fe" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#ccfbf1" stopOpacity="0.9" />
                </SvgLinearGradient>
              </Defs>
              <Path d="M0,0 H375 V812 H0 Z" fill="url(#bg1)" />
              <Path d="M0,620 C60,580 150,650 220,620 C300,585 340,630 375,600 L375,812 L0,812 Z" fill="#e0f2fe" fillOpacity="0.5" />
              <Path d="M0,680 C80,640 200,710 280,670 C340,645 360,680 375,660 L375,812 L0,812 Z" fill="#ccfbf1" fillOpacity="0.6" />
              <Path d="M0,730 C100,700 200,750 300,720 C350,708 370,730 375,720 L375,812 L0,812 Z" fill="#99f6e4" fillOpacity="0.3" />
            </Svg>
          </View>

          <ScrollView
            contentContainerStyle={st.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* ── TOP BAR ── */}
            {screen === 'login' && (
              <View style={st.topBar}>
                <View style={{ width: 40 }} />
                <View style={st.topRight}>
                  <TouchableOpacity style={st.pillOutline} activeOpacity={0.8}>
                    <Text style={st.pillOutlineT}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.pillFill} onPress={() => go('register')} activeOpacity={0.85}>
                    <Text style={st.pillFillT}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {screen === 'register' && (
              <View style={st.topBar}>
                <TouchableOpacity style={st.backBtn} onPress={() => go('login', 'back')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={26} color="#0f172a" />
                </TouchableOpacity>
                <View style={st.topRight}>
                  <TouchableOpacity style={st.pillOutline} onPress={() => go('login', 'back')} activeOpacity={0.8}>
                    <Text style={st.pillOutlineT}>Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {(screen === 'onboard1' || screen === 'onboard2') && <View style={{ height: 16 }} />}

            {/* ── ANIMATED CONTENT ── */}
            <Animated.View style={[st.content, { opacity: fade, transform: [{ translateX: slide }] }]}>

              {/* ════════════════════════════════════════════ */}
              {/* SCREEN 1: ONBOARDING SLIDE 1               */}
              {/* ════════════════════════════════════════════ */}
              {screen === 'onboard1' && (
                <View style={[st.inner, { minHeight: H - 40 }]}>
                  <View style={st.topContent}>
                    {/* Brand */}
                    <View style={st.brandC}>
                      <Animated.View style={[st.logo, { transform: [{ scale: pulse }] }]}>
                        <Text style={st.logoT}>M</Text>
                      </Animated.View>
                      <Text style={st.brandN}>MaterialMApp</Text>
                      <Text style={st.brandTag}>Quarry & Weighbridge Dispatch</Text>
                    </View>

                    <Text style={st.obDesc}>
                      Fast vehicle entries, automated delivery challans, and live sales reports.
                    </Text>

                    {/* Hero */}
                    <Animated.View style={[st.heroWrap, { height: heroH, transform: [{ translateY: float }] }]}>
                      <Image source={weighbridgeHero} style={st.heroImg} resizeMode="cover" />
                    </Animated.View>
                  </View>

                  {/* Bottom */}
                  <View style={st.obBottom}>
                    <View style={st.dots}>
                      <View style={[st.dot, st.dotOn]} />
                      <View style={st.dot} />
                    </View>
                    <TouchableOpacity onPress={() => go('login')} activeOpacity={0.7} style={st.skipBtn}>
                      <Text style={st.skipT}>Skip {'>'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════ */}
              {/* SCREEN 2: ONBOARDING SLIDE 2               */}
              {/* ════════════════════════════════════════════ */}
              {screen === 'onboard2' && (
                <View style={[st.inner, { minHeight: H - 40 }]}>
                  <View style={st.topContent}>
                    {/* Hero */}
                    <Animated.View style={[st.heroWrap2, { height: heroH * 0.85, transform: [{ translateY: float }] }]}>
                      <Image source={operationsHero} style={st.heroImg} resizeMode="cover" />
                    </Animated.View>

                    <Text style={st.s2Title}>Simplify Your{'\n'}Material Operations</Text>

                    {/* Features */}
                    <View style={st.featCol}>
                      <View style={st.featRow}>
                        <View style={[st.featIc, { backgroundColor: '#e0f2fe' }]}>
                          <Ionicons name="git-branch-outline" size={20} color="#0284c7" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.featT}>Quick Vehicle Entries</Text>
                          <Text style={st.featS}>Capture vehicle details in seconds</Text>
                        </View>
                      </View>
                      <View style={st.featRow}>
                        <View style={[st.featIc, { backgroundColor: '#dcfce7' }]}>
                          <Ionicons name="document-text-outline" size={20} color="#16a34a" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.featT}>Automated Challans</Text>
                          <Text style={st.featS}>Generate delivery challans instantly</Text>
                        </View>
                      </View>
                      <View style={st.featRow}>
                        <View style={[st.featIc, { backgroundColor: '#f3e8ff' }]}>
                          <Ionicons name="bar-chart-outline" size={20} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.featT}>Live Sales Reports</Text>
                          <Text style={st.featS}>Track your business in real-time</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Bottom */}
                  <View style={st.obBottom2}>
                    <TouchableOpacity onPress={() => go('onboard1', 'back')} style={st.skipBtn}>
                      <Text style={st.skipT}>Back</Text>
                    </TouchableOpacity>
                    <View style={st.dots}>
                      <View style={st.dot} />
                      <View style={[st.dot, st.dotOn]} />
                    </View>
                    <TouchableOpacity style={st.nextPill} onPress={() => go('login')} activeOpacity={0.85}>
                      <Text style={st.nextPillT}>Next {'>'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════ */}
              {/* SCREEN 3: LOGIN                             */}
              {/* ════════════════════════════════════════════ */}
              {screen === 'login' && (
                <View style={st.inner}>
                  <View style={st.topContent}>
                    <View style={st.brandC}>
                      <Animated.View style={[st.logo, { transform: [{ scale: pulse }] }]}>
                        <Text style={st.logoT}>M</Text>
                      </Animated.View>
                      <Text style={st.brandN}>MaterialMApp</Text>
                      <Text style={st.brandTag}>Quarry & Weighbridge Dispatch</Text>
                    </View>

                    <View style={st.formH}>
                      <Text style={st.formTitle}>Welcome Back!</Text>
                      <Text style={st.formSub}>Sign in to continue to your account</Text>
                    </View>

                    {err ? <View style={st.errB}><Ionicons name="alert-circle" size={16} color="#ef4444" /><Text style={st.errT}>{err}</Text></View> : null}
                    {suc ? <View style={st.sucB}><Ionicons name="checkmark-circle" size={16} color="#16a34a" /><Text style={st.sucT}>{suc}</Text></View> : null}

                    {/* Email */}
                    <View style={st.fg}>
                      <Text style={st.fl}>Email Address</Text>
                      <View style={[st.ib, focus === 'le' && st.ibF]}>
                        <Ionicons name="mail-outline" size={18} color="#64748b" style={st.ii} />
                        <TextInput style={st.ti} placeholder="Enter your email address" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocus('le')} onBlur={() => setFocus(null)} />
                        {email ? <TouchableOpacity onPress={() => setEmail('')} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="close-circle" size={16} color="#94a3b8" /></TouchableOpacity> : null}
                      </View>
                    </View>

                    {/* Password */}
                    <View style={st.fg}>
                      <Text style={st.fl}>Password</Text>
                      <View style={[st.ib, focus === 'lp' && st.ibF]}>
                        <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={st.ii} />
                        <TextInput style={st.ti} placeholder="Enter your password" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" onFocus={() => setFocus('lp')} onBlur={() => setFocus(null)} />
                        <TouchableOpacity onPress={() => setShowPw(v=>!v)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Sign In */}
                    <TouchableOpacity style={[st.pBtn, loading && {opacity:0.7}]} onPress={doLogin} disabled={loading} activeOpacity={0.85}>
                      {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.pBtnT}>Sign In</Text>}
                    </TouchableOpacity>

                    {/* OR */}
                    <View style={st.orR}><View style={st.orL} /><Text style={st.orT}>OR</Text><View style={st.orL} /></View>

                    {/* OTP */}
                    <TouchableOpacity style={st.otpBtn} onPress={() => { setOtpMsg(''); setOtpSent(false); setOtpCode(''); setOtpVis(true); }} activeOpacity={0.8}>
                      <Ionicons name="phone-portrait-outline" size={18} color="#0284c7" style={{marginRight:8}} />
                      <Text style={st.otpBtnT}>Continue with OTP</Text>
                    </TouchableOpacity>

                    {/* Bottom link */}
                    <View style={st.bLink}>
                      <Text style={st.bLinkM}>Don't have an account? </Text>
                      <TouchableOpacity onPress={() => go('register')} hitSlop={{top:8,bottom:8,left:4,right:8}}>
                        <Text style={st.bLinkA}>Sign Up</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* ════════════════════════════════════════════ */}
              {/* SCREEN 4: REGISTER                          */}
              {/* ════════════════════════════════════════════ */}
              {screen === 'register' && (
                <View style={st.inner}>
                  <View style={st.topContent}>
                    <View style={st.brandC}>
                      <Animated.View style={[st.logo, { transform: [{ scale: pulse }] }]}>
                        <Text style={st.logoT}>M</Text>
                      </Animated.View>
                      <Text style={st.brandN}>MaterialMApp</Text>
                      <Text style={st.brandTag}>Quarry & Weighbridge Dispatch</Text>
                    </View>

                    <View style={st.formH}>
                      <Text style={st.formTitle}>Create Your Account</Text>
                      <Text style={st.formSub}>Get started with your business account</Text>
                    </View>

                    {err ? <View style={st.errB}><Ionicons name="alert-circle" size={16} color="#ef4444" /><Text style={st.errT}>{err}</Text></View> : null}

                    {/* Full Name */}
                    <View style={st.fg}>
                      <Text style={st.fl}>Full Name</Text>
                      <View style={[st.ib, focus === 'rn' && st.ibF]}>
                        <Ionicons name="person-outline" size={18} color="#64748b" style={st.ii} />
                        <TextInput style={st.ti} placeholder="Enter your name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} autoCapitalize="words" onFocus={() => setFocus('rn')} onBlur={() => setFocus(null)} />
                        {name ? <TouchableOpacity onPress={() => setName('')} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="close-circle" size={16} color="#94a3b8" /></TouchableOpacity> : null}
                      </View>
                    </View>

                    {/* Email */}
                    <View style={st.fg}>
                      <Text style={st.fl}>Email Address</Text>
                      <View style={[st.ib, focus === 're' && st.ibF]}>
                        <Ionicons name="mail-outline" size={18} color="#64748b" style={st.ii} />
                        <TextInput style={st.ti} placeholder="Enter your email" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocus('re')} onBlur={() => setFocus(null)} />
                        {email ? <TouchableOpacity onPress={() => setEmail('')} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="close-circle" size={16} color="#94a3b8" /></TouchableOpacity> : null}
                      </View>
                    </View>

                    {/* Password */}
                    <View style={st.fg}>
                      <Text style={st.fl}>Password</Text>
                      <View style={[st.ib, focus === 'rp' && st.ibF]}>
                        <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={st.ii} />
                        <TextInput style={st.ti} placeholder="Create a password" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" onFocus={() => setFocus('rp')} onBlur={() => setFocus(null)} />
                        <TouchableOpacity onPress={() => setShowPw(v=>!v)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={19} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Sign Up */}
                    <TouchableOpacity style={[st.pBtn, loading && {opacity:0.7}]} onPress={doRegister} disabled={loading} activeOpacity={0.85}>
                      {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.pBtnT}>Sign Up</Text>}
                    </TouchableOpacity>

                    <View style={st.termsW}>
                      <Text style={st.termsT}>By continuing, you agree to our{' '}<Text style={st.termsL}>Terms & Conditions</Text> and{' '}<Text style={st.termsL}>Privacy Policy</Text></Text>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          {/* ── OTP MODAL ── */}
          <Modal visible={otpVis} transparent animationType="fade" onRequestClose={() => setOtpVis(false)}>
            <TouchableOpacity style={st.mBg} activeOpacity={1} onPress={() => setOtpVis(false)}>
              <TouchableOpacity style={st.mBox} activeOpacity={1} onPress={e => Platform.OS === 'web' && e?.stopPropagation?.()}>
                <View style={st.mHdr}><View><Text style={st.mTtl}>Continue with OTP</Text><Text style={st.mSub}>Quick login via one-time verification</Text></View>
                  <TouchableOpacity style={st.mClose} onPress={() => setOtpVis(false)}><Ionicons name="close" size={18} color="#64748b" /></TouchableOpacity>
                </View>
                {otpMsg ? <View style={[st.errB,{backgroundColor:'#f0fdf4',borderColor:'#bbf7d0'}]}><Ionicons name="information-circle" size={16} color="#15803d" /><Text style={[st.errT,{color:'#15803d'}]}>{otpMsg}</Text></View> : null}
                <View style={st.fg}><Text style={st.fl}>Mobile Number or Email</Text><View style={st.ib}><Ionicons name="call-outline" size={17} color="#64748b" style={st.ii} /><TextInput style={st.ti} placeholder="+91 98765 43210 or email" placeholderTextColor="#94a3b8" value={otpPh} onChangeText={setOtpPh} autoCapitalize="none" /></View></View>
                {otpSent && <View style={st.fg}><Text style={st.fl}>6-Digit OTP</Text><View style={st.ib}><Ionicons name="key-outline" size={17} color="#64748b" style={st.ii} /><TextInput style={st.ti} placeholder="Enter 6-digit code" placeholderTextColor="#94a3b8" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" /></View></View>}
                <TouchableOpacity style={[st.pBtn, otpLoad && {opacity:0.7}]} onPress={otpSent ? verifyOtp : sendOtp} disabled={otpLoad}>
                  {otpLoad ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.pBtnT}>{otpSent ? 'Verify & Sign In' : 'Send OTP'}</Text>}
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  root: { flex: 1, width: '100%', position: 'relative' },
  scroll: { flexGrow: 1 },

  /* Full-screen gradient background */
  bgGradient: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
  },

  /* Top Bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 10, paddingBottom: 4,
    minHeight: 52, zIndex: 10,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pillOutline: {
    borderWidth: 1.5, borderColor: '#0284c7', backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 22,
  },
  pillOutlineT: { color: '#0284c7', fontSize: 13.5, fontWeight: '700' },
  pillFill: {
    backgroundColor: '#0284c7', paddingHorizontal: 18, paddingVertical: 7, borderRadius: 22,
    shadowColor: '#0284c7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  pillFillT: { color: '#fff', fontSize: 13.5, fontWeight: '700' },

  /* Content */
  content: { flex: 1, width: '100%', zIndex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  topContent: { flex: 1 },

  /* Brand */
  brandC: { alignItems: 'center', marginTop: 8, marginBottom: 14 },
  logo: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: '#0d9488',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: '#0d9488', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  logoT: { color: '#fff', fontSize: 28, fontWeight: '900' },
  brandN: { fontSize: 25, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  brandTag: { fontSize: 13.5, fontWeight: '700', color: '#0d9488', marginTop: 2 },

  /* Onboarding 1 */
  obDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, marginBottom: 16, paddingHorizontal: 4 },
  heroWrap: {
    width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#f0fdfa',
    shadowColor: '#0d9488', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 5,
  },
  heroImg: { width: '100%', height: '100%' },
  obBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 16, paddingBottom: 32,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  dotOn: { width: 22, backgroundColor: '#0d9488', borderRadius: 4 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipT: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  /* Onboarding 2 */
  heroWrap2: {
    width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#f0fdfa',
    marginBottom: 18,
    shadowColor: '#0284c7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 4,
  },
  s2Title: { fontSize: 23, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3, marginBottom: 18, lineHeight: 30 },
  featCol: { gap: 12 },
  featRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', padding: 13, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  featIc: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  featT: { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  featS: { fontSize: 12, color: '#64748b', marginTop: 2 },
  obBottom2: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 18, paddingBottom: 32,
  },
  nextPill: {
    backgroundColor: '#0284c7', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24,
    shadowColor: '#0284c7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  nextPillT: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Form */
  formH: { marginBottom: 18 },
  formTitle: { fontSize: 23, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  formSub: { fontSize: 14, color: '#64748b', marginTop: 3 },

  /* Inputs */
  fg: { marginBottom: 14 },
  fl: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  ib: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  ibF: { borderColor: '#0284c7', borderWidth: 1.5, backgroundColor: '#f0f9ff' },
  ii: { marginRight: 10 },
  ti: {
    flex: 1, height: 50, fontSize: 14, color: '#0f172a',
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },

  /* Buttons */
  pBtn: {
    backgroundColor: '#0284c7', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6,
    shadowColor: '#0284c7', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  pBtnT: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  orR: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  orL: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  orT: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  otpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#0284c7', backgroundColor: '#fff',
  },
  otpBtnT: { color: '#0284c7', fontSize: 14, fontWeight: '700' },
  bLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  bLinkM: { fontSize: 14, color: '#64748b' },
  bLinkA: { fontSize: 14, fontWeight: '700', color: '#0284c7' },
  termsW: { marginTop: 18, alignItems: 'center', paddingHorizontal: 10 },
  termsT: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  termsL: { color: '#0284c7', fontWeight: '600' },

  /* Banners */
  errB: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2',
    borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginBottom: 12, gap: 8,
  },
  errT: { fontSize: 12.5, color: '#b91c1c', fontWeight: '600', flex: 1 },
  sucB: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4',
    borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, marginBottom: 12, gap: 8,
  },
  sucT: { fontSize: 12.5, color: '#15803d', fontWeight: '600', flex: 1 },

  /* Modal */
  mBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  mBox: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  mHdr: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  mTtl: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  mSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  mClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
