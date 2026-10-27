import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const formatSavedInLabel = (val) => {
  if (!val) return 'Sale';
  return String(val).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatINR = (val) => Number(val || 0).toLocaleString('en-IN');

export const AllEntriesView = React.memo(({ entries, loading, onOpenAddModal, onOpenImportModal, onRefresh, onViewInvoice, onEditEntry }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Render limit for mobile card view to prevent rendering 100+ cards at once
  const [cardRenderLimit, setCardRenderLimit] = useState(25);

  // On mobile default to 'cards', on desktop default to 'table'
  const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // Filters State: Date, Sale Type, Sales Mode, Material, Party, Source, Column Filters
  const [selectedDate, setSelectedDate] = useState('All');
  const [selectedType, setSelectedType] = useState('All'); // Acts as Sale Type (Royalty Sale / Without Royalty)
  const [selectedMode, setSelectedMode] = useState('All'); // Acts as Sales Mode (Cash, Bank, QR, Credit Sale)
  const [selectedMaterial, setSelectedMaterial] = useState('All');
  const [selectedParty, setSelectedParty] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');
  const [colFilters, setColFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [mobilePicker, setMobilePicker] = useState(null);

  // Unique options extracted dynamically from current entries
  const uniqueDates = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.date && String(e.date).trim()) {
        set.add(String(e.date).trim());
      }
    });
    return Array.from(set).sort().reverse();
  }, [entries]);

  const uniqueSaleTypes = useMemo(() => {
    return ['Royalty Sale', 'Without Royalty'];
  }, []);

  const uniqueSalesModes = useMemo(() => {
    const set = new Set();
    set.add('Cash');
    set.add('Bank');
    set.add('QR');
    set.add('Credit Sale');
    entries.forEach((e) => {
      if (e.payment_mode && String(e.payment_mode).trim()) {
        set.add(String(e.payment_mode).trim());
      }
    });
    return Array.from(set);
  }, [entries]);

  const uniqueTypes = uniqueSaleTypes;
  const uniqueModes = uniqueSalesModes;

  const uniqueMaterials = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.material_name && String(e.material_name).trim()) {
        set.add(String(e.material_name).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const uniqueParties = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.party_name && String(e.party_name).trim()) {
        set.add(String(e.party_name).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const countsBySource = useMemo(() => {
    let excel = 0;
    let manual = 0;
    entries.forEach((e) => {
      const src = String(e.entry_source || 'excel').trim().toLowerCase();
      if (src === 'manual') manual += 1;
      else excel += 1;
    });
    return { total: entries.length, excel, manual };
  }, [entries]);

  // Combined filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // 0. Quick Search across major fields (Challan, Vehicle, Party, Customer, Material, ETP, etc.)
      if (searchTerm && searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const challan = String(entry.challan_no || '').toLowerCase();
        const vehicle = String(entry.vehicle_no || '').toLowerCase();
        const party = String(entry.party_name || '').toLowerCase();
        const customer = String(entry.customer_name || '').toLowerCase();
        const material = String(entry.material_name || '').toLowerCase();
        const transport = String(entry.transport_type || '').toLowerCase();
        const etp = String(entry.etp_no || '').toLowerCase();
        const date = String(entry.date || '').toLowerCase();
        const mode = String(entry.payment_mode || entry.type_mode || '').toLowerCase();

        const match =
          challan.includes(q) ||
          vehicle.includes(q) ||
          party.includes(q) ||
          customer.includes(q) ||
          material.includes(q) ||
          transport.includes(q) ||
          etp.includes(q) ||
          date.includes(q) ||
          mode.includes(q);

        if (!match) return false;
      }

      // 1. Date Filter
      if (selectedDate !== 'All') {
        if (String(entry.date || '').trim() !== selectedDate.trim()) {
          return false;
        }
      }

      // 2. Sale Type Filter (Royalty Sale vs Without Royalty)
      if (selectedType !== 'All') {
        const target = selectedType.trim().toLowerCase();
        const entrySaleType = String(entry.sale_type || entry.hr_loading_type || '').trim().toLowerCase();
        if (target.includes('royalt') && !target.includes('without')) {
          if (!entrySaleType.includes('royalt') || entrySaleType.includes('without')) {
            return false;
          }
        } else if (target.includes('without')) {
          if (!entrySaleType.includes('without')) {
            return false;
          }
        } else if (entrySaleType !== target) {
          return false;
        }
      }

      // 3. Sales Mode Filter (Cash, Bank, QR, Credit Sale, Party)
      if (selectedMode !== 'All') {
        const sm = selectedMode.trim().toLowerCase();
        const pm = String(entry.payment_mode || '').trim().toLowerCase();
        const tm = String(entry.type_mode || '').trim().toLowerCase();
        const pty = String(entry.party_name || '').trim().toLowerCase();

        if (sm === 'cash') {
          if (!tm.includes('cash') || (pm && pm !== 'cash')) return false;
        } else if (sm === 'bank') {
          if (pm !== 'bank') return false;
        } else if (sm === 'qr') {
          if (pm !== 'qr') return false;
        } else if (sm === 'credit sale' || sm === 'credit') {
          if (!tm.includes('credit')) return false;
        } else {
          if (pm !== sm && !tm.includes(sm) && !pty.includes(sm)) {
            return false;
          }
        }
      }

      // 4. Material Name Filter
      if (selectedMaterial !== 'All') {
        const mat = String(entry.material_name || '').trim().toLowerCase();
        if (mat !== selectedMaterial.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Party Wise Filter
      if (selectedParty !== 'All') {
        const pty = String(entry.party_name || '').trim().toLowerCase();
        if (pty !== selectedParty.trim().toLowerCase()) {
          return false;
        }
      }

      // 6. Source Filter (Excel Import vs Manual Entry)
      if (selectedSource !== 'All') {
        const src = String(entry.entry_source || 'excel').trim().toLowerCase();
        if (selectedSource === 'Excel Import' && src !== 'excel') {
          return false;
        }
        if (selectedSource === 'Manual Entry' && src !== 'manual') {
          return false;
        }
      }

      // 7. Column-level text search filters
      if (colFilters && Object.keys(colFilters).length > 0) {
        const addName = (entry.additional_charge_name || '').toLowerCase();
        const addAmt = Number(entry.additional_charge_amount || 0);
        const isRoyalty = addName.includes('royalt') || (entry.sale_type === 'Royalty Sale' && addAmt > 0 && !addName.includes('freight'));
        const royaltyVal = isRoyalty && addAmt > 0 ? String(addAmt) : '-';
        const isFreight = addName.includes('freight') || addName.includes('freigth') || (!isRoyalty && addAmt > 0);
        const freightVal = isFreight && addAmt > 0 ? String(addAmt) : '-';

        const isMpParty = !entry.party_state || entry.party_state.toLowerCase().includes('madhya pradesh') || entry.party_state.toLowerCase() === 'mp';
        const cgstVal = entry.cgst_amount > 0 ? String(entry.cgst_amount) : (entry.gst_amount > 0 && isMpParty ? String(entry.gst_amount / 2) : '-');
        const sgstVal = entry.sgst_amount > 0 ? String(entry.sgst_amount) : (entry.gst_amount > 0 && isMpParty ? String(entry.gst_amount / 2) : '-');
        const igstVal = entry.igst_amount > 0 ? String(entry.igst_amount) : (entry.gst_amount > 0 && !isMpParty ? String(entry.gst_amount) : '-');

        const salesModeVal = entry.type_mode === 'Cash Sale'
          ? (entry.payment_mode || 'Cash')
          : entry.type_mode === 'Credit Sale'
          ? (entry.party_name || 'Credit Sale')
          : (entry.type_mode || '-');

        const customerNameVal = entry.type_mode === 'Cash Sale'
          ? (entry.customer_name || '-')
          : entry.type_mode === 'Credit Sale'
          ? 'NA'
          : (entry.customer_name || '-');

        const cells = {
          date: String(entry.date || ''),
          challan_no: String(entry.challan_no || ''),
          vehicle_no: String(entry.vehicle_no || ''),
          transport_type: String(entry.transport_type || ''),
          sales_mode: String(salesModeVal),
          customer_name: String(customerNameVal),
          sale_type: String(entry.sale_type || entry.hr_loading_type || ''),
          etp_no: String(entry.etp_no || ''),
          cum: String(entry.cum || ''),
          g_wt: String(entry.g_wt || ''),
          t_wt: String(entry.t_wt || ''),
          net_wt: String(entry.net_wt || ''),
          rate: String(entry.rate || ''),
          amount: String(entry.amount || ''),
          royalty: royaltyVal,
          freight: freightVal,
          cgst: cgstVal,
          sgst: sgstVal,
          igst: igstVal,
          gross_amount: String(entry.total_amount || entry.amount || ''),
        };

        for (const [key, filterVal] of Object.entries(colFilters)) {
          if (filterVal && filterVal.trim()) {
            const cellText = (cells[key] || '').toLowerCase();
            const query = filterVal.trim().toLowerCase();
            if (!cellText.includes(query)) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [entries, selectedDate, selectedType, selectedMode, selectedMaterial, selectedParty, selectedSource, colFilters, searchTerm]);

  const hasActiveFilter =
    selectedDate !== 'All' ||
    selectedType !== 'All' ||
    selectedMode !== 'All' ||
    selectedMaterial !== 'All' ||
    selectedParty !== 'All' ||
    selectedSource !== 'All' ||
    Boolean(searchTerm && searchTerm.trim()) ||
    Object.values(colFilters).some((v) => v && v.trim());

  const handleClearFilters = () => {
    setSelectedDate('All');
    setSelectedType('All');
    setSelectedMode('All');
    setSelectedMaterial('All');
    setSelectedParty('All');
    setSelectedSource('All');
    setSearchTerm('');
    setColFilters({});
  };

  const isAllSelected = filteredEntries.length > 0 && selectedIds.size === filteredEntries.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDelete = async () => {
    if (entries.length === 0) {
      alert('No entries available to delete.');
      return;
    }

    let targetEntries = [];
    if (selectedIds.size === 0) {
      const confirmAll = Platform.OS === 'web'
        ? window.confirm(`No entries selected. Would you like to select ALL ${filteredEntries.length} currently visible entries and delete them?`)
        : false;
      if (!confirmAll) {
        return;
      }
      targetEntries = filteredEntries;
    } else {
      const count = selectedIds.size;
      const confirmDelete = Platform.OS === 'web'
        ? window.confirm(`Are you sure you want to delete ${count} selected ${count === 1 ? 'entry' : 'entries'} directly from MongoDB? This cannot be undone.`)
        : true;
      if (!confirmDelete) {
        return;
      }
      targetEntries = filteredEntries.filter((e) => selectedIds.has(e.id));
    }

    try {
      setDeleting(true);
      const payload = targetEntries.map((e) => ({
        id: e.id,
        saved_in: e.saved_in,
      }));
      await api.bulkDeleteEntries(payload);
      setSelectedIds(new Set());
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Delete entries error:', err);
      alert(err.message || 'Failed to delete entries');
    } finally {
      setDeleting(false);
    }
  };

  const getBadgeColor = (savedIn) => {
    switch (savedIn) {
      case 'royalty_sale':
        return { bg: '#fef3c7', text: '#b45309' };
      case 'without_royalty':
        return { bg: '#f1f5f9', text: '#475569' };
      case 'credit_sale':
        return { bg: '#fee2e2', text: '#b91c1c' };
      case 'cash_sale':
        return { bg: '#dcfce7', text: '#15803d' };
      default:
        return { bg: '#e2e8f0', text: '#334155' };
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER & CONTROLS: Mobile (matching reference image media_1792651587761.png) vs Desktop */}
      {isMobile ? (
        <View style={styles.mobileHeaderWrap}>
          {/* Row 1: Title & Count on left, List / Grid View Toggles on right */}
          <View style={styles.mobileTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.mobileTitleText}>All Entries</Text>
              <View style={[styles.mobileCountBadge, hasActiveFilter && styles.mobileCountBadgeFiltered]}>
                <Text style={[styles.mobileCountBadgeText, hasActiveFilter && styles.mobileCountBadgeTextFiltered]}>
                  {hasActiveFilter ? `${filteredEntries.length} / ${entries.length}` : entries.length}
                </Text>
              </View>
            </View>

            <View style={styles.mobileToggleGroup}>
              <TouchableOpacity
                style={[styles.mobileToggleBtn, viewMode === 'cards' && styles.mobileToggleBtnActive]}
                onPress={() => setViewMode('cards')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={viewMode === 'cards' ? '#0284c7' : '#64748b'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mobileToggleBtn, viewMode === 'table' && styles.mobileToggleBtnActive]}
                onPress={() => setViewMode('table')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="grid"
                  size={18}
                  color={viewMode === 'table' ? '#0284c7' : '#64748b'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: Source Filter Pills (All | Excel | Manual) */}
          <View style={styles.mobileSourceRow}>
            <TouchableOpacity
              style={[styles.mobileSourceTab, selectedSource === 'All' && styles.mobileSourceTabActive]}
              onPress={() => setSelectedSource('All')}
              activeOpacity={0.75}
            >
              <Text style={[styles.mobileSourceTabText, selectedSource === 'All' && styles.mobileSourceTabTextActive]}>
                All ({countsBySource.total})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mobileSourceTab, selectedSource === 'Excel Import' && styles.mobileSourceTabActive]}
              onPress={() => setSelectedSource('Excel Import')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="document-text"
                size={13}
                color={selectedSource === 'Excel Import' ? '#ffffff' : '#10b981'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.mobileSourceTabText,
                  selectedSource === 'Excel Import' && styles.mobileSourceTabTextActive,
                  selectedSource !== 'Excel Import' && { color: '#059669' },
                ]}
              >
                Excel ({countsBySource.excel})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mobileSourceTab, selectedSource === 'Manual Entry' && styles.mobileSourceTabActive]}
              onPress={() => setSelectedSource('Manual Entry')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="sync"
                size={13}
                color={selectedSource === 'Manual Entry' ? '#ffffff' : '#0284c7'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.mobileSourceTabText,
                  selectedSource === 'Manual Entry' && styles.mobileSourceTabTextActive,
                  selectedSource !== 'Manual Entry' && { color: '#0284c7' },
                ]}
              >
                Manual ({countsBySource.manual})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Search Bar across all entries */}
          <View style={styles.mobileSearchRow}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.mobileSearchField}
              placeholder="Search Challan, Vehicle, Party, Material, ETP..."
              placeholderTextColor="#94a3b8"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Row 3: 2x2 Filter Dropdowns on Left + Add/Import Actions on Right */}
          <View style={styles.mobileFiltersActionsRow}>
            {/* Left: Filters Area (2x2 Grid) */}
            <View style={styles.mobileFiltersCol}>
              <View style={styles.mobileFiltersHeaderRow}>
                <View style={styles.mobileFiltersPill}>
                  <Ionicons name="funnel" size={12} color="#0284c7" style={{ marginRight: 4 }} />
                  <Text style={styles.mobileFiltersPillText}>Filters:</Text>
                </View>
                {hasActiveFilter && (
                  <TouchableOpacity onPress={handleClearFilters} style={styles.mobileResetPill} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={12} color="#ef4444" style={{ marginRight: 3 }} />
                    <Text style={styles.mobileResetPillText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.mobileFiltersGrid}>
                {/* Row 1: Date & Type */}
                <View style={styles.mobileFilterRow}>
                  {/* DATE Dropdown */}
                  <TouchableOpacity
                    style={[
                      styles.mobileFilterCard,
                      selectedDate !== 'All' && styles.mobileFilterCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      setMobilePicker({
                        title: 'Date',
                        options: uniqueDates,
                        current: selectedDate,
                        onSelect: setSelectedDate,
                      })
                    }
                  >
                    <Text style={[styles.mobileFilterCardLabel, selectedDate !== 'All' && styles.mobileFilterCardLabelActive]}>
                      DATE
                    </Text>
                    <View style={styles.mobileFilterCardValRow}>
                      <Text
                        style={[
                          styles.mobileFilterCardVal,
                          selectedDate !== 'All' && styles.mobileFilterCardValActive,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedDate === 'All' ? 'All Dates' : selectedDate}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={13}
                        color={selectedDate !== 'All' ? '#0284c7' : '#64748b'}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* SALE TYPE Dropdown */}
                  <TouchableOpacity
                    style={[
                      styles.mobileFilterCard,
                      selectedType !== 'All' && styles.mobileFilterCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      setMobilePicker({
                        title: 'Sale Type',
                        options: uniqueSaleTypes,
                        current: selectedType,
                        onSelect: setSelectedType,
                      })
                    }
                  >
                    <Text style={[styles.mobileFilterCardLabel, selectedType !== 'All' && styles.mobileFilterCardLabelActive]}>
                      SALE TYPE
                    </Text>
                    <View style={styles.mobileFilterCardValRow}>
                      <Text
                        style={[
                          styles.mobileFilterCardVal,
                          selectedType !== 'All' && styles.mobileFilterCardValActive,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedType === 'All' ? 'All Sale Types' : selectedType}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={13}
                        color={selectedType !== 'All' ? '#0284c7' : '#64748b'}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Row 2: Sales Mode & Material */}
                <View style={styles.mobileFilterRow}>
                  {/* SALES MODE Dropdown */}
                  <TouchableOpacity
                    style={[
                      styles.mobileFilterCard,
                      selectedMode !== 'All' && styles.mobileFilterCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      setMobilePicker({
                        title: 'Sales Mode',
                        options: uniqueSalesModes,
                        current: selectedMode,
                        onSelect: setSelectedMode,
                      })
                    }
                  >
                    <Text style={[styles.mobileFilterCardLabel, selectedMode !== 'All' && styles.mobileFilterCardLabelActive]}>
                      SALES MODE
                    </Text>
                    <View style={styles.mobileFilterCardValRow}>
                      <Text
                        style={[
                          styles.mobileFilterCardVal,
                          selectedMode !== 'All' && styles.mobileFilterCardValActive,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedMode === 'All' ? 'All Sales Modes' : selectedMode}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={13}
                        color={selectedMode !== 'All' ? '#0284c7' : '#64748b'}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* MATERIAL Dropdown */}
                  <TouchableOpacity
                    style={[
                      styles.mobileFilterCard,
                      selectedMaterial !== 'All' && styles.mobileFilterCardActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      setMobilePicker({
                        title: 'Material',
                        options: uniqueMaterials,
                        current: selectedMaterial,
                        onSelect: setSelectedMaterial,
                      })
                    }
                  >
                    <Text style={[styles.mobileFilterCardLabel, selectedMaterial !== 'All' && styles.mobileFilterCardLabelActive]}>
                      MATERIAL
                    </Text>
                    <View style={styles.mobileFilterCardValRow}>
                      <Text
                        style={[
                          styles.mobileFilterCardVal,
                          selectedMaterial !== 'All' && styles.mobileFilterCardValActive,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedMaterial === 'All' ? 'All Materials' : selectedMaterial}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={13}
                        color={selectedMaterial !== 'All' ? '#0284c7' : '#64748b'}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Right: Actions Column (Add Entry & Import Excel) */}
            <View style={styles.mobileActionsCol}>
              <TouchableOpacity
                style={styles.mobileAddBtn}
                onPress={onOpenAddModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 2 }} />
                <Text style={styles.mobileAddBtnText}>Add Entry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mobileImportBtn}
                onPress={onOpenImportModal}
                activeOpacity={0.85}
              >
                <Ionicons name="cloud-upload-outline" size={15} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.mobileImportBtnText}>Import Excel</Text>
              </TouchableOpacity>

              {selectedIds.size > 0 && (
                <TouchableOpacity
                  style={styles.mobileDeleteBtn}
                  onPress={handleDelete}
                  disabled={deleting}
                  activeOpacity={0.85}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.mobileDeleteBtnText}>Delete ({selectedIds.size})</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ) : (
        /* Desktop Top Action Bar & Filter Bar */
        <>
          <View style={styles.actionHeader}>
            <View style={styles.actionHeaderTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.titleText} numberOfLines={1}>All Entries</Text>
                <View style={[styles.countBadge, hasActiveFilter && styles.countBadgeFiltered]}>
                  <Text style={[styles.countText, hasActiveFilter && styles.countTextFiltered]}>
                    {hasActiveFilter ? `${filteredEntries.length} / ${entries.length}` : entries.length}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.toggleGroup}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'cards' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('cards')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="list"
                      size={15}
                      color={viewMode === 'cards' ? '#0284c7' : '#64748b'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'table' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('table')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="grid"
                      size={15}
                      color={viewMode === 'table' ? '#0284c7' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.addBtn} onPress={onOpenAddModal} activeOpacity={0.85}>
                  <Ionicons name="add" size={17} color="#ffffff" style={{ marginRight: 2 }} />
                  <Text style={styles.addBtnText}>Add Entry</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionHeaderBottomRow}>
              <View style={styles.sourceToggleGroup}>
                <TouchableOpacity
                  style={[styles.sourcePillBtn, selectedSource === 'All' && styles.sourcePillBtnActive]}
                  onPress={() => setSelectedSource('All')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sourcePillText, selectedSource === 'All' && styles.sourcePillTextActive]}>
                    All ({countsBySource.total})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourcePillBtn, selectedSource === 'Excel Import' && styles.sourcePillBtnActive]}
                  onPress={() => setSelectedSource('Excel Import')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text" size={12} color={selectedSource === 'Excel Import' ? '#047857' : '#059669'} style={{ marginRight: 3 }} />
                  <Text style={[styles.sourcePillText, selectedSource === 'Excel Import' && styles.sourcePillTextActive, { color: selectedSource === 'Excel Import' ? '#047857' : '#059669' }]}>
                    Excel ({countsBySource.excel})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourcePillBtn, selectedSource === 'Manual Entry' && styles.sourcePillBtnActive]}
                  onPress={() => setSelectedSource('Manual Entry')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={12} color={selectedSource === 'Manual Entry' ? '#0284c7' : '#0284c7'} style={{ marginRight: 3 }} />
                  <Text style={[styles.sourcePillText, selectedSource === 'Manual Entry' && styles.sourcePillTextActive, { color: selectedSource === 'Manual Entry' ? '#0369a1' : '#0284c7' }]}>
                    Manual ({countsBySource.manual})
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedIds.size > 0 && (
                  <TouchableOpacity
                    style={[styles.deleteBtn, styles.deleteBtnActive]}
                    onPress={handleDelete}
                    disabled={deleting}
                    activeOpacity={0.8}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="trash-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                    )}
                    <Text style={styles.deleteBtnTextActive}>Delete ({selectedIds.size})</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.importExcelBtn}
                  onPress={onOpenImportModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cloud-upload-outline" size={15} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.importExcelBtnText}>Import Excel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.filterBar}>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBarScroll}
            >
              <View style={styles.filterTitleGroup}>
                <Ionicons name="funnel" size={14} color="#0284c7" style={{ marginRight: 5 }} />
                <Text style={styles.filterBarTitle}>Filters:</Text>
              </View>

              <View style={styles.filterControl}>
                <Text style={styles.filterLabel}>Date</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      ...styles.webSelectStyle,
                      borderColor: selectedDate !== 'All' ? '#0284c7' : '#cbd5e1',
                      backgroundColor: selectedDate !== 'All' ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <option value="All">All Dates</option>
                    {uniqueDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TouchableOpacity
                    style={[styles.mobileFilterBtn, selectedDate !== 'All' && styles.mobileFilterBtnActive]}
                    onPress={() => setMobilePicker({ title: 'Date', options: uniqueDates, current: selectedDate, onSelect: setSelectedDate })}
                  >
                    <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                      {selectedDate === 'All' ? 'All Dates' : selectedDate}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterControl}>
                <Text style={styles.filterLabel}>Sale Type</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    style={{
                      ...styles.webSelectStyle,
                      borderColor: selectedType !== 'All' ? '#0284c7' : '#cbd5e1',
                      backgroundColor: selectedType !== 'All' ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <option value="All">All Sale Types</option>
                    {uniqueSaleTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TouchableOpacity
                    style={[styles.mobileFilterBtn, selectedType !== 'All' && styles.mobileFilterBtnActive]}
                    onPress={() => setMobilePicker({ title: 'Sale Type', options: uniqueSaleTypes, current: selectedType, onSelect: setSelectedType })}
                  >
                    <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                      {selectedType === 'All' ? 'All Sale Types' : selectedType}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterControl}>
                <Text style={styles.filterLabel}>Sales Mode</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    style={{
                      ...styles.webSelectStyle,
                      borderColor: selectedMode !== 'All' ? '#0284c7' : '#cbd5e1',
                      backgroundColor: selectedMode !== 'All' ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <option value="All">All Sales Modes</option>
                    {uniqueSalesModes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TouchableOpacity
                    style={[styles.mobileFilterBtn, selectedMode !== 'All' && styles.mobileFilterBtnActive]}
                    onPress={() => setMobilePicker({ title: 'Sales Mode', options: uniqueSalesModes, current: selectedMode, onSelect: setSelectedMode })}
                  >
                    <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                      {selectedMode === 'All' ? 'All Sales Modes' : selectedMode}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterControl}>
                <Text style={styles.filterLabel}>Material</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    style={{
                      ...styles.webSelectStyle,
                      borderColor: selectedMaterial !== 'All' ? '#0284c7' : '#cbd5e1',
                      backgroundColor: selectedMaterial !== 'All' ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <option value="All">All Materials</option>
                    {uniqueMaterials.map((mat) => (
                      <option key={mat} value={mat}>
                        {mat}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TouchableOpacity
                    style={[styles.mobileFilterBtn, selectedMaterial !== 'All' && styles.mobileFilterBtnActive]}
                    onPress={() => setMobilePicker({ title: 'Material', options: uniqueMaterials, current: selectedMaterial, onSelect: setSelectedMaterial })}
                  >
                    <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                      {selectedMaterial === 'All' ? 'All Materials' : selectedMaterial}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterControl}>
                <Text style={styles.filterLabel}>Party</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={selectedParty}
                    onChange={(e) => setSelectedParty(e.target.value)}
                    style={{
                      ...styles.webSelectStyle,
                      minWidth: 140,
                      maxWidth: 210,
                      borderColor: selectedParty !== 'All' ? '#0284c7' : '#cbd5e1',
                      backgroundColor: selectedParty !== 'All' ? '#f0f9ff' : '#ffffff',
                    }}
                  >
                    <option value="All">All Parties</option>
                    {uniqueParties.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TouchableOpacity
                    style={[styles.mobileFilterBtn, selectedParty !== 'All' && styles.mobileFilterBtnActive]}
                    onPress={() => setMobilePicker({ title: 'Party', options: uniqueParties, current: selectedParty, onSelect: setSelectedParty })}
                  >
                    <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                      {selectedParty === 'All' ? 'All Parties' : selectedParty}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {hasActiveFilter && (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={handleClearFilters}
                  activeOpacity={0.7}
                  title="Reset all filters"
                >
                  <Ionicons name="close-circle" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                  <Text style={styles.clearFilterBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </>
      )}

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading delivery entries from MongoDB...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={54} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Entries Found</Text>
          <Text style={styles.emptySubtitle}>Click "+ Add" to create your first delivery entry.</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={onOpenAddModal}>
            <Text style={styles.emptyAddBtnText}>+ Create New Entry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="filter-circle-outline" size={54} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Entries Match Selected Filters</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting or resetting your Date, Type, Mode, Material, or Party filters.
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={handleClearFilters}>
            <Text style={styles.emptyAddBtnText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'cards' ? (
        /* Mobile Card View */
        <ScrollView style={styles.cardListScroll} contentContainerStyle={styles.cardListContainer}>
          {filteredEntries.length > 0 && (
            <View style={styles.cardSelectAllBar}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={toggleSelectAll}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isAllSelected ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={selectedIds.size > 0 ? '#0284c7' : '#94a3b8'}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cardSelectAllText}>
                  {isAllSelected ? 'Deselect All' : `Select All (${filteredEntries.length})`}
                </Text>
              </TouchableOpacity>
              {selectedIds.size > 0 && (
                <Text style={styles.selectedCountText}>
                  {selectedIds.size} of {filteredEntries.length} selected
                </Text>
              )}
            </View>
          )}

          {filteredEntries.slice(0, cardRenderLimit).map((entry, idx) => {
            const isSelected = selectedIds.has(entry.id);
            return (
              <View key={entry.id || idx} style={[styles.refEntryCard, isSelected && styles.refEntryCardSelected]}>
                {/* 1. Header Strip: Column Names */}
                <View style={styles.refCardHeaderStrip}>
                  <View style={{ width: 28 }} />
                  <Text style={[styles.refCardHeaderCol, { flex: 1.1 }]}>DATE</Text>
                  <Text style={[styles.refCardHeaderCol, { flex: 1 }]}>CHALLANNO</Text>
                  <Text style={[styles.refCardHeaderCol, { flex: 1.3 }]}>VEHICLENO</Text>
                  <Text style={[styles.refCardHeaderCol, { flex: 1.2 }]}>TRANSPORT NAME</Text>
                </View>

                {/* 2. Sub-header: Values Row with Checkbox */}
                <View style={styles.refCardSubHeaderRow}>
                  <TouchableOpacity
                    onPress={() => toggleSelectOne(entry.id)}
                    style={styles.refCardCheckboxWrap}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={isSelected ? '#0284c7' : '#94a3b8'}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.refCardSubVal, { flex: 1.1 }]} numberOfLines={1}>
                    {entry.date || '-'}
                  </Text>
                  <Text style={[styles.refCardSubValBold, { flex: 1 }]} numberOfLines={1}>
                    {entry.challan_no || '-'}
                  </Text>
                  <Text style={[styles.refCardSubVal, { flex: 1.3 }]} numberOfLines={1}>
                    {entry.vehicle_no || '-'}
                  </Text>
                  <Text style={[styles.refCardSubVal, { flex: 1.2 }]} numberOfLines={1}>
                    {entry.transport_type || '-'}
                  </Text>
                </View>

                {/* 3. Divider */}
                <View style={styles.refCardDivider} />

                {/* 4. 2-Column Key-Value Grid */}
                <View style={styles.refCardGridBody}>
                  {/* Row 1: SALES MODE | CUSTOMER NAME */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>SALES MODE</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.type_mode === 'Cash Sale'
                          ? (entry.payment_mode || 'Cash')
                          : entry.type_mode === 'Credit Sale'
                          ? (entry.party_name || 'Credit Sale')
                          : (entry.type_mode || 'N/A')}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>CUSTOMER NAME</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.type_mode === 'Cash Sale'
                          ? (entry.customer_name || '-')
                          : entry.type_mode === 'Credit Sale'
                          ? 'NA'
                          : (entry.customer_name || '-')}
                      </Text>
                    </View>
                  </View>

                  {/* Row 2: SALES TYPE | ETP NO. */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>SALES TYPE</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.sale_type || entry.hr_loading_type || '-'}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>ETP NO.</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.etp_no || '-'}
                      </Text>
                    </View>
                  </View>

                  {/* Row 3: CUM | G Wt */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>CUM</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.cum || 0}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>G WT</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {Number(entry.g_wt || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Row 4: T Wt | Net Wt */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>T WT</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {Number(entry.t_wt || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>NET WT</Text>
                      <Text style={[styles.refCardFieldVal, styles.refCardNetWtVal]} numberOfLines={1}>
                        {Number(entry.net_wt || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Row 5: RATE | AMOUNT */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>RATE</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        ₹{entry.rate || 0}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>AMOUNT</Text>
                      <Text style={[styles.refCardFieldVal, styles.refCardAmountVal]} numberOfLines={1}>
                        ₹{Number(entry.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  {/* Row 6: ROYALTY / FREIGHT | GROSS AMOUNT */}
                  <View style={styles.refCardGridRow}>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>ROYALTY / FREIGHT</Text>
                      <Text style={styles.refCardFieldVal} numberOfLines={1}>
                        {entry.additional_charge_amount ? `₹${Number(entry.additional_charge_amount).toLocaleString('en-IN')}` : '-'}
                      </Text>
                    </View>
                    <View style={styles.refCardGridCol}>
                      <Text style={styles.refCardFieldLabel}>GROSS AMOUNT</Text>
                      <Text style={[styles.refCardFieldVal, styles.refCardTotalVal]} numberOfLines={1}>
                        ₹{Number(entry.total_amount || entry.amount || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 5. Footer Row: Truck Icon Badge on Left | Source Badge on Right */}
                <View style={styles.refCardFooterRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.refTruckBadge}>
                      <Ionicons name="bus" size={13} color="#7c3aed" style={{ marginRight: 5 }} />
                      <Text style={styles.refTruckBadgeText} numberOfLines={1}>
                        {entry.saved_in || 'hr_loading'}
                      </Text>
                    </View>
                    {onViewInvoice && (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#ecfdf5',
                          borderColor: '#a7f3d0',
                          borderWidth: 1,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          marginLeft: 6,
                        }}
                        onPress={() => onViewInvoice(entry)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="receipt-outline" size={13} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>Slip</Text>
                      </TouchableOpacity>
                    )}
                    {onEditEntry && (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#eff6ff',
                          borderColor: '#bfdbfe',
                          borderWidth: 1,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: 6,
                          marginLeft: 6,
                        }}
                        onPress={() => onEditEntry(entry)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil-outline" size={13} color="#2563eb" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.refSourcePill, entry.entry_source === 'manual' ? styles.refSourcePillManual : styles.refSourcePillExcel]}>
                    <Text style={[styles.refSourcePillText, entry.entry_source === 'manual' ? styles.refSourcePillTextManual : styles.refSourcePillTextExcel]}>
                      {entry.entry_source === 'manual' ? 'Manual' : 'Excel'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
          {filteredEntries.length > cardRenderLimit && (
            <View style={styles.loadMoreCard}>
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setCardRenderLimit((prev) => prev + 30)}
                activeOpacity={0.8}
                delayPressIn={0}
              >
                <Text style={styles.loadMoreBtnText}>
                  Load More Entries ({Math.min(cardRenderLimit, filteredEntries.length)} of {filteredEntries.length})
                </Text>
                <Ionicons name="chevron-down" size={16} color="#0284c7" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loadAllBtn}
                onPress={() => setCardRenderLimit(filteredEntries.length)}
                activeOpacity={0.8}
                delayPressIn={0}
              >
                <Text style={styles.loadAllBtnText}>Show All ({filteredEntries.length})</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        /* Full Desktop Spreadsheet Table */
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
          <View style={styles.tableWrapper}>
            <View style={styles.tableHeaderRow}>
              {/* Select All Checkbox */}
              <TouchableOpacity
                style={[styles.thCell, { width: 44, alignItems: 'center', justifyContent: 'center' }]}
                onPress={toggleSelectAll}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isAllSelected ? 'checkbox' : 'square-outline'}
                  size={17}
                  color={selectedIds.size > 0 ? '#0284c7' : '#94a3b8'}
                />
              </TouchableOpacity>
              <Text style={[styles.thCell, { width: 68, textAlign: 'center' }]}>SLIP</Text>
              <Text style={[styles.thCell, { width: 68, textAlign: 'center' }]}>EDIT</Text>
              <Text style={[styles.thCell, { width: 95 }]}>DATE</Text>
              <Text style={[styles.thCell, { width: 110 }]}>CHALLAN NO.</Text>
              <Text style={[styles.thCell, { width: 115 }]}>VEHICLE NO</Text>
              <Text style={[styles.thCell, { width: 125 }]}>TRANSPORT Name</Text>
              <Text style={[styles.thCell, { width: 125 }]}>SALES Mode</Text>
              <Text style={[styles.thCell, { width: 130 }]}>Customer Name</Text>
              <Text style={[styles.thCell, { width: 120 }]}>Sales Type</Text>
              <Text style={[styles.thCell, { width: 105 }]}>ETP No.</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 75 }]}>CUM</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>G Wt</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>T Wt</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>Net Wt</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 80 }]}>Rate</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 95 }]}>Amount</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 90 }]}>Royalty</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 90 }]}>Freight</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>CGST</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>SGST</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>IGST</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 115 }]}>Gross Amount</Text>
            </View>

            {/* Row-level Search Filter Inputs for every column (perfect column-wise alignment) */}
            <View style={styles.tableFilterRow}>
              {/* Checkbox column */}
              <View style={[styles.thFilterCell, { width: 44, alignItems: 'center', justifyContent: 'center' }]}>
                {Object.values(colFilters).some((v) => v && v.trim()) ? (
                  <TouchableOpacity
                    onPress={() => setColFilters({})}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    title="Clear all column filters"
                  >
                    <Ionicons name="close-circle" size={17} color="#ef4444" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="search" size={14} color="#64748b" />
                )}
              </View>

              {/* SLIP column */}
              <View style={[styles.thFilterCell, { width: 68, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>-</Text>
              </View>

              {/* EDIT column */}
              <View style={[styles.thFilterCell, { width: 68, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>-</Text>
              </View>

              {/* DATE */}
              <View style={[styles.thFilterCell, { width: 95 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Date"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.date || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, date: txt }))}
                />
              </View>

              {/* CHALLAN NO. */}
              <View style={[styles.thFilterCell, { width: 110 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Challan"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.challan_no || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, challan_no: txt }))}
                />
              </View>

              {/* VEHICLE NO */}
              <View style={[styles.thFilterCell, { width: 115 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Vehicle"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.vehicle_no || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, vehicle_no: txt }))}
                />
              </View>

              {/* TRANSPORT Name */}
              <View style={[styles.thFilterCell, { width: 125 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Transport"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.transport_type || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, transport_type: txt }))}
                />
              </View>

              {/* SALES Mode */}
              <View style={[styles.thFilterCell, { width: 125 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Mode"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.sales_mode || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, sales_mode: txt }))}
                />
              </View>

              {/* Customer Name */}
              <View style={[styles.thFilterCell, { width: 130 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Customer"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.customer_name || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, customer_name: txt }))}
                />
              </View>

              {/* Sales Type */}
              <View style={[styles.thFilterCell, { width: 120 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="Type"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.sale_type || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, sale_type: txt }))}
                />
              </View>

              {/* ETP No. */}
              <View style={[styles.thFilterCell, { width: 105 }]}>
                <TextInput
                  style={styles.colSearchInput}
                  placeholder="ETP No."
                  placeholderTextColor="#94a3b8"
                  value={colFilters.etp_no || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, etp_no: txt }))}
                />
              </View>

              {/* CUM */}
              <View style={[styles.thFilterCell, { width: 75 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="CUM"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.cum || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, cum: txt }))}
                />
              </View>

              {/* G Wt */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="G Wt"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.g_wt || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, g_wt: txt }))}
                />
              </View>

              {/* T Wt */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="T Wt"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.t_wt || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, t_wt: txt }))}
                />
              </View>

              {/* Net Wt */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Net Wt"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.net_wt || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, net_wt: txt }))}
                />
              </View>

              {/* Rate */}
              <View style={[styles.thFilterCell, { width: 80 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Rate"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.rate || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, rate: txt }))}
                />
              </View>

              {/* Amount */}
              <View style={[styles.thFilterCell, { width: 95 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Amount"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.amount || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, amount: txt }))}
                />
              </View>

              {/* Royalty */}
              <View style={[styles.thFilterCell, { width: 90 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Royalty"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.royalty || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, royalty: txt }))}
                />
              </View>

              {/* Freight */}
              <View style={[styles.thFilterCell, { width: 90 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Freight"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.freight || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, freight: txt }))}
                />
              </View>

              {/* CGST */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="CGST"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.cgst || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, cgst: txt }))}
                />
              </View>

              {/* SGST */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="SGST"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.sgst || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, sgst: txt }))}
                />
              </View>

              {/* IGST */}
              <View style={[styles.thFilterCell, { width: 85 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="IGST"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.igst || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, igst: txt }))}
                />
              </View>

              {/* Gross Amount */}
              <View style={[styles.thFilterCell, { width: 115 }]}>
                <TextInput
                  style={[styles.colSearchInput, { textAlign: 'right' }]}
                  placeholder="Gross Amt"
                  placeholderTextColor="#94a3b8"
                  value={colFilters.gross_amount || ''}
                  onChangeText={(txt) => setColFilters((prev) => ({ ...prev, gross_amount: txt }))}
                />
              </View>
            </View>

            <ScrollView style={styles.tableBodyScroll}>
              {filteredEntries.map((entry, idx) => {
                const isEven = idx % 2 === 0;
                const isSelected = selectedIds.has(entry.id);

                const addName = (entry.additional_charge_name || '').toLowerCase();
                const addAmt = Number(entry.additional_charge_amount || 0);
                const isRoyalty = addName.includes('royalt') || (entry.sale_type === 'Royalty Sale' && addAmt > 0 && !addName.includes('freight'));
                const royaltyVal = isRoyalty && addAmt > 0 ? `₹${addAmt.toLocaleString()}` : '-';
                const isFreight = addName.includes('freight') || addName.includes('freigth') || (!isRoyalty && addAmt > 0);
                const freightVal = isFreight && addAmt > 0 ? `₹${addAmt.toLocaleString()}` : '-';

                const isMpParty = !entry.party_state || entry.party_state.toLowerCase().includes('madhya pradesh') || entry.party_state.toLowerCase() === 'mp';
                const cgstVal = entry.cgst_amount > 0 ? `₹${Number(entry.cgst_amount).toLocaleString()}` : (entry.gst_amount > 0 && isMpParty ? `₹${Number(entry.gst_amount / 2).toLocaleString()}` : '-');
                const sgstVal = entry.sgst_amount > 0 ? `₹${Number(entry.sgst_amount).toLocaleString()}` : (entry.gst_amount > 0 && isMpParty ? `₹${Number(entry.gst_amount / 2).toLocaleString()}` : '-');
                const igstVal = entry.igst_amount > 0 ? `₹${Number(entry.igst_amount).toLocaleString()}` : (entry.gst_amount > 0 && !isMpParty ? `₹${Number(entry.gst_amount).toLocaleString()}` : '-');

                return (
                  <View
                    key={entry.id || idx}
                    style={[
                      styles.tableRow,
                      isEven && styles.evenRow,
                      isSelected && styles.tableRowSelected,
                    ]}
                  >
                    {/* Row Checkbox */}
                    <TouchableOpacity
                      style={[styles.tdCell, { width: 44, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => toggleSelectOne(entry.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={17}
                        color={isSelected ? '#0284c7' : '#cbd5e1'}
                      />
                    </TouchableOpacity>
                    {/* Slip / Invoice Action */}
                    <TouchableOpacity
                      style={[styles.tdCell, { width: 68, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => onViewInvoice && onViewInvoice(entry)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#ecfdf5',
                        borderColor: '#a7f3d0',
                        borderWidth: 1,
                        paddingVertical: 2,
                        paddingHorizontal: 6,
                        borderRadius: 4,
                      }}>
                        <Ionicons name="receipt-outline" size={12} color="#059669" style={{ marginRight: 3 }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Slip</Text>
                      </View>
                    </TouchableOpacity>
                    {/* Edit Action */}
                    <TouchableOpacity
                      style={[styles.tdCell, { width: 68, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => onEditEntry && onEditEntry(entry)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#eff6ff',
                        borderColor: '#bfdbfe',
                        borderWidth: 1,
                        paddingVertical: 2,
                        paddingHorizontal: 6,
                        borderRadius: 4,
                      }}>
                        <Ionicons name="pencil-outline" size={12} color="#2563eb" style={{ marginRight: 3 }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563eb' }}>Edit</Text>
                      </View>
                    </TouchableOpacity>
                    {/* 1. DATE */}
                    <Text style={[styles.tdCell, { width: 95 }]}>{entry.date || '-'}</Text>
                    {/* 2. CHALLAN NO. */}
                    <Text style={[styles.tdCell, styles.boldCell, { width: 110 }]}>
                      {entry.challan_no || '-'}
                    </Text>
                    {/* 3. VEHICLE NO */}
                    <Text style={[styles.tdCell, { width: 115 }]}>{entry.vehicle_no || '-'}</Text>
                    {/* 4. TRANSPORT Name */}
                    <Text style={[styles.tdCell, { width: 125 }]}>{entry.transport_type || '-'}</Text>
                    {/* 5. SALES Mode */}
                    <Text style={[styles.tdCell, { width: 125 }]}>
                      {entry.type_mode === 'Cash Sale'
                        ? (entry.payment_mode || 'Cash')
                        : entry.type_mode === 'Credit Sale'
                        ? (entry.party_name || 'Credit Sale')
                        : (entry.type_mode || '-')}
                    </Text>
                    {/* 6. Customer Name */}
                    <Text style={[styles.tdCell, { width: 130 }]}>
                      {entry.type_mode === 'Cash Sale'
                        ? (entry.customer_name || '-')
                        : entry.type_mode === 'Credit Sale'
                        ? 'NA'
                        : (entry.customer_name || '-')}
                    </Text>
                    {/* 7. Sales Type */}
                    <Text style={[styles.tdCell, { width: 120 }]}>
                      {entry.sale_type || entry.hr_loading_type || '-'}
                    </Text>
                    {/* 8. ETP No. */}
                    <Text style={[styles.tdCell, { width: 105 }]}>{entry.etp_no || '-'}</Text>
                    {/* 9. CUM */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 75 }]}>
                      {entry.cum || 0}
                    </Text>
                    {/* 10. G Wt */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {(entry.g_wt || 0).toLocaleString()}
                    </Text>
                    {/* 11. T Wt */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {(entry.t_wt || 0).toLocaleString()}
                    </Text>
                    {/* 12. Net Wt */}
                    <Text style={[styles.tdCell, styles.tdRight, styles.highlightCell, { width: 85 }]}>
                      {(entry.net_wt || 0).toLocaleString()}
                    </Text>
                    {/* 13. Rate */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 80 }]}>₹{entry.rate || 0}</Text>
                    {/* 14. Amount */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 95 }]}>
                      ₹{(entry.amount || 0).toLocaleString()}
                    </Text>
                    {/* 15. Royalty */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 90 }]}>
                      {royaltyVal}
                    </Text>
                    {/* 16. Freight */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 90 }]}>
                      {freightVal}
                    </Text>
                    {/* 17. CGST */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {cgstVal}
                    </Text>
                    {/* 18. SGST */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {sgstVal}
                    </Text>
                    {/* 19. IGST */}
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {igstVal}
                    </Text>
                    {/* 20. Gross Amount */}
                    <Text style={[styles.tdCell, styles.tdRight, styles.boldCell, { width: 115, color: '#16a34a' }]}>
                      ₹{(entry.total_amount || entry.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Mobile Picker Modal */}
      {mobilePicker && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMobilePicker(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMobilePicker(null)}
          >
            <TouchableOpacity
              style={styles.mobilePickerBox}
              activeOpacity={1}
              onPress={(e) => {
                if (Platform.OS === 'web' && e?.stopPropagation) {
                  e.stopPropagation();
                }
              }}
            >
              <View style={styles.mobilePickerHeader}>
                <View>
                  <Text style={styles.mobilePickerTitle}>Select {mobilePicker.title}</Text>
                  <Text style={styles.mobilePickerSubtitle}>Choose an option to filter entries</Text>
                </View>
                <TouchableOpacity
                  style={styles.mobilePickerCloseBtn}
                  onPress={() => setMobilePicker(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobilePickerList} showsVerticalScrollIndicator={true}>
                <TouchableOpacity
                  style={[
                    styles.mobilePickerOption,
                    mobilePicker.current === 'All' && styles.mobilePickerOptionActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    mobilePicker.onSelect('All');
                    setMobilePicker(null);
                  }}
                >
                  <Text
                    style={[
                      styles.mobilePickerOptionText,
                      mobilePicker.current === 'All' && styles.mobilePickerOptionTextActive,
                    ]}
                  >
                    All {mobilePicker.title}s
                  </Text>
                  {mobilePicker.current === 'All' && (
                    <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
                  )}
                </TouchableOpacity>
                {mobilePicker.options.map((opt) => {
                  const isSelected = mobilePicker.current === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.mobilePickerOption,
                        isSelected && styles.mobilePickerOptionActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        mobilePicker.onSelect(opt);
                        setMobilePicker(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.mobilePickerOptionText,
                          isSelected && styles.mobilePickerOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {opt}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  actionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    gap: 10,
  },
  actionHeaderMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionHeaderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionHeaderBottomRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  countBadge: {
    marginLeft: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeFiltered: {
    backgroundColor: '#e0f2fe',
  },
  countText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  countTextFiltered: {
    color: '#0284c7',
    fontWeight: '700',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    padding: 2,
    marginRight: 6,
  },
  toggleBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 4,
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
  },
  deleteBtnActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtnTextActive: {
    color: '#ffffff',
  },
  importExcelBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
  },
  importExcelBtnText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  /* Filter Bar Styles */
  filterBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  filterBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  filterBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  filterControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 5,
    textTransform: 'uppercase',
  },
  webSelectStyle: {
    height: 32,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'solid',
    borderRadius: 6,
    paddingLeft: 8,
    paddingRight: 18,
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineStyle: 'none', cursor: 'pointer' } : {}),
    minWidth: 105,
    maxWidth: 165,
  },
  mobileFilterBtn: {
    height: 32,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 85,
  },
  mobileFilterBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  mobileFilterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    maxWidth: 90,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 4,
  },
  clearFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  /* Loading & Empty Styles */
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  /* Mobile Card Styles */
  cardListScroll: {
    flex: 1,
  },
  cardListContainer: {
    padding: 12,
    paddingBottom: 90,
  },
  cardSelectAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  cardSelectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  selectedCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284c7',
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  entryCardSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#f0f9ff',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  challanBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  challanText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0284c7',
  },
  cardDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  collectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  collectionBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardPartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 9,
  },
  cardPartyIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPartyLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  cardPartyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  cardChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  cardChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  cardMetricsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  metricColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  metricColVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardModeText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748b',
  },
  cardEtpText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  totalBox: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 9.5,
    color: '#059669',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
    marginTop: 1,
  },
  /* Table Styles */
  horizontalScroll: {
    flex: 1,
  },
  tableWrapper: {
    minWidth: 2100,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    paddingHorizontal: 6,
  },
  thRight: {
    textAlign: 'right',
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowSelected: {
    backgroundColor: '#eff6ff',
  },
  evenRow: {
    backgroundColor: '#fafbfc',
  },
  tdCell: {
    fontSize: 12,
    color: '#334155',
    paddingHorizontal: 6,
  },
  tdRight: {
    textAlign: 'right',
  },
  boldCell: {
    fontWeight: '700',
    color: '#0f172a',
  },
  highlightCell: {
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyAddBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  /* Modal Overlay */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mobilePickerBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    maxHeight: 440,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  mobilePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mobilePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobilePickerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mobilePickerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobilePickerList: {
    marginTop: 8,
  },
  mobilePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#ffffff',
  },
  mobilePickerOptionActive: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  mobilePickerOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  mobilePickerOptionTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  /* Quick Source Tabs & Badges */
  sourceToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
    marginLeft: 8,
  },
  sourcePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sourcePillBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  sourcePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  sourcePillTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sourceBadgeExcel: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 0.8,
  },
  sourceBadgeManual: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
    borderWidth: 0.8,
  },
  sourceBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  sourceBadgeTextExcel: {
    color: '#047857',
  },
  sourceBadgeTextManual: {
    color: '#0284c7',
  },
  loadMoreCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    width: '100%',
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  loadAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  loadAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textDecorationLine: 'underline',
  },

  /* Exact Mobile Layout Styles (Matching reference screenshot media_1792651587761.png) */
  mobileHeaderWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  mobileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  mobileTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  mobileCountBadge: {
    marginLeft: 8,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  mobileCountBadgeFiltered: {
    backgroundColor: '#bae6fd',
  },
  mobileCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  mobileCountBadgeTextFiltered: {
    color: '#0369a1',
  },
  mobileToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileToggleBtnActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
  },
  mobileSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileSourceTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileSourceTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  mobileSourceTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  mobileSourceTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mobileFiltersActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    paddingTop: 2,
  },
  mobileFiltersCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  mobileFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileFiltersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    alignSelf: 'flex-start',
  },
  mobileFiltersPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobileResetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
  },
  mobileResetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  mobileFiltersGrid: {
    gap: 6,
  },
  mobileFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  mobileFilterCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: 'relative',
  },
  mobileFilterCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  mobileFilterCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  mobileFilterCardLabelActive: {
    color: '#0284c7',
  },
  mobileFilterCardValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  mobileFilterCardVal: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  mobileFilterCardValActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  mobileActionsCol: {
    width: 100,
    flexShrink: 0,
    gap: 6,
    paddingTop: 23,
  },
  mobileAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 8,
  },
  mobileAddBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  mobileImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 6,
  },
  mobileImportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  mobileDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 6,
  },
  mobileDeleteBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Reference Entry Card Styles */
  refEntryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  refEntryCardSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f8fafc',
  },
  refCardHeaderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  refCardHeaderCol: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  refCardSubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  refCardCheckboxWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refCardSubVal: {
    fontSize: 11.5,
    color: '#1e293b',
    fontWeight: '500',
  },
  refCardSubValBold: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '800',
  },
  refCardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  refCardGridBody: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  refCardGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5.5,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  refCardGridCol: {
    flex: 1,
  },
  refCardFieldLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  refCardFieldVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  refCardNetWtVal: {
    color: '#0284c7',
    fontWeight: '800',
  },
  refCardAmountVal: {
    color: '#16a34a',
    fontWeight: '800',
  },
  refCardTotalVal: {
    color: '#16a34a',
    fontWeight: '800',
  },
  refDestinationPill: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  refDestinationPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
  refCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  refTruckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  refTruckBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
  refSourcePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  refSourcePillManual: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  refSourcePillExcel: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  refSourcePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  refSourcePillTextManual: {
    color: '#0284c7',
  },
  refSourcePillTextExcel: {
    color: '#16a34a',
  },
  tableFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thFilterCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colSearchInput: {
    height: 30,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 0,
    fontSize: 11,
    color: '#0f172a',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  mobileSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  mobileSearchField: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
});
