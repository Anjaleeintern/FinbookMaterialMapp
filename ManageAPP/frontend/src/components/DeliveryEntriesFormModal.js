import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';

const getTodayStr = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export const isCashOrQrSale = (mode) => {
  if (!mode) return false;
  const m = String(mode).trim().toLowerCase();
  return (
    m === 'cash sale' ||
    m === 'case sale' ||
    m === 'qr sale' ||
    m === 'cash' ||
    m === 'qr' ||
    m.includes('cash') ||
    m.includes('case') ||
    m.includes('qr')
  );
};

// Restrict weights (G.WT, T.WT, N.WT) to any number of digits before decimal and max 3 digits after decimal
export const sanitizeWeightInput = (txt) => {
  if (txt === undefined || txt === null) return '';
  const cleaned = String(txt).replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  // Any number of digits before decimal point
  const intPart = parts[0];
  if (parts.length > 1) {
    // Max 3 digits after decimal point (.000 - .999)
    const decPart = parts.slice(1).join('').slice(0, 3);
    return `${intPart}.${decPart}`;
  }
  return intPart;
};

// Stepper Component defined outside so it NEVER unmounts on re-render, keeping focus intact
const StepperInput = ({ label, value, onChange, step = 1, placeholder = '0', isWeight = false, max = null }) => {
  const currentStr = value === undefined || value === null ? '' : String(value);
  const effectiveMax = max;

  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperContainer}>
        <TextInput
          style={styles.stepperTextInput}
          keyboardType="decimal-pad"
          selectTextOnFocus={true}
          value={currentStr}
          onChangeText={(txt) => {
            if (isWeight) {
              onChange(sanitizeWeightInput(txt));
            } else {
              // Keep numeric digits and at most one decimal point
              const cleaned = txt.replace(/[^0-9.]/g, '');
              const parts = cleaned.split('.');
              const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
              onChange(sanitized);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
        />
        <View style={styles.stepperButtons}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const currentNum = parseFloat(value) || 0;
              const next = Math.max(0, Number((currentNum - step).toFixed(isWeight ? 3 : 2)));
              onChange(isWeight ? sanitizeWeightInput(String(next)) : String(next));
            }}
          >
            <Ionicons name="remove" size={20} color="#334155" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const currentNum = parseFloat(value) || 0;
              let next = Number((currentNum + step).toFixed(isWeight ? 3 : 2));
              if (effectiveMax !== null && next > effectiveMax) {
                next = effectiveMax;
              }
              onChange(isWeight ? sanitizeWeightInput(String(next)) : String(next));
            }}
          >
            <Ionicons name="add" size={20} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Dropdown Component defined outside so it NEVER remounts
