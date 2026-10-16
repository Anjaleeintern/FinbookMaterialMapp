import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import SvgNative, {
  Path as PathNative,
  Circle as CircleNative,
  Rect as RectNative,
  G as GNative,
  Line as LineNative,
  Text as SvgTextNative,
} from 'react-native-svg';

const isWeb = Platform.OS === 'web';
const Svg = isWeb ? 'svg' : SvgNative;
const G = isWeb ? 'g' : GNative;
const Path = isWeb ? 'path' : PathNative;
const Circle = isWeb ? 'circle' : CircleNative;
const Rect = isWeb ? 'rect' : RectNative;
const Line = isWeb ? 'line' : LineNative;
const SvgText = isWeb ? 'text' : SvgTextNative;

// Colors for materials & modes (matching reference image palette)
const MODE_COLORS = {
  without_royalty: '#1e3a8a',    // Deep Navy: Without Royalty
  qr: '#ea580c',                 // Vibrant Warm Orange: QR / UPI Sale
  royalty: '#d97706',            // Golden Mustard: Royalty Bills (GST)
  credit: '#0d9488',             // Teal: Credit Sale
  hr_royalty: '#7c3aed',         // Purple / Violet: HR Loading (Royalty Sale)
  cash: '#e11d48',               // Salmon Coral: Cash Sale
  hr_without_royalty: '#94a3b8', // Slate Grey: HR Loading (Without Royalty)
};

const MATERIAL_PALETTE = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

// Distinct modes matching all quarry sales & HR loading types
const STACKED_MODES = [
  { key: 'without_royalty', label: 'Without Royalty', color: '#1e3a8a' },
  { key: 'qr', label: 'QR / UPI Sale', color: '#ea580c' },
  { key: 'royalty', label: 'Royalty Bills (GST)', color: '#d97706' },
  { key: 'credit', label: 'Credit Sale', color: '#0d9488' },
  { key: 'hr_royalty', label: 'HR Loading (Royalty)', color: '#7c3aed' },
  { key: 'cash', label: 'Cash Sale', color: '#e11d48' },
  { key: 'hr_without_royalty', label: 'HR Loading (Non-Royalty)', color: '#94a3b8' },
];

const computeNiceTicks = (maxVal) => {
  const val = Number(maxVal) || 0;
  if (val <= 0) {
    return {
      ticks: [0, 250, 500, 750, 1000],
      maxScale: 1000,
    };
  }

  // Purely dynamic magnitude calculation based strictly on actual sales total
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const norm = val / magnitude;

  let stepNormalized;
  if (norm <= 1.2) stepNormalized = 0.2;
  else if (norm <= 2.5) stepNormalized = 0.5;
  else if (norm <= 5.0) stepNormalized = 1.0;
  else stepNormalized = 2.0;

  const step = Math.max(1, stepNormalized * magnitude);
  const maxScale = Math.ceil(val / step) * step;

  const count = Math.min(8, Math.max(2, Math.round(maxScale / step)));
  const adjustedStep = maxScale / count;

  const ticks = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(i * adjustedStep));
  }

  return { ticks, maxScale };
};

const parseEntryDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let month = parseInt(parts[0], 10) - 1;
        let day = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (month > 11) {
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[0], 10);
        }
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      }
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2].substring(0, 2), 10);
        return new Date(year, month, day);
      }
    }
  } catch {
    return null;
  }
  return null;
};

const formatDateKey = (dateStr) => {
  if (!dateStr) return '15-Oct';
  try {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let mIdx = parseInt(parts[0], 10) - 1;
        let dayNum = parts[1];
        if (mIdx > 11) {
          mIdx = parseInt(parts[1], 10) - 1;
          dayNum = parts[0];
        }
        const mName = monthNames[mIdx] || 'Oct';
        return `${String(dayNum).padStart(2, '0')}-${mName}`;
      }
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const dayNum = parts[2].substring(0, 2);
        return `${String(dayNum).padStart(2, '0')}-${monthNames[mIdx] || 'Oct'}`;
      }
    }
  } catch {
    return dateStr;
  }
  return dateStr;
};

const getSaleModeBucket = (entry) => {
  const mode = String(entry.type_mode || entry.saved_in || '').toLowerCase();
  const hrType = String(entry.hr_loading_type || '').toLowerCase();

  // 1. HR Loading has two distinct subtypes (separate from normal royalty/without royalty)
  if (mode.includes('hr')) {
    if (hrType.includes('with') || (hrType.includes('royalty') && !hrType.includes('without'))) {
      return 'hr_royalty';
    }
    return 'hr_without_royalty';
  }

  // 2. Standard Payment and Sale Modes
  if (mode.includes('cash') || mode.includes('case')) return 'cash';
  if (mode.includes('qr')) return 'qr';
  if (mode.includes('without')) return 'without_royalty';
  if (mode.includes('royalty')) return 'royalty';
  if (mode.includes('credit')) return 'credit';
  return 'credit';
};

const formatINR = (val) => {
  return Math.round(val || 0).toLocaleString('en-IN');
};

