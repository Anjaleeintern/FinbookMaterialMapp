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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const formatSavedInLabel = (val) => {
  if (!val) return 'Sale';
  return String(val).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatINR = (val) => Number(val || 0).toLocaleString('en-IN');

export const AllEntriesView = ({ entries, loading, onOpenAddModal, onOpenImportModal, onRefresh }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // On mobile default to 'cards', on desktop default to 'table'
  const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // Filters State: Date, Type, Mode, Material, Party, Source
  const [selectedDate, setSelectedDate] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedMode, setSelectedMode] = useState('All');
  const [selectedMaterial, setSelectedMaterial] = useState('All');
  const [selectedParty, setSelectedParty] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');
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

  const uniqueTypes = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.type_mode && String(e.type_mode).trim()) {
        set.add(String(e.type_mode).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const uniqueModes = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.payment_mode && String(e.payment_mode).trim()) {
        set.add(String(e.payment_mode).trim());
      }
    });
    if (set.size === 0) {
      ['Cash', 'QR', 'Credit'].forEach((m) => set.add(m));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

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
      // 1. Date Filter
      if (selectedDate !== 'All') {
        if (String(entry.date || '').trim() !== selectedDate.trim()) {
          return false;
        }
      }

      // 2. Type Filter (Type/Mode)
      if (selectedType !== 'All') {
        const tm = String(entry.type_mode || '').trim().toLowerCase();
        if (tm !== selectedType.trim().toLowerCase()) {
          return false;
        }
      }

      // 3. Mode Filter (Payment Mode or mode substring)
      if (selectedMode !== 'All') {
        const sm = selectedMode.trim().toLowerCase();
        const pm = String(entry.payment_mode || '').trim().toLowerCase();
        const tm = String(entry.type_mode || '').trim().toLowerCase();
        if (pm !== sm && !tm.includes(sm)) {
          return false;
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

      return true;
    });
  }, [entries, selectedDate, selectedType, selectedMode, selectedMaterial, selectedParty, selectedSource]);

  const hasActiveFilter =
    selectedDate !== 'All' ||
    selectedType !== 'All' ||
    selectedMode !== 'All' ||
    selectedMaterial !== 'All' ||
    selectedParty !== 'All' ||
    selectedSource !== 'All';

  const handleClearFilters = () => {
    setSelectedDate('All');
    setSelectedType('All');
    setSelectedMode('All');
    setSelectedMaterial('All');
    setSelectedParty('All');
    setSelectedSource('All');
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
      case 'qr_sale':
        return { bg: '#e0e7ff', text: '#4338ca' };
      case 'hr_loading':
        return { bg: '#f3e8ff', text: '#7e22ce' };
      default:
        return { bg: '#e2e8f0', text: '#334155' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={[styles.actionHeader, isMobile && styles.actionHeaderMobile]}>
        {/* Row 1: Title, Count, View Mode Switcher, and Primary Add Button */}
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
            {/* View Mode Toggle: Grid / Table */}
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'cards' && styles.toggleBtnActive]}
                onPress={() => setViewMode('cards')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="grid"
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
                  name="list"
                  size={15}
                  color={viewMode === 'table' ? '#0284c7' : '#64748b'}
                />
              </TouchableOpacity>
            </View>

            {/* Primary Add Button */}
            <TouchableOpacity style={styles.addBtn} onPress={onOpenAddModal} activeOpacity={0.85}>
              <Ionicons name="add" size={17} color="#ffffff" style={{ marginRight: 2 }} />
              <Text style={styles.addBtnText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Source Filter Pills & Bulk Actions */}
        <View style={[styles.actionHeaderBottomRow, isMobile && styles.actionHeaderBottomRowMobile]}>
          {/* Quick Source Filter Tabs (All | Excel | Manual) */}
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
            {/* Delete Button (shown when items selected) */}
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

            {/* Import Excel Button */}
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

      {/* Filter Bar: Date, Type, Mode, Material, Party */}
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

          {/* Date Filter */}
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

          {/* Type Filter */}
          <View style={styles.filterControl}>
            <Text style={styles.filterLabel}>Type</Text>
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
                <option value="All">All Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <TouchableOpacity
                style={[styles.mobileFilterBtn, selectedType !== 'All' && styles.mobileFilterBtnActive]}
                onPress={() => setMobilePicker({ title: 'Type', options: uniqueTypes, current: selectedType, onSelect: setSelectedType })}
              >
                <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                  {selectedType === 'All' ? 'All Types' : selectedType}
                </Text>
                <Ionicons name="chevron-down" size={13} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Mode Filter */}
          <View style={styles.filterControl}>
            <Text style={styles.filterLabel}>Mode</Text>
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
                <option value="All">All Modes</option>
                {uniqueModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <TouchableOpacity
                style={[styles.mobileFilterBtn, selectedMode !== 'All' && styles.mobileFilterBtnActive]}
                onPress={() => setMobilePicker({ title: 'Mode', options: uniqueModes, current: selectedMode, onSelect: setSelectedMode })}
              >
                <Text style={styles.mobileFilterBtnText} numberOfLines={1}>
                  {selectedMode === 'All' ? 'All Modes' : selectedMode}
                </Text>
                <Ionicons name="chevron-down" size={13} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Material Name Filter */}
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

          {/* Party Wise Filter */}
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

          {/* Reset Filters Button */}
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

          {filteredEntries.map((entry, idx) => {
            const badge = getBadgeColor(entry.saved_in);
            const isSelected = selectedIds.has(entry.id);
            return (
              <View
                key={entry.id || idx}
                style={[styles.entryCard, isSelected && styles.entryCardSelected]}
              >
                {/* 1. Card Top Bar: Checkbox, Challan ID, Date, Source, and Mode badge */}
                <View style={styles.cardTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleSelectOne(entry.id)}
                      activeOpacity={0.7}
                      style={{ padding: 2 }}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? '#0284c7' : '#94a3b8'}
                      />
                    </TouchableOpacity>
                    <View style={styles.challanBadge}>
                      <Text style={styles.challanText}>{entry.challan_no}</Text>
                    </View>
                    <Text style={styles.cardDateText}>{entry.date}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.sourceBadge, entry.entry_source === 'manual' ? styles.sourceBadgeManual : styles.sourceBadgeExcel]}>
                      <Text style={[styles.sourceBadgeText, entry.entry_source === 'manual' ? styles.sourceBadgeTextManual : styles.sourceBadgeTextExcel]}>
                        {entry.entry_source === 'manual' ? 'Manual' : 'Excel'}
                      </Text>
                    </View>
                    <View style={[styles.collectionBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.collectionBadgeText, { color: badge.text }]}>
                        {formatSavedInLabel(entry.saved_in || entry.type_mode)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Prominent Party / Buyer Name */}
                <View style={styles.cardPartyRow}>
                  <View style={styles.cardPartyIconSquircle}>
                    <Ionicons name="business" size={14} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardPartyLabel}>PARTY / BUYER</Text>
                    <Text style={styles.cardPartyName} numberOfLines={2}>
                      {entry.party_name || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* 3. Vehicle, Transport, & Material Chips Row */}
                <View style={styles.cardChipsRow}>
                  <View style={styles.cardChipItem}>
                    <Ionicons name="car-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.cardChipText}>{entry.vehicle_no || 'N/A'}</Text>
                  </View>
                  <View style={styles.cardChipItem}>
                    <Ionicons name="bus-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                    <Text style={styles.cardChipText}>{entry.transport_type || 'N/A'}</Text>
                  </View>
                  <View style={[styles.cardChipItem, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Ionicons name="cube-outline" size={13} color="#16a34a" style={{ marginRight: 4 }} />
                    <Text style={[styles.cardChipText, { color: '#166534', fontWeight: '700' }]}>
                      {entry.material_name || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* 4. 4-Column Structured Metric Box (Gross, Tare, Net, Rate) */}
                <View style={styles.cardMetricsBox}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricColLabel}>GROSS WT</Text>
                    <Text style={styles.metricColVal}>{formatINR(entry.g_wt)}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text style={styles.metricColLabel}>TARE WT</Text>
                    <Text style={styles.metricColVal}>{formatINR(entry.t_wt)}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text style={[styles.metricColLabel, { color: '#0284c7' }]}>NET WT</Text>
                    <Text style={[styles.metricColVal, { color: '#0284c7', fontWeight: '800' }]}>
                      {formatINR(entry.net_wt)}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricCol}>
                    <Text style={styles.metricColLabel}>RATE</Text>
                    <Text style={styles.metricColVal}>₹{entry.rate || 0}</Text>
                  </View>
                </View>

                {/* 5. Footer: Mode, ETP, and Grand Total */}
                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.cardModeText} numberOfLines={1}>
                      Mode: <Text style={{ color: '#0f172a', fontWeight: '700' }}>{entry.type_mode || 'N/A'}</Text>
                      {entry.payment_mode ? ` (${entry.payment_mode})` : ''}
                    </Text>
                    {entry.etp_no ? (
                      <Text style={styles.cardEtpText} numberOfLines={1}>
                        ETP: {entry.etp_no}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
                    <Text style={styles.totalAmountText}>
                      ₹ {formatINR(entry.total_amount)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
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
              <Text style={[styles.thCell, { width: 90 }]}>Date</Text>
              <Text style={[styles.thCell, { width: 100 }]}>ChallanNo</Text>
              <Text style={[styles.thCell, { width: 110 }]}>VehicleNo</Text>
              <Text style={[styles.thCell, { width: 110 }]}>TransportType</Text>
              <Text style={[styles.thCell, { width: 120 }]}>Type/Mode</Text>
              <Text style={[styles.thCell, { width: 140 }]}>PartyName</Text>
              <Text style={[styles.thCell, { width: 110 }]}>MaterialName</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 70 }]}>CUM</Text>
              <Text style={[styles.thCell, { width: 110 }]}>ETP No.</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>G.WT</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>T.WT</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 85 }]}>NET WT</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 75 }]}>Rate</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 95 }]}>Amount</Text>
              <Text style={[styles.thCell, styles.thRight, { width: 105 }]}>Total Amt</Text>
              <Text style={[styles.thCell, { width: 130 }]}>Direct Destination</Text>
              <Text style={[styles.thCell, { width: 85 }]}>Source</Text>
            </View>

            <ScrollView style={styles.tableBodyScroll}>
              {filteredEntries.map((entry, idx) => {
                const badge = getBadgeColor(entry.saved_in);
                const isEven = idx % 2 === 0;
                const isSelected = selectedIds.has(entry.id);

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
                    <Text style={[styles.tdCell, { width: 90 }]}>{entry.date}</Text>
                    <Text style={[styles.tdCell, styles.boldCell, { width: 100 }]}>
                      {entry.challan_no}
                    </Text>
                    <Text style={[styles.tdCell, { width: 110 }]}>{entry.vehicle_no}</Text>
                    <Text style={[styles.tdCell, { width: 110 }]}>{entry.transport_type}</Text>
                    <Text style={[styles.tdCell, { width: 120 }]}>
                      {entry.type_mode}{entry.payment_mode ? ` (${entry.payment_mode})` : ''}
                    </Text>
                    <Text style={[styles.tdCell, { width: 140 }]}>{entry.party_name}</Text>
                    <Text style={[styles.tdCell, { width: 110 }]}>{entry.material_name}</Text>
                    <Text style={[styles.tdCell, styles.tdRight, { width: 70 }]}>
                      {entry.cum || 0}
                    </Text>
                    <Text style={[styles.tdCell, { width: 110 }]}>{entry.etp_no || '-'}</Text>
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {(entry.g_wt || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.tdCell, styles.tdRight, { width: 85 }]}>
                      {(entry.t_wt || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.tdCell, styles.tdRight, styles.highlightCell, { width: 85 }]}>
                      {(entry.net_wt || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.tdCell, styles.tdRight, { width: 75 }]}>₹{entry.rate || 0}</Text>
                    <Text style={[styles.tdCell, styles.tdRight, { width: 95 }]}>
                      ₹{(entry.amount || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.tdCell, styles.tdRight, styles.boldCell, { width: 105, color: '#16a34a' }]}>
                      ₹{(entry.total_amount || 0).toLocaleString()}
                    </Text>
                    <View style={[styles.tdCell, { width: 130, paddingVertical: 4 }]}>
                      <View style={[styles.collectionBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.collectionBadgeText, { color: badge.text }]}>
                          {entry.saved_in}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.tdCell, { width: 85, paddingVertical: 4 }]}>
                      <View style={[styles.sourceBadge, entry.entry_source === 'manual' ? styles.sourceBadgeManual : styles.sourceBadgeExcel]}>
                        <Text style={[styles.sourceBadgeText, entry.entry_source === 'manual' ? styles.sourceBadgeTextManual : styles.sourceBadgeTextExcel]}>
                          {entry.entry_source === 'manual' ? 'Manual' : 'Excel'}
                        </Text>
                      </View>
                    </View>
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
          <View style={styles.modalOverlay}>
            <View style={styles.mobilePickerBox}>
              <View style={styles.mobilePickerHeader}>
                <Text style={styles.mobilePickerTitle}>Filter by {mobilePicker.title}</Text>
                <TouchableOpacity onPress={() => setMobilePicker(null)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.mobilePickerList}>
                <TouchableOpacity
                  style={[
                    styles.mobilePickerOption,
                    mobilePicker.current === 'All' && styles.mobilePickerOptionActive,
                  ]}
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
                </TouchableOpacity>
                {mobilePicker.options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.mobilePickerOption,
                      mobilePicker.current === opt && styles.mobilePickerOptionActive,
                    ]}
                    onPress={() => {
                      mobilePicker.onSelect(opt);
                      setMobilePicker(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.mobilePickerOptionText,
                        mobilePicker.current === opt && styles.mobilePickerOptionTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

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
    outlineWidth: 0,
    outlineStyle: 'none',
    cursor: 'pointer',
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
    minWidth: 1660,
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mobilePickerBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 340,
    maxHeight: 420,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  mobilePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mobilePickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobilePickerList: {
    marginTop: 8,
  },
  mobilePickerOption: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    borderRadius: 6,
  },
  mobilePickerOptionActive: {
    backgroundColor: '#f0f9ff',
  },
  mobilePickerOptionText: {
    fontSize: 13,
    color: '#334155',
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
});
