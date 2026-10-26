import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const isWeb = Platform.OS === 'web';

const parseEntryDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const str = String(dateStr).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        let p0 = parseInt(parts[0], 10);
        let p1 = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        let month = p0 - 1;
        let day = p1;
        if (p0 > 12) {
          day = p0;
          month = p1 - 1;
        }
        return new Date(year, month, day);
      }
    }
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2].substring(0, 2), 10);
          return new Date(year, month, day);
        } else if (parts[2].length >= 4) {
          let p0 = parseInt(parts[0], 10);
          let p1 = parseInt(parts[1], 10);
          let year = parseInt(parts[2].substring(0, 4), 10);
          let month = p0 - 1;
          let day = p1;
          if (p0 > 12) {
            day = p0;
            month = p1 - 1;
          }
          return new Date(year, month, day);
        }
      }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  } catch {
    return null;
  }
  return null;
};

const formatINR = (val) => {
  return Math.round(val || 0).toLocaleString('en-IN');
};

export const PartyWiseSalesModal = ({
  visible,
  onClose,
  entries = [],
  initialMonth = null,
  isDirectPage = false,
}) => {
  const { width } = useWindowDimensions();
  const screenW = isWeb && typeof window !== 'undefined' ? window.innerWidth : width;
  const isMobile = screenW < 768;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // 1. Available Months
  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthLabel = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    monthMap.set(currentMonthKey, {
      key: currentMonthKey,
      label: currentMonthLabel,
      year: today.getFullYear(),
      month: today.getMonth(),
    });

    entries.forEach((e) => {
      const d = parseEntryDate(e.date);
      if (d) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            key,
            label: `${monthNames[m]} ${y}`,
            year: y,
            month: m,
          });
        }
      }
    });

    const sorted = Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return [
      ...sorted,
      { key: 'all', label: 'All Months', year: 9999, month: 99 }
    ];
  }, [entries]);

  const defaultMonth = useMemo(() => {
    if (initialMonth && availableMonths.some((m) => m.key === initialMonth)) {
      return initialMonth;
    }
    const today = new Date();
    const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (availableMonths.some((m) => m.key === curKey)) {
      return curKey;
    }
    return availableMonths[0]?.key || 'all';
  }, [initialMonth, availableMonths]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState(false);

  React.useEffect(() => {
    if (initialMonth && availableMonths.some((m) => m.key === initialMonth)) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth, availableMonths]);

  const currentMonthObj = useMemo(() => {
    return availableMonths.find((m) => m.key === selectedMonth) || availableMonths[0];
  }, [availableMonths, selectedMonth]);

  // 2. Party-wise Aggregates for Selected Month
  const { filteredPartyList, monthTotalSales, monthTotalTrips } = useMemo(() => {
    let targetEntries = entries;

    if (selectedMonth !== 'all' && currentMonthObj) {
      targetEntries = entries.filter((e) => {
        const d = parseEntryDate(e.date);
        if (!d) return false;
        return (
          d.getFullYear() === currentMonthObj.year &&
          d.getMonth() === currentMonthObj.month
        );
      });
    }

    const map = {};
    let totalSales = 0;
    let totalTrips = 0;

    targetEntries.forEach((e) => {
      const pName = (e.party_name || e.customer_name || 'Unspecified Party').trim() || 'Unspecified Party';
      const saleAmt = Number(e.total_amount) || Number(e.amount) || 0;

      totalSales += saleAmt;
      totalTrips += 1;

      if (!map[pName]) {
        map[pName] = {
          name: pName,
          total: 0,
          trips: 0,
        };
      }
      map[pName].total += saleAmt;
      map[pName].trips += 1;
    });

    const list = Object.values(map).sort((a, b) => b.total - a.total);
    list.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    let filtered = list;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }

    return {
      filteredPartyList: filtered,
      monthTotalSales: totalSales,
      monthTotalTrips: totalTrips,
    };
  }, [entries, selectedMonth, currentMonthObj, searchQuery]);

  // 3. Download in Excel
  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const label = currentMonthObj?.label || 'All Time';
      const monthParam = selectedMonth === 'all' ? 'all' : selectedMonth;

      try {
        await api.downloadPartyWiseSalesExcel(monthParam, label);
      } catch (err) {
        console.warn('Backend export fallback to CSV:', err);
        downloadClientCSV(filteredPartyList, label, monthTotalSales, monthTotalTrips);
      }
    } catch (finalErr) {
      alert('Could not download Excel: ' + (finalErr.message || ''));
    } finally {
      setDownloading(false);
    }
  };

  const downloadClientCSV = (list, monthLabel, totalAmt, totalTrp) => {
    if (!isWeb || typeof window === 'undefined') return;
    const headers = ['S.No.', 'Party Name', 'Total Sales (INR)', 'Total Deliveries / Trips'];
    const rows = list.map((p) => [
      p.rank,
      `"${p.name.replace(/"/g, '""')}"`,
      p.total.toFixed(2),
      p.trips,
    ]);
    rows.push(['TOTAL', `"${list.length} Parties"`, totalAmt.toFixed(2), totalTrp]);

    const csv =
      `"Party-wise Sales - ${monthLabel}"\n\n` +
      headers.join(',') + '\n' +
      rows.map((r) => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `party_wise_sales_${monthLabel.replace(/\s+/g, '_').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  const content = (
    <View style={[styles.card, isMobile && styles.cardMobile]}>
      {/* 1. CLEAN APP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Party-wise Sales
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {currentMonthObj?.label || 'Selected Month'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerExcelBtn}
          onPress={handleDownloadExcel}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.headerExcelText}>Excel</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onClose}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* 2. MONTH SELECTOR STRIP */}
      <View style={styles.monthStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthScroll}
        >
          {availableMonths.map((m) => {
            const isSelected = selectedMonth === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.monthPill, isSelected && styles.monthPillActive]}
                onPress={() => setSelectedMonth(m.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.monthText, isSelected && styles.monthTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. SEARCH BOX */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search party by name..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 4. SIMPLE PARTY LIST */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
      >
        {filteredPartyList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="file-tray-outline" size={40} color="#cbd5e1" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>No Parties Found</Text>
            <Text style={styles.emptySubtitle}>No delivery entries recorded for this period.</Text>
          </View>
        ) : (
          filteredPartyList.map((p, idx) => (
            <View key={`party-row-${p.name}-${idx}`} style={styles.partyRow}>
              {/* Left: Rank & Name */}
              <View style={styles.partyLeft}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{p.rank}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.partyName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.partyTrips}>
                    {p.trips} {p.trips === 1 ? 'Delivery' : 'Deliveries'}
                  </Text>
                </View>
              </View>

              {/* Right: Total Sales */}
              <View style={styles.partyRight}>
                <Text style={styles.partyAmount}>₹{formatINR(p.total)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 5. BOTTOM TOTAL & DOWNLOAD BAR */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>
            Total ({filteredPartyList.length} Parties)
          </Text>
          <Text style={styles.footerAmount}>₹{formatINR(monthTotalSales)}</Text>
        </View>

        <TouchableOpacity
          style={styles.footerDownloadBtn}
          onPress={handleDownloadExcel}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
          ) : (
            <Ionicons name="download-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.footerDownloadText}>
            {downloading ? 'Exporting...' : 'Download in Excel'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isDirectPage) {
    return <View style={styles.directPageRoot}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {content}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 14 : 0,
  },
  directPageRoot: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: 720,
    height: Platform.OS === 'web' ? '90%' : '100%',
    maxHeight: 820,
    backgroundColor: '#ffffff',
    borderRadius: Platform.OS === 'web' ? 14 : 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
  },
  cardMobile: {
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 1,
  },
  headerExcelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 7,
  },
  headerExcelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Month selector strip
  monthStrip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  monthScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  monthPill: {
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  monthText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  monthTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
    outlineStyle: 'none',
  },

  // Party List
  listScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingVertical: 4,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  partyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  partyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  partyTrips: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  partyRight: {
    alignItems: 'flex-end',
  },
  partyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: -0.2,
  },

  // Empty State
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  footerLeft: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  footerAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#047857',
    marginTop: 1,
  },
  footerDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  footerDownloadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