const formatCompactINR = (val) => {
  const num = Math.abs(val || 0);
  if (num >= 10000000) {
    const cr = num / 10000000;
    return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)}Cr`;
  }
  if (num >= 100000) {
    const lk = num / 100000;
    return `₹${lk >= 10 ? lk.toFixed(1) : lk.toFixed(2)}L`;
  }
  if (num >= 1000) {
    const th = num / 1000;
    return `₹${th >= 10 ? th.toFixed(0) : th.toFixed(1)}k`;
  }
  return `₹${Math.round(num)}`;
};

export const DashboardView = React.memo(({ entries = [], onOpenAddModal, onNavigateMasters }) => {
  const { user } = useAuth();
  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const { width } = useWindowDimensions();
  const isMobile = width < 900 || (Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 900);
  const isNarrowPhone = width < 520 || (Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 520);

  // Dynamic hover states for interactive tooltips
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);
  const [hoveredPartyIdx, setHoveredPartyIdx] = useState(null);
  const [hoveredMaterialIdx, setHoveredMaterialIdx] = useState(null);
  const [hoveredModeKey, setHoveredModeKey] = useState(null);

  // Quick Date Filter Tabs: 'all' (Default All-Time Overall) | 'daily' | 'weekly' | 'monthly'
  const [dateFilter, setDateFilter] = useState('all');

  // One-time global CSS animation injection (Real app dynamic feel & smooth entrance)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'dashboard-chart-animations-global';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes donutSpinIn {
          0% { transform: rotate(-180deg) scale(0.65); opacity: 0; }
          65% { transform: rotate(14deg) scale(1.05); opacity: 1; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        .donut-rotate-group {
          transform-origin: 110px 110px;
          animation: donutSpinIn 1.1s cubic-bezier(0.34, 1.3, 0.64, 1) forwards;
        }
        .pie-slice-path {
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .pie-legend-card-row {
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .pie-legend-card-row:hover {
          background-color: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }
        @keyframes barSlideUp {
          0% { transform: scaleY(0); opacity: 0; }
          65% { transform: scaleY(1.04); opacity: 0.95; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .stacked-bar-rect {
          transform-origin: center bottom;
          animation: barSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: all 0.22s ease;
        }
        .bar-col-0 .stacked-bar-rect { animation-delay: 0.04s; }
        .bar-col-1 .stacked-bar-rect { animation-delay: 0.12s; }
        .bar-col-2 .stacked-bar-rect { animation-delay: 0.20s; }
        .bar-col-3 .stacked-bar-rect { animation-delay: 0.28s; }
        .bar-col-4 .stacked-bar-rect { animation-delay: 0.36s; }

        @keyframes badgeFadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .bar-value-pill {
          animation: badgeFadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
        }

        @keyframes partyBarGrow {
          0% { transform: scaleY(0); opacity: 0.2; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .party-bar-seg, .party-bar-rect {
          transform-origin: center bottom;
          animation: partyBarGrow 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: all 0.25s ease;
        }
        .party-value-pill {
          animation: badgeFadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both;
        }

        @keyframes pulseDot {
          0% { transform: scale(0.92); opacity: 0.75; }
          50% { transform: scale(1.22); opacity: 1; }
          100% { transform: scale(0.92); opacity: 0.75; }
        }
        .live-pulse-dot {
          animation: pulseDot 2s infinite ease-in-out;
        }

        .dashboard-kpi-tile {
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .dashboard-kpi-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Dynamic greeting based on current local hour
  const dynamicGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good Morning,';
    if (hour >= 12 && hour < 17) return 'Good Afternoon,';
    if (hour >= 17 && hour < 22) return 'Good Evening,';
    return 'Good Night,';
  }, []);

  // 100% PURE DYNAMIC COMPUTATION FROM ACTUAL MONGODB ENTRIES
  const {
    metrics,
    dateRangeStr,
    materialData,
    timelineData,
    maxTimelineVal,
    stackedTicks,
    modeShares,
    partyData,
    maxPartyVal,
  } = useMemo(() => {
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. Parse all dates in entries
    const parsedEntries = entries.map((e) => ({
      ...e,
      _parsedDate: parseEntryDate(e.date),
    }));

    const validDates = parsedEntries.map((e) => e._parsedDate).filter(Boolean);
    validDates.sort((a, b) => b.getTime() - a.getTime());

    // Target reference date: check if today has entries, or fallback to latest entry date
    const hasTodayEntry = parsedEntries.some((e) => {
      const d = e._parsedDate;
      return d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    });

    const targetDate = hasTodayEntry ? today : (validDates.length > 0 ? validDates[0] : today);
    const tDay = String(targetDate.getDate()).padStart(2, '0');
    const tMonth = monthNames[targetDate.getMonth()] || 'Oct';
    const tYear = targetDate.getFullYear();

    // 2. Filter active entries based on selected filter: 'daily' (Today) | 'weekly' | 'monthly' | 'all'
    let activeEntries = parsedEntries;
    let rangeText = 'Today';

    if (dateFilter === 'daily') {
      activeEntries = parsedEntries.filter((e) => {
        const d = e._parsedDate;
        if (!d) return true;
        return d.getFullYear() === targetDate.getFullYear() &&
               d.getMonth() === targetDate.getMonth() &&
               d.getDate() === targetDate.getDate();
      });
      rangeText = `${tDay}-${tMonth} ${tYear} (Today)`;
    } else if (dateFilter === 'weekly') {
      const weekStart = new Date(targetDate);
      weekStart.setDate(targetDate.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(targetDate);
      weekEnd.setHours(23, 59, 59, 999);

      activeEntries = parsedEntries.filter((e) => {
        const d = e._parsedDate;
        if (!d) return true;
        return d >= weekStart && d <= weekEnd;
      });

      const wStartDay = String(weekStart.getDate()).padStart(2, '0');
      const wStartMonth = monthNames[weekStart.getMonth()] || 'Oct';
      rangeText = `${wStartDay}-${wStartMonth} – ${tDay}-${tMonth} ${tYear} (This Week)`;
    } else if (dateFilter === 'monthly') {
      activeEntries = parsedEntries.filter((e) => {
        const d = e._parsedDate;
        if (!d) return true;
        return d.getFullYear() === targetDate.getFullYear() &&
               d.getMonth() === targetDate.getMonth();
      });
      rangeText = `${tMonth} ${tYear} (This Month)`;
    } else {
      activeEntries = parsedEntries;
      if (validDates.length > 0) {
        const first = validDates[validDates.length - 1];
        const last = validDates[0];
        const fDay = String(first.getDate()).padStart(2, '0');
        const fMonth = monthNames[first.getMonth()] || 'Oct';
        const lDay = String(last.getDate()).padStart(2, '0');
        const lMonth = monthNames[last.getMonth()] || 'Oct';
        rangeText = `${fDay}-${fMonth} ${first.getFullYear()} – ${lDay}-${lMonth} ${last.getFullYear()}`;
      } else {
        rangeText = 'All Time';
      }
    }

    // 1. Overall metrics across ALL entries in MongoDB (All-Time Business Totals)
    let overallTotalSale = 0;
    let overallTaxable = 0;
    let overallGst = 0;
    const overallTrips = entries.length;

    // Filtered metrics (if date filter tab is applied)
    let totalSale = 0;
    let taxableAmount = 0;
    let gstCollected = 0;

    const dateMap = {};
    const modeTotals = {
      royalty: 0,
      without_royalty: 0,
      hr_royalty: 0,
      hr_without_royalty: 0,
      credit: 0,
      cash: 0,
      qr: 0,
    };
    const matTotals = {};
    const partyMap = {};
    const datesFound = [];

    // Calculate Overall totals, Party totals, and Date-wise mapping across ALL entries
    entries.forEach((e) => {
      const saleAmt = Number(e.total_amount) || Number(e.amount) || 0;
      const taxAmt = Number(e.amount) || 0;
      const gstAmt = Number(e.gst_amount) || 0;

      overallTotalSale += saleAmt;
      overallTaxable += taxAmt;
      overallGst += gstAmt;

      // Party ranking across all entries
      const pName = (e.party_name || 'Unspecified Party').trim();
      if (!partyMap[pName]) {
        partyMap[pName] = { name: pName, royalty: 0, non_royalty: 0, credit: 0, cash: 0, total: 0 };
      }
      partyMap[pName].total += saleAmt;
      const bucket = getSaleModeBucket(e);
      if (bucket === 'royalty' || bucket === 'hr_royalty') partyMap[pName].royalty += saleAmt;
      else if (bucket === 'cash') partyMap[pName].cash += saleAmt;
      else if (bucket === 'credit') partyMap[pName].credit += saleAmt;
      else partyMap[pName].non_royalty += saleAmt;

      // Date-wise aggregation for timeline chart
      if (e.date) {
        datesFound.push(e.date);
        const dKey = formatDateKey(e.date);
        if (!dateMap[dKey]) {
          dateMap[dKey] = {
            date: dKey,
            total: 0,
            royalty: 0,
            without_royalty: 0,
            hr_royalty: 0,
            hr_without_royalty: 0,
            credit: 0,
            cash: 0,
            qr: 0,
            count: 0,
          };
        }
        dateMap[dKey].total += saleAmt;
        dateMap[dKey].count += 1;
        if (dateMap[dKey][bucket] !== undefined) {
          dateMap[dKey][bucket] += saleAmt;
        }
      }
    });

    // Active entries computation for Material and Mode breakdowns
    activeEntries.forEach((e) => {
      const saleAmt = Number(e.total_amount) || Number(e.amount) || 0;
      const taxAmt = Number(e.amount) || 0;
      const gstAmt = Number(e.gst_amount) || 0;

      totalSale += saleAmt;
      taxableAmount += taxAmt;
      gstCollected += gstAmt;

      const bucket = getSaleModeBucket(e);
      if (modeTotals[bucket] !== undefined) {
        modeTotals[bucket] += saleAmt;
      } else {
        modeTotals.credit += saleAmt;
      }

      // Material
      const mat = (e.material_name || 'Unspecified').trim();
      matTotals[mat] = (matTotals[mat] || 0) + saleAmt;
    });

    // Material Data & Slices
    const matList = Object.entries(matTotals)
      .map(([name, amount], idx) => {
        const percent = totalSale > 0 ? Math.round((amount / totalSale) * 100) : 0;
        return {
          name,
          amount,
          percent,
          color: MATERIAL_PALETTE[idx % MATERIAL_PALETTE.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);

    if (matList.length === 0) {
      matList.push({ name: 'No Material Data', amount: 0, percent: 100, color: '#94a3b8' });
    }

    // Mode Shares - Matching reference image labels & colors
    const sumAllModes = Object.values(modeTotals).reduce((a, b) => a + b, 0);
    const shares = [
      { key: 'without_royalty', label: 'Without Royalty', amount: modeTotals.without_royalty, percent: sumAllModes > 0 ? Math.round((modeTotals.without_royalty / sumAllModes) * 100) : 0, color: MODE_COLORS.without_royalty },
      { key: 'qr', label: 'QR / UPI Sale', amount: modeTotals.qr, percent: sumAllModes > 0 ? Math.round((modeTotals.qr / sumAllModes) * 100) : 0, color: MODE_COLORS.qr },
      { key: 'royalty', label: 'Royalty Bills (GST)', amount: modeTotals.royalty, percent: sumAllModes > 0 ? Math.round((modeTotals.royalty / sumAllModes) * 100) : 0, color: MODE_COLORS.royalty },
      { key: 'credit', label: 'Credit Sale', amount: modeTotals.credit, percent: sumAllModes > 0 ? Math.round((modeTotals.credit / sumAllModes) * 100) : 0, color: MODE_COLORS.credit },
      { key: 'hr_royalty', label: 'HR Loading (Royalty Sale)', amount: modeTotals.hr_royalty, percent: sumAllModes > 0 ? Math.round((modeTotals.hr_royalty / sumAllModes) * 100) : 0, color: MODE_COLORS.hr_royalty },
      { key: 'cash', label: 'Cash Sale', amount: modeTotals.cash, percent: sumAllModes > 0 ? Math.round((modeTotals.cash / sumAllModes) * 100) : 0, color: MODE_COLORS.cash },
      { key: 'hr_without_royalty', label: 'HR Loading (Without Royalty)', amount: modeTotals.hr_without_royalty, percent: sumAllModes > 0 ? Math.round((modeTotals.hr_without_royalty / sumAllModes) * 100) : 0, color: MODE_COLORS.hr_without_royalty },
    ];

    // Date-wise Timeline Data: Current date se last 7 days (1 week)
    let baseDate = targetDate || new Date();
    if (datesFound.length > 0) {
      datesFound.forEach((dStr) => {
        const parsed = parseEntryDate(dStr);
        if (parsed && parsed > baseDate) {
          baseDate = parsed;
        }
      });
    }

    // 7 continuous days ending at baseDate (current date se last 7 days / week)
    const timelineKeys = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - offset);
      const dayNum = String(d.getDate()).padStart(2, '0');
      const mName = monthNames[d.getMonth()] || 'Oct';
      timelineKeys.push(`${dayNum}-${mName}`);
    }

    const timeline = timelineKeys.map((k) => {
      const item = dateMap[k] || {};
      return {
        date: k,
        total: item.total || 0,
        royalty: item.royalty || 0,
        without_royalty: item.without_royalty || 0,
        hr_royalty: item.hr_royalty || 0,
        hr_without_royalty: item.hr_without_royalty || 0,
        cash: item.cash || 0,
        credit: item.credit || 0,
        qr: item.qr || 0,
        count: item.count || 0,
      };
    });

    let maxTVal = 0;
    timeline.forEach((t) => {
      if (t.total > maxTVal) maxTVal = t.total;
    });

    const stackedTicks = computeNiceTicks(maxTVal);

    // Parties ranked by total purchase across all entries
    const pList = Object.values(partyMap).sort((a, b) => b.total - a.total);
    let maxPVal = 1000;
    pList.forEach((p) => {
      if (p.total > maxPVal) maxPVal = p.total;
    });

    return {
      metrics: {
        overallTotalSale,
        overallTaxable,
        overallGst,
        overallTrips,
        totalSale,
        taxableAmount,
        gstCollected,
        trips: activeEntries.length,
      },
      dateRangeStr: rangeText,
      materialData: matList,
      timelineData: timeline,
      maxTimelineVal: maxTVal,
      stackedTicks,
      modeShares: shares,
      partyData: pList,
      maxPartyVal: maxPVal,
    };
  }, [entries, dateFilter]);

  // 4 KPI cards showing ALL DATA and OVERALL SALES
  const kpiCards = [
    {
      id: 'sales',
      title: 'Overall Total Sales (₹)',
      value: `₹ ${formatINR(metrics.overallTotalSale)}`,
      trend: 'All-Time Overall Sales',
      icon: 'wallet',
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
      cardBg: '#ffffff',
      borderColor: '#e2e8f0',
    },
    {
      id: 'trips',
      title: 'Total Trips / Challans',
      value: String(metrics.overallTrips),
      trend: 'Total Trips Recorded',
      icon: 'bus',
      iconBg: '#dcfce7',
      iconColor: '#10b981',
      cardBg: '#ffffff',
      borderColor: '#e2e8f0',
    },
    {
      id: 'taxable',
      title: 'Overall Taxable Amount (₹)',
      value: `₹ ${formatINR(metrics.overallTaxable)}`,
      trend: 'All-Time Taxable Base',
      icon: 'newspaper',
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
      cardBg: '#ffffff',
      borderColor: '#e2e8f0',
    },
    {
      id: 'gst',
      title: 'Overall GST Collected (₹)',
      value: `₹ ${formatINR(metrics.overallGst)}`,
      trend: 'All-Time GST Liability',
      isPercent: true,
      iconBg: '#ffedd5',
      iconColor: '#ea580c',
      cardBg: '#ffffff',
      borderColor: '#e2e8f0',
    },
  ];

  return (
    <ScrollView style={styles.pageContainer} showsVerticalScrollIndicator={true} contentContainerStyle={[styles.contentWrap, isMobile && styles.contentWrapMobile]}>
      {/* 1. TOP HEADER & STATUS BAR */}
      <View style={[styles.topHeader, isMobile && styles.topHeaderMobile]}>
        <View style={styles.greetingHeaderRow}>
          <View style={styles.greetingTitleRow}>
            <Text style={[styles.greetingTitle, isMobile && styles.greetingTitleMobile]}>{dynamicGreeting} </Text>
            <Text style={[styles.greetingAdmin, isMobile && styles.greetingAdminMobile]}>{displayName}</Text>
          </View>

          <View style={[styles.onlineBadge, isMobile && styles.onlineBadgeMobile]}>
            <View style={styles.onlineDot} className="live-pulse-dot" />
            <Text style={[styles.onlineText, isMobile && styles.onlineTextMobile]}>Online</Text>
          </View>
        </View>

        <View style={[styles.subHeaderControlsRow, isMobile && styles.subHeaderControlsRowMobile]}>
          <Text style={[styles.greetingDesc, isMobile && styles.greetingDescMobile]}>
            Here's your business overview for {dateFilter === 'daily' ? 'today' : dateFilter === 'weekly' ? 'this week' : dateFilter === 'monthly' ? 'this month' : 'all time'}
          </Text>

          <View style={[styles.filterControlsGroup, isMobile && styles.filterControlsGroupMobile]}>
            {/* Quick Segmented Date Tabs: Daily | Weekly | Monthly | All */}
            <View style={[styles.dateFilterTabs, isMobile && styles.dateFilterTabsMobile]}>
              {[
                { id: 'all', label: 'All' },
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ].map((tab) => {
                const isActive = dateFilter === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    activeOpacity={0.75}
                    onPress={() => setDateFilter(tab.id)}
                    style={[
                      styles.dateFilterTab,
                      isMobile && styles.dateFilterTabMobile,
                      isActive && styles.dateFilterTabActive,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.dateFilterTabText,
                        isMobile && styles.dateFilterTabTextMobile,
                        isActive && styles.dateFilterTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date Range Badge Pill */}
            <View style={[styles.dateSelectorPill, isMobile && styles.dateSelectorPillMobile]}>
              <Ionicons name="calendar-outline" size={isMobile ? 13 : 15} color="#0284c7" />
              <Text style={[styles.dateSelectorText, isMobile && styles.dateSelectorTextMobile]}>
                {dateRangeStr}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. THE 4 KPI CARDS (1 per row on narrow phone, 2 per row on tablet, 4 in 1 row on Desktop) */}
      <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
        {kpiCards.map((card) => (
          <View
            key={card.id}
            className="dashboard-kpi-tile"
            style={[
              styles.kpiCard,
              isMobile && styles.kpiCardMobile,
              isNarrowPhone && styles.kpiCardNarrowPhone,
              { backgroundColor: card.cardBg, borderColor: card.borderColor },
              !isMobile && styles.kpiCardDesktop,
            ]}
          >
            {/* Left Squircle Icon */}
            <View style={[styles.kpiIconSquircle, isMobile && styles.kpiIconSquircleMobile, { backgroundColor: card.iconBg }]}>
              {card.isPercent ? (
                <Text style={[styles.kpiPercentText, isMobile && styles.kpiPercentTextMobile, { color: card.iconColor }]}>%</Text>
              ) : (
                <Ionicons name={card.icon} size={isMobile ? 16 : 20} color={card.iconColor} />
              )}
            </View>

            {/* Right Content */}
            <View style={styles.kpiContentCol}>
              <View style={styles.kpiTitleRow}>
                <Text style={[styles.kpiCardTitle, isMobile && styles.kpiCardTitleMobile]} numberOfLines={1}>{card.title}</Text>
                <Ionicons name="chevron-forward" size={isMobile ? 13 : 15} color="#94a3b8" />
              </View>
              <Text style={[styles.kpiCardValue, isMobile && styles.kpiCardValueMobile]} numberOfLines={1}>{card.value}</Text>
              <Text style={[styles.kpiCardTrend, isMobile && styles.kpiCardTrendMobile]} numberOfLines={1}>{card.trend}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 3. THE 4 CHARTS (Rearranged: 1. Date-wise Sales by Mode, 2. Sales by Mode, 3. Sales by Material, 4. Top Party-wise Sales) */}
      <View style={styles.chartsGrid}>
        {/* ROW 1: Date-wise Sales by Sale Mode & Sales by Mode (Monthly Overview) */}
        <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
          {/* Chart 1: Date-wise Sales by Sale Mode (₹) */}
          <View style={[styles.chartCard, styles.stackedChartCard, isMobile && styles.chartCardMobile, !isMobile && styles.chartCardHalf]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartCardTitle, isMobile && styles.chartCardTitleMobile, { flexShrink: 1 }]} numberOfLines={1}>
                Date-wise Sales by Sale Mode (₹)
              </Text>
              <View style={styles.headerBadgeContainer}>
                {hoveredTrendIdx !== null && timelineData[hoveredTrendIdx] ? (
                  <View style={styles.hoverBadgePill}>
                    <Text style={styles.hoverBadgeText} numberOfLines={1}>
                      {timelineData[hoveredTrendIdx].date}: ₹{formatINR(timelineData[hoveredTrendIdx].total)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Direct-Fit Responsive Container (No Horizontal Scroll on Phone) */}
            <View style={styles.lineChartWrap}>
              <Svg width="100%" height={isMobile ? "225" : "240"} viewBox="0 0 460 220" style={{ overflow: 'visible', display: 'block' }}>
                {/* Y-Axis Values & Gridlines (Compact formatted to fit perfectly) */}
                {stackedTicks.ticks.map((tickVal) => {
                  const yPos = 25 + (155 * (1 - (stackedTicks.maxScale > 0 ? tickVal / stackedTicks.maxScale : 0)));
                  return (
                    <G key={`y-tick-${tickVal}`}>
                      <SvgText x="54" y={yPos + 3.5} fill="#64748b" fontSize="9.5" fontWeight="600" textAnchor="end">
                        {formatCompactINR(tickVal).replace('₹', '')}
                      </SvgText>
                      <Line x1="58" y1={yPos} x2="445" y2={yPos} stroke="#f1f5f9" strokeWidth="0.8" strokeDasharray="3 3" />
                    </G>
                  );
                })}

                {/* Y-Axis Line */}
                <Line x1="58" y1="22" x2="58" y2="182" stroke="#cbd5e1" strokeWidth="1" />

                {/* X-Axis Baseline */}
                <Line x1="58" y1="182" x2="445" y2="182" stroke="#94a3b8" strokeWidth="1.2" />

                {/* Stacked Columns for Each Date - Sleek Width & Values Directly Visible */}
                {(() => {
                  const N = timelineData.length;
                  const plotWidth = 387; // 445 - 58
                  const colWidth = plotWidth / Math.max(1, N);
                  const barWidth = Math.min(60, Math.max(46, Math.round(colWidth * 0.76))); // Bold width, column gap minimized to ~18px

                  return (
                    <G>
                      {timelineData.map((d, i) => {
                        const colCenterX = 58 + (i + 0.5) * colWidth;
                        const barLeft = colCenterX - barWidth / 2;
                        const isHovered = hoveredTrendIdx === i;

                        // Find topmost active mode for rounded cap
                        const activeModes = STACKED_MODES.filter((m) => (d[m.key] || 0) > 0);
                        const topModeKey = activeModes.length > 0 ? activeModes[activeModes.length - 1].key : null;

                        let currentY = 182; // baseline

                        // Compute segments
                        const segments = STACKED_MODES.map((mode) => {
                          const val = d[mode.key] || 0;
                          if (val <= 0) return null;
                          const segHeight = stackedTicks.maxScale > 0 ? (val / stackedTicks.maxScale) * 155 : 0;
                          if (segHeight <= 0) return null;

                          const segY = currentY - segHeight;
                          currentY = segY;

                          return {
                            mode,
                            val,
                            segY,
                            segHeight,
                            isTop: mode.key === topModeKey,
                          };
                        }).filter(Boolean);

                        const barTopY = currentY;

                        return (
                          <G
                            key={`col-${d.date}`}
                            className={`bar-col-${i}`}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={isWeb ? () => setHoveredTrendIdx(i) : undefined}
                            onMouseLeave={isWeb ? () => setHoveredTrendIdx(null) : undefined}
                            onClick={isWeb ? () => setHoveredTrendIdx((prev) => (prev === i ? null : i)) : undefined}
                            onPress={!isWeb ? () => setHoveredTrendIdx((prev) => (prev === i ? null : i)) : undefined}
                          >
                            {/* Hover background column indicator */}
                            {isHovered && (
                              <Rect
                                x={colCenterX - colWidth / 2 + 2}
                                y="18"
                                width={colWidth - 4}
                                height="166"
                                fill="#f1f5f9"
                                rx="4"
                                opacity="0.65"
                              />
                            )}

                            {/* Stack segments with bold bar width & rounded top */}
                            {segments.map(({ mode, val, segY, segHeight, isTop }) => (
                              <G key={`${d.date}-${mode.key}`}>
                                <Rect
                                  className="stacked-bar-rect"
                                  x={barLeft}
                                  y={segY}
                                  width={barWidth}
                                  height={segHeight}
                                  rx={isTop ? 4 : 0}
                                  ry={isTop ? 4 : 0}
                                  fill={mode.color}
                                  opacity={isHovered ? 0.95 : 1}
                                  stroke={isHovered ? '#ffffff' : 'none'}
                                  strokeWidth="0.5"
                                />
                                {/* Value directly inside segment if height is sufficient */}
                                {segHeight >= 14 && (
                                  <SvgText
                                    x={colCenterX}
                                    y={segY + segHeight / 2 + 3}
                                    fill="#ffffff"
                                    fontSize="8.5"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    pointerEvents="none"
                                  >
                                    {formatCompactINR(val).replace('₹', '')}
                                  </SvgText>
                                )}
                              </G>
                            ))}

                            {/* Direct Sales Value on top of bar - NO CLICK NEEDED ON PHONE! */}
                            {d.total > 0 ? (
                              <G className="bar-value-pill">
                                <Rect
                                  x={colCenterX - 26}
                                  y={barTopY - 16}
                                  width="52"
                                  height="13"
                                  rx="6.5"
                                  fill="#f1f5f9"
                                />
                                <SvgText
                                  x={colCenterX}
                                  y={barTopY - 6}
                                  fill="#0f172a"
                                  fontSize="9.5"
                                  fontWeight="800"
                                  textAnchor="middle"
                                >
                                  {formatCompactINR(d.total)}
                                </SvgText>
                              </G>
                            ) : (
                              <SvgText
                                x={colCenterX}
                                y={176}
                                fill="#94a3b8"
                                fontSize="9"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                ₹0
                              </SvgText>
                            )}

                            {/* X-Axis Date Label */}
                            <SvgText
                              x={colCenterX}
                              y="198"
                              fill={isHovered ? '#0284c7' : '#334155'}
                              fontSize="10"
                              fontWeight={isHovered ? '700' : '600'}
                              textAnchor="middle"
                            >
                              {d.date}
                            </SvgText>

                            {/* Column Tap / Hover Hit Area */}
                            <Rect
                              x={colCenterX - colWidth / 2}
                              y={14}
                              width={colWidth}
                              height={172}
                              fill="#ffffff"
                              opacity="0.001"
                            />
                          </G>
                        );
                      })}

                      {/* Tooltip on Tap/Hover for Deep Breakdown */}
                      {hoveredTrendIdx !== null && timelineData[hoveredTrendIdx] && (() => {
                        const cur = timelineData[hoveredTrendIdx];
                        const colCenterX = 58 + (hoveredTrendIdx + 0.5) * colWidth;
                        const boxW = 150;
                        const boxH = 90;
                        const boxX = Math.max(60, Math.min(colCenterX - boxW / 2, 445 - boxW));
                        const boxY = 20;

                        return (
                          <G pointerEvents="none">
                            <Line
                              x1={colCenterX}
                              y1="16"
                              x2={colCenterX}
                              y2="182"
                              stroke="#0f172a"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              opacity="0.35"
                            />
                            <Rect x={boxX} y={boxY} width={boxW} height={boxH} rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                            <SvgText x={boxX + 8} y={boxY + 14} fill="#0f172a" fontSize="10.5" fontWeight="700">
                              {cur.date} {cur.total > 0 ? `(₹${formatINR(cur.total)})` : '₹0'}
                            </SvgText>
                            <Line x1={boxX + 8} y1={boxY + 19} x2={boxX + boxW - 8} y2={boxY + 19} stroke="#f1f5f9" strokeWidth="1" />
                            {(() => {
                              const activeModes = STACKED_MODES.filter((m) => (cur[m.key] || 0) > 0);
                              if (activeModes.length === 0) {
                                return (
                                  <SvgText x={boxX + 8} y={boxY + 36} fill="#64748b" fontSize="9.5">
                                    No sales recorded
                                  </SvgText>
                                );
                              }
                              return activeModes.slice(0, 4).map((m, idx) => (
                                <G key={m.key}>
                                  <Rect x={boxX + 8} y={boxY + 25 + idx * 14} width="7" height="7" rx="1.5" fill={m.color} />
                                  <SvgText x={boxX + 19} y={boxY + 32 + idx * 14} fill="#334155" fontSize="9" fontWeight="500">
                                    {m.label.split(' ')[0]}: ₹{formatINR(cur[m.key])}
                                  </SvgText>
                                </G>
                              ));
                            })()}
                          </G>
                        );
                      })()}
                    </G>
                  );
                })()}
              </Svg>
            </View>

            {/* Horizontal Legend at Bottom */}
            <View style={styles.stackedBarLegendRow}>
              {STACKED_MODES.map((m) => (
                <View key={m.key} style={styles.stackedBarLegendItem}>
                  <View style={[styles.stackedLegendBox, { backgroundColor: m.color }]} />
                  <Text style={[styles.stackedLegendText, isMobile && { fontSize: 10.5 }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Chart 2: Sales by Mode (Monthly Overview) - Animated Pie Chart matching Reference Image */}
          <View style={[styles.chartCard, isMobile && styles.chartCardMobile, !isMobile && styles.chartCardHalf]}>
            <View style={styles.chartHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.chartTitleBadge}>
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="12" width="4.5" height="9" rx="1.5" fill="#2563eb" />
                    <Rect x="9.75" y="4" width="4.5" height="17" rx="1.5" fill="#2563eb" />
                    <Rect x="16.5" y="8" width="4.5" height="13" rx="1.5" fill="#2563eb" />
                  </Svg>
                </View>
                <Text style={[styles.chartCardTitle, isMobile && styles.chartCardTitleMobile, { flexShrink: 1 }]} numberOfLines={1}>
                  Sales by Mode (Monthly Overview)
                </Text>
              </View>
              <View style={styles.headerBadgeContainer}>
                {hoveredModeKey ? (() => {
                  const item = modeShares.find((s) => s.key === hoveredModeKey);
                  return item ? (
                    <View style={styles.hoverBadgePill}>
                      <Text style={styles.hoverBadgeText} numberOfLines={1}>
                        {item.label}: ₹{formatINR(item.amount)} ({item.percent}%)
                      </Text>
                    </View>
                  ) : null;
                })() : null}
              </View>
            </View>

            {(() => {
              const sortedModes = [...modeShares].sort((a, b) => b.amount - a.amount);
              const totalModeAmount = sortedModes.reduce((sum, m) => sum + (m.amount || 0), 0);
              const isNarrowChart = isMobile || width < 1000;
              const hoveredModeItem = hoveredModeKey ? sortedModes.find((m) => m.key === hoveredModeKey) : null;

              const cx = 135;
              const cy = 135;
              const baseR = 100;
              const base_r = 54;

              // Compute Donut Slices starting at -90 degrees (12 o'clock)
              let currentDeg = -90;
              const slices = sortedModes.map((item) => {
                const percent = totalModeAmount > 0 ? (item.amount / totalModeAmount) * 100 : 0;
                const sweepDeg = (percent / 100) * 360;
                const startDeg = currentDeg;
                const endDeg = currentDeg + sweepDeg;
                const midDeg = startDeg + sweepDeg / 2;

                if (sweepDeg > 0) {
                  currentDeg += sweepDeg;
                }

                const isHovered = hoveredModeKey === item.key;
                const isAnyHovered = hoveredModeKey !== null;

                const popOut = isHovered ? 6 : 0;
                const midRad = (midDeg * Math.PI) / 180;
                const startRad = (startDeg * Math.PI) / 180;
                const endRad = (endDeg * Math.PI) / 180;

                const shiftX = popOut * Math.cos(midRad);
                const shiftY = popOut * Math.sin(midRad);

                const R = isHovered ? baseR + 5 : (isAnyHovered ? baseR - 2 : baseR);
                const r = isHovered ? base_r - 3 : base_r;

                const x1 = (cx + shiftX) + R * Math.cos(startRad);
                const y1 = (cy + shiftY) + R * Math.sin(startRad);
                const x2 = (cx + shiftX) + R * Math.cos(endRad);
                const y2 = (cy + shiftY) + R * Math.sin(endRad);

                const x3 = (cx + shiftX) + r * Math.cos(endRad);
                const y3 = (cy + shiftY) + r * Math.sin(endRad);
                const x4 = (cx + shiftX) + r * Math.cos(startRad);
                const y4 = (cy + shiftY) + r * Math.sin(startRad);

                const largeArc = sweepDeg > 180 ? 1 : 0;
                const pathD = sweepDeg >= 359.9
                  ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
                  : `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;

                const midR = (R + r) / 2;
                const lx = (cx + shiftX) + midR * Math.cos(midRad);
                const ly = (cy + shiftY) + midR * Math.sin(midRad);

                return {
                  ...item,
                  percent: Math.round(percent),
                  sweepDeg,
                  pathD,
                  lx,
                  ly,
                  isHovered,
                  hasSales: item.amount > 0,
                };
              });

              return (
                <View style={[styles.pieChartContainerRow, isNarrowChart && styles.pieChartContainerRowMobile]}>
                  {/* Left: Clean Interactive Donut Graphic with Zero Text Collisions */}
                  <View style={[styles.pieSvgWrap, !isNarrowChart && styles.pieSvgWrapDesktop, isNarrowChart && styles.pieSvgWrapMobile]}>
                    <View style={{ width: isMobile ? 240 : 270, height: isMobile ? 240 : 270, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                      <Svg
                        width={isMobile ? "240" : "270"}
                        height={isMobile ? "240" : "270"}
                        viewBox="0 0 270 270"
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                          width: isMobile ? 240 : 270,
                          height: isMobile ? 240 : 270,
                          alignSelf: 'center',
                          display: isWeb ? 'block' : undefined,
                          overflow: 'visible',
                        }}
                      >
                        <G className="donut-rotate-group">
                          {/* 1. Donut Slices */}
                          {slices.map((slice) => {
                            if (!slice.hasSales) return null;
                            const isAnyHovered = hoveredModeKey !== null;
                            return (
                              <Path
                                key={`slice-${slice.key}`}
                                d={slice.pathD}
                                fill={slice.color}
                                stroke="#ffffff"
                                strokeWidth={slice.isHovered ? 2.5 : 1.5}
                                strokeLinejoin="round"
                                className={isWeb ? "pie-slice-path" : undefined}
                                opacity={isAnyHovered && !slice.isHovered ? 0.45 : 1}
                                onMouseEnter={isWeb ? () => setHoveredModeKey(slice.key) : undefined}
                                onMouseLeave={isWeb ? () => setHoveredModeKey(null) : undefined}
                                onClick={isWeb ? () => setHoveredModeKey(slice.isHovered ? null : slice.key) : undefined}
                                onPress={!isWeb ? () => setHoveredModeKey(slice.isHovered ? null : slice.key) : undefined}
                                style={{
                                  cursor: 'pointer',
                                  transition: 'all 0.25s ease',
                                }}
                              />
                            );
                          })}

                          {/* 2. White Percentage Text inside prominent slices (>= 6%) */}
                          {slices.map((slice) => {
                            if (!slice.hasSales || slice.percent < 6) return null;
                            return (
                              <SvgText
                                key={`pct-${slice.key}`}
                                x={slice.lx}
                                y={slice.ly + 4}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="12"
                                fontWeight="800"
                                pointerEvents="none"
                              >
                                {slice.percent}%
                              </SvgText>
                            );
                          })}

                          {/* 3. Center White Hole Circle */}
                          <Circle
                            cx={cx}
                            cy={cy}
                            r={hoveredModeKey !== null ? 48 : 52}
                            fill="#ffffff"
                            stroke="#e2e8f0"
                            strokeWidth="1.5"
                            style={{ transition: 'all 0.25s ease' }}
                          />
                        </G>
                      </Svg>

                      {/* 4. Center Content Overlay: Clear, Bug-Free Value Display */}
                      <View style={styles.donutCenterOverlay} pointerEvents="none">
                        {hoveredModeItem ? (
                          <>
                            <Text style={styles.donutCenterLabel} numberOfLines={1}>
                              {hoveredModeItem.label}
                            </Text>
                            <Text style={[styles.donutCenterValue, { color: hoveredModeItem.color, fontSize: 12.5 }]} numberOfLines={1}>
                              ₹{formatINR(hoveredModeItem.amount)}
                            </Text>
                            <Text style={styles.donutCenterPercent}>
                              {hoveredModeItem.percent}% of sales
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.donutCenterLabel}>Total Sales</Text>
                            <Text style={styles.donutCenterValue} numberOfLines={1}>
                              ₹{formatCompactINR(totalModeAmount)}
                            </Text>
                            <Text style={styles.donutCenterPercent}>
                              All 7 Modes
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Right: Sleek Enclosed Legend Card */}
                  <View style={[styles.pieLegendCard, isNarrowChart && styles.pieLegendCardMobile]}>
                    {sortedModes.map((item) => {
                      const isHovered = hoveredModeKey === item.key;
                      const isAnyHovered = hoveredModeKey !== null;
                      return (
                        <View
                          key={item.key}
                          className={isWeb ? "pie-legend-card-row" : undefined}
                          style={[
                            styles.pieLegendRow,
                            isHovered && styles.pieLegendRowHovered,
                            isAnyHovered && !isHovered && { opacity: 0.65 },
                          ]}
                          onMouseEnter={isWeb ? () => setHoveredModeKey(item.key) : undefined}
                          onMouseLeave={isWeb ? () => setHoveredModeKey(null) : undefined}
                          onClick={isWeb ? () => setHoveredModeKey(isHovered ? null : item.key) : undefined}
                          onPress={() => setHoveredModeKey(isHovered ? null : item.key)}
                        >
                          <View style={[styles.pieLegendBullet, { backgroundColor: item.color }]} />
                          <View style={styles.pieLegendCol}>
                            <Text style={styles.pieLegendLabel}>{item.label}</Text>
                            <Text style={styles.pieLegendAmount}>₹ {formatINR(item.amount)}</Text>
                          </View>
                          <Text style={styles.pieLegendPercent}>{item.percent}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>
        </View>

        {/* ROW 2: Sales by Material & Top Party-wise Sales */}
        <View style={[styles.chartsRow, isMobile && styles.chartsRowMobile]}>
          {/* Chart 3: Sales by Material */}
          <View style={[styles.chartCard, isMobile && styles.chartCardMobile, !isMobile && styles.chartCardHalf]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartCardTitle, isMobile && styles.chartCardTitleMobile, { flexShrink: 1 }]} numberOfLines={1}>
                Sales by Material
              </Text>
              <View style={styles.headerBadgeContainer}>
                {hoveredMaterialIdx !== null && materialData[hoveredMaterialIdx] ? (
                  <View style={styles.hoverBadgePill}>
                    <Text style={styles.hoverBadgeText} numberOfLines={1}>
                      {materialData[hoveredMaterialIdx].name}: ₹{formatINR(materialData[hoveredMaterialIdx].amount)} ({materialData[hoveredMaterialIdx].percent}%)
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.donutSectionRow, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
              {/* Dynamic SVG Donut Graphic - Prominent & Bold */}
              <View style={styles.donutSvgWrap}>
                <Svg width={isMobile ? "190" : "215"} height={isMobile ? "190" : "215"} viewBox="0 0 220 220" style={{ overflow: 'visible', display: 'block', maxWidth: '100%' }}>
                  <G className="donut-rotate-group">
                    {/* Render dynamic arc slices with smooth increase/decrease on hover */}
                    {(() => {
                      const cx = 110;
                      const cy = 110;
                      let currentAngle = -90;

                      return materialData.map((m, idx) => {
                        const isHovered = hoveredMaterialIdx === idx;
                        const isAnyHovered = hoveredMaterialIdx !== null;
                        const sliceAngle = Math.max(2, (m.percent / 100) * 360);
                        const startA = currentAngle;
                        const endA = currentAngle + sliceAngle;
                        currentAngle = endA;

                        const R = isHovered ? 98 : (isAnyHovered ? 84 : 90);
                        const r = isHovered ? 48 : (isAnyHovered ? 56 : 54);

                        const midA = (startA + endA) / 2;
                        const midRad = (midA * Math.PI) / 180;
                        const shiftX = isHovered ? Math.cos(midRad) * 5 : 0;
                        const shiftY = isHovered ? Math.sin(midRad) * 5 : 0;

                        const radStart = (startA * Math.PI) / 180;
                        const radEnd = (endA * Math.PI) / 180;

                        const x1 = (cx + shiftX) + R * Math.cos(radStart);
                        const y1 = (cy + shiftY) + R * Math.sin(radStart);
                        const x2 = (cx + shiftX) + R * Math.cos(radEnd);
                        const y2 = (cy + shiftY) + R * Math.sin(radEnd);

                        const x3 = (cx + shiftX) + r * Math.cos(radEnd);
                        const y3 = (cy + shiftY) + r * Math.sin(radEnd);
                        const x4 = (cx + shiftX) + r * Math.cos(radStart);
                        const y4 = (cy + shiftY) + r * Math.sin(radStart);

                        const largeArc = sliceAngle > 180 ? 1 : 0;
                        const pathD = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;

                        return (
                          <G
                            key={m.name}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={isWeb ? () => setHoveredMaterialIdx(idx) : undefined}
                            onMouseLeave={isWeb ? () => setHoveredMaterialIdx(null) : undefined}
                            onClick={isWeb ? () => setHoveredMaterialIdx(isHovered ? null : idx) : undefined}
                            onPress={!isWeb ? () => setHoveredMaterialIdx(isHovered ? null : idx) : undefined}
                          >
                            <Path
                              d={pathD}
                              fill={m.color}
                              opacity={hoveredMaterialIdx === null || isHovered ? 1 : 0.32}
                              stroke="#ffffff"
                              strokeWidth={isHovered ? 2.5 : 1}
                              style={{
                                transition: 'd 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
                              }}
                            />
                            {/* Direct Percentage on Donut Slice - NO CLICK NEEDED! */}
                            {m.percent >= 8 && (
                              <SvgText
                                x={(cx + shiftX) + ((R + r) / 2) * Math.cos(midRad)}
                                y={(cy + shiftY) + ((R + r) / 2) * Math.sin(midRad) + 3.5}
                                fill="#ffffff"
                                fontSize="10.5"
                                fontWeight="800"
                                textAnchor="middle"
                                pointerEvents="none"
                              >
                                {m.percent}%
                              </SvgText>
                            )}
                          </G>
                        );
                      });
                    })()}

                    {/* Center White Hole Circle */}
                    <Circle
                      cx="110"
                      cy="110"
                      r={hoveredMaterialIdx !== null ? 45 : 50}
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1.5"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                  </G>
                </Svg>

                {/* Center Content Overlay using Native Text (100% bug-free rupee alignment) */}
                <View style={styles.donutCenterOverlay} pointerEvents="none">
                  {hoveredMaterialIdx !== null && materialData[hoveredMaterialIdx] ? (
                    <>
                      <Text style={styles.donutCenterLabel} numberOfLines={1}>
                        {materialData[hoveredMaterialIdx].name}
                      </Text>
                      <Text style={[styles.donutCenterValue, { color: materialData[hoveredMaterialIdx].color }]} numberOfLines={1}>
                        ₹{formatINR(materialData[hoveredMaterialIdx].amount)}
                      </Text>
                      <Text style={styles.donutCenterPercent}>
                        {materialData[hoveredMaterialIdx].percent}%
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.donutCenterLabel}>Total</Text>
                      <Text style={styles.donutCenterValue} numberOfLines={1}>
                        ₹{formatINR(metrics.totalSale)}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Dynamic Legend List on Right - TIGHT VALUES SPACING */}
              <View style={[styles.materialLegendList, isMobile && styles.materialLegendListMobile]}>
                {materialData.map((m, idx) => {
                  const isHovered = hoveredMaterialIdx === idx;
                  return (
                    <View
                      key={m.name}
                      style={[styles.materialLegendItem, isHovered && styles.materialLegendItemHovered]}
                      onMouseEnter={() => setHoveredMaterialIdx(idx)}
                      onMouseLeave={() => setHoveredMaterialIdx(null)}
                      onClick={() => setHoveredMaterialIdx(isHovered ? null : idx)}
                    >
                      <View style={[styles.legendColorBox, { backgroundColor: m.color }]} />
                      <Text style={[styles.materialLegendLabel, isMobile && { fontSize: 11 }]} numberOfLines={1}>
                        {m.name}: <Text style={{ fontWeight: '700', color: '#0f172a' }}>₹{formatINR(m.amount)}</Text> ({m.percent}%)
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Chart 4: Top Party-wise Sales */}
          <View style={[styles.chartCard, isMobile && styles.chartCardMobile, !isMobile && styles.chartCardHalf]}>
            <View style={styles.chartHeaderRow}>
              <Text style={[styles.chartCardTitle, isMobile && styles.chartCardTitleMobile, { flexShrink: 1 }]} numberOfLines={1}>
                Top Party-wise Sales
              </Text>
              <View style={styles.headerBadgeContainer}>
                {hoveredPartyIdx !== null && partyData[hoveredPartyIdx] ? (
                  <View style={styles.hoverBadgePill}>
                    <Text style={styles.hoverBadgeText} numberOfLines={1}>
                      {partyData[hoveredPartyIdx].name}: ₹{formatINR(partyData[hoveredPartyIdx].total)}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.hoverBadgePill, { backgroundColor: '#f1f5f9' }]}>
                    <Text style={[styles.hoverBadgeText, { color: '#475569' }]} numberOfLines={1}>
                      Ranked by Total Purchase
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Direct Total Bar Chart - NO CLICK NEEDED, VALUES VISIBLE DIRECTLY */}
            <View style={styles.lineChartWrap}>
              <Svg width="100%" height={isMobile ? "225" : "240"} viewBox="0 0 500 220" style={{ overflow: 'visible', display: 'block' }}>
                {/* Dynamic Y-Axis Gridlines & Numbers */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const yPos = 28 + 142 * (1 - pct);
                  const val = Math.round(maxPartyVal * pct);
                  return (
                    <G key={`py-${idx}`}>
                      <Line x1="68" y1={yPos} x2="485" y2={yPos} stroke="#f1f5f9" strokeWidth="0.8" strokeDasharray="3 3" />
                      <SvgText x="62" y={yPos + 3.5} fill="#94a3b8" fontSize="9.5" fontWeight="600" textAnchor="end">
                        {formatCompactINR(val).replace('₹', '')}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Y-Axis Line */}
                <Line x1="68" y1="24" x2="68" y2="170" stroke="#cbd5e1" strokeWidth="1" />

                {/* X-Axis Baseline */}
                <Line x1="68" y1="170" x2="485" y2="170" stroke="#94a3b8" strokeWidth="1.2" />

                {/* Dynamic Direct Total Bars for Parties (Highest to Lowest) */}
                {partyData.length === 0 ? (
                  <SvgText x="270" y="105" textAnchor="middle" fill="#94a3b8" fontSize="12">
                    No party deliveries recorded yet.
                  </SvgText>
                ) : (
                  (() => {
                    const topParties = partyData.slice(0, 5);
                    const N = topParties.length;
                    const plotWidth = 417; // 485 - 68
                    const colWidth = plotWidth / Math.max(1, N);
                    const barW = Math.min(58, Math.max(44, Math.round(colWidth * 0.74))); // Bold bars, minimal gap
                    const chartH = 142;
                    const maxVal = maxPartyVal > 0 ? maxPartyVal : 1;

                    // Modern ranked color palette: #1 vibrant royal blue, #2 oceanic sky, #3 electric teal, #4 emerald, #5 amber
                    const PARTY_COLORS = ['#2563eb', '#0284c7', '#0891b2', '#059669', '#d97706'];

                    return topParties.map((p, i) => {
                      const colCenterX = 68 + (i + 0.5) * colWidth;
                      const barLeft = colCenterX - barW / 2;
                      const isHovered = hoveredPartyIdx === i;

                      const barH = maxVal > 0 ? (p.total / maxVal) * chartH : 0;
                      const barY = 170 - barH;
                      const barColor = PARTY_COLORS[i % PARTY_COLORS.length];

                      return (
                        <G
                          key={p.name}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={isWeb ? () => setHoveredPartyIdx(i) : undefined}
                          onMouseLeave={isWeb ? () => setHoveredPartyIdx(null) : undefined}
                          onClick={isWeb ? () => setHoveredPartyIdx(isHovered ? null : i) : undefined}
                          onPress={!isWeb ? () => setHoveredPartyIdx(isHovered ? null : i) : undefined}
                        >
                          {/* Hover background column indicator */}
                          {isHovered && (
                            <Rect
                              x={colCenterX - colWidth / 2 + 2}
                              y="20"
                              width={colWidth - 4}
                              height="150"
                              fill="#f1f5f9"
                              rx="4"
                              opacity="0.65"
                            />
                          )}

                          {/* Direct Solid Total Bar with rounded top */}
                          {barH > 0 && (
                            <Rect
                              className="party-bar-rect"
                              x={barLeft}
                              y={barY}
                              width={barW}
                              height={barH}
                              rx="5"
                              ry="5"
                              fill={barColor}
                              opacity={isHovered ? 1 : 0.9}
                              stroke={isHovered ? '#ffffff' : 'none'}
                              strokeWidth="1"
                            />
                          )}

                          {/* Direct Sales Value on top of bar - NO CLICK NEEDED ON PHONE! */}
                          {p.total > 0 && (
                            <G className="party-value-pill">
                              <Rect
                                x={colCenterX - 25}
                                y={barY - 17}
                                width="50"
                                height="14"
                                rx="7"
                                fill="#f1f5f9"
                                stroke="#e2e8f0"
                                strokeWidth="0.8"
                              />
                              <SvgText
                                x={colCenterX}
                                y={barY - 6.5}
                                fill="#0f172a"
                                fontSize="9.5"
                                fontWeight="800"
                                textAnchor="middle"
                              >
                                {formatCompactINR(p.total)}
                              </SvgText>
                            </G>
                          )}

                          {/* Party Label below baseline */}
                          <SvgText
                            x={colCenterX}
                            y="188"
                            fill={isHovered ? barColor : '#475569'}
                            fontSize="10"
                            fontWeight={isHovered ? '800' : '600'}
                            textAnchor="middle"
                          >
                            {p.name.length > 10 ? `${p.name.substring(0, 9)}..` : p.name}
                          </SvgText>
                        </G>
                      );
                    });
                  })()
                )}
              </Svg>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentWrap: {
    padding: 18,
    paddingBottom: 36,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  contentWrapMobile: {
    padding: 12,
    paddingBottom: 90,
  },

  // 1. Top Header & Status Bar
  topHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 20,
    marginTop: 4,
    width: '100%',
  },
  topHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 14,
  },
  greetingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  greetingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    marginRight: 8,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  greetingTitleMobile: {
    fontSize: 18,
  },
  greetingAdmin: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: -0.3,
  },
  greetingAdminMobile: {
    fontSize: 18,
  },
  greetingDesc: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  greetingDescMobile: {
    fontSize: 12,
    marginTop: 1,
    marginBottom: 6,
  },
  subHeaderControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
    gap: 10,
  },
  subHeaderControlsRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  filterControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterControlsGroupMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  dateFilterTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateFilterTabsMobile: {
    width: '100%',
    height: 42,
    padding: 3,
  },
  dateFilterTab: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateFilterTabMobile: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  dateFilterTabActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  dateFilterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
  dateFilterTabTextMobile: {
    fontSize: 12,
  },
  dateFilterTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dateSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dateSelectorPillMobile: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  dateSelectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dateSelectorTextMobile: {
    fontSize: 12,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 6,
  },
  onlineBadgeMobile: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  onlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  onlineTextMobile: {
    fontSize: 11,
  },

  // 2. KPI Cards Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  kpiGridMobile: {
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiCardMobile: {
    padding: 10,
    borderRadius: 13,
    gap: 8,
  },
  kpiCardNarrowPhone: {
    width: '100%',
  },
  kpiCardDesktop: {
    width: '23.8%',
    padding: 16,
  },
  kpiIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  kpiIconSquircleMobile: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  kpiPercentText: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiPercentTextMobile: {
    fontSize: 15,
  },
  kpiContentCol: {
    flex: 1,
    minWidth: 0,
  },
  kpiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
    marginRight: 4,
  },
  kpiCardTitleMobile: {
    fontSize: 10.5,
  },
  kpiCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  kpiCardValueMobile: {
    fontSize: 15.5,
    marginTop: 2,
    marginBottom: 2,
  },
  kpiCardTrend: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  kpiCardTrendMobile: {
    fontSize: 9.5,
  },

  // 3. Charts 2x2 Grid
  chartsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chartsRowMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chartCardMobile: {
    padding: 10,
    borderRadius: 12,
  },
  chartCardHalf: {
    flex: 1,
    minWidth: 0,
  },
  chartCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  chartCardTitleMobile: {
    fontSize: 13.5,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 28,
    gap: 6,
  },
  headerBadgeContainer: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  hoverBadgePill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  hoverBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  inlineLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chartLegendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Donut Layout & Svg
  donutSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 18,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  donutSvgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  donutCenterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 15,
  },
  donutCenterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  donutCenterPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
  },
  modeCenterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCenterLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 11,
  },
  modeCenterValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 1,
    paddingHorizontal: 2,
    letterSpacing: -0.2,
  },
  modeCenterPercent: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 11,
    marginTop: 1,
  },
  materialLegendList: {
    flex: 1,
    maxWidth: 340,
    gap: 6,
    minWidth: 175,
  },
  materialLegendListMobile: {
    minWidth: 0,
    width: '100%',
    marginTop: 8,
    gap: 6,
  },
  materialLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    cursor: 'pointer',
  },
  materialLegendItemHovered: {
    backgroundColor: '#f1f5f9',
  },
  materialLegendLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
  },
  legendColorBox: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
  },

  // Header Icon Badge
  chartTitleBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Pie Chart Layout Styles (Matching reference image)
  pieChartContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 8,
    width: '100%',
  },
  pieChartContainerRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  pieSvgWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieSvgWrapDesktop: {
    flex: 1,
    minWidth: 0,
  },
  pieSvgWrapMobile: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  pieLegendCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    gap: 2,
    flex: 1,
    minWidth: 210,
    maxWidth: 260,
  },
  pieLegendCardMobile: {
    width: '100%',
    marginTop: 8,
    padding: 8,
    gap: 2,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 6,
    cursor: 'pointer',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pieLegendRowHovered: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  pieLegendBullet: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 7,
    flexShrink: 0,
  },
  pieLegendCol: {
    flex: 1,
    justifyContent: 'center',
  },
  pieLegendLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 13,
  },
  pieLegendAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 14,
    marginTop: 1,
  },
  pieLegendPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 6,
    minWidth: 26,
    textAlign: 'right',
  },

  // Mode Legend Table (Legacy fallback)
  modeLegendTable: {
    flex: 1,
    maxWidth: 325,
    gap: 3.5,
    minWidth: 180,
  },

  // Line Chart Wrap
  lineChartWrap: {
    width: '100%',
    paddingTop: 2,
  },

  // Stacked Bar Chart Styles (Matching reference image)
  stackedChartCard: {
    paddingBottom: 12,
  },
  stackedBarHeaderRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stackedChartMainTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  stackedBarLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  stackedBarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stackedLegendBox: {
    width: 11,
    height: 11,
    borderRadius: 1,
  },
  stackedLegendText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#1e293b',
  },
});
