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
  Linking,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

const CATEGORIES = [
  { id: 'VehicleNo', label: 'Vehicle No', singular: 'Vehicle Number', icon: 'car-outline', sample: 'MP09DD5763' },
  { id: 'TransportName', label: 'Transport', singular: 'Transport Name', icon: 'bus-outline', sample: 'VMPL' },
  { id: 'MaterialName', label: 'Material', singular: 'Material Name', icon: 'cube-outline', sample: '20MM' },
  { id: 'PartyName', label: 'Party Name', singular: 'Party Name', icon: 'people-outline', sample: 'NAWAZ KHAN' },
  { id: 'AdditionalCharges', label: 'Additional Charges', singular: 'Additional Charge', icon: 'receipt-outline', sample: 'Freight' },
];

const INDIAN_STATES = [
  'Madhya Pradesh',
  'Maharashtra',
  'Gujarat',
  'Rajasthan',
  'Uttar Pradesh',
  'Delhi',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const STATIC_TYPE_MODES = [
  'Cash Sale',
  'Credit Sale',
  'QR Sale',
  'Royalty Sale',
  'Without Royalty',
  'With Royalty',
  'Case Sale',
];

const isItemStatic = (item) => {
  if (!item) return false;
  if (item.category !== 'Type/Mode') return false;
  const v = String(item.value || '').trim();
  return STATIC_TYPE_MODES.some((std) => std.toLowerCase() === v.toLowerCase());
};

const formatDate = (isoStr) => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()] || '';
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
  const [mobileDetailCategory, setMobileDetailCategory] = useState(null);

  // Switch category and reset filters cleanly
  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    setStatusFilter('All');
    setSearchQuery('');
    setSelectedIds(new Set());
    if (isMobile) {
      setMobileDetailCategory(catId);
    }
  };

  // Master items from /api/masters/all
  const [masterList, setMasterList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Inactive'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortAsc, setSortAsc] = useState(true);


  // Add / Edit Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = add, object = edit
  const [formCategory, setFormCategory] = useState('VehicleNo');
  const [formValue, setFormValue] = useState('');
  const [formStatus, setFormStatus] = useState('Active');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Party Master Specific Fields
  const [formAddress1, setFormAddress1] = useState('');
  const [formAddress2, setFormAddress2] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('Madhya Pradesh');
  const [formPinCode, setFormPinCode] = useState('');
  const [formMobileNo, setFormMobileNo] = useState('');
  const [formEmailId, setFormEmailId] = useState('');
  const [formGstType, setFormGstType] = useState('Unregistered'); // 'Registered' | 'Unregistered'
  const [formGstNo, setFormGstNo] = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [stateList, setStateList] = useState(INDIAN_STATES);
  const [stateSearchText, setStateSearchText] = useState('');
  const [isAddingNewState, setIsAddingNewState] = useState(false);
  const [newStateInput, setNewStateInput] = useState('');

  // Sync custom/database states from masters prop whenever it updates
  useEffect(() => {
    if (masters?.State && Array.isArray(masters.State) && masters.State.length > 0) {
      setStateList((prev) => Array.from(new Set([...prev, ...masters.State])));
    }
  }, [masters?.State]);

  // Handler to add a new state to dropdown and save to master
  const handleAddNewState = async (customName = null) => {
    const trimmed = (typeof customName === 'string' ? customName : newStateInput).trim();
    if (!trimmed) return;

    // Immediately add to dropdown list and select
    setStateList((prev) => (prev.includes(trimmed) ? prev : [trimmed, ...prev]));
    setFormState(trimmed);
    setNewStateInput('');
    setStateSearchText('');
    setIsAddingNewState(false);
    setStateDropdownOpen(false);

    // Save to master database
    try {
      await api.addMasterItem('State', trimmed);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.warn('Note: State added locally (or already exists in master):', err.message);
    }
  };

  // Import / Bulk Modal (Multi-column Excel & CSV support)
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCategory, setImportCategory] = useState('VehicleNo');
  const [importRawText, setImportRawText] = useState('');
  const [selectedImportFile, setSelectedImportFile] = useState(null);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
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
        is_static: m.is_static !== undefined ? m.is_static : isItemStatic(m),
        sub_types: m.sub_types,
        created_at: m.created_at,
        updated_at: m.updated_at,
        address_1: m.address_1,
        address_2: m.address_2,
        city: m.city,
        state: m.state,
        pin_code: m.pin_code,
        mobile_no: m.mobile_no,
        email_id: m.email_id,
        gst_type: m.gst_type,
        gst_no: m.gst_no,
      }));
    } else {
      const fallbackStrings = masters?.[catKey] || [];
      items = fallbackStrings.map((val, idx) => ({
        id: `fb_${activeCategory}_${idx}`,
        category: activeCategory,
        value: val,
        status: 'Active',
        is_static: activeCategory === 'Type/Mode' && isItemStatic({ category: 'Type/Mode', value: val }),
        created_at: new Date(Date.now() - idx * 86400000).toISOString(),
        updated_at: new Date(Date.now() - idx * 86400000).toISOString(),
      }));
    }



    // Apply Search Filter across all fields for all master categories
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((item) => {
        if (String(item.value || '').toLowerCase().includes(q)) return true;
        if (item.city && String(item.city).toLowerCase().includes(q)) return true;
        if (item.state && String(item.state).toLowerCase().includes(q)) return true;
        if (item.gst_no && String(item.gst_no).toLowerCase().includes(q)) return true;
        if (item.mobile_no && String(item.mobile_no).toLowerCase().includes(q)) return true;
        if (item.email_id && String(item.email_id).toLowerCase().includes(q)) return true;
        if (item.address_1 && String(item.address_1).toLowerCase().includes(q)) return true;
        if (item.sub_types && item.sub_types.some((s) => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))) {
          return true;
        }
        return false;
      });
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
    const items = masterList.filter((m) => m.category === activeCategory);
    const allCount = items.length > 0 ? items.length : (masters?.[activeCategory]?.length || 0);
    const activeCount = items.filter((m) => m.status === 'Active').length || allCount;
    const inactiveCount = items.filter((m) => m.status === 'Inactive').length;

    return { all: allCount, active: activeCount, inactive: inactiveCount };
  }, [masterList, masters, activeCategory]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeCategory, searchQuery, statusFilter]);

  // Checkbox Selection - Select/Deselect all records (excluding static protected items)
  const toggleSelectAll = () => {
    const selectableRecords = activeRecords.filter((r) => !isItemStatic(r));
    if (selectedIds.size === selectableRecords.length && selectableRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(selectableRecords.map((r) => r.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectOne = (id) => {
    const item = activeRecords.find((r) => r.id === id);
    if (item && isItemStatic(item)) return;
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
    setFormAddress1('');
    setFormAddress2('');
    setFormCity('');
    setFormState('Madhya Pradesh');
    setFormPinCode('');
    setFormMobileNo('');
    setFormEmailId('');
    setFormGstType('Unregistered');
    setFormGstNo('');
    setStateDropdownOpen(false);
    setIsAddingNewState(false);
    setNewStateInput('');
    setStateSearchText('');
    setModalError('');
    setEditModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormValue(item.value);
    setFormStatus(item.status || 'Active');
    setFormAddress1(item.address_1 || '');
    setFormAddress2(item.address_2 || '');
    setFormCity(item.city || '');
    setFormState(item.state || 'Madhya Pradesh');
    setFormPinCode(item.pin_code || '');
    setFormMobileNo(item.mobile_no || '');
    setFormEmailId(item.email_id || '');
    setFormGstType(item.gst_type || (item.gst_no ? 'Registered' : 'Unregistered'));
    setFormGstNo(item.gst_no || '');
    setStateDropdownOpen(false);
    setIsAddingNewState(false);
    setNewStateInput('');
    setStateSearchText('');
    setModalError('');
    setEditModalVisible(true);
  };

  // Save Add / Edit
  const handleSaveItem = async () => {
    if (!formValue.trim()) {
      setModalError(formCategory === 'PartyName' ? 'Party Name is required (*)' : 'Please enter a value');
      return;
    }

    if (formCategory === 'PartyName') {
      if (!formCity.trim()) {
        setModalError('City is required (*)');
        return;
      }
      if (!formState.trim()) {
        setModalError('State is required (*)');
        return;
      }
      if (formGstType === 'Registered') {
        if (!formGstNo.trim()) {
          setModalError('GSTIN Number is mandatory when GST Type is Registered (*)');
          return;
        }
      }
    }

    setFormSubmitting(true);
    setModalError('');

    try {
      const partyData = formCategory === 'PartyName' ? {
        address_1: formAddress1.trim(),
        address_2: formAddress2.trim(),
        city: formCity.trim(),
        state: formState.trim(),
        pin_code: formPinCode.trim(),
        mobile_no: formMobileNo.trim(),
        email_id: formEmailId.trim(),
        gst_type: formGstType,
        gst_no: formGstType === 'Registered' ? formGstNo.trim().toUpperCase() : '',
      } : {};

      if (editingItem && editingItem.id && !editingItem.id.startsWith('fb_')) {
        await api.updateMasterItem(editingItem.id, {
          value: formValue.trim(),
          status: formStatus,
          ...partyData,
        });
      } else {
        await api.addMasterItem({
          category: formCategory,
          value: formValue.trim(),
          status: formStatus,
          ...partyData,
        });
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

  // Delete single item (protects static items)
  const handleDeleteItem = async (item) => {
    if (isItemStatic(item)) {
      alert(`'${item.value}' is a permanent static Type/Mode and cannot be deleted.`);
      return;
    }

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
      // Exclude static items from bulk delete
      const deletableIds = idsArray.filter((id) => {
        const item = masterList.find((m) => m.id === id);
        return !isItemStatic(item);
      });

      if (deletableIds.length === 0) {
        alert('Static system items cannot be deleted.');
        return;
      }

      if (Platform.OS === 'web') {
        const ok = window.confirm(`Are you sure you want to delete ${deletableIds.length} selected items?`);
        if (!ok) return;
      }
      try {
        await api.bulkDeleteMasters(deletableIds);
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

  // Download Unified Master Template (Excel .xlsx or CSV .csv with all master columns)
  const handleDownloadTemplate = async (format = 'xlsx') => {
    const url = api.getMasterTemplateUrl(format);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank');
      } else {
        alert(`Master Template URL:\n${url}`);
      }
    }
  };

  // Open Import Modal
  const handleOpenImport = (cat = activeCategory) => {
    setImportCategory(cat);
    setImportRawText('');
    setSelectedImportFile(null);
    setImportPreviewData(null);
    setImportError('');
    setImportSuccess('');
    setImportModalVisible(true);
  };

  // Process File (.xlsx, .xls, .csv, .txt)
  const handleProcessFile = async (file) => {
    if (!file) return;
    setSelectedImportFile(file);
    setImportRawText('');
    setImportError('');
    setImportSuccess('');
    setImporting(true);

    try {
      const res = await api.importMasterFile(file, true, importCategory || activeCategory);
      if (res.success) {
        setImportPreviewData(res);
        if (res.total_new === 0 && res.total_duplicates > 0) {
          setImportError(`All ${res.total_duplicates} records in this file already exist in masters.`);
        } else if (res.total_new === 0) {
          setImportError('No master items found in the selected file.');
        } else {
          setImportSuccess(res.message || `Found ${res.total_new} new items in ${file.name}`);
        }
      } else {
        setImportError(res.detail || 'Failed to parse file');
      }
    } catch (err) {
      setImportError(err.message || 'Failed to read file');
    } finally {
      setImporting(false);
    }
  };

  const handlePickMasterFile = async () => {
    setImportError('');
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const pickedFile = {
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType,
      };
      await handleProcessFile(pickedFile);
    } catch (err) {
      setImportError('Failed to select file: ' + (err.message || ''));
    }
  };

  // Parse Text or CSV in Import Modal
  const handleParseImport = async () => {
    if (!importRawText.trim()) {
      if (selectedImportFile) {
        return handleProcessFile(selectedImportFile);
      }
      setImportError('Please select an Excel / CSV file or paste master records.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');
    setSelectedImportFile(null);

    try {
      const res = await api.importMasterPasted(importRawText, importCategory || activeCategory, true);
      if (res.success) {
        setImportPreviewData(res);
        if (res.total_new === 0 && res.total_duplicates > 0) {
          setImportError(`All ${res.total_duplicates} records already exist in masters.`);
        } else if (res.total_new === 0) {
          setImportError('No valid master items found in input.');
        } else {
          setImportSuccess(res.message || `Found ${res.total_new} new items ready to import.`);
        }
      } else {
        setImportError(res.detail || 'Failed to parse pasted data');
      }
    } catch (err) {
      setImportError(err.message || 'Failed to parse pasted data');
    } finally {
      setImporting(false);
    }
  };

  // Execute Bulk Import directly into MongoDB
  const handleExecuteImport = async () => {
    if (!importPreviewData || importPreviewData.total_new === 0) {
      setImportError('No new items to import. Please select a valid file or preview data first.');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      let res;
      if (selectedImportFile) {
        res = await api.importMasterFile(selectedImportFile, false, importCategory || activeCategory);
      } else {
        res = await api.importMasterPasted(importRawText, importCategory || activeCategory, false);
      }

      if (res.success) {
        const catSummaries = [];
        if (res.categories) {
          Object.values(res.categories).forEach((cat) => {
            if (cat.new_count > 0) {
              catSummaries.push(`${cat.label || cat.category}: ${cat.new_count}`);
            }
          });
        }
        const breakdownStr = catSummaries.length > 0 ? ` (${catSummaries.join(', ')})` : '';
        setImportSuccess(`Successfully imported ${res.total_new} records directly into masters!${breakdownStr}`);
        setImportPreviewData(null);
        setSelectedImportFile(null);
        setImportRawText('');
        await loadMasterDetails();
        if (onRefresh) onRefresh();
      } else {
        setImportError(res.detail || 'Failed to import records');
      }
    } catch (err) {
      setImportError(err.message || 'Failed to import records');
    } finally {
      setImporting(false);
    }
  };

  // Handle file select on web
  const handleWebFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    if (e.target) e.target.value = '';
  };

  // Render individual category metric card
  const renderCategoryCard = (cat) => {
    const isSelected = activeCategory === cat.id;
    const count = categoryCounts[cat.id] || 0;
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.smallCard, isSelected && styles.smallCardActive]}
        onPress={() => handleSelectCategory(cat.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.smallIconWrap, isSelected && styles.smallIconWrapActive]}>
          <Ionicons name={cat.icon} size={17} color={isSelected ? '#0284c7' : '#64748b'} />
        </View>
        <View style={styles.smallCardInfo}>
          <Text style={[styles.smallCardTitle, isSelected && styles.smallCardTitleActive]} numberOfLines={1}>
            {cat.label}
          </Text>
          <View style={styles.smallCardNumRow}>
            <Text style={styles.smallCardCount}>{count}</Text>
            <Text style={[styles.smallCardView, isSelected && styles.smallCardViewActive]}>
              {isMobile ? 'Open →' : 'View →'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ==========================================
  // MOBILE VIEW 1: DEDICATED FULL-SCREEN LIST PAGE
  // ==========================================
  const renderMobileDetailPage = () => {
    return (
      <View style={styles.mobileDetailContainer}>
        {/* Sticky Top Header with Back Button */}
        <View style={styles.mobileDetailHeader}>
          <TouchableOpacity
            style={styles.mobileBackBtn}
            onPress={() => setMobileDetailCategory(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#0284c7" />
            <Text style={styles.mobileBackBtnText}>Masters</Text>
          </TouchableOpacity>

          <View style={styles.mobileDetailHeaderCenter}>
            <Ionicons name={currentCatConfig.icon} size={17} color="#0f172a" style={{ marginRight: 5 }} />
            <Text style={styles.mobileDetailHeaderTitle} numberOfLines={1}>
              {currentCatConfig.label}
            </Text>
            <View style={styles.mobileDetailCountBadge}>
              <Text style={styles.mobileDetailCountBadgeText}>
                {categoryCounts[activeCategory] || 0}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.mobileAddBtnSmall}
            onPress={() => handleOpenAdd(activeCategory)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 2 }} />
            <Text style={styles.mobileAddBtnSmallText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Category Switcher Tabs */}
        <View style={styles.mobileCategoryPillsScrollWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileCategoryPillsRow}>
            {CATEGORIES.map((cat) => {
              const isCatActive = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.mobileCatPill, isCatActive && styles.mobileCatPillActive]}
                  onPress={() => handleSelectCategory(cat.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={cat.icon}
                    size={13}
                    color={isCatActive ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.mobileCatPillText, isCatActive && styles.mobileCatPillTextActive]}>
                    {cat.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={styles.mobileSearchBoxWrap}>
          <View style={styles.mobileSearchBox}>
            <Ionicons name="search-outline" size={16} color="#0284c7" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.mobileSearchInput}
              placeholder={`Search ${currentCatConfig.label}...`}
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Filter Pills & Bulk Actions */}
        <View style={styles.mobileFilterPillBar}>
          <View style={styles.mobileStatusGroup}>
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
                  style={[styles.mobileFilterPill, isSelected && styles.mobileFilterPillActive]}
                  onPress={() => setStatusFilter(st)}
                >
                  <Text style={[styles.mobileFilterPillText, isSelected && styles.mobileFilterPillTextActive]}>
                    {st} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedIds.size > 0 && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.mobileBulkBtn}
                onPress={() => setBulkMenuVisible(!bulkMenuVisible)}
                activeOpacity={0.8}
              >
                <Ionicons name="layers-outline" size={13} color="#0284c7" style={{ marginRight: 4 }} />
                <Text style={styles.mobileBulkBtnText}>Bulk ({selectedIds.size})</Text>
                <Ionicons name="chevron-down" size={11} color="#0284c7" style={{ marginLeft: 3 }} />
              </TouchableOpacity>

              {bulkMenuVisible && (
                <View style={styles.bulkDropdownMenu}>
                  <TouchableOpacity style={styles.bulkMenuItem} onPress={() => handleBulkAction('activate')}>
                    <Ionicons name="checkmark-circle-outline" size={15} color="#16a34a" />
                    <Text style={styles.bulkMenuText}>Set as Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bulkMenuItem} onPress={() => handleBulkAction('deactivate')}>
                    <Ionicons name="pause-circle-outline" size={15} color="#eab308" />
                    <Text style={styles.bulkMenuText}>Set as Inactive</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity style={styles.bulkMenuItem} onPress={() => handleBulkAction('delete')}>
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                    <Text style={[styles.bulkMenuText, { color: '#ef4444' }]}>Delete Selected</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* List Controls: Select All & Sort */}
        <View style={styles.mobileListMetaRow}>
          <TouchableOpacity
            style={styles.mobileSelectAllBtn}
            onPress={toggleSelectAll}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                selectedIds.size === activeRecords.length && activeRecords.length > 0
                  ? 'checkbox'
                  : 'square-outline'
              }
              size={18}
              color={selectedIds.size > 0 ? '#0284c7' : '#94a3b8'}
            />
            <Text style={styles.mobileSelectAllText}>
              {selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileSortToggle}
            onPress={() => setSortAsc(!sortAsc)}
            activeOpacity={0.7}
          >
            <Text style={styles.mobileSortToggleText}>{sortAsc ? 'A → Z' : 'Z → A'}</Text>
            <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={12} color="#64748b" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        {/* Native Scrollable Card List */}
        <ScrollView
          style={styles.mobileDetailScroll}
          contentContainerStyle={styles.mobileDetailScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={styles.loadingText}>Loading master data...</Text>
            </View>
          ) : activeRecords.length === 0 ? (
            <View style={styles.mobileEmptyState}>
              <Ionicons name="folder-open-outline" size={44} color="#cbd5e1" />
              <Text style={styles.mobileEmptyTitle}>No {currentCatConfig.label} Found</Text>
              <Text style={styles.mobileEmptySubtitle}>
                {searchQuery || statusFilter !== 'All'
                  ? 'No records match your current filter or search.'
                  : `No records yet in ${currentCatConfig.label}. Tap "+ Add" to create one.`}
              </Text>
              {(searchQuery || statusFilter !== 'All') ? (
                <TouchableOpacity
                  style={styles.mobileResetFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                  }}
                >
                  <Text style={styles.mobileResetFilterBtnText}>Show All Records</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.mobileResetFilterBtn}
                  onPress={() => handleOpenAdd(activeCategory)}
                >
                  <Text style={styles.mobileResetFilterBtnText}>+ Add {currentCatConfig.singular}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {activeRecords.map((item, idx) => {
                const rowNumber = idx + 1;
                const isSelected = selectedIds.has(item.id);
                const isActive = item.status === 'Active';
                const isStatic = isItemStatic(item);
                const hasSubTypes = item.sub_types && item.sub_types.length > 0;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.mobileItemCard,
                      isSelected && styles.mobileItemCardSelected,
                    ]}
                  >
                    {/* Top Row: Checkbox, Index, Value, Status Badge */}
                    <View style={styles.mobileItemCardTop}>
                      <TouchableOpacity
                        style={styles.mobileItemCheckbox}
                        onPress={() => toggleSelectOne(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={isSelected ? '#0284c7' : '#94a3b8'}
                        />
                      </TouchableOpacity>

                      <View style={styles.mobileItemIndexBadge}>
                        <Text style={styles.mobileItemIndexText}>#{rowNumber}</Text>
                      </View>

                      <View style={styles.mobileItemValueWrap}>
                        <Text style={styles.mobileItemValueText} numberOfLines={2}>
                          {item.value}
                        </Text>
                        {item.category === 'PartyName' && (item.city || item.state) ? (
                          <Text style={styles.partyCardSubText} numberOfLines={1}>
                            <Ionicons name="location-outline" size={11} color="#64748b" /> {item.city ? `${item.city}, ${item.state || ''}` : item.state}
                          </Text>
                        ) : null}
                        {item.category === 'PartyName' && item.gst_type === 'Registered' && item.gst_no ? (
                          <View style={styles.partyGstBadgeRd}>
                            <Text style={styles.partyGstBadgeRdText}>
                              GST: {item.gst_no}
                            </Text>
                          </View>
                        ) : null}
                        {item.created_at ? (
                          <Text style={styles.mobileItemDateText}>
                            Added {formatDate(item.created_at)}
                          </Text>
                        ) : null}
                      </View>

                      {/* Status Badge (Tap to toggle status) */}
                      <TouchableOpacity
                        style={[
                          styles.statusBadge,
                          isActive ? styles.badgeActive : styles.badgeInactive,
                          styles.mobileStatusBadgeTouch,
                        ]}
                        onPress={() => handleToggleStatus(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.statusDot, isActive ? styles.dotActive : styles.dotInactive]} />
                        <Text style={[styles.statusBadgeText, isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                          {item.status}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sub-types if any */}
                    {hasSubTypes && (
                      <View style={styles.mobileSubTypesBox}>
                        <Text style={styles.mobileSubTypesTitle}>Sub-types / Options:</Text>
                        {item.sub_types.map((sub, sIdx) => (
                          <View key={`${item.id}_sub_${sIdx}`} style={styles.mobileSubTypeRowItem}>
                            <Ionicons name="return-down-forward-outline" size={13} color="#0284c7" />
                            <Text style={styles.mobileSubTypeLabel}>{sub.label || sub.value}</Text>
                            <View style={[styles.statusBadge, styles.badgeActive, { marginLeft: 'auto', paddingVertical: 1, paddingHorizontal: 5 }]}>
                              <View style={[styles.statusDot, styles.dotActive, { width: 4, height: 4 }]} />
                              <Text style={[styles.statusBadgeText, styles.badgeTextActive, { fontSize: 8.5 }]}>Active</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Bottom Row: Quick Actions */}
                    <View style={styles.mobileItemCardBottom}>
                      <TouchableOpacity
                        style={styles.mobileActionBtn}
                        onPress={() => handleToggleStatus(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isActive ? 'pause-circle-outline' : 'checkmark-circle-outline'}
                          size={14}
                          color={isActive ? '#ca8a04' : '#16a34a'}
                        />
                        <Text style={[styles.mobileActionBtnText, { color: isActive ? '#ca8a04' : '#16a34a' }]}>
                          {isActive ? 'Deactivate' : 'Activate'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mobileActionBtn}
                        onPress={() => handleOpenEdit(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil-outline" size={13} color="#0284c7" />
                        <Text style={[styles.mobileActionBtnText, { color: '#0284c7' }]}>Edit</Text>
                      </TouchableOpacity>

                      {!isStatic && (
                        <TouchableOpacity
                          style={[styles.mobileActionBtn, styles.mobileActionBtnDelete]}
                          onPress={() => handleDeleteItem(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={13} color="#ef4444" />
                          <Text style={[styles.mobileActionBtnText, { color: '#ef4444' }]}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* End of list footer */}
              <View style={styles.mobileListFooter}>
                <Text style={styles.mobileListFooterText}>
                  Showing all {activeRecords.length} {currentCatConfig.label} records
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  // ==========================================
  // MOBILE VIEW 2: APP-BASED MASTERS OVERVIEW HUB
  // ==========================================
  const renderMobileHubPage = () => {
    return (
      <ScrollView
        style={styles.mobileHubScroll}
        contentContainerStyle={styles.mobileHubScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hub Header */}
        <View style={styles.mobileHubHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.pageTitle}>Masters Management</Text>
            <Text style={styles.pageSubtitle}>
              Tap any master directory to open its full list.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => handleOpenAdd(activeCategory)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.btnPrimaryText}>Add Master</Text>
          </TouchableOpacity>
        </View>

        {/* Master Categories List */}
        <View style={styles.mobileHubSection}>
          <Text style={styles.mobileSectionHeading}>MASTER DIRECTORIES</Text>

          <View style={styles.mobileHubCardsCol}>
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.mobileHubCatCard}
                  onPress={() => handleSelectCategory(cat.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.mobileHubCatIconWrap}>
                    <Ionicons name={cat.icon} size={22} color="#0284c7" />
                  </View>

                  <View style={styles.mobileHubCatContent}>
                    <Text style={styles.mobileHubCatTitle}>{cat.label}</Text>
                    <Text style={styles.mobileHubCatSub} numberOfLines={1}>
                      {cat.id === 'VehicleNo' && 'Truck & transport plate numbers'}
                      {cat.id === 'TransportName' && 'Logistics & transport agencies'}
                      {cat.id === 'MaterialName' && 'Aggregates, stones & raw materials'}
                      {cat.id === 'PartyName' && 'Registered buyers & customers'}
                      {cat.id === 'AdditionalCharges' && 'Freight, loading, toll & extra levies'}
                    </Text>
                  </View>

                  <View style={styles.mobileHubCatRight}>
                    <View style={styles.mobileHubCountBadge}>
                      <Text style={styles.mobileHubCountText}>{count}</Text>
                    </View>
                    <View style={styles.mobileHubOpenRow}>
                      <Text style={styles.mobileHubOpenText}>Open list</Text>
                      <Ionicons name="chevron-forward" size={13} color="#0284c7" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Batch Operations & Tools */}
        <View style={styles.mobileHubSection}>
          <Text style={styles.mobileSectionHeading}>BATCH OPERATIONS & TOOLS</Text>

          <View style={styles.mobileToolsGrid}>
            {/* Import Excel */}
            <TouchableOpacity
              style={styles.mobileToolCard}
              onPress={() => handleOpenImport(activeCategory)}
              activeOpacity={0.8}
            >
              <View style={[styles.mobileToolIconWrap, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mobileToolTitle}>Import from Excel / CSV</Text>
                <Text style={styles.mobileToolSub}>
                  Upload spreadsheets with automatic multi-column master detection.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>

            {/* Download Template */}
            <TouchableOpacity
              style={styles.mobileToolCard}
              onPress={() => handleDownloadTemplate('xlsx')}
              activeOpacity={0.8}
            >
              <View style={[styles.mobileToolIconWrap, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="download-outline" size={22} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mobileToolTitle}>Download Sample Template</Text>
                <Text style={styles.mobileToolSub}>
                  Pre-formatted .xlsx file with VehicleNo, Transport, Material & Party.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>

            {/* Sync Database */}
            <TouchableOpacity
              style={styles.mobileToolCard}
              onPress={handleSync}
              activeOpacity={0.8}
            >
              <View style={[styles.mobileToolIconWrap, { backgroundColor: '#f8fafc' }]}>
                <Ionicons name="sync-outline" size={22} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mobileToolTitle}>Sync & Refresh Data</Text>
                <Text style={styles.mobileToolSub}>
                  Pull fresh master list directly from database.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  // ==========================================
  // DESKTOP VIEW: FULL SPREADSHEET DASHBOARD
  // ==========================================
  const renderDesktopView = () => {
    return (
      <>
        {/* Desktop Header */}
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
              onPress={() => handleDownloadTemplate('xlsx')}
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

        {/* Desktop Metric Cards */}
        <View style={styles.metricCardsContainer}>
          <View style={styles.metricRowDesktop}>
            {CATEGORIES.map((cat) => renderCategoryCard(cat))}
          </View>
        </View>

        {/* Main Work Area: Spreadsheet Table */}
        <View style={styles.mainLayoutGrid}>
          <View style={styles.tableContainerCard}>
            {/* Horizontal Tabs */}
            <View style={styles.horizontalTabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.tabButton, isActive && styles.tabButtonActive]}
                      onPress={() => handleSelectCategory(cat.id)}
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

            {/* Filter & Action Bar */}
            <View style={styles.filterActionBar}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
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

              <View style={styles.filterPillsRow}>
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

                {/* Bulk Actions */}
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
                      color={selectedIds.size > 0 ? '#0284c7' : '#0f172a'}
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
            </View>

            {/* Desktop Table View */}
            <View style={styles.tableResponsiveWrapper}>
              <View style={styles.fullTable}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <TouchableOpacity
                    style={[styles.thCell, { width: 40, alignItems: 'center', paddingHorizontal: 0 }]}
                    onPress={toggleSelectAll}
                  >
                    <Ionicons
                      name={
                        selectedIds.size === activeRecords.length && activeRecords.length > 0
                          ? 'checkbox'
                          : 'square-outline'
                      }
                      size={16}
                      color={selectedIds.size > 0 ? '#0284c7' : '#94a3b8'}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.thCell, { width: 46, textAlign: 'center', paddingHorizontal: 1, fontSize: 11 }]}>#</Text>

                  <TouchableOpacity
                    style={[styles.thCell, { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }]}
                    onPress={() => setSortAsc(!sortAsc)}
                  >
                    <Text style={styles.thCellText} numberOfLines={1}>
                      {currentCatConfig.label}
                    </Text>
                    <Ionicons
                      name={sortAsc ? 'arrow-up' : 'arrow-down'}
                      size={13}
                      color="#64748b"
                      style={{ marginLeft: 2 }}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.thCell, { width: 110, textAlign: 'center', paddingHorizontal: 1, fontSize: 11 }]}>
                    Status
                  </Text>

                  <Text style={[styles.thCell, { width: 110, textAlign: 'center', paddingHorizontal: 1, fontSize: 11 }]}>
                    Actions
                  </Text>
                </View>

                {/* Table Body */}
                <ScrollView
                  style={styles.tableBodyScrollView}
                  contentContainerStyle={styles.tableBodyScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  {loading ? (
                    <View style={styles.loadingArea}>
                      <ActivityIndicator size="small" color="#0284c7" />
                      <Text style={styles.loadingText}>Loading master data...</Text>
                    </View>
                  ) : activeRecords.length === 0 ? (
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
                    activeRecords.map((item, idx) => {
                      const rowNumber = idx + 1;
                      const isSelected = selectedIds.has(item.id);
                      const isActive = item.status === 'Active';
                      const isStatic = isItemStatic(item);
                      const hasSubTypes = item.sub_types && item.sub_types.length > 0;

                      return (
                        <React.Fragment key={item.id}>
                          <View
                            style={[
                              styles.tableRow,
                              idx % 2 === 1 && styles.tableRowEven,
                              isSelected && styles.tableRowSelected,
                            ]}
                          >
                            <TouchableOpacity
                              style={[styles.tdCell, { width: 40, alignItems: 'center', paddingHorizontal: 0 }]}
                              onPress={() => toggleSelectOne(item.id)}
                            >
                              <Ionicons
                                name={isSelected ? 'checkbox' : 'square-outline'}
                                size={16}
                                color={isSelected ? '#0284c7' : '#94a3b8'}
                              />
                            </TouchableOpacity>

                            <Text style={[styles.tdCell, { width: 46, textAlign: 'center', paddingHorizontal: 1, color: '#64748b', fontSize: 12 }]}>
                              {rowNumber}
                            </Text>

                            <View style={[styles.tdCell, { flex: 1, minWidth: 180, paddingHorizontal: 6, justifyContent: 'center' }]}>
                              <Text style={[styles.boldCell, { fontSize: 13, color: '#0f172a' }]} numberOfLines={1}>
                                {item.value}
                              </Text>
                              {item.category === 'PartyName' && (item.city || item.state || (item.gst_type === 'Registered' && item.gst_no)) ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                  {(item.city || item.state) ? (
                                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                                      📍 {item.city ? `${item.city}, ${item.state || ''}` : item.state}
                                    </Text>
                                  ) : null}
                                  {item.gst_type === 'Registered' && item.gst_no ? (
                                    <View style={styles.partyGstBadgeRd}>
                                      <Text style={styles.partyGstBadgeRdText}>GST: {item.gst_no}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>

                            <View style={[styles.tdCell, { width: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 }]}>
                              <TouchableOpacity
                                style={[
                                  styles.statusBadge,
                                  isActive ? styles.badgeActive : styles.badgeInactive,
                                ]}
                                onPress={() => handleToggleStatus(item)}
                                title="Click to toggle status"
                              >
                                <View
                                  style={[
                                    styles.statusDot,
                                    isActive ? styles.dotActive : styles.dotInactive,
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                                  ]}
                                >
                                  {item.status}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            <View style={[styles.tdCell, { width: 110, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 1 }]}>
                              <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={() => handleOpenEdit(item)}
                                title="Edit"
                              >
                                <Ionicons name="pencil-outline" size={15} color="#0284c7" />
                              </TouchableOpacity>

                              {!isStatic && (
                                <TouchableOpacity
                                  style={styles.actionIconBtn}
                                  onPress={() => handleDeleteItem(item)}
                                  title="Delete"
                                >
                                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={() => handleToggleStatus(item)}
                                title={isActive ? 'Deactivate' : 'Activate'}
                              >
                                <Ionicons name="ellipsis-horizontal" size={15} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {hasSubTypes && item.sub_types.map((sub, sIdx) => {
                            const isLast = sIdx === item.sub_types.length - 1;
                            const branchChar = isLast ? '└─ ' : '├─ ';
                            return (
                              <View
                                key={`${item.id}_sub_${sIdx}`}
                                style={[
                                  styles.tableRow,
                                  styles.subTypeRow,
                                ]}
                              >
                                <View style={[styles.tdCell, { width: 40, alignItems: 'center', paddingHorizontal: 0 }]} />
                                <Text style={[styles.tdCell, { width: 46, textAlign: 'center', paddingHorizontal: 1, color: '#94a3b8', fontSize: 11 }]}>
                                  {`${rowNumber}.${sIdx + 1}`}
                                </Text>
                                <View style={[styles.tdCell, { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 6 }]}>
                                  <Text style={styles.subTypeBranchText}>{branchChar}</Text>
                                  <Text style={styles.subTypeValueText}>
                                    {sub.label || sub.value}
                                  </Text>
                                </View>
                                <View style={[styles.tdCell, { width: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 }]}>
                                  <View style={[styles.statusBadge, styles.badgeActive]}>
                                    <View style={[styles.statusDot, styles.dotActive]} />
                                    <Text style={[styles.statusBadgeText, styles.badgeTextActive]}>
                                      Active
                                    </Text>
                                  </View>
                                </View>
                                <View style={[styles.tdCell, { width: 110, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 1 }]} />
                              </View>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>

            {/* Desktop Table Footer */}
            <View style={styles.paginationBar}>
              <Text style={styles.paginationInfo}>
                Showing all {activeRecords.length} {currentCatConfig.label} records &bull; Scroll to view all
              </Text>

              {selectedIds.size > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="checkmark-done" size={14} color="#0284c7" />
                  <Text style={[styles.paginationInfo, { color: '#0284c7', fontWeight: '700' }]}>
                    {selectedIds.size} of {activeRecords.length} selected
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={[styles.pageContainer, isMobile && styles.mobilePageContainer]}>
      {/* Hidden file input for web upload (Excel & CSV) */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          style={{ display: 'none' }}
          onChange={handleWebFileSelect}
        />
      )}

      {isMobile ? (
        mobileDetailCategory !== null ? (
          renderMobileDetailPage()
        ) : (
          renderMobileHubPage()
        )
      ) : (
        renderDesktopView()
      )}

      {/* MODAL 1: ADD / EDIT MASTER ITEM */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalDialog, formCategory === 'PartyName' && { maxWidth: 580 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem
                  ? (formCategory === 'PartyName' ? 'Edit Party Name' : `Edit ${currentCatConfig.singular}`)
                  : (formCategory === 'PartyName' ? 'Add Party Name' : `Add ${currentCatConfig.singular}`)}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalBody, formCategory === 'PartyName' && { maxHeight: isMobile ? 480 : 560 }]}>
              {modalError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={15} color="#b91c1c" />
                  <Text style={styles.errorBannerText}>{modalError}</Text>
                </View>
              ) : null}

              {formCategory === 'PartyName' ? (
                <ScrollView
                  style={{ maxHeight: isMobile ? 380 : 460 }}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Party Name * */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      Party Name <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Enter Party Name (e.g. NAWAZ KHAN)"
                      placeholderTextColor="#94a3b8"
                      value={formValue}
                      onChangeText={setFormValue}
                      autoFocus
                    />
                  </View>

                  {/* Address 1 */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Address 1</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Building No., Street, Area"
                      placeholderTextColor="#94a3b8"
                      value={formAddress1}
                      onChangeText={setFormAddress1}
                    />
                  </View>

                  {/* Address 2 */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Address 2</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Landmark, Locality (Optional)"
                      placeholderTextColor="#94a3b8"
                      value={formAddress2}
                      onChangeText={setFormAddress2}
                    />
                  </View>

                  {/* City * (Clean standalone field - ZERO blank gap) */}
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                      City <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Indore"
                      placeholderTextColor="#94a3b8"
                      value={formCity}
                      onChangeText={setFormCity}
                    />
                  </View>

                  {/* State * (Simple Dropdown on form - FLOATS over PIN code without layout shift) */}
                  <View style={[styles.formGroup, { position: 'relative', zIndex: stateDropdownOpen ? 9999 : 20, elevation: stateDropdownOpen ? 50 : 1 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={styles.formLabel}>
                        State <Text style={{ color: '#ef4444' }}>*</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setStateDropdownOpen(true);
                          setIsAddingNewState(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11.5, color: '#0284c7', fontWeight: '700' }}>
                          + Add New State
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dropdown Trigger Box */}
                    <TouchableOpacity
                      style={[
                        styles.formInput,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#ffffff',
                          borderColor: stateDropdownOpen ? '#0284c7' : '#cbd5e1',
                        },
                      ]}
                      onPress={() => {
                        setStateDropdownOpen(!stateDropdownOpen);
                        if (!stateDropdownOpen) {
                          setStateSearchText('');
                          setIsAddingNewState(false);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="location-outline" size={15} color="#0284c7" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 13, color: formState ? '#0f172a' : '#94a3b8', fontWeight: '500' }} numberOfLines={1}>
                          {formState || 'Select State'}
                        </Text>
                      </View>
                      <Ionicons
                        name={stateDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={stateDropdownOpen ? '#0284c7' : '#64748b'}
                      />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Ionicons name="information-circle-outline" size={12} color="#0284c7" />
                      <Text style={{ fontSize: 10.5, color: '#0369a1', fontStyle: 'italic' }}>
                        State se we need to calculate C/S or IGST
                      </Text>
                    </View>

                    {/* Floating Dropdown Menu (Overlays PIN code without moving form elements) */}
                    {stateDropdownOpen && (
                      <View style={styles.stateDropdownFloatingMenu}>
                        {/* Search Input */}
                        <View style={styles.stateDropdownSearchWrap}>
                          <Ionicons name="search" size={14} color="#0284c7" style={{ marginRight: 6 }} />
                          <TextInput
                            style={styles.stateDropdownSearchInput}
                            placeholder="Search state..."
                            placeholderTextColor="#94a3b8"
                            value={stateSearchText}
                            onChangeText={setStateSearchText}
                            autoFocus={!isAddingNewState}
                          />
                          {stateSearchText ? (
                            <TouchableOpacity onPress={() => setStateSearchText('')} style={{ padding: 4 }}>
                              <Ionicons name="close-circle" size={15} color="#94a3b8" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity onPress={() => setStateDropdownOpen(false)} style={{ padding: 4 }}>
                              <Ionicons name="close" size={16} color="#64748b" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Add New State Row */}
                        {!isAddingNewState ? (
                          <TouchableOpacity
                            style={styles.stateDropdownAddRow}
                            onPress={() => setIsAddingNewState(true)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="add-circle-outline" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                            <Text style={styles.stateDropdownAddRowText}>+ Add New State to Master</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.stateDropdownInlineAddBox}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369a1', marginBottom: 4 }}>
                              Add State to Master Database:
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                              <TextInput
                                style={[styles.formInput, { flex: 1, height: 32, fontSize: 12, paddingHorizontal: 8 }]}
                                placeholder="Enter state name (e.g. Goa, Ladakh)"
                                placeholderTextColor="#94a3b8"
                                value={newStateInput}
                                onChangeText={setNewStateInput}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.stateDropdownAddSubmitBtn}
                                onPress={() => handleAddNewState()}
                              >
                                <Text style={styles.stateDropdownAddSubmitBtnText}>Add</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.stateDropdownAddCancelBtn}
                                onPress={() => setIsAddingNewState(false)}
                              >
                                <Ionicons name="close" size={16} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Scrollable list of Indian States */}
                        <ScrollView
                          style={{ maxHeight: 180 }}
                          contentContainerStyle={{ paddingVertical: 2 }}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled={true}
                        >
                          {(() => {
                            const filtered = stateList.filter(
                              (st) => !stateSearchText.trim() || st.toLowerCase().includes(stateSearchText.trim().toLowerCase())
                            );

                            if (filtered.length === 0) {
                              return (
                                <View style={{ padding: 12, alignItems: 'center' }}>
                                  <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                                    No state found matching "{stateSearchText}"
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.stateDropdownAddSubmitBtn}
                                    onPress={() => handleAddNewState(stateSearchText)}
                                  >
                                    <Text style={styles.stateDropdownAddSubmitBtnText}>
                                      + Add "{stateSearchText}"
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            }

                            return filtered.map((st) => {
                              const isSelected = formState === st;
                              return (
                                <TouchableOpacity
                                  key={st}
                                  style={[
                                    styles.stateDropdownItem,
                                    isSelected && styles.stateDropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    setFormState(st);
                                    setStateDropdownOpen(false);
                                    setStateSearchText('');
                                    setIsAddingNewState(false);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.stateDropdownItemText,
                                      isSelected && styles.stateDropdownItemTextActive,
                                    ]}
                                  >
                                    {st}
                                  </Text>
                                  {isSelected && (
                                    <Ionicons name="checkmark" size={15} color="#0284c7" />
                                  )}
                                </TouchableOpacity>
                              );
                            });
                          })()}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* PIN Code (zIndex: 1 with relative position so dropdown floats OVER it) */}
                  <View style={[styles.formGroup, { position: 'relative', zIndex: 1 }]}>
                    <Text style={styles.formLabel}>PIN Code</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. 452001"
                      placeholderTextColor="#94a3b8"
                      value={formPinCode}
                      onChangeText={setFormPinCode}
                      keyboardType="numeric"
                      maxLength={6}
                    />
                  </View>

                      {/* Mobile No. & Email ID Row */}
                      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, position: 'relative', zIndex: 1 }}>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Mobile No.</Text>
                          <TextInput
                            style={styles.formInput}
                            placeholder="10-digit mobile number"
                            placeholderTextColor="#94a3b8"
                            value={formMobileNo}
                            onChangeText={setFormMobileNo}
                            keyboardType="phone-pad"
                            maxLength={10}
                          />
                        </View>

                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Email ID</Text>
                          <TextInput
                            style={styles.formInput}
                            placeholder="party@example.com"
                            placeholderTextColor="#94a3b8"
                            value={formEmailId}
                            onChangeText={setFormEmailId}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      {/* GST Details */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>GST Type</Text>
                        <View style={styles.gstTypeToggleRow}>
                          <TouchableOpacity
                            style={[
                              styles.gstTypeBtn,
                              formGstType === 'Unregistered' && styles.gstTypeBtnActiveUnreg,
                            ]}
                            onPress={() => {
                              setFormGstType('Unregistered');
                              setFormGstNo('');
                            }}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={14}
                              color={formGstType === 'Unregistered' ? '#0284c7' : '#94a3b8'}
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.gstTypeBtnText,
                                formGstType === 'Unregistered' && styles.gstTypeBtnTextActiveUnreg,
                              ]}
                            >
                              Unregistered
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.gstTypeBtn,
                              formGstType === 'Registered' && styles.gstTypeBtnActiveReg,
                            ]}
                            onPress={() => {
                              setFormGstType('Registered');
                            }}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={14}
                              color={formGstType === 'Registered' ? '#16a34a' : '#94a3b8'}
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.gstTypeBtnText,
                                formGstType === 'Registered' && styles.gstTypeBtnTextActiveReg,
                              ]}
                            >
                              Registered
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* GSTIN Number: Shown ONLY if Registered (if Unregistered, kuch nhi) */}
                      {formGstType === 'Registered' && (
                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>
                            GSTIN Number <Text style={{ color: '#ef4444' }}>*</Text>
                          </Text>
                          <TextInput
                            style={styles.formInput}
                            placeholder="Enter GSTIN Number (e.g. 23AAAAA0000A1Z5)"
                            placeholderTextColor="#94a3b8"
                            value={formGstNo}
                            onChangeText={(t) => setFormGstNo(t.toUpperCase())}
                            autoCapitalize="characters"
                            maxLength={15}
                            autoFocus
                          />
                        </View>
                      )}

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
                    </ScrollView>
                  ) : (
                    /* For all other categories: simple single input */
                    <>
                      {/* Value input */}
                      <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>
                          {(CATEGORIES.find((c) => c.id === formCategory) || currentCatConfig).singular} <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <TextInput
                          style={styles.formInput}
                          placeholder={`Enter ${(CATEGORIES.find((c) => c.id === formCategory) || currentCatConfig).singular.toLowerCase()} (e.g. ${(CATEGORIES.find((c) => c.id === formCategory) || currentCatConfig).sample})`}
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
                    </>
                  )}
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

      {/* MODAL 2: IMPORT MASTER DATA (Excel & CSV with Multi-column Auto-detection) */}
      <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalDialog, { maxWidth: 620 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cloud-upload-outline" size={20} color="#0284c7" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Import Master Data (Excel & CSV)</Text>
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
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.importStepTitle}>Download Multi-Master Template</Text>
                  <Text style={styles.importStepSub}>
                    One sheet with columns: VehicleNo, TransportName, MaterialName, PartyName, Type/Mode.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.downloadTemplateBtn}
                    onPress={() => handleDownloadTemplate('xlsx')}
                  >
                    <Ionicons name="document-text-outline" size={13} color="#0284c7" style={{ marginRight: 4 }} />
                    <Text style={styles.downloadTemplateBtnText}>Excel (.xlsx)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.downloadTemplateBtn}
                    onPress={() => handleDownloadTemplate('csv')}
                  >
                    <Ionicons name="download-outline" size={13} color="#0284c7" style={{ marginRight: 4 }} />
                    <Text style={styles.downloadTemplateBtnText}>CSV (.csv)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* File upload drag drop zone */}
              {selectedImportFile ? (
                <View style={styles.selectedFileBox}>
                  <Ionicons name="document-attach-outline" size={28} color="#0284c7" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                      {selectedImportFile.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Size: {(selectedImportFile.size / 1024).toFixed(1)} KB &bull; Ready to process
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.browseFileBtn}
                    onPress={handlePickMasterFile}
                  >
                    <Text style={styles.browseFileBtnText}>Change File</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {Platform.OS === 'web' && (
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls,.csv,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleProcessFile(f);
                      }}
                    />
                  )}
                  <TouchableOpacity
                    style={[
                      styles.uploadZone,
                      isDraggingOver && { borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
                    ]}
                    onPress={handlePickMasterFile}
                    activeOpacity={0.8}
                    {...(Platform.OS === 'web'
                      ? {
                          onDragOver: (e) => {
                            e.preventDefault();
                            setIsDraggingOver(true);
                          },
                          onDragLeave: (e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                          },
                          onDrop: (e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                            const f = e.dataTransfer?.files?.[0];
                            if (f) handleProcessFile(f);
                          },
                        }
                      : {})}
                  >
                    <Ionicons name="cloud-upload-outline" size={34} color="#0284c7" />
                    <Text style={styles.uploadZoneTitle}>Choose file or drag and drop</Text>
                    <Text style={styles.uploadZoneSub}>
                      Excel (.xlsx, .xls) / CSV (Max 10MB) &bull; All master columns auto-mapped
                    </Text>

                    <View style={styles.browseFileBtn}>
                      <Text style={styles.browseFileBtnText}>Browse Excel / CSV File</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* Or paste text */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Or Paste Master Records (Copied from Excel or CSV with columns):
                </Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top', paddingTop: 8, fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]}
                  placeholder={"VehicleNo\tTransportName\tMaterialName\tPartyName\nMP09DD5763\tVMPL\t20MM\tNAWAZ KHAN\nMH12AB1234\tMSK\t10MM\tALTAMASH KHAN"}
                  placeholderTextColor="#94a3b8"
                  value={importRawText}
                  onChangeText={(txt) => {
                    setImportRawText(txt);
                    if (selectedImportFile) setSelectedImportFile(null);
                  }}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.btnOutlineSecondary, importing && { opacity: 0.7 }]}
                onPress={handleParseImport}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#0284c7" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="eye-outline" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.btnOutlineSecondaryText}>
                  {importing ? 'Processing File...' : 'Upload & Preview Data'}
                </Text>
              </TouchableOpacity>

              {/* Multi-Category Master Preview */}
              {importPreviewData && (
                <View style={styles.previewBox}>
                  <View style={styles.previewSummaryHeader}>
                    <Text style={styles.previewTitle}>
                      Detected Master Records in Sheet:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={styles.catBadgeNew}>
                        <Text style={styles.catBadgeNewText}>
                          {importPreviewData.total_new} New Masters
                        </Text>
                      </View>
                      {importPreviewData.total_duplicates > 0 && (
                        <View style={styles.catBadgeDup}>
                          <Text style={styles.catBadgeDupText}>
                            {importPreviewData.total_duplicates} Duplicates Skipped
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Render cards for each detected master category */}
                  {CATEGORIES.map((cat) => {
                    const catInfo = importPreviewData.categories?.[cat.id];
                    if (!catInfo || catInfo.total_found === 0) return null;

                    return (
                      <View key={cat.id} style={styles.multiCatCard}>
                        <View style={styles.multiCatHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name={cat.icon} size={15} color="#0284c7" style={{ marginRight: 6 }} />
                            <Text style={styles.multiCatName}>{cat.label}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.multiCatCount}>
                              {catInfo.new_count} to insert
                            </Text>
                            {catInfo.duplicate_count > 0 && (
                              <Text style={{ fontSize: 10, color: '#ca8a04', fontWeight: '600' }}>
                                ({catInfo.duplicate_count} existing)
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.previewListChips}>
                          {(catInfo.sample_new || []).map((val, idx) => (
                            <View key={idx} style={styles.previewChip}>
                              <Text style={styles.previewChipText}>{val}</Text>
                            </View>
                          ))}
                          {catInfo.new_count > (catInfo.sample_new?.length || 0) && (
                            <Text style={{ fontSize: 10, color: '#64748b', alignSelf: 'center' }}>
                              +{catInfo.new_count - catInfo.sample_new.length} more...
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
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

              {importPreviewData && importPreviewData.total_new > 0 && (
                <TouchableOpacity
                  style={[styles.modalSaveBtn, importing && { opacity: 0.7 }]}
                  onPress={handleExecuteImport}
                  disabled={importing}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>
                      Import & Push All {importPreviewData.total_new} Masters
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    backgroundColor: '#f8fafc',
    padding: 16,
    overflow: 'hidden',
  },
  mobilePageContainer: {
    padding: 0,
    overflow: 'visible',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
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
    marginBottom: 10,
  },
  metricRowDesktop: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  mobileCardsGrid: {
    gap: 8,
  },
  mobileCardsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  mobileActionBox: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
  },
  mobileImportBtn: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#6ee7b7',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  mobileImportBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
  },
  mobileTemplateBtn: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#93c5fd',
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  mobileTemplateBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
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
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  tableContainerCard: {
    flex: 1,
    minHeight: 0,
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
    display: 'flex',
    flexDirection: 'column',
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
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  searchBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0f172a',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusFilterGroup: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  statusPillText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
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
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  fullTable: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  tableBodyScrollView: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  tableBodyScrollContent: {
    flexGrow: 1,
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

  // Static & Sub-type Styles
  staticBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  staticBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subTypesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  subTypesPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  subTypeRow: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  subTypeBranchText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  subTypeValueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  subTypeTag: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  subTypeTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
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
  gstTypeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gstTypeBtn: {
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
  gstTypeBtnActiveUnreg: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  gstTypeBtnActiveReg: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  gstTypeBtnTextActiveUnreg: {
    color: '#0284c7',
    fontWeight: '700',
  },
  gstTypeBtnTextActiveReg: {
    color: '#15803d',
    fontWeight: '700',
  },
  // Floating State Dropdown Styles
  stateDropdownFloatingMenu: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 99,
    zIndex: 99999,
    overflow: 'hidden',
  },
  stateDropdownSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  stateDropdownSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0f172a',
    paddingVertical: 4,
  },
  stateDropdownAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  stateDropdownAddRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  stateDropdownInlineAddBox: {
    padding: 10,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  stateDropdownAddSubmitBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateDropdownAddSubmitBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  stateDropdownAddCancelBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  stateDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stateDropdownItemActive: {
    backgroundColor: '#f0f9ff',
  },
  stateDropdownItemText: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '500',
  },
  stateDropdownItemTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  partyCardSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyGstBadgeUrd: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  partyGstBadgeUrdText: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  partyGstBadgeRd: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  partyGstBadgeRdText: {
    fontSize: 9.5,
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
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  previewSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  catBadgeNew: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  catBadgeNewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  catBadgeDup: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  catBadgeDupText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  multiCatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
  },
  multiCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  multiCatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  multiCatCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
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

  // MOBILE DETAIL PAGE STYLES
  mobileDetailContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  },
  mobileDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  mobileBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 6,
  },
  mobileBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
    marginLeft: 2,
  },
  mobileDetailHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  mobileDetailHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  mobileDetailCountBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  mobileDetailCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  mobileAddBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  mobileAddBtnSmallText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileCategoryPillsScrollWrap: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 6,
  },
  mobileCategoryPillsRow: {
    paddingHorizontal: 12,
    gap: 6,
  },
  mobileCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  mobileCatPillActive: {
    backgroundColor: '#0284c7',
  },
  mobileCatPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileCatPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mobileSearchBoxWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  mobileSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  mobileFilterPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mobileStatusGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  mobileFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 7,
    backgroundColor: '#f1f5f9',
  },
  mobileFilterPillActive: {
    backgroundColor: '#0284c7',
  },
  mobileFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  mobileFilterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mobileBulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  mobileBulkBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  mobileListMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  mobileSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileSelectAllText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  mobileSortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  mobileSortToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  mobileDetailScroll: {
    flex: 1,
    width: '100%',
  },
  mobileDetailScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 120,
  },
  mobileItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  mobileItemCardSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
  },
  mobileItemCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileItemCheckbox: {
    marginRight: 6,
  },
  mobileItemIndexBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 8,
  },
  mobileItemIndexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  mobileItemValueWrap: {
    flex: 1,
    marginRight: 6,
  },
  mobileItemValueText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobileItemDateText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  mobileStatusBadgeTouch: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mobileSubTypesBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileSubTypesTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  mobileSubTypeRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  mobileSubTypeLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  mobileItemCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mobileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 3,
  },
  mobileActionBtnDelete: {
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  mobileActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mobileListFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  mobileListFooterText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  mobileEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  mobileEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  mobileEmptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  mobileResetFilterBtn: {
    marginTop: 14,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 7,
  },
  mobileResetFilterBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // MOBILE HUB STYLES
  mobileHubScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mobileHubScrollContent: {
    padding: 14,
    paddingBottom: 120,
  },
  mobileHubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mobileHubSection: {
    marginBottom: 20,
  },
  mobileSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  mobileHubCardsCol: {
    gap: 10,
  },
  mobileHubCatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  mobileHubCatIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mobileHubCatContent: {
    flex: 1,
  },
  mobileHubCatTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobileHubCatSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mobileHubCatRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  mobileHubCountBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
  },
  mobileHubCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  mobileHubOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileHubOpenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284c7',
    marginRight: 2,
  },
  mobileToolsGrid: {
    gap: 10,
  },
  mobileToolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 12,
  },
  mobileToolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileToolTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobileToolSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  catSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catSelectChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  catSelectChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  catSelectChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
