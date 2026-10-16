import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const CATEGORIES = [
  { id: 'VehicleNo', label: 'Vehicle No', singular: 'Vehicle Number', icon: 'car-outline', sample: 'MP09DD5763' },
  { id: 'TransportName', label: 'Transport', singular: 'Transport Name', icon: 'bus-outline', sample: 'VMPL' },
  { id: 'MaterialName', label: 'Material', singular: 'Material Name', icon: 'cube-outline', sample: '20MM' },
  { id: 'PartyName', label: 'Party Name', singular: 'Party Name', icon: 'people-outline', sample: 'NAWAZ KHAN' },
  { id: 'Type/Mode', label: 'Type / Mode', singular: 'Type / Mode', icon: 'git-branch-outline', sample: 'Cash Sale' },
];

const formatDate = (isoStr) => {
  if (!isoStr) return '12 Oct 2025 10:24 AM';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()] || 'Oct';
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return isoStr;
  }
};

export const MastersView = React.memo(({ masters, onRefresh }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isDesktop = width >= 1024;

  const [activeCategory, setActiveCategory] = useState('VehicleNo');

  // Master items from /api/masters/all
  const [masterList, setMasterList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Inactive'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Add / Edit Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = add, object = edit
  const [formCategory, setFormCategory] = useState('VehicleNo');
  const [formValue, setFormValue] = useState('');
  const [formStatus, setFormStatus] = useState('Active');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Import / Bulk Modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCategory, setImportCategory] = useState('VehicleNo');
  const [importRawText, setImportRawText] = useState('');
  const [importParsedItems, setImportParsedItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Bulk Actions Dropdown State
  const [bulkMenuVisible, setBulkMenuVisible] = useState(false);

  // File Input Ref for Web
  const fileInputRef = useRef(null);

  // Load detailed items from backend
  const loadMasterDetails = async () => {
    try {
      const data = await api.getMastersDetails();
      if (Array.isArray(data)) {
        setMasterList(data);
      }
    } catch (err) {
      console.warn('Failed to load masters details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterDetails();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    await loadMasterDetails();
    if (onRefresh) onRefresh();
  };

  // Get current category config
  const currentCatConfig = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach((c) => {
      const catKey = c.id === 'Type/Mode' ? 'TypeMode' : c.id;
      const fromDetails = masterList.filter((m) => m.category === c.id);
      if (fromDetails.length > 0) {
        counts[c.id] = fromDetails.length;
      } else {
        counts[c.id] = masters?.[catKey]?.length || 0;
      }
    });
    return counts;
  }, [masterList, masters]);

  // Combined and filtered records for active category
  const activeRecords = useMemo(() => {
    const catKey = activeCategory === 'Type/Mode' ? 'TypeMode' : activeCategory;
    const fromApi = masterList.filter((m) => m.category === activeCategory);

    let items = [];
    if (fromApi.length > 0) {
      items = fromApi.map((m) => ({
        id: m.id || m.value,
        category: m.category,
        value: m.value,
        status: m.status || 'Active',
        created_at: m.created_at,
        updated_at: m.updated_at,
      }));
    } else {
      const fallbackStrings = masters?.[catKey] || [];
      items = fallbackStrings.map((val, idx) => ({
        id: `fb_${activeCategory}_${idx}`,
        category: activeCategory,
        value: val,
        status: 'Active',
        created_at: new Date(Date.now() - idx * 86400000).toISOString(),
        updated_at: new Date(Date.now() - idx * 86400000).toISOString(),
      }));
    }

    // Apply Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((item) => String(item.value).toLowerCase().includes(q));
    }

    // Apply Status Filter
    if (statusFilter !== 'All') {
      items = items.filter((item) => item.status === statusFilter);
    }

    // Sort by value
    items.sort((a, b) => {
      const cmp = String(a.value).localeCompare(String(b.value));
      return sortAsc ? cmp : -cmp;
    });

    return items;
  }, [masterList, masters, activeCategory, searchQuery, statusFilter, sortAsc]);

  // Status counts for pills
  const statusCounts = useMemo(() => {
    const fromApi = masterList.filter((m) => m.category === activeCategory);
    let allCount = 0;
    let activeCount = 0;
    let inactiveCount = 0;

    if (fromApi.length > 0) {
      allCount = fromApi.length;
      activeCount = fromApi.filter((m) => m.status === 'Active').length;
      inactiveCount = fromApi.filter((m) => m.status === 'Inactive').length;
    } else {
      const catKey = activeCategory === 'Type/Mode' ? 'TypeMode' : activeCategory;
      const count = masters?.[catKey]?.length || 0;
      allCount = count;
      activeCount = count;
      inactiveCount = 0;
    }

    return { all: allCount, active: activeCount, inactive: inactiveCount };
  }, [masterList, masters, activeCategory]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(activeRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeRecords.slice(start, start + itemsPerPage);
  }, [activeRecords, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeCategory, searchQuery, statusFilter]);

  // Checkbox Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(paginatedRecords.map((r) => r.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Open Add Modal
  const handleOpenAdd = (category = activeCategory) => {
    setEditingItem(null);
    setFormCategory(category);
    setFormValue('');
    setFormStatus('Active');
    setModalError('');
    setEditModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormValue(item.value);
    setFormStatus(item.status || 'Active');
    setModalError('');
    setEditModalVisible(true);
  };

  // Save Add / Edit
  const handleSaveItem = async () => {
    if (!formValue.trim()) {
      setModalError('Please enter a value');
      return;
    }

    setFormSubmitting(true);
    setModalError('');

    try {
      if (editingItem && editingItem.id && !editingItem.id.startsWith('fb_')) {
        await api.updateMasterItem(editingItem.id, {
          value: formValue.trim(),
          status: formStatus,
        });
      } else {
        await api.addMasterItem(formCategory, formValue.trim(), formStatus);
      }
      setEditModalVisible(false);
      await loadMasterDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.message || 'Failed to save item');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete single item
  const handleDeleteItem = async (item) => {
    if (Platform.OS === 'web') {
      const ok = window.confirm(`Are you sure you want to delete '${item.value}' from ${item.category}?`);
      if (!ok) return;
    }

    try {
      if (item.id && !item.id.startsWith('fb_')) {
        await api.bulkDeleteMasters([item.id]);
      } else {
        await api.deleteMasterItem(item.category, item.value);
      }
      await loadMasterDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete item');
    }
  };

  // Toggle status directly (Active <-> Inactive)
  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    try {
      if (item.id && !item.id.startsWith('fb_')) {
        await api.updateMasterItem(item.id, { status: newStatus });
      } else {
        await api.deleteMasterItem(item.category, item.value);
        await api.addMasterItem(item.category, item.value, newStatus);
      }
      await loadMasterDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Bulk Actions
  const handleBulkAction = async (actionType) => {
    setBulkMenuVisible(false);
    if (selectedIds.size === 0) {
      alert('Please select at least one item');
      return;
    }

    const idsArray = Array.from(selectedIds);

    if (actionType === 'delete') {
      if (Platform.OS === 'web') {
        const ok = window.confirm(`Are you sure you want to delete ${idsArray.length} selected items?`);
        if (!ok) return;
      }
      try {
        await api.bulkDeleteMasters(idsArray);
        setSelectedIds(new Set());
        await loadMasterDetails();
        if (onRefresh) onRefresh();
      } catch (err) {
        alert(err.message || 'Failed to delete selected items');
      }
    } else if (actionType === 'activate' || actionType === 'deactivate') {
      const newStatus = actionType === 'activate' ? 'Active' : 'Inactive';
      try {
        await Promise.all(
          idsArray.map((id) => api.updateMasterItem(id, { status: newStatus }).catch(() => null))
        );
        setSelectedIds(new Set());
        await loadMasterDetails();
        if (onRefresh) onRefresh();
      } catch (err) {
        alert(err.message || 'Failed to update status for selected items');
      }
    }
  };

  // Download CSV Template
  const handleDownloadTemplate = (cat = activeCategory) => {
    const config = CATEGORIES.find((c) => c.id === cat) || CATEGORIES[0];
    const samples = {
      'VehicleNo': 'VehicleNo\nMP09DD5763\nMP09HH9584\nMH12AB1234\nRJ14CD5678\nGJ01XY7890',
      'TransportName': 'TransportName\nVMPL\nMSK\nBALAJI LOGISTICS\nSPEED FREIGHT',
      'MaterialName': 'MaterialName\n10MM\n20MM\nGSB\nM-SAND\nWMM',
      'PartyName': 'PartyName\nNAWAZ KHAN\nALTAMASH KHAN\nSAGEER PATEL\nPUSHPENDRA\nANIL AARIYA',
      'Type/Mode': 'TypeMode\nRoyalty Sale\nWithout Royalty\nCredit Sale\nCash Sale\nQR Sale\nHR Loading',
    };
    const content = samples[cat] || `${config.label}\nSample1\nSample2`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cat.replace(/[^a-zA-Z0-9]/g, '_')}_Template.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(`CSV Template for ${config.label}:\n\n${content}`);
    }
  };

  // Open Import Modal
  const handleOpenImport = (cat = activeCategory) => {
    setImportCategory(cat);
    setImportRawText('');
    setImportParsedItems([]);
    setImportError('');
    setImportSuccess('');
    setImportModalVisible(true);
  };

  // Parse Text or CSV in Import Modal
  const handleParseImport = () => {
    if (!importRawText.trim()) {
      setImportError('Please paste some records or upload a CSV file.');
      return;
    }

    setImportError('');
    const lines = importRawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];

    lines.forEach((line) => {
      const firstCol = line.split(',')[0].replace(/^["']|["']$/g, '').trim();
      const lower = firstCol.toLowerCase();
      if (
        firstCol &&
        lower !== 'vehicleno' &&
        lower !== 'vehicle no' &&
        lower !== 'transportname' &&
        lower !== 'materialname' &&
        lower !== 'partyname' &&
        lower !== 'typemode' &&
        lower !== 'type/mode'
      ) {
        if (!parsed.includes(firstCol)) {
          parsed.push(firstCol);
        }
      }
    });

    if (parsed.length === 0) {
      setImportError('No valid items found in input.');
      return;
    }

    setImportParsedItems(parsed);
  };

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    if (importParsedItems.length === 0) {
      setImportError('No parsed items to import. Please click Preview first.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const res = await api.bulkAddMasters(importCategory, importParsedItems, 'Active');
      setImportSuccess(
        `Successfully imported ${res.added_count} items! ${res.skipped_count > 0 ? `(${res.skipped_count} duplicates skipped)` : ''}`
      );
      setImportParsedItems([]);
      setImportRawText('');
      await loadMasterDetails();
      if (onRefresh) onRefresh();
    } catch (err) {
      setImportError(err.message || 'Failed to import records');
    } finally {
      setImporting(false);
    }
  };

  // Handle file select on web
  const handleWebFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setImportRawText(content);
        const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const parsed = [];
        lines.forEach((line) => {
          const firstCol = line.split(',')[0].replace(/^["']|["']$/g, '').trim();
          const lower = firstCol.toLowerCase();
          if (
            firstCol &&
            lower !== 'vehicleno' &&
            lower !== 'vehicle no' &&
            lower !== 'transportname' &&
            lower !== 'materialname' &&
            lower !== 'partyname' &&
            lower !== 'typemode' &&
            lower !== 'type/mode'
          ) {
            if (!parsed.includes(firstCol)) {
              parsed.push(firstCol);
            }
          }
        });
        setImportParsedItems(parsed);
      }
    };
    reader.readAsText(file);
  };

  return (
    <ScrollView
      style={styles.pageScrollView}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: isMobile ? 120 : 60 }]}
      showsVerticalScrollIndicator={true}
    >
      {/* Hidden file input for web upload */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={handleWebFileSelect}
        />
      )}

      {/* TOP HEADER: Compact Title, Subtitle, Add New Master & Import */}
      <View style={styles.pageHeader}>
        <View style={styles.titleArea}>
          <Text style={styles.pageTitle}>Masters Management</Text>
          <Text style={styles.pageSubtitle}>
            Manage your master data for smooth and accurate transactions.
          </Text>
        </View>

        <View style={styles.headerActionButtons}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => handleOpenAdd(activeCategory)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.btnPrimaryText}>Add New Master</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => handleOpenImport(activeCategory)}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={15} color="#0284c7" style={{ marginRight: 4 }} />
            <Text style={styles.btnOutlineText}>Import</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => handleDownloadTemplate(activeCategory)}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={15} color="#0284c7" style={{ marginRight: 4 }} />
            <Text style={styles.btnOutlineText}>Template</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnIconOnly} onPress={handleSync} title="Refresh">
            <Ionicons name="sync-outline" size={16} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      {/* COMPACT CATEGORY METRIC CARDS: Small, sleek, balanced height */}
      <View style={styles.metricCardsContainer}>
        {isDesktop ? (
          <View style={styles.metricRowDesktop}>
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.smallCard, isSelected && styles.smallCardActive]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.smallIconWrap, isSelected && styles.smallIconWrapActive]}>
                    <Ionicons name={cat.icon} size={16} color={isSelected ? '#0284c7' : '#64748b'} />
                  </View>
                  <View style={styles.smallCardInfo}>
                    <Text style={[styles.smallCardTitle, isSelected && styles.smallCardTitleActive]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    <View style={styles.smallCardNumRow}>
                      <Text style={styles.smallCardCount}>{count}</Text>
                      <Text style={[styles.smallCardView, isSelected && styles.smallCardViewActive]}>View →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScrollContent}>
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.smallCardMobile, isSelected && styles.smallCardActive]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.smallIconWrap, isSelected && styles.smallIconWrapActive]}>
                    <Ionicons name={cat.icon} size={16} color={isSelected ? '#0284c7' : '#64748b'} />
                  </View>
                  <View style={styles.smallCardInfo}>
                    <Text style={[styles.smallCardTitle, isSelected && styles.smallCardTitleActive]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    <View style={styles.smallCardNumRow}>
                      <Text style={styles.smallCardCount}>{count}</Text>
                      <Text style={[styles.smallCardView, isSelected && styles.smallCardViewActive]}>View →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* MAIN WORK AREA: Full-width Table Card */}
      <View style={styles.mainLayoutGrid}>
        <View style={styles.tableContainerCard}>
          {/* Horizontal Category Navigation Tabs */}
          <View style={styles.horizontalTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => setActiveCategory(cat.id)}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {cat.label}
                    </Text>
                    {isActive && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Action & Filter Bar: Search, Status Filter, Bulk Actions */}
          <View style={styles.filterActionBar}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${currentCatConfig.label}...`}
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Status Pills */}
            <View style={styles.statusFilterGroup}>
              {['All', 'Active', 'Inactive'].map((st) => {
                const isSelected = statusFilter === st;
                const count =
                  st === 'All'
                    ? statusCounts.all
                    : st === 'Active'
                      ? statusCounts.active
                      : statusCounts.inactive;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusPill, isSelected && styles.statusPillActive]}
                    onPress={() => setStatusFilter(st)}
                  >
                    <Text style={[styles.statusPillText, isSelected && styles.statusPillTextActive]}>
                      {st} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bulk Actions Button with Dropdown */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[
                  styles.bulkActionBtn,
                  selectedIds.size > 0 && styles.bulkActionBtnActive,
                ]}
                onPress={() => setBulkMenuVisible(!bulkMenuVisible)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="layers-outline"
                  size={14}
                  color={selectedIds.size > 0 ? '#0284c7' : '#475569'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.bulkActionBtnText,
                    selectedIds.size > 0 && { color: '#0284c7' },
                  ]}
                >
                  Bulk Actions {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#64748b" style={{ marginLeft: 3 }} />
              </TouchableOpacity>

              {bulkMenuVisible && (
                <View style={styles.bulkDropdownMenu}>
                  <TouchableOpacity
                    style={styles.bulkMenuItem}
                    onPress={() => handleBulkAction('activate')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={15} color="#16a34a" />
                    <Text style={styles.bulkMenuText}>Set as Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bulkMenuItem}
                    onPress={() => handleBulkAction('deactivate')}
                  >
                    <Ionicons name="pause-circle-outline" size={15} color="#eab308" />
                    <Text style={styles.bulkMenuText}>Set as Inactive</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.bulkMenuItem}
                    onPress={() => handleBulkAction('delete')}
                  >
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                    <Text style={[styles.bulkMenuText, { color: '#ef4444' }]}>Delete Selected</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* SPREADSHEET TABLE: Perfectly fitted for both mobile (no horizontal scroll) and desktop */}
          <View style={styles.tableResponsiveWrapper}>
            <View style={styles.fullTable}>
              {/* Table Header */}
              <View style={[styles.tableHeaderRow, isMobile && { paddingHorizontal: 4 }]}>
                <TouchableOpacity
                  style={[styles.thCell, { width: isMobile ? 28 : 40, alignItems: 'center', paddingHorizontal: 0 }]}
                  onPress={toggleSelectAll}
                >
                  <Ionicons
                    name={
                      selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0
                        ? 'checkbox'
                        : 'square-outline'
                    }
                    size={isMobile ? 15 : 16}
                    color={selectedIds.size > 0 ? '#0284c7' : '#94a3b8'}
                  />
                </TouchableOpacity>

                <Text style={[styles.thCell, { width: isMobile ? 24 : 46, textAlign: 'center', paddingHorizontal: 1, fontSize: isMobile ? 10 : 11 }]}>#</Text>

                <TouchableOpacity
                  style={[styles.thCell, { flex: 1, minWidth: isMobile ? 60 : 180, flexDirection: 'row', alignItems: 'center', paddingHorizontal: isMobile ? 3 : 6 }]}
                  onPress={() => setSortAsc(!sortAsc)}
                >
                  <Text style={[styles.thCellText, isMobile && { fontSize: 10 }]} numberOfLines={1}>
                    {currentCatConfig.label}
                  </Text>
                  <Ionicons
                    name={sortAsc ? 'arrow-up' : 'arrow-down'}
                    size={isMobile ? 11 : 13}
                    color="#64748b"
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>

                <Text style={[styles.thCell, { width: isMobile ? 66 : 110, textAlign: 'center', paddingHorizontal: 1, fontSize: isMobile ? 10 : 11 }]}>
                  Status
                </Text>

                <Text style={[styles.thCell, { width: isMobile ? 62 : 110, textAlign: 'center', paddingHorizontal: 1, fontSize: isMobile ? 10 : 11 }]}>
                  Actions
                </Text>
              </View>

              {/* Table Body */}
              {loading ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator size="small" color="#0284c7" />
                  <Text style={styles.loadingText}>Loading master data...</Text>
                </View>
              ) : paginatedRecords.length === 0 ? (
                <View style={styles.emptyTableArea}>
                  <Ionicons name="folder-open-outline" size={38} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No {currentCatConfig.label} found.</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery
                      ? 'Try adjusting your search or filters.'
                      : `Click "+ Add New Master" or "Import" to add records.`}
                  </Text>
                </View>
              ) : (
                paginatedRecords.map((item, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isSelected = selectedIds.has(item.id);
                  const isActive = item.status === 'Active';

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.tableRow,
                        idx % 2 === 1 && styles.tableRowEven,
                        isSelected && styles.tableRowSelected,
                        isMobile && { paddingHorizontal: 4, paddingVertical: 8 },
                      ]}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        style={[styles.tdCell, { width: isMobile ? 28 : 40, alignItems: 'center', paddingHorizontal: 0 }]}
                        onPress={() => toggleSelectOne(item.id)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={isMobile ? 15 : 16}
                          color={isSelected ? '#0284c7' : '#94a3b8'}
                        />
                      </TouchableOpacity>

                      {/* Index */}
                      <Text style={[styles.tdCell, { width: isMobile ? 24 : 46, textAlign: 'center', paddingHorizontal: 1, color: '#64748b', fontSize: isMobile ? 10 : 12 }]}>
                        {rowNumber}
                      </Text>

                      {/* Value */}
                      <Text
                        style={[
                          styles.tdCell,
                          styles.boldCell,
                          { flex: 1, minWidth: isMobile ? 60 : 180, paddingHorizontal: isMobile ? 3 : 6, fontSize: isMobile ? 12 : 13 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.value}
                      </Text>

                      {/* Status Badge */}
                      <View style={[styles.tdCell, { width: isMobile ? 66 : 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 }]}>
                        <TouchableOpacity
                          style={[
                            styles.statusBadge,
                            isActive ? styles.badgeActive : styles.badgeInactive,
                            isMobile && { paddingHorizontal: 5, paddingVertical: 2, height: 21, borderRadius: 10 },
                          ]}
                          onPress={() => handleToggleStatus(item)}
                          title="Click to toggle status"
                        >
                          <View
                            style={[
                              styles.statusDot,
                              isActive ? styles.dotActive : styles.dotInactive,
                              isMobile && { width: 5, height: 5, marginRight: 3 },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                              isMobile && { fontSize: 9, fontWeight: '700' },
                            ]}
                          >
                            {item.status}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Actions */}
                      <View style={[styles.tdCell, { width: isMobile ? 62 : 110, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 1 }]}>
                        <TouchableOpacity
                          style={[styles.actionIconBtn, isMobile && { width: 26, height: 26, marginHorizontal: 1, padding: 3, alignItems: 'center', justifyContent: 'center' }]}
                          onPress={() => handleOpenEdit(item)}
                          title="Edit"
                        >
                          <Ionicons name="pencil-outline" size={isMobile ? 13 : 15} color="#0284c7" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionIconBtn, isMobile && { width: 26, height: 26, marginHorizontal: 1, padding: 3, alignItems: 'center', justifyContent: 'center' }]}
                          onPress={() => handleDeleteItem(item)}
                          title="Delete"
                        >
                          <Ionicons name="trash-outline" size={isMobile ? 13 : 15} color="#ef4444" />
                        </TouchableOpacity>
                        {!isMobile && (
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleToggleStatus(item)}
                            title={isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Ionicons name="ellipsis-horizontal" size={15} color="#64748b" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* TABLE FOOTER & PAGINATION */}
          <View style={styles.paginationBar}>
            <Text style={styles.paginationInfo}>
              Showing{' '}
              {activeRecords.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, activeRecords.length)} of {activeRecords.length} records
            </Text>

            <View style={styles.pageButtonsGroup}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={14} color={currentPage === 1 ? '#cbd5e1' : '#334155'} />
              </TouchableOpacity>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = currentPage === pageNum;
                if (totalPages > 6 && Math.abs(currentPage - pageNum) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                  return null;
                }
                return (
                  <TouchableOpacity
                    key={pageNum}
                    style={[styles.pageBtn, isCurrent && styles.pageBtnActive]}
                    onPress={() => setCurrentPage(pageNum)}
                  >
                    <Text style={[styles.pageBtnText, isCurrent && styles.pageBtnTextActive]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={currentPage === totalPages ? '#cbd5e1' : '#334155'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* MODAL 1: ADD / EDIT MASTER ITEM */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? `Edit ${currentCatConfig.singular}` : `Add ${currentCatConfig.singular}`}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {modalError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={15} color="#b91c1c" />
                  <Text style={styles.errorBannerText}>{modalError}</Text>
                </View>
              ) : null}

              {/* Category selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={[styles.formInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                  <Text style={{ color: '#334155', fontWeight: '600', fontSize: 13 }}>{currentCatConfig.label}</Text>
                </View>
              </View>

              {/* Value input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {currentCatConfig.singular} <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={`Enter ${currentCatConfig.singular.toLowerCase()} (e.g. ${currentCatConfig.sample})`}
                  placeholderTextColor="#94a3b8"
                  value={formValue}
                  onChangeText={setFormValue}
                  autoFocus
                />
              </View>

              {/* Status Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status</Text>
                <View style={styles.statusToggleRow}>
                  <TouchableOpacity
                    style={[styles.statusToggleBtn, formStatus === 'Active' && styles.statusToggleBtnActive]}
                    onPress={() => setFormStatus('Active')}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color={formStatus === 'Active' ? '#16a34a' : '#94a3b8'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        formStatus === 'Active' && styles.statusToggleBtnTextActive,
                      ]}
                    >
                      Active
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.statusToggleBtn, formStatus === 'Inactive' && styles.statusToggleBtnInactive]}
                    onPress={() => setFormStatus('Inactive')}
                  >
                    <Ionicons
                      name="pause-circle"
                      size={15}
                      color={formStatus === 'Inactive' ? '#eab308' : '#94a3b8'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.statusToggleBtnText,
                        formStatus === 'Inactive' && { color: '#ca8a04', fontWeight: '700' },
                      ]}
                    >
                      Inactive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={formSubmitting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, formSubmitting && { opacity: 0.7 }]}
                onPress={handleSaveItem}
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: IMPORT MASTER DATA */}
      <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalDialog, { maxWidth: 580 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cloud-upload-outline" size={20} color="#0284c7" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Import Master Data</Text>
              </View>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {importError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={15} color="#b91c1c" />
                  <Text style={styles.errorBannerText}>{importError}</Text>
                </View>
              ) : null}

              {importSuccess ? (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={15} color="#15803d" />
                  <Text style={styles.successBannerText}>{importSuccess}</Text>
                </View>
              ) : null}

              {/* Template Step Banner */}
              <View style={styles.importTemplateBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.importStepTitle}>Download Template</Text>
                  <Text style={styles.importStepSub}>
                    Download the pre-formatted CSV template and fill in your data.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.downloadTemplateBtn}
                  onPress={() => handleDownloadTemplate(importCategory)}
                >
                  <Ionicons name="download-outline" size={15} color="#0284c7" style={{ marginRight: 5 }} />
                  <Text style={styles.downloadTemplateBtnText}>Download Template</Text>
                </TouchableOpacity>
              </View>

              {/* File upload drag drop zone */}
              <View style={styles.uploadZone}>
                <Ionicons name="cloud-upload-outline" size={32} color="#0284c7" />
                <Text style={styles.uploadZoneTitle}>Choose file or drag and drop</Text>
                <Text style={styles.uploadZoneSub}>Excel / CSV (Max 5MB)</Text>

                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={styles.browseFileBtn}
                    onPress={() => fileInputRef.current?.click()}
                  >
                    <Text style={styles.browseFileBtnText}>Browse CSV File</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Or paste text */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Or Paste Records (One per line or comma-separated):</Text>
                <TextInput
                  style={[styles.formInput, { height: 90, textAlignVertical: 'top', paddingTop: 8 }]}
                  placeholder={`Example:\nMP09DD5763\nMP09HH9584\nMH12AB1234`}
                  placeholderTextColor="#94a3b8"
                  value={importRawText}
                  onChangeText={setImportRawText}
                  multiline
                />
              </View>

              <TouchableOpacity style={styles.btnOutlineSecondary} onPress={handleParseImport}>
                <Ionicons name="eye-outline" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                <Text style={styles.btnOutlineSecondaryText}>Upload & Preview</Text>
              </TouchableOpacity>

              {/* Parsed items preview */}
              {importParsedItems.length > 0 && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewTitle}>
                    Preview: {importParsedItems.length} records ready to import into {importCategory}
                  </Text>
                  <View style={styles.previewListChips}>
                    {importParsedItems.slice(0, 15).map((val, idx) => (
                      <View key={idx} style={styles.previewChip}>
                        <Text style={styles.previewChipText}>{val}</Text>
                      </View>
                    ))}
                    {importParsedItems.length > 15 && (
                      <Text style={{ fontSize: 11, color: '#64748b', alignSelf: 'center' }}>
                        +{importParsedItems.length - 15} more...
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setImportModalVisible(false)}
                disabled={importing}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>

              {importParsedItems.length > 0 && (
                <TouchableOpacity
                  style={[styles.modalSaveBtn, importing && { opacity: 0.7 }]}
                  onPress={handleExecuteImport}
                  disabled={importing}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>
                      Import {importParsedItems.length} Records
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  pageScrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 10,
  },
  titleArea: {
    flex: 1,
    minWidth: 200,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 7,
  },
  btnOutlineText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
  },
  btnIconOnly: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // COMPACT METRIC CARDS
  metricCardsContainer: {
    marginBottom: 14,
  },
  metricRowDesktop: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  metricScrollContent: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  smallCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  smallCardMobile: {
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  smallCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
  },
  smallIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  smallIconWrapActive: {
    backgroundColor: '#e0f2fe',
  },
  smallCardInfo: {
    flex: 1,
  },
  smallCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  smallCardTitleActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  smallCardNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  smallCardCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  smallCardView: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  smallCardViewActive: {
    color: '#0284c7',
    fontWeight: '700',
  },

  // Main Layout Grid
  mainLayoutGrid: {
    width: '100%',
  },
  tableContainerCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },

  // Horizontal Navigation Tabs
  horizontalTabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    position: 'relative',
    marginRight: 4,
  },
  tabButtonActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 14,
    right: 14,
    height: 2.5,
    backgroundColor: '#0284c7',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Action and Filter Bar
  filterActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  searchBox: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    paddingHorizontal: 9,
    height: 34,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  statusFilterGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusPillActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  statusPillText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  bulkActionBtnActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  bulkActionBtnText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  bulkDropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 160,
    backgroundColor: '#ffffff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
    paddingVertical: 3,
  },
  bulkMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 8,
  },
  bulkMenuText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 3,
  },

  // Table Structure
  tableResponsiveWrapper: {
    width: '100%',
  },
  fullTable: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  thCell: {
    paddingHorizontal: 6,
  },
  thCellText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
  },
  tableRowEven: {
    backgroundColor: '#fcfdfe',
  },
  tableRowSelected: {
    backgroundColor: '#f0f9ff',
  },
  tdCell: {
    paddingHorizontal: 6,
    fontSize: 12,
    color: '#334155',
  },
  boldCell: {
    fontWeight: '600',
    color: '#0f172a',
  },

  // Badges
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeInactive: {
    backgroundColor: '#fef3c7',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  dotActive: {
    backgroundColor: '#16a34a',
  },
  dotInactive: {
    backgroundColor: '#d97706',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#15803d',
  },
  badgeTextInactive: {
    color: '#b45309',
  },

  actionIconBtn: {
    padding: 5,
    borderRadius: 5,
    marginHorizontal: 1,
  },

  // Pagination
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  paginationInfo: {
    fontSize: 12,
    color: '#64748b',
  },
  pageButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  pageBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  pageBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Right Side Panels (Desktop)
  rightPanelsColumn: {
    width: 250,
  },
  panelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  panelPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    height: 35,
    borderRadius: 7,
    marginBottom: 8,
  },
  panelPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  panelOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 35,
    borderRadius: 7,
    marginBottom: 8,
  },
  panelOutlineBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryVerticalList: {
    gap: 3,
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryListItemActive: {
    backgroundColor: '#e0f2fe',
  },
  categoryListItemLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  categoryListItemLabelActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  categoryCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  categoryCountBadgeActive: {
    backgroundColor: '#0284c7',
  },
  categoryCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  categoryCountTextActive: {
    color: '#ffffff',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    padding: 14,
    maxHeight: 450,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  modalCancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalCancelBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#0284c7',
  },
  modalSaveBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
  },
  formInput: {
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 7,
    backgroundColor: '#ffffff',
  },
  statusToggleBtnActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  statusToggleBtnInactive: {
    borderColor: '#eab308',
    backgroundColor: '#fefce8',
  },
  statusToggleBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statusToggleBtnTextActive: {
    color: '#15803d',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#991b1b',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  successBannerText: {
    fontSize: 12,
    color: '#15803d',
    flex: 1,
  },

  // Import Modal Styles
  importTemplateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 7,
    padding: 10,
    marginBottom: 12,
  },
  importStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  importStepSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  downloadTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    marginLeft: 6,
  },
  downloadTemplateBtnText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '600',
  },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  uploadZoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
  },
  uploadZoneSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  browseFileBtn: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  browseFileBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  btnOutlineSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0284c7',
    height: 35,
    borderRadius: 7,
    marginBottom: 12,
  },
  btnOutlineSecondaryText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  previewListChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  previewChip: {
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  previewChipText: {
    fontSize: 11,
    color: '#0369a1',
    fontWeight: '600',
  },

  loadingArea: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  emptyTableArea: {
    padding: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    textAlign: 'center',
  },
});
