import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const AboutView = React.memo(() => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [activeStep, setActiveStep] = useState(0);

  // The 4 Daily Operational Challenges
  const challenges = [
    {
      id: 'paper',
      icon: 'document-text-outline',
      title: 'Lost Paper Registers',
      text: 'Handwritten books get damaged, misplaced, or lost. Searching past vehicle records takes hours.',
    },
    {
      id: 'challan',
      icon: 'alert-circle-outline',
      title: 'Duplicate Challan Numbers',
      text: 'Manual slips cause duplicate numbers, missing serials, and billing disputes with parties.',
    },
    {
      id: 'calc',
      icon: 'calculator-outline',
      title: 'Calculation Mistakes',
      text: 'Manually calculating Gross – Tare = Net, royalty, and GST leads to expensive billing errors.',
    },
    {
      id: 'visibility',
      icon: 'eye-off-outline',
      title: 'No Live Sales Tracking',
      text: 'Owners wait until evening or end-of-month registers are compiled to know actual sales and collections.',
    },
  ];

  // How MaterialMApp Solves It
  const solutions = [
    {
      id: 'dispatch',
      icon: 'phone-portrait-outline',
      iconColor: '#0d9488',
      iconBg: '#f0fdfa',
      title: '10-Second Digital Dispatch',
      text: 'Operators record deliveries rapidly from weighbridge phones or office computers without paper registers.',
    },
    {
      id: 'challan',
      icon: 'receipt-outline',
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      title: 'Continuous Serial Challans',
      text: 'Guaranteed sequential challan numbers automatically assigned with zero gaps and zero duplicates.',
    },
    {
      id: 'math',
      icon: 'flash-outline',
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      title: 'Instant Weighbridge Math',
      text: 'Enter Gross & Tare weights — Net weight, royalty, and GST calculate instantly with 100% precision.',
    },
    {
      id: 'reports',
      icon: 'bar-chart-outline',
      iconColor: '#7c3aed',
      iconBg: '#faf5ff',
      title: 'Live Owner Dashboard',
      text: 'Check daily sales turnover, vehicle trip counts, buyer balances, and tax liabilities from anywhere.',
    },
    {
      id: 'excel',
      icon: 'cloud-upload-outline',
      iconColor: '#16a34a',
      iconBg: '#f0fdf4',
      title: '1-Click Excel Ingestion',
      text: 'Upload thousands of old delivery records from Excel sheets with automatic validation in seconds.',
    },
    {
      id: 'masters',
      icon: 'layers-outline',
      iconColor: '#e11d48',
      iconBg: '#fff1f2',
      title: 'Centralized Master Records',
      text: 'Maintain all vehicles, parties, materials, and sale types in one place for complete data accuracy.',
    },
  ];

  // 4 Easy Workflow Steps
  const steps = [
    {
      num: '1',
      title: 'Pick Vehicle & Party',
      icon: 'car-outline',
      desc: 'Select existing vehicle and buyer from your saved master list in one tap.',
    },
    {
      num: '2',
      title: 'Enter Weights',
      icon: 'scale-outline',
      desc: 'Type Gross and Tare weights directly from the weighbridge scale.',
    },
    {
      num: '3',
      title: 'Auto-Generate Challan',
      icon: 'receipt-outline',
      desc: 'System automatically calculates Net weight, royalty, and GST, then generates the challan.',
    },
    {
      num: '4',
      title: 'Instant Owner Visibility',
      icon: 'trending-up-outline',
      desc: 'The delivery syncs immediately so management can see sales and tax totals in real time.',
    },
  ];

  // Business Impact Points
  const impactPoints = [
    {
      icon: 'time-outline',
      title: 'Save 2+ Hours Daily',
      text: 'Eliminate repeated manual handwriting, paper searches, and spreadsheet double entry.',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Zero Billing Errors',
      text: 'Consistent calculation rules ensure 100% accurate net weights, rates, and GST amounts.',
    },
    {
      icon: 'people-outline',
      title: 'Better Team Coordination',
      text: 'Connect weighbridge operators, dispatch staff, and accounting in one smooth workflow.',
    },
    {
      icon: 'trending-up-outline',
      title: 'Complete Sales Control',
      text: 'Always know who bought what, which trucks moved, and exact tax dues in real time.',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, isMobile && { padding: 12 }]}
      contentContainerStyle={{ paddingBottom: 80 }}
      showsVerticalScrollIndicator={true}
    >
      {/* 1. HERO SALES BANNER */}
      <View className="mma-animate-fadeup" style={[styles.heroCard, isMobile && { padding: 18 }]}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroPillBadge}>
            <Ionicons name="sparkles" size={12} color="#0d9488" style={{ marginRight: 5 }} />
            <Text style={styles.heroPillText}>Quarry & Crushing Plant Software</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          Smarter Material Dispatch.{'\n'}Less Manual Work.
        </Text>

        <Text style={styles.heroSubtitle}>
          MaterialMApp replaces slow paper registers with fast digital challans, automated weighbridge
          calculations, and real-time sales tracking for quarry and plant owners.
        </Text>

        {/* 3 Quick Value Highlights */}
        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <View style={styles.valueIconBox}>
              <Ionicons name="flash" size={16} color="#0d9488" />
            </View>
            <View>
              <Text style={styles.valueItemTitle}>10-Second Entries</Text>
              <Text style={styles.valueItemSub}>Fast mobile & PC dispatch</Text>
            </View>
          </View>

          <View style={styles.valueDivider} />

          <View style={styles.valueItem}>
            <View style={styles.valueIconBox}>
              <Ionicons name="checkmark-done" size={16} color="#0284c7" />
            </View>
            <View>
              <Text style={styles.valueItemTitle}>100% Exact Math</Text>
              <Text style={styles.valueItemSub}>Auto Net Wt, Royalty & GST</Text>
            </View>
          </View>

          <View style={styles.valueDivider} />

          <View style={styles.valueItem}>
            <View style={styles.valueIconBox}>
              <Ionicons name="phone-portrait" size={16} color="#7c3aed" />
            </View>
            <View>
              <Text style={styles.valueItemTitle}>Live Mobile Tracking</Text>
              <Text style={styles.valueItemSub}>Check sales from anywhere</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. THE COMMON PROBLEMS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>The Challenges of Traditional Operations</Text>
        <Text style={styles.sectionSubtitle}>
          Common everyday headaches across manual registers and spreadsheet dispatches
        </Text>
      </View>

      <View style={styles.grid}>
        {challenges.map((c, idx) => (
          <View
            key={c.id}
            className={`mma-card-hover mma-animate-fadeup mma-delay-${idx + 1}`}
            style={[styles.challengeCard, isMobile && styles.fullWidthCard]}
          >
            <View style={styles.challengeIconBox}>
              <Ionicons name={c.icon} size={20} color="#dc2626" />
            </View>
            <Text style={styles.cardHeading}>{c.title}</Text>
            <Text style={styles.cardBody}>{c.text}</Text>
          </View>
        ))}
      </View>

      {/* 3. HOW MATERIALMAPP SOLVES IT */}
      <View style={[styles.sectionHeader, { marginTop: 32 }]}>
        <Text style={styles.sectionTitle}>One Platform. Complete Dispatch Control.</Text>
        <Text style={styles.sectionSubtitle}>
          Built specifically to make weighbridge and material sales fast, simple, and accurate
        </Text>
      </View>

      <View style={styles.grid}>
        {solutions.map((s, idx) => (
          <View
            key={s.id}
            className={`mma-card-hover mma-animate-fadeup mma-delay-${(idx % 4) + 1}`}
            style={[styles.solutionCard, isMobile && styles.fullWidthCard]}
          >
            <View style={[styles.solutionIconBox, { backgroundColor: s.iconBg }]}>
              <Ionicons name={s.icon} size={20} color={s.iconColor} />
            </View>
            <Text style={styles.cardHeading}>{s.title}</Text>
            <Text style={styles.cardBody}>{s.text}</Text>
          </View>
        ))}
      </View>

      {/* 4. EASY 4-STEP WORKFLOW */}
      <View style={[styles.sectionHeader, { marginTop: 32 }]}>
        <Text style={styles.sectionTitle}>How It Works in 4 Easy Steps</Text>
        <Text style={styles.sectionSubtitle}>
          From truck arrival at the weighbridge to live dashboard reporting
        </Text>
      </View>

      <View style={[styles.workflowCard, isMobile && { padding: 16 }]}>
        <View style={styles.stepsRow}>
          {steps.map((st, idx) => {
            const isSelected = activeStep === idx;
            return (
              <TouchableOpacity
                key={st.num}
                activeOpacity={0.8}
                onPress={() => setActiveStep(idx)}
                className="mma-card-hover"
                style={[
                  styles.stepBox,
                  isMobile && styles.stepBoxMobile,
                  isSelected && styles.stepBoxActive,
                ]}
              >
                <View style={styles.stepHeader}>
                  <View
                    style={[
                      styles.stepBadge,
                      isSelected ? styles.stepBadgeActive : styles.stepBadgeDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepBadgeText,
                        isSelected ? { color: '#ffffff' } : { color: '#0d9488' },
                      ]}
                    >
                      Step {st.num}
                    </Text>
                  </View>
                  <Ionicons
                    name={st.icon}
                    size={18}
                    color={isSelected ? '#0d9488' : '#64748b'}
                  />
                </View>
                <Text style={styles.stepTitle}>{st.title}</Text>
                <Text style={styles.stepDesc}>{st.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 5. BUSINESS IMPACT */}
      <View style={[styles.sectionHeader, { marginTop: 32 }]}>
        <Text style={styles.sectionTitle}>Less Repetitive Work. Faster Operations.</Text>
        <Text style={styles.sectionSubtitle}>
          Real business benefits for quarry owners, plant managers, and weighbridge teams
        </Text>
      </View>

      <View style={styles.grid}>
        {impactPoints.map((item, idx) => (
          <View
            key={item.title}
            className={`mma-card-hover mma-animate-fadeup mma-delay-${idx + 1}`}
            style={[styles.impactCard, isMobile && styles.fullWidthCard]}
          >
            <View style={styles.impactIconBox}>
              <Ionicons name={item.icon} size={20} color="#0d9488" />
            </View>
            <Text style={styles.cardHeading}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* 6. CALL TO ACTION SALES BANNER */}
      <View className="mma-animate-fadeup" style={[styles.ctaCard, isMobile && { padding: 20 }]}>
        <Text style={styles.ctaTitle}>Ready to Digitize Your Quarry Dispatch?</Text>
        <Text style={styles.ctaDesc}>
          Join modern quarries and crushing plants using MaterialMApp for faster dispatch, accurate
          billing, and complete peace of mind.
        </Text>
        <View style={styles.ctaPillsRow}>
          <View style={styles.ctaPill}>
            <Ionicons name="checkmark-circle" size={14} color="#14b8a6" style={{ marginRight: 4 }} />
            <Text style={styles.ctaPillText}>Fast Setup</Text>
          </View>
          <View style={styles.ctaPill}>
            <Ionicons name="checkmark-circle" size={14} color="#14b8a6" style={{ marginRight: 4 }} />
            <Text style={styles.ctaPillText}>Mobile & PC Friendly</Text>
          </View>
          <View style={styles.ctaPill}>
            <Ionicons name="checkmark-circle" size={14} color="#14b8a6" style={{ marginRight: 4 }} />
            <Text style={styles.ctaPillText}>Secure Cloud Sync</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>MaterialMApp Logistics Platform</Text>
        <Text style={styles.footerText}>
          Designed for Quarry Owners, Plant Managers, Weighbridge Operators & Accounting.
        </Text>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  /* Hero Card */
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 28,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  heroPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f766e',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 20,
    maxWidth: 720,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  valueIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  valueItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  valueItemSub: {
    fontSize: 11.5,
    color: '#64748b',
  },
  valueDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  /* Section Header */
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  /* Grids */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fullWidthCard: {
    width: '100%',
  },
  /* Challenge Card */
  challengeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fee2e2',
    padding: 16,
    width: '48.8%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  challengeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  /* Solution Card */
  solutionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    width: '32.1%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  solutionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
  },
  /* Workflow */
  workflowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  stepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stepBox: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  stepBoxMobile: {
    minWidth: '100%',
  },
  stepBoxActive: {
    backgroundColor: '#f0fdfa',
    borderColor: '#5eead4',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stepBadgeDefault: {
    backgroundColor: '#e6fffa',
  },
  stepBadgeActive: {
    backgroundColor: '#0d9488',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
  },
  /* Impact Card */
  impactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    width: '48.8%',
  },
  impactIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  /* CTA Card */
  ctaCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 26,
    marginTop: 28,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  ctaDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: '#cbd5e1',
    textAlign: 'center',
    maxWidth: 580,
    marginBottom: 16,
  },
  ctaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ctaPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  /* Footer */
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  footerText: {
    fontSize: 11.5,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
