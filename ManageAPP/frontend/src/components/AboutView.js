import React from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const AboutView = React.memo(() => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const features = [
    {
      id: 'dashboard',
      icon: 'pie-chart',
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
      title: 'Real-Time Executive Analytics',
      subtitle: 'Live business intelligence & sales overview',
      description: 'Instant tracking of total sales turnover, trip counts, taxable values, and GST liability. Features interactive stacked mode trends, party rankings, and multi-period date filters (All, Daily, Weekly, Monthly).',
      tag: 'Analytics',
      tagBg: '#f0f9ff',
      tagColor: '#0369a1',
    },
    {
      id: 'challan',
      icon: 'receipt',
      iconBg: '#ecfdf5',
      iconColor: '#059669',
      title: 'Sequential Digital Challan System',
      subtitle: 'Automated gap-free delivery numbering',
      description: 'Guarantees unique, sequentially continuous challan numbering across all dispatch records. Manual phone entries seamlessly continue the sequence established by imported Excel registers with zero duplication.',
      tag: 'Dispatch',
      tagBg: '#ecfdf5',
      tagColor: '#047857',
    },
    {
      id: 'tax',
      icon: 'calculator',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      title: 'Automated Tax & Royalty Engine',
      subtitle: 'Instant weighbridge & tax calculations',
      description: 'Automatic Net Weight computation (Gross Wt – Tare Wt), volumetric pricing (CUM × Rate), dynamic royalty bill processing, and conditional GST tax rate calculation with 100% mathematical precision.',
      tag: 'Compliance',
      tagBg: '#fffbeb',
      tagColor: '#b45309',
    },
    {
      id: 'import',
      icon: 'cloud-upload',
      iconBg: '#f3e8ff',
      iconColor: '#7c3aed',
      title: 'Dual-Channel Entry & Excel Import',
      subtitle: 'High-speed mobile entry & bulk spreadsheet ingestion',
      description: 'Empowers weighbridge operators to rapidly log single vehicle deliveries from phones while administrative staff can bulk-import thousands of entries from multi-sheet Excel files with instant validation.',
      tag: 'Data Pipeline',
      tagBg: '#faf5ff',
      tagColor: '#6d28d9',
    },
    {
      id: 'masters',
      icon: 'layers',
      iconBg: '#e0e7ff',
      iconColor: '#4f46e5',
      title: 'Centralized Master Management',
      subtitle: 'Single source of truth for quarry entities',
      description: 'Unified management for Vehicles, Transports, Materials, Parties/Buyers, and Sale Types. Features one-tap Active/Inactive toggles, search filtering, and bulk operations with complete referential integrity.',
      tag: 'Operations',
      tagBg: '#eef2ff',
      tagColor: '#4338ca',
    },
    {
      id: 'security',
      icon: 'shield-checkmark',
      iconBg: '#ffe4e6',
      iconColor: '#e11d48',
      title: 'Enterprise Security & Protected Config',
      subtitle: 'JWT token auth & zero-exposure environment config',
      description: 'Secured with JSON Web Token (JWT) authorization, role-based access control, and environment-isolated credentials (.env). All database connection strings and secret keys are completely protected.',
      tag: 'Security',
      tagBg: '#fff1f2',
      tagColor: '#be123c',
    },
  ];

  return (
    <ScrollView style={[styles.container, isMobile && { padding: 12 }]} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* 1. Hero Identity Card */}
      <View style={[styles.heroCard, isMobile && { padding: 16 }]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroLogoSquircle}>
            <Text style={styles.heroLogoText}>M</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.heroTitle}>MaterialMApp</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>v2.4.0 Production</Text>
              </View>
            </View>
            <Text style={styles.heroTagline}>
              Enterprise Quarry Logistics & Delivery Management Platform
            </Text>
          </View>
        </View>

        <Text style={styles.heroDescription}>
          MaterialMApp is a production-grade dispatch logistics system built for crushing plants, quarries, and bulk material transport operations. It connects mobile weighbridge operators and management through real-time sync, automated royalty/GST tax processing, and executive intelligence.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>6</Text>
            <Text style={styles.heroStatLabel}>Sale Modes</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>100%</Text>
            <Text style={styles.heroStatLabel}>Data Integrity</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>Real-time</Text>
            <Text style={styles.heroStatLabel}>MongoDB Sync</Text>
          </View>
        </View>
      </View>

      {/* 2. Key Features Section Header */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderIcon}>
          <Ionicons name="sparkles" size={16} color="#0284c7" />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Key Production Features</Text>
          <Text style={styles.sectionSubtitle}>End-to-end capabilities engineered for operational speed</Text>
        </View>
      </View>

      {/* 3. Features Cards Grid */}
      <View style={styles.featuresGrid}>
        {features.map((item) => (
          <View key={item.id} style={[styles.featureCard, isMobile && styles.featureCardMobile]}>
            <View style={styles.featureTopRow}>
              <View style={[styles.featureIconSquircle, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={[styles.featureTagBadge, { backgroundColor: item.tagBg }]}>
                <Text style={[styles.featureTagText, { color: item.tagColor }]}>{item.tag}</Text>
              </View>
            </View>

            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
            <Text style={styles.featureDescription}>{item.description}</Text>
          </View>
        ))}
      </View>

      {/* 4. Technical Architecture & Specifications */}
      <View style={[styles.specsCard, isMobile && { padding: 16 }]}>
        <View style={styles.specsHeader}>
          <Ionicons name="hardware-chip-outline" size={20} color="#0284c7" style={{ marginRight: 8 }} />
          <Text style={styles.specsTitle}>System Specifications & Architecture</Text>
        </View>

        <View style={styles.specsTable}>
          <View style={styles.specsRow}>
            <Text style={styles.specsKey}>Application Frontend</Text>
            <Text style={styles.specsVal}>React Native & Expo Web (Cross-Platform Mobile/Web)</Text>
          </View>
          <View style={styles.specsRow}>
            <Text style={styles.specsKey}>Backend API Engine</Text>
            <Text style={styles.specsVal}>FastAPI (Python 3.11+) with Async Motor Driver</Text>
          </View>
          <View style={styles.specsRow}>
            <Text style={styles.specsKey}>Database & Storage</Text>
            <Text style={styles.specsVal}>MongoDB with Multi-Collection Destination Routing</Text>
          </View>
          <View style={styles.specsRow}>
            <Text style={styles.specsKey}>Security & Protocols</Text>
            <Text style={styles.specsVal}>HS256 JWT Authentication, Encrypted Environment Variables (.env)</Text>
          </View>
          <View style={[styles.specsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.specsKey}>Weighbridge Calculations</Text>
            <Text style={styles.specsVal}>Automated Net Wt, CUM Rate, Royalty & Dynamic GST Engine</Text>
          </View>
        </View>
      </View>

      {/* 5. Footer Copyright */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          MaterialMApp Enterprise Logistics Platform • Built for high-volume dispatch operations.
        </Text>
        <Text style={styles.footerSubText}>
          © 2026 MaterialMApp Inc. All rights reserved.
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroLogoSquircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  heroLogoText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  versionBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  heroDescription: {
    fontSize: 13.5,
    lineHeight: 21,
    color: '#334155',
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  /* Features Grid */
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    width: '48.8%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  featureCardMobile: {
    width: '100%',
  },
  featureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  featureIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  featureTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#475569',
  },
  /* Specs Card */
  specsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  specsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  specsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  specsTable: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  specsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  specsKey: {
    width: 140,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  specsVal: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1e293b',
  },
  /* Footer */
  footerRow: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  footerSubText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
