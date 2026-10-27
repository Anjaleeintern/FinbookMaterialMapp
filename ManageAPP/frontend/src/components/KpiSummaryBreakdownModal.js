import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

const formatINR = (val) => {
  return Math.round(val || 0).toLocaleString('en-IN');
};

const getSaleModeBucket = (entry) => {
  if (!entry) return 'credit';
  const pm = String(entry.payment_mode || '').trim().toLowerCase();
  const tm = String(entry.sales_mode || entry.type_mode || entry.saved_in || '').trim().toLowerCase();

  if (pm === 'bank' || pm.includes('bank') || tm.includes('bank')) return 'bank';
  if (pm === 'qr' || pm.includes('qr') || pm.includes('upi') || tm.includes('qr') || tm.includes('upi')) return 'qr';
  if (pm === 'cash' || tm.includes('cash') || tm.includes('case')) return 'cash';
  if (tm.includes('credit') || entry.saved_in === 'credit_sale') return 'credit';
  if (entry.saved_in === 'cash_sale') return 'cash';
  return 'credit';
};

const getRoyaltyBucket = (entry) => {
  if (!entry) return 'without_royalty';
  const st = String(entry.sale_type || '').trim().toLowerCase();
  const tm = String(entry.type_mode || '').trim().toLowerCase();
  const savedIn = String(entry.saved_in || '').trim().toLowerCase();

  if (st.includes('without')) return 'without_royalty';
  if (st.includes('royalty')) return 'royalty';
  if (savedIn === 'without_royalty') return 'without_royalty';
  if (savedIn === 'royalty_sale') return 'royalty';
  if (tm.includes('without')) return 'without_royalty';
  if (tm.includes('royalty') || tm.includes('with royalty')) return 'royalty';

  const gst = Number(entry.gst_amount) || Number(entry.gst_rate) || 0;
  if (gst > 0) return 'royalty';
  return 'without_royalty';
};

const MODE_DEFS = [
  { key: 'cash', label: 'Cash Sale', subLabel: 'Cash counter sales', color: '#e11d48', icon: 'cash-outline', bg: '#ffe4e6' },
  { key: 'bank', label: 'Bank Sale', subLabel: 'Bank accounts / RTGS', color: '#2563eb', icon: 'business-outline', bg: '#dbeafe' },
  { key: 'qr', label: 'QR / UPI Sale', subLabel: 'Instant UPI / QR payments', color: '#ea580c', icon: 'qr-code-outline', bg: '#ffedd5' },
  { key: 'credit', label: 'Credit Sale', subLabel: 'Customer ledger accounts', color: '#0d9488', icon: 'card-outline', bg: '#ccfbf1' },
];

const ROYALTY_DEFS = [
  { key: 'royalty', label: 'Royalty Sale (GST)', subLabel: 'Tax invoice bills with GST', color: '#d97706', icon: 'shield-checkmark-outline', bg: '#fef3c7' },
  { key: 'without_royalty', label: 'Without Royalty', subLabel: 'Challan / Commercial dispatch', color: '#1e3a8a', icon: 'document-text-outline', bg: '#e0e7ff' },
];

const METRIC_CONFIG = {
  sales: {
    id: 'sales',
    title: 'Total Sales Breakdown',
    shortLabel: 'TOTAL SALES AMOUNT',
    badgeLabel: 'TOTAL SALES',
    subtitle: 'Sale amount distribution across modes & types',
    unit: '₹',
    icon: 'layers',
    color: '#0284c7',
    bg: '#e0f2fe',
    colTitle: 'SALES AMOUNT (₹)',
  },
  trips: {
    id: 'trips',
    title: 'Challans & Trips Counting',
    shortLabel: 'TOTAL CHALLANS / TRIPS COUNT',
    badgeLabel: 'CHALLANS COUNT',
    subtitle: 'Challan count distribution across modes & types',
    unit: 'Challans',
    icon: 'receipt',
    color: '#10b981',
    bg: '#dcfce7',
    colTitle: 'CHALLAN COUNT',
  },
  taxable: {
    id: 'taxable',
    title: 'Taxable Amount Breakdown',
    shortLabel: 'TOTAL TAXABLE BASE AMOUNT',
    badgeLabel: 'TAXABLE BASE',
    subtitle: 'Net taxable amount across modes & types',
    unit: '₹',
    icon: 'calculator',
    color: '#7c3aed',
    bg: '#ede9fe',
    colTitle: 'TAXABLE AMOUNT (₹)',
  },
  gst: {
    id: 'gst',
    title: 'GST Collected Breakdown',
    shortLabel: 'TOTAL GST COLLECTED',
    badgeLabel: 'GST COLLECTED',
    subtitle: 'GST tax collected across modes & types',
    unit: '₹',
    icon: 'pricetag',
    color: '#ea580c',
    bg: '#ffedd5',
    colTitle: 'GST COLLECTED (₹)',
  },
};

