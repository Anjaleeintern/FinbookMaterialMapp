import React, { useState, useEffect } from 'react';
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

// Stepper Component defined outside so it NEVER unmounts on re-render, keeping focus intact
const StepperInput = ({ label, value, onChange, step = 1, placeholder = '0' }) => {
  const currentStr = value === undefined || value === null ? '' : String(value);

  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperContainer}>
        <TextInput
          style={styles.stepperTextInput}
          keyboardType="numeric"
          selectTextOnFocus={true}
          value={currentStr}
          onChangeText={(txt) => {
            // Keep numeric digits and at most one decimal point
            const cleaned = txt.replace(/[^0-9.]/g, '');
            const parts = cleaned.split('.');
            const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
            onChange(sanitized);
          }}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
        />
        <View style={styles.stepperButtons}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const currentNum = parseFloat(value) || 0;
              const next = Math.max(0, Number((currentNum - step).toFixed(2)));
              onChange(String(next));
            }}
          >
            <Ionicons name="remove" size={20} color="#334155" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const currentNum = parseFloat(value) || 0;
              const next = Number((currentNum + step).toFixed(2));
              onChange(String(next));
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
const DropdownSelect = ({ label, required, value, options = [], onSelect, isMobile, onOpenPicker }) => {
  if (Platform.OS === 'web' && !isMobile) {
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
  }

  // Native Mobile Picker Trigger Button
  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>
        {label} {required ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
      </Text>
      <TouchableOpacity
        style={styles.mobileDropdownTrigger}
        onPress={() => onOpenPicker && onOpenPicker({ label, options, value, onSelect })}
      >
        <Text
          style={[styles.mobileDropdownValue, !value && styles.mobileDropdownPlaceholder]}
          numberOfLines={1}
        >
          {value || `Select ${label}`}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </TouchableOpacity>
    </View>
  );
};