const DropdownSelect = ({ label, required, value, options = [], onSelect, isMobile, onOpenPicker, category }) => {
  // If dropdown has a master category or on mobile, open searchable & creatable picker dialog
  if (category || isMobile) {
    return (
      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>
          {label} {required ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
        </Text>
        <TouchableOpacity
          style={[styles.mobileDropdownTrigger, category && styles.searchableDropdownTrigger]}
          onPress={() => onOpenPicker && onOpenPicker({ label, category, options, value, onSelect })}
          activeOpacity={0.75}
        >
          <Text
            style={[styles.mobileDropdownValue, !value && styles.mobileDropdownPlaceholder]}
            numberOfLines={1}
          >
            {value || `Select ${label}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {category ? <Ionicons name="search" size={13} color="#94a3b8" /> : null}
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Desktop Web for fixed non-master lists (e.g. Sales Mode, Sale Type, GST Rate)
  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>
        {label} {required ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
      </Text>
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          height: 44,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 14,
          color: value ? '#0f172a' : '#94a3b8',
          backgroundColor: '#ffffff',
          outline: 'none',
          width: '100%',
        }}
      >
        <option value="">Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </View>
  );
};

export const DeliveryEntriesFormModal = ({ visible, onClose, onSuccess, masters, initialData = null }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const topSafe = Platform.OS === 'web' ? 0 : Math.max(insets.top || 0, Platform.OS === 'android' ? 24 : 0);
  const bottomSafe = Platform.OS === 'web' ? 0 : (insets.bottom || 0);

  const [date, setDate] = useState(getTodayStr());
  const [challanNo, setChallanNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportType, setTransportType] = useState('');
  const [typeMode, setTypeMode] = useState('');
  const [saleType, setSaleType] = useState('');
  const [hrLoadingType, setHrLoadingType] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cum, setCum] = useState('0');
  const [etpNo, setEtpNo] = useState('');
  const [gWt, setGWt] = useState('0');
  const [tWt, setTWt] = useState('0');
  const [rate, setRate] = useState('0');
  const [hasAdditionalCharges, setHasAdditionalCharges] = useState(false);
  const [savedChargesList, setSavedChargesList] = useState([]);
  const [curChargeName, setCurChargeName] = useState('');
  const [curChargeAmount, setCurChargeAmount] = useState('0');
  const [isAddingCharge, setIsAddingCharge] = useState(false);

  const handleSaveCurrentCharge = () => {
    const trimmed = (curChargeName || '').trim();
    const amt = parseFloat(curChargeAmount) || 0;
    if (!trimmed && amt <= 0) {
      return;
    }
    setSavedChargesList((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        name: trimmed || 'Additional Charge',
        amount: String(amt),
      },
    ]);
    setCurChargeName('');
    setCurChargeAmount('0');
    setIsAddingCharge(false);
  };

  const handleRemoveSavedCharge = (id) => {
    setSavedChargesList((prev) => prev.filter((item) => item.id !== id));
  };
  const [partyState, setPartyState] = useState('Madhya Pradesh');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [gstRate, setGstRate] = useState('0');
  const [rateCalcUnit, setRateCalcUnit] = useState('MT'); // 'MT' | 'CUM'

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Local Options state initialized from masters prop
  const [vehicleOptions, setVehicleOptions] = useState(masters?.VehicleNo || []);
  const [transportOptions, setTransportOptions] = useState(masters?.TransportName || []);
  const [partyOptions, setPartyOptions] = useState(masters?.PartyName || []);
  const [materialOptions, setMaterialOptions] = useState(masters?.MaterialName || []);
  const [additionalChargeOptions, setAdditionalChargeOptions] = useState(masters?.AdditionalCharges || []);

  // Search & Inline Create Picker Modal State
  const [pickerConfig, setPickerConfig] = useState(null); // { label, category, options, value, onSelect }
  const [pickerSearch, setPickerSearch] = useState('');
  const [creatingMaster, setCreatingMaster] = useState(false);

  // Sales Mode has strictly 2 options: Cash Sale or Credit Sale
  const salesModeOptions = ['Cash Sale', 'Credit Sale'];

  // Sale Type options: Royalty Sale or Without Royalty
  const saleTypeOptions = ['Royalty Sale', 'Without Royalty'];

  useEffect(() => {
    if (masters) {
      if (Array.isArray(masters.VehicleNo)) setVehicleOptions(masters.VehicleNo);
      if (Array.isArray(masters.TransportName)) setTransportOptions(masters.TransportName);
      if (Array.isArray(masters.PartyName)) setPartyOptions(masters.PartyName);
      if (Array.isArray(masters.MaterialName)) setMaterialOptions(masters.MaterialName);
      if (Array.isArray(masters.AdditionalCharges)) setAdditionalChargeOptions(masters.AdditionalCharges);
    }
  }, [masters]);

  // Popup state for "+ Add New" Master Item
  const [addMasterModal, setAddMasterModal] = useState(null); // { category, label, onCreated }
  const [newMasterInputValue, setNewMasterInputValue] = useState('');
  const [savingNewMaster, setSavingNewMaster] = useState(false);
  const [addMasterError, setAddMasterError] = useState('');

  const handleOpenAddMasterPopup = (category, label, initialVal = '') => {
    setAddMasterError('');
    setNewMasterInputValue(initialVal);
    setAddMasterModal({
      category,
      label,
      onCreated: (newVal) => {
        if (pickerConfig && pickerConfig.onSelect) {
          pickerConfig.onSelect(newVal);
        }
        setPickerConfig(null);
        setPickerSearch('');
      },
    });
  };

  const handleSaveNewMasterPopup = async () => {
    const trimmed = (newMasterInputValue || '').trim();
    if (!trimmed) {
      setAddMasterError('Please enter a value');
      return;
    }

    setSavingNewMaster(true);
    setAddMasterError('');
    try {
      const payload = {
        category: addMasterModal.category,
        value: trimmed,
        status: 'Active',
      };
      if (addMasterModal.category === 'PartyName') {
        payload.state = 'Madhya Pradesh';
        payload.gst_type = 'Unregistered';
      }
      await api.addMasterItem(payload);

      const cat = addMasterModal.category;
      if (cat === 'VehicleNo') {
        setVehicleOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'TransportName') {
        setTransportOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'PartyName') {
        setPartyOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
        setPartyState('Madhya Pradesh');
      } else if (cat === 'MaterialName') {
        setMaterialOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'AdditionalCharges') {
        setAdditionalChargeOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      }

      if (addMasterModal.onCreated) {
        addMasterModal.onCreated(trimmed);
      }
      setAddMasterModal(null);
      setNewMasterInputValue('');
    } catch (err) {
      console.warn('Add master popup warning/fallback:', err);
      const cat = addMasterModal.category;
      if (cat === 'VehicleNo') {
        setVehicleOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'TransportName') {
        setTransportOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'PartyName') {
        setPartyOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
        setPartyState('Madhya Pradesh');
      } else if (cat === 'MaterialName') {
        setMaterialOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      } else if (cat === 'AdditionalCharges') {
        setAdditionalChargeOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()));
      }

      if (addMasterModal.onCreated) {
        addMasterModal.onCreated(trimmed);
      }
      setAddMasterModal(null);
      setNewMasterInputValue('');
    } finally {
      setSavingNewMaster(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setChallanNo(initialData.challan_no || '');
        setDate(initialData.date || getTodayStr());
        setVehicleNo(initialData.vehicle_no || '');
        setTransportType(initialData.transport_type || initialData.transport_name || '');
        setTypeMode(initialData.type_mode || '');
        setSaleType(initialData.sale_type || '');
        setHrLoadingType(initialData.hr_loading_type || '');
        setMaterialName(initialData.material_name || '');
        setPartyName(initialData.party_name || '');
        setCustomerName(initialData.customer_name || '');
        setPartyState(initialData.party_state || 'Madhya Pradesh');
        setCum(String(initialData.cum !== undefined && initialData.cum !== null ? initialData.cum : '0'));
        setEtpNo(initialData.etp_no || '');
        setGWt(String(initialData.g_wt !== undefined && initialData.g_wt !== null ? initialData.g_wt : '0'));
        setTWt(String(initialData.t_wt !== undefined && initialData.t_wt !== null ? initialData.t_wt : '0'));
        setRate(String(initialData.rate !== undefined && initialData.rate !== null ? initialData.rate : '0'));

        if (Array.isArray(initialData.additional_charges) && initialData.additional_charges.length > 0) {
          setSavedChargesList(
            initialData.additional_charges.map((c, i) => ({
              id: String(i + 1),
              name: c.name || '',
              amount: String(c.amount || '0'),
            }))
          );
          setHasAdditionalCharges(true);
          setIsAddingCharge(false);
        } else if (initialData.additional_charge_amount > 0 || initialData.additional_charge_name) {
          setSavedChargesList([
            {
              id: '1',
              name: initialData.additional_charge_name || '',
              amount: String(initialData.additional_charge_amount || '0'),
            },
          ]);
          setHasAdditionalCharges(true);
          setIsAddingCharge(false);
        } else {
          setSavedChargesList([]);
          setHasAdditionalCharges(false);
          setIsAddingCharge(false);
        }

        setPaymentMode(initialData.payment_mode || (initialData.type_mode === 'Cash Sale' ? 'Cash' : ''));
        setGstRate(String(initialData.gst_rate !== undefined && initialData.gst_rate !== null ? initialData.gst_rate : '0'));
        setRateCalcUnit(initialData.rate_calc_unit || 'MT');
        setErrorMsg('');
        setPickerConfig(null);
        setPickerSearch('');
      } else {
        api.getNextChallan()
          .then((data) => setChallanNo(data.next_challan_no))
          .catch(() => setChallanNo(''));

        setDate(getTodayStr());
        setVehicleNo('');
        setTransportType('');
        setTypeMode('');
        setSaleType('');
        setHrLoadingType('');
        setMaterialName('');
        setPartyName('');
        setCustomerName('');
        setPartyState('Madhya Pradesh');
        setCum('0');
        setEtpNo('');
        setGWt('0');
        setTWt('0');
        setRate('0');
        setSavedChargesList([]);
        setHasAdditionalCharges(false);
        setCurChargeName('');
        setCurChargeAmount('0');
        setIsAddingCharge(false);
        setPaymentMode('Cash');
        setGstRate('0');
        setRateCalcUnit('MT');
        setErrorMsg('');
        setPickerConfig(null);
        setPickerSearch('');
      }

      if (masters) {
        if (Array.isArray(masters.VehicleNo)) setVehicleOptions(masters.VehicleNo);
        if (Array.isArray(masters.TransportName)) setTransportOptions(masters.TransportName);
        if (Array.isArray(masters.PartyName)) setPartyOptions(masters.PartyName);
        if (Array.isArray(masters.MaterialName)) setMaterialOptions(masters.MaterialName);
        if (Array.isArray(masters.AdditionalCharges)) setAdditionalChargeOptions(masters.AdditionalCharges);
      }
    }
  }, [visible, masters, initialData]);

  // When partyName changes, automatically load its registered state from masters
  useEffect(() => {
    if (partyName && masters?.party_states && masters.party_states[partyName]) {
      setPartyState(masters.party_states[partyName]);
    }
  }, [partyName, masters]);

  // When typeMode changes, automatically set sensible defaults for Payment Mode
  useEffect(() => {
    if (typeMode === 'Cash Sale') {
      if (!paymentMode) setPaymentMode('Cash');
    } else {
      setPaymentMode('');
      setCustomerName('');
    }
  }, [typeMode]);

  // Reactive Calculations
  const numGWt = parseFloat(gWt) || 0;
  const numTWt = parseFloat(tWt) || 0;
  const numCum = parseFloat(cum) || 0;
  const numRate = parseFloat(rate) || 0;
  const numGstRate = parseFloat(gstRate) || 0;
  const numAddCharge = useMemo(() => {
    if (!hasAdditionalCharges) return 0;
    return savedChargesList.reduce((sum, item) => {
      const amt = parseFloat(item.amount) || 0;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  }, [hasAdditionalCharges, savedChargesList]);

  // Gross Weight and Tare Weight: any digits before decimal, max 3 after decimal
  const netWt = Math.max(0, Number((numGWt - numTWt).toFixed(3)));

  // Amount: CUM * Rate if CUM, or NET WT * Rate if MT (Tons, no / 1000)
  const amount = rateCalcUnit === 'CUM'
    ? Number((numCum * numRate).toFixed(2))
    : Number((netWt * numRate).toFixed(2));
  const materialAmount = amount;

  // Taxable base includes Amount + Additional Charge Amount
  const taxableAmount = Number((amount + numAddCharge).toFixed(2));

  // GST is now visible and calculated for all sale types
  const isGstVisible = true;

  // Determine if party state is MP (Intra-state: CGST + SGST) vs outside MP (Inter-state: IGST)
  const isMP = !partyState || partyState.trim().toLowerCase() === 'madhya pradesh' || partyState.trim().toLowerCase() === 'mp';

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;
  let gstAmount = 0;

  if (numGstRate > 0) {
    if (isMP) {
      // Intra-state MP: CGST + SGST split 50-50
      cgstRate = Number((numGstRate / 2).toFixed(2));
      sgstRate = Number((numGstRate / 2).toFixed(2));
      cgstAmount = Number(((taxableAmount * cgstRate) / 100).toFixed(2));
      sgstAmount = Number(((taxableAmount * sgstRate) / 100).toFixed(2));
      gstAmount = Number((cgstAmount + sgstAmount).toFixed(2));
    } else {
      // Inter-state (outside MP): Full IGST
      igstRate = numGstRate;
      igstAmount = Number(((taxableAmount * igstRate) / 100).toFixed(2));
      gstAmount = igstAmount;
    }
  }

  // Exact Round Off to nearest rupee
  const rawTotalAmount = Number((taxableAmount + gstAmount).toFixed(2));
  const roundedTotalAmount = Math.round(rawTotalAmount);
  const roundOff = Number((roundedTotalAmount - rawTotalAmount).toFixed(2));
  const totalAmount = roundedTotalAmount;

  const handleSave = async () => {
    if (!vehicleNo || !transportType || !typeMode || !materialName) {
      setErrorMsg('Please select all required fields marked with *');
      return;
    }

    if (typeMode === 'Credit Sale' && !partyName) {
      setErrorMsg('Please select Party Name for Credit Sale');
      return;
    }

    if (typeMode === 'Cash Sale' && !customerName.trim()) {
      setErrorMsg('Please enter Customer Name for Cash Sale');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        date,
        challan_no: challanNo,
        vehicle_no: vehicleNo,
        transport_type: transportType,
        type_mode: typeMode,
        sale_type: saleType || null,
        hr_loading_type: null,
        material_name: materialName,
        party_name: typeMode === 'Cash Sale' ? customerName.trim() : partyName,
        customer_name: typeMode === 'Cash Sale' ? customerName.trim() : null,
        party_state: partyState,
        cum: parseFloat(cum) || 0,
        etp_no: etpNo || '',
        g_wt: parseFloat(gWt) || 0,
        t_wt: parseFloat(tWt) || 0,
        net_wt: netWt,
        rate: parseFloat(rate) || 0,
        rate_calc_unit: rateCalcUnit,
        amount: amount,
        additional_charges: hasAdditionalCharges
          ? savedChargesList
              .map((c) => ({
                name: (c.name || '').trim(),
                amount: parseFloat(c.amount) || 0,
              }))
              .filter((c) => c.name || c.amount > 0)
          : [],
        additional_charge_name: hasAdditionalCharges
          ? savedChargesList
              .map((c) => (c.name || '').trim())
              .filter(Boolean)
              .join(', ') || null
          : null,
        additional_charge_amount: numAddCharge,
        taxable_amount: taxableAmount,
        payment_mode: typeMode === 'Cash Sale' ? (paymentMode || 'Cash') : null,
        gst_rate: numGstRate,
        gst_amount: gstAmount,
        cgst_rate: cgstRate,
        cgst_amount: cgstAmount,
        sgst_rate: sgstRate,
        sgst_amount: sgstAmount,
        igst_rate: igstRate,
        igst_amount: igstAmount,
        round_off: roundOff,
        total_amount: totalAmount,
      };

      let res;
      if (initialData && initialData.id) {
        res = await api.updateEntry(initialData.id, payload, initialData.saved_in);
      } else {
        res = await api.createEntry(payload);
      }
      setSubmitting(false);
      const savedEntry = res?.entry || (res?.id ? res : { ...payload, id: initialData?.id || Date.now().toString() });
      onSuccess(savedEntry);
      onClose();
    } catch (err) {
      setSubmitting(false);
      setErrorMsg(err.message || 'Failed to save delivery entry');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isMobile && { padding: 0 }]}>
        <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
          {/* Header with safe top padding */}
          <View style={[styles.modalHeader, isMobile && { paddingTop: topSafe, height: 56 + topSafe }]}>
            <View style={styles.modalTitleRow}>
              <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {initialData ? 'Edit Delivery Entry' : (isMobile ? 'New Delivery Entry' : 'Delivery Entries Form')}
              </Text>
            </View>
            <View style={styles.modalHeaderButtons}>
              {!isMobile && (
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>{initialData ? 'Update' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Banner */}
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#b91c1c" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form Scroll Body */}
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: isMobile ? 100 : 30 }}
            showsVerticalScrollIndicator={true}
          >
            {/* 1. Date */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Date <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="MM/DD/YYYY"
                />
                <Ionicons name="calendar-outline" size={18} color="#64748b" style={styles.inputIcon} />
              </View>
            </View>

            {/* 2. ChallanNo */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>
                  ChallanNo <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <Text style={{ fontSize: 11, color: '#0284c7', fontWeight: '600' }}>
                  Auto-Continuing Series
                </Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={challanNo}
                onChangeText={setChallanNo}
                placeholder="Auto-assigned Challan No"
              />
            </View>

            {/* 3. VehicleNo */}
            <DropdownSelect
              label="VehicleNo"
              required={true}
              category="VehicleNo"
              value={vehicleNo}
              options={vehicleOptions}
              onSelect={setVehicleNo}
              isMobile={isMobile}
              onOpenPicker={(cfg) => {
                setPickerSearch('');
                setPickerConfig(cfg);
              }}
            />

            {/* 4. Transport Name */}
            <DropdownSelect
              label="Transport Name"
              required={true}
              category="TransportName"
              value={transportType}
              options={transportOptions}
              onSelect={setTransportType}
              isMobile={isMobile}
              onOpenPicker={(cfg) => {
                setPickerSearch('');
                setPickerConfig(cfg);
              }}
            />

            {/* 5. Sales Mode (formerly Type/Mode) */}
            <DropdownSelect
              label="Sales Mode"
              required={true}
              value={typeMode}
              options={salesModeOptions}
              onSelect={setTypeMode}
              isMobile={isMobile}
              onOpenPicker={(cfg) => {
                setPickerSearch('');
                setPickerConfig(cfg);
              }}
            />

            {/* In case of Cash Sale: Payment Mode dropdown (Cash, QR, Bank) + Customer Name input box */}
            {typeMode === 'Cash Sale' && (
              <View style={{ marginBottom: 4 }}>
                {/* Payment Mode Dropdown: Cash, QR, Bank */}
                <DropdownSelect
                  label="Payment Mode"
                  required={true}
                  value={paymentMode || 'Cash'}
                  options={['Cash', 'QR', 'Bank']}
                  onSelect={setPaymentMode}
                  isMobile={isMobile}
                  onOpenPicker={(cfg) => {
                    setPickerSearch('');
                    setPickerConfig(cfg);
                  }}
                />

                {/* Customer Name Text Input (Note removed) */}
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>
                    Customer Name <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="Enter Customer Name"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            )}

            {/* In case of Credit Sale: PartyName dropdown */}
            {typeMode === 'Credit Sale' && (
              <>
                <DropdownSelect
                  label="PartyName"
                  required={true}
                  category="PartyName"
                  value={partyName}
                  options={partyOptions}
                  onSelect={setPartyName}
                  isMobile={isMobile}
                  onOpenPicker={(cfg) => {
                    setPickerSearch('');
                    setPickerConfig(cfg);
                  }}
                />

                {partyName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 12, gap: 5 }}>
                    <Ionicons name="location-outline" size={13} color="#0284c7" />
                    <Text style={{ fontSize: 11.5, color: '#0369a1', fontWeight: '600' }}>
                      Party State:{' '}
                      <Text style={{ fontWeight: '700', color: '#0f172a' }}>{partyState || 'Madhya Pradesh'}</Text>
                      {' '}({isMP ? 'Intra-State: CGST + SGST' : 'Inter-State: IGST'})
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Sale Type Dropdown: Royalty Sale / Without Royalty */}
            <DropdownSelect
              label="Sale Type"
              required={true}
              value={saleType}
              options={saleTypeOptions}
              onSelect={setSaleType}
              isMobile={isMobile}
              onOpenPicker={(cfg) => {
                setPickerSearch('');
                setPickerConfig(cfg);
              }}
            />

            {/* MaterialName */}
            <DropdownSelect
              label="MaterialName"
              required={true}
              category="MaterialName"
              value={materialName}
              options={materialOptions}
              onSelect={setMaterialName}
              isMobile={isMobile}
              onOpenPicker={(cfg) => {
                setPickerSearch('');
                setPickerConfig(cfg);
              }}
            />

            {/* 9. CUM */}
            <StepperInput label="CUM" value={cum} onChange={setCum} step={1} />

            {/* 10. ETP No. */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>ETP No.</Text>
              <TextInput
                style={styles.textInput}
                value={etpNo}
                onChangeText={setEtpNo}
                placeholder="Enter ETP No."
              />
            </View>

            {/* 11. G.WT */}
            <StepperInput label="G.WT (Gross Weight - Tons)" value={gWt} onChange={setGWt} step={1} isWeight={true} />

            {/* 12. T.WT */}
            <StepperInput label="T.WT (Tare Weight - Tons)" value={tWt} onChange={setTWt} step={1} isWeight={true} />

            {/* 13. NET WT */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>NET WT (Calculated: G.WT - T.WT)</Text>
              <View style={styles.calculatedBox}>
                <Text style={styles.calculatedValue}>{netWt.toFixed(3)} Tons</Text>
              </View>
            </View>

            {/* RATE CALCULATION Fields Toggle (Directly above Rate) */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>RATE CALCULATION</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleBtn, rateCalcUnit === 'MT' && styles.toggleBtnActive]}
                  onPress={() => setRateCalcUnit('MT')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="scale-outline"
                    size={16}
                    color={rateCalcUnit === 'MT' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.toggleBtnText, rateCalcUnit === 'MT' && styles.toggleBtnTextActive]}>
                    MT (Net WT × Rate)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, rateCalcUnit === 'CUM' && styles.toggleBtnActive]}
                  onPress={() => setRateCalcUnit('CUM')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="cube-outline"
                    size={16}
                    color={rateCalcUnit === 'CUM' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.toggleBtnText, rateCalcUnit === 'CUM' && styles.toggleBtnTextActive]}>
                    CUM (CUM × Rate)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 14. Rate */}
            <StepperInput label="Rate" value={rate} onChange={setRate} step={10} />

            {/* 15. Amount (Directly calculated after Rate) */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Amount ({rateCalcUnit === 'CUM' ? 'CUM × Rate' : 'NET WT × Rate'})
              </Text>
              <View style={styles.calculatedBox}>
                <Text style={styles.calculatedValue}>
                  ₹ {amount.toLocaleString()}
                  <Text style={{ fontSize: 12, fontWeight: '400', color: '#64748b' }}>
                    {' '}
                    ({rateCalcUnit === 'CUM' ? `${numCum} CUM × ₹${numRate}` : `${netWt} MT × ₹${numRate}`})
                  </Text>
                </Text>
              </View>
            </View>

            {/* 16. Additional Charges Section with Toggle (No / Yes), Input Card with Save, Mini Table, and + Add Another Charge */}
            <View style={styles.addChargesSection}>
              {/* Toggle Header Row */}
              <View style={styles.addChargesToggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="receipt-outline" size={17} color="#0284c7" />
                  <Text style={styles.addChargesSectionTitle}>Additional Charges</Text>
                </View>
                <View style={styles.toggleYesNoGroup}>
                  <TouchableOpacity
                    style={[styles.togglePillBtn, !hasAdditionalCharges && styles.togglePillBtnInactive]}
                    onPress={() => {
                      setHasAdditionalCharges(false);
                      setIsAddingCharge(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.togglePillText, !hasAdditionalCharges && styles.togglePillTextInactive]}>
                      No
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.togglePillBtn, hasAdditionalCharges && styles.togglePillBtnActive]}
                    onPress={() => {
                      setHasAdditionalCharges(true);
                      if (savedChargesList.length === 0) {
                        setIsAddingCharge(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.togglePillText, hasAdditionalCharges && styles.togglePillTextActive]}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* If toggled YES */}
              {hasAdditionalCharges && (
                <View style={{ marginTop: 10 }}>
                  {/* Mini-table of Saved Charges */}
                  {savedChargesList.length > 0 && (
                    <View style={styles.miniTableCard}>
                      <View style={styles.miniTableHeader}>
                        <Text style={[styles.miniTableTh, { flex: 2 }]}>CHARGE NAME</Text>
                        <Text style={[styles.miniTableTh, { flex: 1.2, textAlign: 'right' }]}>AMOUNT (₹)</Text>
                        <Text style={[styles.miniTableTh, { width: 50, textAlign: 'center' }]}>ACTION</Text>
                      </View>
                      {savedChargesList.map((item, idx) => (
                        <View key={item.id || idx} style={[styles.miniTableRow, idx === savedChargesList.length - 1 && { borderBottomWidth: 0 }]}>
                          <Text style={[styles.miniTableCellText, { flex: 2, fontWeight: '600', color: '#0f172a' }]} numberOfLines={1}>
                            {item.name || 'Additional Charge'}
                          </Text>
                          <Text style={[styles.miniTableCellText, { flex: 1.2, textAlign: 'right', fontWeight: '700', color: '#0284c7' }]}>
                            ₹ {Number(item.amount || 0).toLocaleString()}
                          </Text>
                          <View style={{ width: 50, alignItems: 'center' }}>
                            <TouchableOpacity
                              onPress={() => handleRemoveSavedCharge(item.id)}
                              style={styles.trashBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={15} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      {/* Mini Table Total Row */}
                      <View style={styles.miniTableTotalRow}>
                        <Text style={styles.miniTableTotalLabel}>Total Charges:</Text>
                        <Text style={styles.miniTableTotalVal}>₹ {numAddCharge.toLocaleString()}</Text>
                      </View>
                    </View>
                  )}

                  {/* Input Card for selecting charge and amount, with Save Charge button */}
                  {(isAddingCharge || savedChargesList.length === 0) && (
                    <View style={styles.chargeInputCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.chargeInputCardTitle}>
                          {savedChargesList.length === 0 ? 'Select Additional Charge' : 'Add Another Charge'}
                        </Text>
                        {savedChargesList.length > 0 && (
                          <TouchableOpacity onPress={() => setIsAddingCharge(false)}>
                            <Ionicons name="close-circle" size={18} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <DropdownSelect
                        label="Additional Charge"
                        category="AdditionalCharges"
                        value={curChargeName}
                        options={additionalChargeOptions}
                        onSelect={(val) => setCurChargeName(val)}
                        isMobile={isMobile}
                        onOpenPicker={(cfg) => {
                          setPickerSearch('');
                          setPickerConfig({
                            ...cfg,
                            onSelect: (val) => setCurChargeName(val),
                          });
                        }}
                      />

                      <StepperInput
                        label="Additional Charge Amount (₹)"
                        value={curChargeAmount}
                        onChange={setCurChargeAmount}
                        step={50}
                        placeholder="0"
                      />

                      <TouchableOpacity
                        style={styles.saveChargeBtn}
                        onPress={handleSaveCurrentCharge}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.saveChargeBtnText}>Save Charge</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* "+ Add Another Charge" Button */}
                  {!isAddingCharge && savedChargesList.length > 0 && (
                    <TouchableOpacity
                      style={styles.addMoreChargeBtn}
                      onPress={() => {
                        setCurChargeName('');
                        setCurChargeAmount('0');
                        setIsAddingCharge(true);
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add-circle" size={18} color="#0284c7" />
                      <Text style={styles.addMoreChargeBtnText}>+ Add Another Charge</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Taxable Amount Summary */}
            {numAddCharge > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Taxable Base Amount (Amount + Total Addl Charges: ₹{numAddCharge.toLocaleString()})
                </Text>
                <View style={styles.calculatedBox}>
                  <Text style={[styles.calculatedValue, { color: '#0369a1' }]}>
                    ₹ {taxableAmount.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Payment Summary Badge near Amount for Cash Sale */}
            {typeMode === 'Cash Sale' && (
              <View style={styles.paymentSummaryBadge}>
                <Ionicons
                  name={paymentMode === 'Bank' ? 'business-outline' : paymentMode === 'QR' ? 'qr-code-outline' : 'cash-outline'}
                  size={16}
                  color="#0284c7"
                />
                <Text style={styles.paymentSummaryBadgeText}>
                  Payment Mode:{' '}
                  <Text style={{ fontWeight: '700', color: '#0369a1' }}>
                    {paymentMode || 'Cash'}
                  </Text>
                  {customerName ? (
                    <Text style={{ color: '#475569', fontWeight: '400' }}>
                      {' '}• Customer: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{customerName}</Text>
                    </Text>
                  ) : null}
                </Text>
              </View>
            )}

            {/* 17, 18, 19. GST Fields (Available & Calculated for ALL Sale Types) */}
            <View style={styles.conditionalBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <Text style={styles.conditionalTag}>GST Tax Calculations</Text>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 4,
                  backgroundColor: isMP ? '#eff6ff' : '#fef3c7',
                  borderWidth: 1,
                  borderColor: isMP ? '#bfdbfe' : '#fde68a',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isMP ? '#1d4ed8' : '#b45309' }}>
                    {isMP ? 'Intra-State (MP): CGST + SGST' : `Inter-State (${partyState}): IGST`}
                  </Text>
                </View>
              </View>

              {/* Taxable Base on which GST is calculated */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Taxable Base Amount (Amount + Addl Charge)</Text>
                <View style={styles.calculatedBox}>
                  <Text style={styles.calculatedValue}>₹ {taxableAmount.toLocaleString()}</Text>
                </View>
              </View>

              {/* GST Rate Dropdown with [0%, 5%, 12%, 18%] */}
              <DropdownSelect
                label="GST Rate (%)"
                value={`${gstRate}%`}
                options={['0%', '5%', '12%', '18%']}
                onSelect={(val) => {
                  const clean = String(val).replace('%', '').trim();
                  setGstRate(clean);
                }}
                isMobile={isMobile}
                onOpenPicker={(cfg) => {
                  setPickerSearch('');
                  setPickerConfig(cfg);
                }}
              />

              {/* State-wise Split: CGST + SGST for MP, IGST for other states */}
              {isMP ? (
                <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>CGST ({cgstRate}%)</Text>
                    <View style={styles.calculatedBox}>
                      <Text style={styles.calculatedValue}>₹ {cgstAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>SGST ({sgstRate}%)</Text>
                    <View style={styles.calculatedBox}>
                      <Text style={styles.calculatedValue}>₹ {sgstAmount.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>IGST ({igstRate}%)</Text>
                  <View style={styles.calculatedBox}>
                    <Text style={styles.calculatedValue}>₹ {igstAmount.toLocaleString()}</Text>
                  </View>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Total GST Amount</Text>
                <View style={styles.calculatedBox}>
                  <Text style={styles.calculatedValue}>₹ {gstAmount.toLocaleString()}</Text>
                </View>
              </View>

              {/* Total Amount without Round Off */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Total Amount (Without Round Off)</Text>
                <View style={styles.calculatedBox}>
                  <Text style={styles.calculatedValue}>
                    ₹ {Number(rawTotalAmount.toFixed(2)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* Round Off */}
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>Round Off (₹)</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: roundOff >= 0 ? '#16a34a' : '#ea580c' }}>
                    {roundOff === 0 ? 'Exact' : roundOff > 0 ? `+ ₹${roundOff.toFixed(2)}` : `- ₹${Math.abs(roundOff).toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.calculatedBox}>
                  <Text style={[styles.calculatedValue, { color: roundOff >= 0 ? '#16a34a' : '#ea580c' }]}>
                    {roundOff >= 0 ? `+ ₹ ${roundOff.toFixed(2)}` : `- ₹ ${Math.abs(roundOff).toFixed(2)}`}
                  </Text>
                </View>
              </View>

              {/* Final Total Amount with Round Off */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Total Amount (With Round Off)</Text>
                <View style={[styles.calculatedBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.calculatedValue, { color: '#16a34a', fontSize: 16 }]}>
                    ₹ {totalAmount.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Mobile Floating / Sticky Bottom Save Button */}
          {isMobile && (
            <View style={[styles.mobileBottomActionBar, { paddingBottom: Math.max(bottomSafe, 12) }]}>
              <TouchableOpacity
                style={[styles.mobileBottomSaveBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.mobileBottomSaveText}>
                      {initialData ? 'Update Delivery Entry' : 'Save Delivery Entry'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Searchable & Inline Creatable Picker Dialog for Web & Mobile */}
          {pickerConfig && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setPickerConfig(null);
                setPickerSearch('');
              }}
            >
              <View style={[styles.pickerBackdrop, !isMobile && styles.pickerBackdropDesktop]}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    setPickerConfig(null);
                    setPickerSearch('');
                  }}
                >
                  <View style={styles.pickerBackdropTouch} />
                </TouchableWithoutFeedback>

                <View style={[styles.pickerSheet, !isMobile && styles.pickerSheetDesktop]}>
                  {/* Picker Header */}
                  <View style={styles.pickerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                      <Ionicons
                        name={pickerConfig.category ? 'layers-outline' : 'list-outline'}
                        size={18}
                        color="#0284c7"
                      />
                      <Text style={styles.pickerTitle} numberOfLines={1}>
                        Select {pickerConfig.label}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setPickerConfig(null);
                        setPickerSearch('');
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close" size={22} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {/* Search Input Box ONLY for Master Dropdowns */}
                  {pickerConfig.category ? (
                    <View style={styles.pickerSearchWrap}>
                      <Ionicons name="search" size={16} color="#0284c7" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.pickerSearchInput}
                        placeholder={`Search ${pickerConfig.label} or type new...`}
                        placeholderTextColor="#94a3b8"
                        value={pickerSearch}
                        onChangeText={setPickerSearch}
                        autoFocus={true}
                      />
                      {pickerSearch ? (
                        <TouchableOpacity
                          onPress={() => setPickerSearch('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Add New Option Button (Opens popup modal with input box & Save button) */}
                  {pickerConfig.category && (
                    <TouchableOpacity
                      style={styles.pickerOpenAddBtn}
                      onPress={() =>
                        handleOpenAddMasterPopup(
                          pickerConfig.category,
                          pickerConfig.label,
                          pickerSearch.trim()
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle" size={18} color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.pickerOpenAddBtnText}>
                        {pickerSearch.trim() &&
                        !pickerConfig.options.some(
                          (opt) => String(opt).trim().toLowerCase() === pickerSearch.trim().toLowerCase()
                        )
                          ? `+ Add "${pickerSearch.trim()}"`
                          : `+ Add New ${pickerConfig.label}`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Options List */}
                  <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                    {(() => {
                      const query = pickerSearch.trim().toLowerCase();
                      const filtered = query && pickerConfig.category
                        ? pickerConfig.options.filter((opt) => String(opt).toLowerCase().includes(query))
                        : pickerConfig.options;

                      if (filtered.length === 0) {
                        return (
                          <View style={styles.pickerEmptyWrap}>
                            <Ionicons name="search-outline" size={30} color="#cbd5e1" style={{ marginBottom: 6 }} />
                            <Text style={styles.noOptionsText}>
                              {pickerSearch.trim()
                                ? `No ${pickerConfig.label} found for "${pickerSearch.trim()}".`
                                : `No items available in ${pickerConfig.label}.`}
                            </Text>
                            {pickerConfig.category && (
                              <TouchableOpacity
                                style={[styles.pickerOpenAddBtn, { marginHorizontal: 0, marginTop: 12 }]}
                                onPress={() =>
                                  handleOpenAddMasterPopup(
                                    pickerConfig.category,
                                    pickerConfig.label,
                                    pickerSearch.trim()
                                  )
                                }
                              >
                                <Ionicons name="add" size={16} color="#0284c7" style={{ marginRight: 4 }} />
                                <Text style={styles.pickerOpenAddBtnText}>
                                  Click here to Add New {pickerConfig.label}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      }

                      return filtered.map((opt) => {
                        const isSelected = pickerConfig.value === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                            onPress={() => {
                              pickerConfig.onSelect(opt);
                              setPickerConfig(null);
                              setPickerSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                              {opt}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={19} color="#0284c7" />}
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}

          {/* Add New Master Item Popup Window with Input Box and Save Button */}
          {addMasterModal && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                if (!savingNewMaster) setAddMasterModal(null);
              }}
            >
              <View style={styles.addMasterOverlay}>
                <View style={styles.addMasterCard}>
                  {/* Popup Header */}
                  <View style={styles.addMasterHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.addMasterIconCircle}>
                        <Ionicons name="add" size={18} color="#0284c7" />
                      </View>
                      <Text style={styles.addMasterTitle}>
                        Add New {addMasterModal.label}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (!savingNewMaster) setAddMasterModal(null);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="close" size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {/* Popup Body: Input Box */}
                  <View style={styles.addMasterBody}>
                    <Text style={styles.addMasterLabel}>
                      {addMasterModal.label} Name <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.addMasterInput}
                      placeholder={`Enter ${addMasterModal.label}...`}
                      placeholderTextColor="#94a3b8"
                      value={newMasterInputValue}
                      onChangeText={setNewMasterInputValue}
                      autoFocus={true}
                      onSubmitEditing={handleSaveNewMasterPopup}
                    />
                    {addMasterError ? (
                      <Text style={styles.addMasterError}>{addMasterError}</Text>
                    ) : null}
                    <Text style={styles.addMasterHint}>
                      Saved directly to MongoDB masters and selected in your entry.
                    </Text>
                  </View>

                  {/* Popup Footer: Cancel and Save Buttons */}
                  <View style={styles.addMasterFooter}>
                    <TouchableOpacity
                      style={styles.addMasterCancelBtn}
                      onPress={() => setAddMasterModal(null)}
                      disabled={savingNewMaster}
                    >
                      <Text style={styles.addMasterCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addMasterSaveBtn, savingNewMaster && { opacity: 0.7 }]}
                      onPress={handleSaveNewMasterPopup}
                      disabled={savingNewMaster}
                    >
                      {savingNewMaster ? (
                        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                      ) : (
                        <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.addMasterSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContentMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    height: '100%',
    borderRadius: 0,
  },
  modalHeader: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCloseBtn: {
    padding: 6,
    marginRight: 6,
    borderRadius: 6,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  mobileBottomActionBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  mobileBottomSaveBtn: {
    backgroundColor: '#0284c7',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  mobileBottomSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 6,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  readOnlyInput: {
    backgroundColor: '#f8fafc',
    color: '#475569',
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 46,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  stepperTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  stepperButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  stepperBtn: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  calculatedBox: {
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  calculatedValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
  },
  conditionalBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 14,
  },
  conditionalTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  paymentSectionBlock: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    padding: 14,
    marginBottom: 16,
  },
  paymentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369a1',
    marginLeft: 6,
  },
  paymentSectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paymentOptionCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f8fafc',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  paymentRadioActive: {
    borderColor: '#0284c7',
  },
  paymentRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#0284c7',
  },
  paymentOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  paymentOptionLabelActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  paymentOptionDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  paymentSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  paymentSummaryBadgeText: {
    fontSize: 13,
    color: '#0369a1',
    marginLeft: 6,
  },
  mobileDropdownTrigger: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  mobileDropdownValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    flex: 1,
  },
  mobileDropdownPlaceholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  pickerBackdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBackdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 20,
    width: '100%',
  },
  pickerSheetDesktop: {
    width: 480,
    maxHeight: 540,
    borderRadius: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  searchableDropdownTrigger: {
    backgroundColor: '#ffffff',
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  pickerAddNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickerAddNewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pickerAddNewTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  pickerAddNewSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  pickerOpenAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pickerOpenAddBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  addMasterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addMasterCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  addMasterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addMasterIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMasterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  addMasterBody: {
    padding: 18,
  },
  addMasterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  addMasterInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  addMasterError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  addMasterHint: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 8,
  },
  addMasterFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  addMasterCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMasterCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  addMasterSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  addMasterSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  pickerEmptyWrap: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  pickerList: {
    paddingHorizontal: 8,
    maxHeight: 320,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  pickerItemActive: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 14.5,
    color: '#334155',
    fontWeight: '500',
  },
  pickerItemTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  noOptionsText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  toggleBtnActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  addChargesSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 16,
  },
  addChargesToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addChargesSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  toggleYesNoGroup: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  togglePillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePillBtnActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  togglePillBtnInactive: {
    backgroundColor: '#64748b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  togglePillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  togglePillTextActive: {
    color: '#ffffff',
  },
  togglePillTextInactive: {
    color: '#ffffff',
  },
  miniTableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    marginBottom: 10,
  },
  miniTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  miniTableTh: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.3,
  },
  miniTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  miniTableCellText: {
    fontSize: 12.5,
  },
  trashBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTableTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  miniTableTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  miniTableTotalVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  chargeInputCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
    marginBottom: 10,
  },
  chargeInputCardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0369a1',
  },
  saveChargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 4,
  },
  saveChargeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  addMoreChargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
    paddingVertical: 9,
    borderRadius: 8,
  },
  addMoreChargeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
});