export const KpiSummaryBreakdownModal = ({
  visible,
  activeMetric,
  initialMetric,
  onClose,
  entries = [],
  allEntries = [],
  dateRangeStr = '',
  onNavigateEntries,
}) => {
  const metricKey = activeMetric || initialMetric || 'sales';
  const { width } = useWindowDimensions();
  const screenW = isWeb && typeof window !== 'undefined' ? window.innerWidth : width;
  const isMobile = screenW < 768;

  const insets = useSafeAreaInsets();
  const topSafe = isWeb
    ? 0
    : Math.max(insets?.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 24);
  const bottomSafe = isWeb
    ? 0
    : Math.max(insets?.bottom || 0, 10);

  // 3 Clear Tabs: 'mode' (By Payment Mode) | 'royalty' (By Royalty Type) | 'combined' (Combined Matrix)
  const [dimension, setDimension] = useState('mode');

  const { totals, modeRows, royaltyRows, combinedRows } = useMemo(() => {
    let totalGross = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    const totalTrips = entries.length;

    const modeMap = {
      cash: { count: 0, gross: 0, taxable: 0, gst: 0 },
      bank: { count: 0, gross: 0, taxable: 0, gst: 0 },
      qr: { count: 0, gross: 0, taxable: 0, gst: 0 },
      credit: { count: 0, gross: 0, taxable: 0, gst: 0 },
    };

    const royaltyMap = {
      royalty: { count: 0, gross: 0, taxable: 0, gst: 0 },
      without_royalty: { count: 0, gross: 0, taxable: 0, gst: 0 },
    };

    const combinedMap = {};
    MODE_DEFS.forEach((m) => {
      ROYALTY_DEFS.forEach((r) => {
        combinedMap[`${m.key}__${r.key}`] = {
          modeKey: m.key,
          modeLabel: m.label,
          modeColor: m.color,
          royaltyKey: r.key,
          royaltyLabel: r.label,
          royaltyColor: r.color,
          count: 0,
          gross: 0,
          taxable: 0,
          gst: 0,
        };
      });
    });

    entries.forEach((e) => {
      const gross = Number(e.total_amount) || Number(e.amount) || 0;
      const taxable = Number(e.amount) || 0;
      const gst = Number(e.gst_amount) || 0;

      totalGross += gross;
      totalTaxable += taxable;
      totalGst += gst;

      const mBucket = getSaleModeBucket(e);
      const rBucket = getRoyaltyBucket(e);

      if (modeMap[mBucket]) {
        modeMap[mBucket].count += 1;
        modeMap[mBucket].gross += gross;
        modeMap[mBucket].taxable += taxable;
        modeMap[mBucket].gst += gst;
      }

      if (royaltyMap[rBucket]) {
        royaltyMap[rBucket].count += 1;
        royaltyMap[rBucket].gross += gross;
        royaltyMap[rBucket].taxable += taxable;
        royaltyMap[rBucket].gst += gst;
      }

      const cKey = `${mBucket}__${rBucket}`;
      if (combinedMap[cKey]) {
        combinedMap[cKey].count += 1;
        combinedMap[cKey].gross += gross;
        combinedMap[cKey].taxable += taxable;
        combinedMap[cKey].gst += gst;
      }
    });

    const computeIndicator = (val, maxVal, totalVal) => {
      const pct = totalVal > 0 ? (val / totalVal) * 100 : 0;
      let badge = '● Medium';
      let badgeBg = '#fefce8';
      let badgeColor = '#ca8a04';
      let badgeBorder = '#fef08a';

      if (val === maxVal && val > 0) {
        badge = '🔥 Highest';
        badgeBg = '#fef2f2';
        badgeColor = '#dc2626';
        badgeBorder = '#fecaca';
      } else if (pct >= 25) {
        badge = '▲ High';
        badgeBg = '#f0fdf4';
        badgeColor = '#16a34a';
        badgeBorder = '#bbf7d0';
      } else if (pct < 10) {
        badge = '▼ Low';
        badgeBg = '#f8fafc';
        badgeColor = '#64748b';
        badgeBorder = '#e2e8f0';
      }

      return {
        pct: Math.round(pct * 10) / 10,
        badge,
        badgeBg,
        badgeColor,
        badgeBorder,
      };
    };

    const getVal = (item) => {
      if (metricKey === 'trips') return Number(item.count) || 0;
      if (metricKey === 'taxable') return Number(item.taxable) || 0;
      if (metricKey === 'gst') return Number(item.gst) || 0;
      return Number(item.gross) || 0;
    };

    const targetTotal =
      metricKey === 'trips'
        ? totalTrips
        : metricKey === 'taxable'
        ? totalTaxable
        : metricKey === 'gst'
        ? totalGst
        : totalGross;

    const rawModeRows = MODE_DEFS.map((m) => {
      const data = modeMap[m.key] || { count: 0, gross: 0, taxable: 0, gst: 0 };
      const val = getVal(data);
      return {
        key: m.key,
        label: m.label,
        subLabel: m.subLabel,
        color: m.color,
        icon: m.icon,
        bg: m.bg,
        val: val,
        count: data.count || 0,
      };
    });
    const maxModeVal = Math.max(0, ...rawModeRows.map((r) => r.val));
    const processedModeRows = rawModeRows.map((r) => ({
      ...r,
      indicator: computeIndicator(r.val, maxModeVal, targetTotal),
    }));

    const rawRoyaltyRows = ROYALTY_DEFS.map((r) => {
      const data = royaltyMap[r.key] || { count: 0, gross: 0, taxable: 0, gst: 0 };
      const val = getVal(data);
      return {
        key: r.key,
        label: r.label,
        subLabel: r.subLabel,
        color: r.color,
        icon: r.icon,
        bg: r.bg,
        val: val,
        count: data.count || 0,
      };
    });
    const maxRoyaltyVal = Math.max(0, ...rawRoyaltyRows.map((r) => r.val));
    const processedRoyaltyRows = rawRoyaltyRows.map((r) => ({
      ...r,
      indicator: computeIndicator(r.val, maxRoyaltyVal, targetTotal),
    }));

    const rawCombinedRows = Object.values(combinedMap).map((r) => {
      const val = getVal(r);
      return {
        ...r,
        key: `${r.modeKey}__${r.royaltyKey}`,
        label: `${r.modeLabel} • ${r.royaltyLabel}`,
        subLabel: `${r.modeLabel} | ${r.royaltyLabel}`,
        color: r.modeColor,
        icon: 'layers-outline',
        val: val,
        count: r.count || 0,
      };
    });
    const maxCombinedVal = Math.max(0, ...rawCombinedRows.map((r) => r.val));
    const processedCombinedRows = rawCombinedRows
      .map((r) => ({
        ...r,
        indicator: computeIndicator(r.val, maxCombinedVal, targetTotal),
      }))
      .sort((a, b) => b.val - a.val);

    return {
      totals: {
        targetTotal,
      },
      modeRows: processedModeRows,
      royaltyRows: processedRoyaltyRows,
      combinedRows: processedCombinedRows,
    };
  }, [entries, metricKey]);

  if (!visible) return null;

  const currentMetricCfg = METRIC_CONFIG[metricKey] || METRIC_CONFIG.sales;

  const formatValText = (num) => {
    if (metricKey === 'trips') {
      const cnt = Math.round(num || 0);
      return `${cnt} ${cnt === 1 ? 'Challan' : 'Challans'}`;
    }
    return `₹ ${formatINR(num)}`;
  };

  const activeRows =
    dimension === 'mode'
      ? modeRows
      : dimension === 'royalty'
      ? royaltyRows
      : combinedRows;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={[styles.fullPageRoot, { paddingTop: topSafe, paddingBottom: bottomSafe }]}>
        {/* 1. TOP NAVIGATION APP HEADER */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <View style={styles.navTitleRow}>
              <Text style={styles.navTitle} numberOfLines={1}>
                {currentMetricCfg.title}
              </Text>
              <View style={[styles.navBadge, { backgroundColor: currentMetricCfg.bg, borderColor: `${currentMetricCfg.color}40` }]}>
                <Text style={[styles.navBadgeText, { color: currentMetricCfg.color }]}>
                  {currentMetricCfg.badgeLabel || 'SUMMARY'}
                </Text>
              </View>
            </View>
            <Text style={styles.navSubtitle} numberOfLines={1}>
              {dateRangeStr || 'Active Period'} • {entries.length} entries
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* 2. COMPACT HERO BANNER (Clean, compact fonts) */}
        <View style={styles.heroStripWrap}>
          <View
            style={[
              styles.heroStripCard,
              { backgroundColor: currentMetricCfg.bg, borderColor: `${currentMetricCfg.color}35` },
            ]}
          >
            <View style={[styles.heroIconSquircle, { backgroundColor: '#ffffff' }]}>
              <Ionicons name={currentMetricCfg.icon} size={16} color={currentMetricCfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroStripLabel, { color: currentMetricCfg.color }]}>
                {currentMetricCfg.shortLabel}
              </Text>
              <Text style={[styles.heroStripValue, { color: currentMetricCfg.color }]}>
                {formatValText(totals.targetTotal)}
              </Text>
            </View>
            <View style={styles.heroStripBadge}>
              <Ionicons name="calendar-outline" size={10} color="#0369a1" />
              <Text style={styles.heroStripBadgeText} numberOfLines={1}>
                {dateRangeStr || 'Active Period'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. THREE CLEAN COMPACT TABS */}
        <View style={styles.segmentTabBar}>
          {[
            { id: 'mode', label: 'By Payment Mode', count: 4, icon: 'wallet-outline' },
            { id: 'royalty', label: 'By Royalty Type', count: 2, icon: 'shield-checkmark-outline' },
            { id: 'combined', label: 'Combined Matrix', count: combinedRows.length, icon: 'grid-outline' },
          ].map((tab) => {
            const isActive = dimension === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => setDimension(tab.id)}
                style={[styles.segmentTabBtn, isActive && styles.segmentTabBtnActive]}
              >
                <Ionicons
                  name={tab.icon}
                  size={11}
                  color={isActive ? '#0284c7' : '#64748b'}
                />
                <Text
                  style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                <View style={[styles.segmentCountPill, isActive && styles.segmentCountPillActive]}>
                  <Text style={[styles.segmentCountText, isActive && styles.segmentCountTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. MAIN SCROLLABLE TABLE CONTAINER (Full-width, zero horizontal scroll, compact font sizes) */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>
          <View style={styles.tableCard}>
            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
              <View style={styles.colCategory}>
                <Text style={styles.tableThText}>TYPE / MODE CATEGORY</Text>
              </View>
              <View style={styles.colValue}>
                <Text style={[styles.tableThText, { color: currentMetricCfg.color, fontWeight: '800' }]}>
                  {currentMetricCfg.colTitle}
                </Text>
              </View>
            </View>

            {/* Table Data Rows (ONLY the clicked card's metric value!) */}
            {activeRows.map((row, idx) => {
              const isZebra = idx % 2 === 1;
              return (
                <TouchableOpacity
                  key={row.key || idx}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (onNavigateEntries) {
                      onNavigateEntries({
                        mode: row.modeKey || row.key,
                        royalty: row.royaltyKey || (row.key === 'royalty' || row.key === 'without_royalty' ? row.key : null),
                      });
                    }
                  }}
                  style={[styles.tableDataRow, isZebra && styles.tableDataRowZebra]}
                >
                  {/* Category Info */}
                  <View style={styles.colCategory}>
                    <View style={[styles.catIconSquircle, { backgroundColor: row.bg || `${row.color}15` }]}>
                      <Ionicons name={row.icon || 'radio-button-on'} size={12} color={row.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catTitleText} numberOfLines={1}>
                        {row.label}
                      </Text>
                      <Text style={styles.catSubText} numberOfLines={1}>
                        {row.subLabel || 'Active breakdown'}
                      </Text>
                    </View>
                  </View>

                  {/* Exact Value for Clicked KPI ONLY */}
                  <View style={styles.colValue}>
                    <Text style={[styles.primaryValText, { color: currentMetricCfg.color }]}>
                      {formatValText(row.val)}
                    </Text>

                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: row.indicator.badgeBg,
                            borderColor: row.indicator.badgeBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.statusPillText, { color: row.indicator.badgeColor }]}>
                          {row.indicator.badge}
                        </Text>
                      </View>
                      <Text style={styles.shareText}>
                        {row.indicator.pct}% Share{metricKey !== 'trips' ? ` (${row.count || 0} ch)` : ''}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, Math.max(4, row.indicator.pct))}%`,
                            backgroundColor: currentMetricCfg.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Total Summary Row */}
            <View style={styles.tableTotalRow}>
              <View style={styles.colCategory}>
                <View style={[styles.catIconSquircle, { backgroundColor: currentMetricCfg.color }]}>
                  <Ionicons name="checkmark-done" size={13} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.totalTitle}>TOTAL SUMMARY</Text>
                  <Text style={styles.totalSub}>
                    {metricKey === 'trips'
                      ? `${totals.targetTotal} total challans counted`
                      : `${entries.length} entries evaluated`}
                  </Text>
                </View>
              </View>

              <View style={styles.colValue}>
                <Text style={[styles.totalValText, { color: currentMetricCfg.color }]}>
                  {formatValText(totals.targetTotal)}
                </Text>
                <View style={styles.totalBadge}>
                  <Ionicons name="checkmark-circle" size={10} color="#059669" />
                  <Text style={styles.totalBadgeText}>100% Volume</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 5. APP FOOTER */}
        <View style={styles.pageFooter}>
          <View style={styles.footerNoteRow}>
            <Ionicons name="information-circle-outline" size={13} color="#0284c7" />
            <Text style={styles.footerNoteText} numberOfLines={1}>
              Tap any row to filter entries.
            </Text>
          </View>

          <View style={styles.footerBtnRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                if (onNavigateEntries) {
                  onNavigateEntries();
                }
              }}
              style={styles.viewEntriesBtn}
            >
              <Ionicons name="list" size={13} color="#0284c7" />
              <Text style={styles.viewEntriesBtnText}>
                View All ({entries.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullPageRoot: {
    flex: 1,
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  },

  // Navigation Header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  navTitleWrap: {
    flex: 1,
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  navBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  navSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  // Hero Strip
  heroStripWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#f8fafc',
  },
  heroStripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    gap: 8,
  },
  heroIconSquircle: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStripLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroStripValue: {
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 1,
    letterSpacing: -0.3,
  },
  heroStripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  heroStripBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369a1',
  },

  // Segmented Tabs
  segmentTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    gap: 3.5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segmentTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 3,
    borderRadius: 6,
    gap: 3,
    backgroundColor: 'transparent',
  },
  segmentTabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  segmentTabText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentTabTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  segmentCountPill: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 3.5,
    paddingVertical: 0.5,
    borderRadius: 5,
  },
  segmentCountPillActive: {
    backgroundColor: '#e0f2fe',
  },
  segmentCountText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentCountTextActive: {
    color: '#0284c7',
  },

  // Table Card
  scrollContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
  },
  tableThText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  colCategory: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  colValue: {
    flex: 1.1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tableDataRowZebra: {
    backgroundColor: '#fafcff',
  },
  catIconSquircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  catTitleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  catSubText: {
    fontSize: 8.5,
    color: '#64748b',
    marginTop: 0.5,
  },

  primaryValText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    marginTop: 1.5,
  },
  statusPill: {
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    borderRadius: 3.5,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '800',
  },
  shareText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#64748b',
  },
  progressTrack: {
    width: 65,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#e2e8f0',
    marginTop: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  // Total Summary
  tableTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 8.5,
    borderTopWidth: 2,
    borderTopColor: '#cbd5e1',
  },
  totalTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  totalSub: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  totalValText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 1.5,
  },
  totalBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#059669',
  },

  // Footer
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 6,
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  footerNoteText: {
    fontSize: 9.5,
    color: '#64748b',
  },
  footerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  viewEntriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  viewEntriesBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  doneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 6,
    backgroundColor: '#0284c7',
  },
  doneBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
});