export const DeliveryEntriesFormModal = ({ visible, onClose, onSuccess, masters }) => {
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
  const [hrLoadingType, setHrLoadingType] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [cum, setCum] = useState('0');
  const [etpNo, setEtpNo] = useState('');
  const [gWt, setGWt] = useState('0');
  const [tWt, setTWt] = useState('0');
  const [rate, setRate] = useState('0');
  const [paymentMode, setPaymentMode] = useState('');
  const [gstRate, setGstRate] = useState('0');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Mobile Picker Modal State
  const [pickerConfig, setPickerConfig] = useState(null); // { label, options, value, onSelect }

  // Guarantee standard options are always present even before masters load
  const standardTypeModes = [
    'Royalty Sale',
    'Without Royalty',
    'Credit Sale',
    'Cash Sale',
    'QR Sale',
    'HR Loading',
  ];
  const typeModeOptions = Array.from(
    new Set([...(masters?.TypeMode || []), ...standardTypeModes])
  );

  useEffect(() => {
    if (visible) {
      api.getNextChallan()
        .then((data) => setChallanNo(data.next_challan_no))
        .catch(() => setChallanNo(''));

      setDate(getTodayStr());
      setVehicleNo('');
      setTransportType('');
      setTypeMode('');
      setHrLoadingType('');
      setMaterialName('');
      setPartyName('');
      setCum('0');
      setEtpNo('');
      setGWt('0');
      setTWt('0');
      setRate('0');
      setPaymentMode('');
      setGstRate('0');
      setErrorMsg('');
      setPickerConfig(null);
    }
  }, [visible, masters]);

  // When typeMode changes, automatically set sensible defaults for Payment Mode or HR Loading
  useEffect(() => {
    if (isCashOrQrSale(typeMode)) {
      const m = String(typeMode).trim().toLowerCase();
      if (m.includes('qr')) {
        setPaymentMode('QR');
      } else {
        setPaymentMode('Cash');
      }
    } else {
      setPaymentMode('');
    }

    if (typeMode === 'HR Loading') {
      setHrLoadingType((prev) => (prev === 'Without Royalty' ? 'Without Royalty' : 'Royalty Sale'));
    } else {
      setHrLoadingType('');
    }
  }, [typeMode]);

  // Reactive Calculations
  const numGWt = parseFloat(gWt) || 0;
  const numTWt = parseFloat(tWt) || 0;
  const numCum = parseFloat(cum) || 0;
  const numRate = parseFloat(rate) || 0;
  const numGstRate = parseFloat(gstRate) || 0;

  const netWt = Math.max(0, Number((numGWt - numTWt).toFixed(2)));
  const amount = netWt > 0 ? Number(((netWt / 1000) * numRate).toFixed(2)) : Number((numCum * numRate).toFixed(2));

  const isGstVisible =
    typeMode === 'Royalty Sale' ||
    (typeMode === 'HR Loading' && (hrLoadingType === 'Royalty Sale' || hrLoadingType === 'With Royalty'));

  const gstAmount = isGstVisible ? Number(((amount * numGstRate) / 100).toFixed(2)) : 0;
  const totalAmount = Number((amount + gstAmount).toFixed(2));

  const handleSave = async () => {
    if (!vehicleNo || !transportType || !typeMode || !materialName || !partyName) {
      setErrorMsg('Please select all required fields marked with *');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const finalPaymentMode = isCashOrQrSale(typeMode)
        ? (paymentMode || (String(typeMode).toLowerCase().includes('qr') ? 'QR' : 'Cash'))
        : null;

      const payload = {
        date,
        challan_no: challanNo,
        vehicle_no: vehicleNo,
        transport_type: transportType,
        type_mode: typeMode,
        hr_loading_type: typeMode === 'HR Loading' ? hrLoadingType : null,
        material_name: materialName,
        party_name: partyName,
        cum: parseFloat(cum) || 0,
        etp_no: etpNo || '',
        g_wt: parseFloat(gWt) || 0,
        t_wt: parseFloat(tWt) || 0,
        rate: parseFloat(rate) || 0,
        payment_mode: finalPaymentMode,
        gst_rate: isGstVisible ? (parseFloat(gstRate) || 0) : 0,
      };

      const res = await api.createEntry(payload);
      setSubmitting(false);
      onSuccess(res);
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
                {isMobile ? 'New Delivery Entry' : 'Delivery Entries Form'}
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
                  <Text style={styles.saveBtnText}>Save</Text>
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
              value={vehicleNo}
              options={masters?.VehicleNo || []}
              onSelect={setVehicleNo}
              isMobile={isMobile}
              onOpenPicker={setPickerConfig}
            />

            {/* 4. TransportType */}
            <DropdownSelect
              label="TransportType"
              required={true}
              value={transportType}
              options={masters?.TransportName || []}
              onSelect={setTransportType}
              isMobile={isMobile}
              onOpenPicker={setPickerConfig}
            />

            {/* 5. Type/Mode */}
            <DropdownSelect
              label="Type/Mode"
              required={true}
              value={typeMode}
              options={typeModeOptions}
              onSelect={setTypeMode}
              isMobile={isMobile}
              onOpenPicker={setPickerConfig}
            />

            {/* 5.1 EASY & PROMINENT Payment Mode for Cash Sale / Case Sale / QR Sale */}
            {isCashOrQrSale(typeMode) && (
              <View style={styles.paymentSectionBlock}>
                <View style={styles.paymentSectionHeader}>
                  <Ionicons name="wallet-outline" size={18} color="#0284c7" />
                  <Text style={styles.paymentSectionTitle}>
                    Payment Mode <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                </View>
                <Text style={styles.paymentSectionSub}>
                  Select payment mode for {typeMode} (Cash or QR):
                </Text>
                <View style={[styles.paymentOptionsRow, isMobile && { flexDirection: 'column' }]}>
                  <TouchableOpacity
                    style={[
                      styles.paymentOptionCard,
                      paymentMode === 'Cash' && styles.paymentOptionCardActive,
                    ]}
                    onPress={() => setPaymentMode('Cash')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.paymentRadio, paymentMode === 'Cash' && styles.paymentRadioActive]}>
                      {paymentMode === 'Cash' && <View style={styles.paymentRadioInner} />}
                    </View>
                    <Ionicons
                      name="cash-outline"
                      size={22}
                      color={paymentMode === 'Cash' ? '#0284c7' : '#64748b'}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.paymentOptionLabel,
                          paymentMode === 'Cash' && styles.paymentOptionLabelActive,
                        ]}
                      >
                        Cash
                      </Text>
                      <Text style={styles.paymentOptionDesc}>Direct Cash Payment</Text>
                    </View>
                    {paymentMode === 'Cash' && (
                      <Ionicons name="checkmark-circle" size={22} color="#0284c7" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.paymentOptionCard,
                      paymentMode === 'QR' && styles.paymentOptionCardActive,
                    ]}
                    onPress={() => setPaymentMode('QR')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.paymentRadio, paymentMode === 'QR' && styles.paymentRadioActive]}>
                      {paymentMode === 'QR' && <View style={styles.paymentRadioInner} />}
                    </View>
                    <Ionicons
                      name="qr-code-outline"
                      size={22}
                      color={paymentMode === 'QR' ? '#0284c7' : '#64748b'}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.paymentOptionLabel,
                          paymentMode === 'QR' && styles.paymentOptionLabelActive,
                        ]}
                      >
                        QR Code / UPI
                      </Text>
                      <Text style={styles.paymentOptionDesc}>Online QR / UPI Scan</Text>
                    </View>
                    {paymentMode === 'QR' && (
                      <Ionicons name="checkmark-circle" size={22} color="#0284c7" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 6. HR Loading Type */}
            {typeMode === 'HR Loading' && (
              <View style={styles.conditionalBlock}>
                <Text style={styles.conditionalTag}>HR Loading Options</Text>
                <DropdownSelect
                  label="HR Loading Type"
                  required={true}
                  value={hrLoadingType}
                  options={['Royalty Sale', 'Without Royalty']}
                  onSelect={setHrLoadingType}
                  isMobile={isMobile}
                  onOpenPicker={setPickerConfig}
                />
              </View>
            )}

            {/* 7. MaterialName */}
            <DropdownSelect
              label="MaterialName"
              required={true}
              value={materialName}
              options={masters?.MaterialName || []}
              onSelect={setMaterialName}
              isMobile={isMobile}
              onOpenPicker={setPickerConfig}
            />

            {/* 8. PartyName */}
            <DropdownSelect
              label="PartyName"
              required={true}
              value={partyName}
              options={masters?.PartyName || []}
              onSelect={setPartyName}
              isMobile={isMobile}
              onOpenPicker={setPickerConfig}
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
            <StepperInput label="G.WT (Gross Weight)" value={gWt} onChange={setGWt} step={100} />

            {/* 12. T.WT */}
            <StepperInput label="T.WT (Tare Weight)" value={tWt} onChange={setTWt} step={100} />

            {/* 13. NET WT */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>NET WT (Calculated: G.WT - T.WT)</Text>
              <View style={styles.calculatedBox}>
                <Text style={styles.calculatedValue}>{netWt.toLocaleString()} kg</Text>
              </View>
            </View>

            {/* 14. Rate */}
            <StepperInput label="Rate" value={rate} onChange={setRate} step={10} />

            {/* 15. Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Amount (NET WT × Rate or CUM × Rate)</Text>
              <View style={styles.calculatedBox}>
                <Text style={styles.calculatedValue}>₹ {amount.toLocaleString()}</Text>
              </View>
            </View>

            {/* Payment Summary Badge near Amount */}
            {isCashOrQrSale(typeMode) && (
              <View style={styles.paymentSummaryBadge}>
                <Ionicons
                  name={paymentMode === 'QR' ? 'qr-code-outline' : 'cash-outline'}
                  size={16}
                  color="#0284c7"
                />
                <Text style={styles.paymentSummaryBadgeText}>
                  Selected Payment Mode:{' '}
                  <Text style={{ fontWeight: '700', color: '#0369a1' }}>
                    {paymentMode === 'QR' ? 'QR Code / UPI' : 'Cash'}
                  </Text>
                </Text>
              </View>
            )}

            {/* 17, 18, 19. GST Fields */}
            {isGstVisible && (
              <View style={styles.conditionalBlock}>
                <Text style={styles.conditionalTag}>GST Tax Calculations</Text>
                <StepperInput label="GST Rate (%)" value={gstRate} onChange={setGstRate} step={1} />

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>GST Amount (Amount × GST Rate / 100)</Text>
                  <View style={styles.calculatedBox}>
                    <Text style={styles.calculatedValue}>₹ {gstAmount.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>Total Amount (Amount + GST Amount)</Text>
                  <View style={[styles.calculatedBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Text style={[styles.calculatedValue, { color: '#16a34a', fontSize: 16 }]}>
                      ₹ {totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

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
                    <Text style={styles.mobileBottomSaveText}>Save Delivery Entry</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Sheet Picker Modal for Mobile */}
          {pickerConfig && (
            <Modal visible={true} transparent={true} animationType="slide" onRequestClose={() => setPickerConfig(null)}>
              <View style={styles.pickerBackdrop}>
                <TouchableWithoutFeedback onPress={() => setPickerConfig(null)}>
                  <View style={styles.pickerBackdropTouch} />
                </TouchableWithoutFeedback>
                <View style={[styles.pickerSheet, { paddingBottom: Math.max(bottomSafe + 16, 24) }]}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select {pickerConfig.label}</Text>
                    <TouchableOpacity onPress={() => setPickerConfig(null)} style={{ padding: 4 }}>
                      <Ionicons name="close" size={22} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.pickerList}>
                    {pickerConfig.options.length === 0 ? (
                      <Text style={styles.noOptionsText}>No items available in {pickerConfig.label}.</Text>
                    ) : (
                      pickerConfig.options.map((opt) => {
                        const isSelected = pickerConfig.value === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                            onPress={() => {
                              pickerConfig.onSelect(opt);
                              setPickerConfig(null);
                            }}
                          >
                            <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                              {opt}
                            </Text>
                            {isSelected && <Ionicons name="checkmark" size={20} color="#0284c7" />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
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
  pickerBackdropTouch: {
    flex: 1,
  },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 20,
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
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  pickerItemActive: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  pickerItemTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  noOptionsText: {
    padding: 20,
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
  },
});
