import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';

export const ExcelImportModal = ({ visible, onClose, onSuccess }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const insets = useSafeAreaInsets();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const resetState = () => {
    setSelectedFile(null);
    setSelectedMode('auto');
    setSelectedSheets([]);
    setAnalyzing(false);
    setPreviewData(null);
    setImporting(false);
    setImportResult(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const loadPreview = async (file, mode, sheets = null) => {
    if (!file) return;
    setErrorMsg('');
    setAnalyzing(true);

    try {
      const preview = await api.importExcel(file, true, mode, sheets);
      setPreviewData(preview);

      // If sheets were not initialized yet, initialize with default selected sheets
      if (sheets === null && preview.available_sheets) {
        const defaultSelected = preview.available_sheets
          .filter((s) => s.selected !== false)
          .map((s) => s.name);
        setSelectedSheets(defaultSelected);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read Excel file. Please verify file format.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSelectedSheets([]);
    setImportResult(null);
    await loadPreview(file, selectedMode, null);
  };

  const handleModeChange = async (newMode) => {
    setSelectedMode(newMode);
    if (selectedFile) {
      await loadPreview(selectedFile, newMode, selectedSheets.length > 0 ? selectedSheets : null);
    }
  };

  const handleToggleSheet = async (sheetName) => {
    if (!selectedFile) return;

    let updated;
    if (selectedSheets.includes(sheetName)) {
      updated = selectedSheets.filter((s) => s !== sheetName);
    } else {
      updated = [...selectedSheets, sheetName];
    }
    setSelectedSheets(updated);
    await loadPreview(selectedFile, selectedMode, updated);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setErrorMsg('');

    try {
      const result = await api.importExcel(
        selectedFile,
        false,
        selectedMode,
        selectedSheets.length > 0 ? selectedSheets : null
      );
      setImportResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to import entries to MongoDB.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const url = api.getTemplateDownloadUrl();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const getCollectionBadgeColor = (colName) => {
    switch (colName) {
      case 'royalty_sale':
        return { bg: '#fef3c7', text: '#b45309', label: 'Royalty Sale' };
      case 'without_royalty':
        return { bg: '#f1f5f9', text: '#475569', label: 'Without Royalty' };
      case 'credit_sale':
        return { bg: '#fee2e2', text: '#b91c1c', label: 'Credit Sale' };
      case 'cash_sale':
        return { bg: '#dcfce7', text: '#15803d', label: 'Cash Sale' };
      case 'qr_sale':
        return { bg: '#e0e7ff', text: '#4338ca', label: 'QR Sale' };
      case 'hr_loading':
        return { bg: '#f3e8ff', text: '#7e22ce', label: 'HR Loading' };
      default:
        return { bg: '#e2e8f0', text: '#334155', label: colName };
    }
  };

  const topSafe = Platform.OS === 'web' ? 0 : Math.max(insets.top || 0, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, isMobile && { padding: 0 }]}>
        <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
          
          {/* Header */}
          <View style={[styles.modalHeader, isMobile && { paddingTop: topSafe, height: 56 + topSafe }]}>
            <View style={styles.modalTitleRow}>
              <View style={styles.headerIconBg}>
                <Ionicons name="document-text" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Import Excel / CSV Entries</Text>
                <Text style={styles.modalSubtitle}>Direct Date-wise & Mode-wise Destination Saving</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.headerCloseBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            
            {/* Step 1: Download Template Helper */}
            <View style={styles.templateBanner}>
              <View style={styles.templateBannerLeft}>
                <Ionicons name="cloud-download-outline" size={24} color="#0284c7" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.templateBannerTitle}>Standard Excel Template</Text>
                  <Text style={styles.templateBannerDesc}>
                    Download our ready-to-use template with columns: Date, VehicleNo, Type/Mode, Material, Party, Rate, Weights, etc.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={handleDownloadTemplate}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
                <Text style={styles.downloadBtnText}>Download Template</Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Success State */}
            {importResult ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
                </View>
                <Text style={styles.successTitle}>Import Successful!</Text>
                <Text style={styles.successSubtitle}>
                  Successfully inserted {importResult.total_saved} entries directly into MongoDB collections.
                </Text>

                {/* Collection Breakdown */}
                <View style={styles.summaryCollectionsBox}>
                  <Text style={styles.summarySectionTitle}>Direct Destination Breakdown:</Text>
                  <View style={styles.collectionPillsGrid}>
                    {Object.entries(importResult.by_collection || {}).map(([col, count]) => {
                      const badge = getCollectionBadgeColor(col);
                      return (
                        <View key={col} style={[styles.collectionPill, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.collectionPillName, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                          <View style={styles.pillCountBadge}>
                            <Text style={styles.pillCountText}>{count}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {importResult.errors && importResult.errors.length > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>
                      {importResult.errors.length} Row(s) Skipped due to Missing Fields:
                    </Text>
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <Text key={i} style={styles.warningItem}>
                        • Row {err.row}: {err.reason}
                      </Text>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                  <Text style={styles.doneBtnText}>View All Entries</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Upload Box */}
                <View style={styles.uploadCard}>
                  {Platform.OS === 'web' && (
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.dropZone}
                    onPress={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropZoneIconCircle}>
                      <Ionicons name="cloud-upload-outline" size={36} color="#0d9488" />
                    </View>
                    <Text style={styles.dropZoneTitle}>
                      {selectedFile ? selectedFile.name : 'Click to Browse Excel or CSV File'}
                    </Text>
                    <Text style={styles.dropZoneSub}>
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB — Click to choose a different file`
                        : 'Supports .xlsx, .xls, and .csv files. Entries are sorted date-wise.'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Mode Selector Card */}
                <View style={styles.modeConfigCard}>
                  <View style={styles.modeConfigHeader}>
                    <Ionicons name="pricetags-outline" size={17} color="#0d9488" style={{ marginRight: 6 }} />
                    <Text style={styles.modeConfigTitle}>Sheet Type / Mode Selection</Text>
                  </View>
                  <Text style={styles.modeConfigDesc}>
                    Agar Excel file me alag se "Type/Mode" ka column nahi hai, toh Sheet Tab ke naam se auto-detect hoga ya aap yahan se direct mode chun sakte hain:
                  </Text>

                  <View style={styles.modeButtonsGrid}>
                    {[
                      { key: 'auto', label: '⚡ Auto-Detect (from Sheet Name)' },
                      { key: 'Royalty Sale', label: 'Royalty Sale' },
                      { key: 'Without Royalty', label: 'Without Royalty' },
                      { key: 'Cash Sale', label: 'Cash Sale' },
                      { key: 'Credit Sale', label: 'Credit Sale' },
                      { key: 'QR Sale', label: 'QR Sale' },
                      { key: 'HR Loading', label: 'HR Loading' },
                    ].map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.modeSelectBtn,
                          selectedMode === m.key && styles.modeSelectBtnActive,
                        ]}
                        onPress={() => handleModeChange(m.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={selectedMode === m.key ? 'radio-button-on' : 'radio-button-off'}
                          size={13}
                          color={selectedMode === m.key ? '#0d9488' : '#64748b'}
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[
                            styles.modeSelectBtnText,
                            selectedMode === m.key && styles.modeSelectBtnTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Multi-Sheet Selection Manager */}
                  {previewData?.available_sheets?.length > 0 && (
                    <View style={styles.sheetSelectorCard}>
                      <View style={styles.sheetSelectorHeader}>
                        <Ionicons name="albums-outline" size={17} color="#0284c7" style={{ marginRight: 6 }} />
                        <Text style={styles.sheetSelectorTitle}>
                          Sheets Found in Workbook ({previewData.available_sheets.length}):
                        </Text>
                      </View>
                      <Text style={styles.sheetSelectorDesc}>
                        Har sheet ka mode alag se detect ho chuka hai (jaise HR Loading, Without Royalty, Royalty Sale). Aap kisi bhi sheet ko click karke include/exclude kar sakte hain:
                      </Text>

                      <View style={styles.sheetPillsRow}>
                        {previewData.available_sheets.map((sheet) => {
                          const isSelected = selectedSheets.includes(sheet.name);
                          const colKey =
                            sheet.mode === 'HR Loading'
                              ? 'hr_loading'
                              : sheet.mode === 'Without Royalty'
                              ? 'without_royalty'
                              : sheet.mode === 'Royalty Sale'
                              ? 'royalty_sale'
                              : sheet.mode === 'Cash Sale'
                              ? 'cash_sale'
                              : sheet.mode === 'QR Sale'
                              ? 'qr_sale'
                              : 'credit_sale';
                          const modeBadge = getCollectionBadgeColor(colKey);

                          return (
                            <TouchableOpacity
                              key={sheet.name}
                              style={[
                                styles.sheetSelectChip,
                                isSelected ? styles.sheetSelectChipActive : styles.sheetSelectChipInactive,
                              ]}
                              onPress={() => handleToggleSheet(sheet.name)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={isSelected ? 'checkbox' : 'square-outline'}
                                size={16}
                                color={isSelected ? '#0284c7' : '#94a3b8'}
                                style={{ marginRight: 6 }}
                              />
                              <Text style={[styles.sheetChipName, isSelected && styles.sheetChipNameActive]}>
                                {sheet.name}
                              </Text>
                              <View style={[styles.sheetChipModeBadge, { backgroundColor: modeBadge.bg }]}>
                                <Text style={[styles.sheetChipModeText, { color: modeBadge.text }]}>
                                  {sheet.mode}
                                  {sheet.hr_loading_type ? ` • ${sheet.hr_loading_type}` : ''}
                                </Text>
                              </View>
                              <View style={styles.sheetChipCountBadge}>
                                <Text style={styles.sheetChipCountText}>{sheet.rows_count} rows</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Analyzing Indicator */}
                {analyzing && (
                  <View style={styles.analyzingBox}>
                    <ActivityIndicator size="small" color="#0d9488" />
                    <Text style={styles.analyzingText}>Reading & analyzing file entries...</Text>
                  </View>
                )}

                {/* Preview Section */}
                {previewData && (
                  <View style={styles.previewSection}>
                    <View style={styles.previewHeaderRow}>
                      <View>
                        <Text style={styles.previewHeading}>File Analysis & Preview</Text>
                        <Text style={styles.previewSubheading}>
                          {previewData.valid_count} entries ready to import • Chronologically date-sorted
                        </Text>
                      </View>
                      
                      <View style={styles.statsBadgeRow}>
                        <View style={[styles.statBadge, { backgroundColor: '#dcfce7' }]}>
                          <Text style={[styles.statBadgeText, { color: '#15803d' }]}>
                            ✓ {previewData.valid_count} Valid
                          </Text>
                        </View>
                        {previewData.error_count > 0 && (
                          <View style={[styles.statBadge, { backgroundColor: '#fee2e2' }]}>
                            <Text style={[styles.statBadgeText, { color: '#b91c1c' }]}>
                              ⚠ {previewData.error_count} Issues
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Mode routing breakdown preview */}
                    <View style={styles.routingPreviewBox}>
                      <Text style={styles.routingTitle}>Destination Collections Distribution:</Text>
                      <View style={styles.collectionPillsGrid}>
                        {Object.entries(previewData.by_collection || {}).map(([col, count]) => {
                          const badge = getCollectionBadgeColor(col);
                          return (
                            <View key={col} style={[styles.collectionPill, { backgroundColor: badge.bg }]}>
                              <Text style={[styles.collectionPillName, { color: badge.text }]}>
                                {badge.label}
                              </Text>
                              <View style={styles.pillCountBadge}>
                                <Text style={styles.pillCountText}>{count}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Sample Table Preview */}
                    <Text style={styles.tableTitle}>Data Preview (First {previewData.preview_items?.length || 0} rows):</Text>
                    <ScrollView horizontal={true} style={styles.tableScrollView}>
                      <View style={styles.previewTable}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.thCell, { width: 90 }]}>Date</Text>
                          <Text style={[styles.thCell, { width: 120 }]}>Vehicle No</Text>
                          <Text style={[styles.thCell, { width: 130 }]}>Type/Mode</Text>
                          <Text style={[styles.thCell, { width: 130 }]}>Party</Text>
                          <Text style={[styles.thCell, { width: 100 }]}>Material</Text>
                          <Text style={[styles.thCell, { width: 85, textAlign: 'right' }]}>Net Wt</Text>
                          <Text style={[styles.thCell, { width: 80, textAlign: 'right' }]}>Rate</Text>
                          <Text style={[styles.thCell, { width: 100, textAlign: 'right' }]}>Amount</Text>
                          <Text style={[styles.thCell, { width: 130 }]}>Destination</Text>
                        </View>

                        {previewData.preview_items?.map((item, idx) => {
                          const badge = getCollectionBadgeColor(item.target_collection);
                          return (
                            <View key={idx} style={[styles.tableDataRow, idx % 2 === 1 && styles.tableDataRowAlt]}>
                              <Text style={[styles.tdCell, { width: 90 }]}>{item.date}</Text>
                              <Text style={[styles.tdCell, styles.boldCell, { width: 120 }]}>{item.vehicle_no}</Text>
                              <View style={{ width: 130, justifyContent: 'center' }}>
                                <View style={[styles.inlineBadge, { backgroundColor: badge.bg }]}>
                                  <Text style={[styles.inlineBadgeText, { color: badge.text }]}>
                                    {item.type_mode}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.tdCell, { width: 130 }]} numberOfLines={1}>{item.party_name}</Text>
                              <Text style={[styles.tdCell, { width: 100 }]} numberOfLines={1}>{item.material_name}</Text>
                              <Text style={[styles.tdCell, { width: 85, textAlign: 'right' }]}>
                                {item.net_wt ? Number(item.net_wt).toLocaleString('en-IN') : '0'}
                              </Text>
                              <Text style={[styles.tdCell, { width: 80, textAlign: 'right' }]}>
                                ₹{item.rate}
                              </Text>
                              <Text style={[styles.tdCell, styles.boldCell, { width: 100, textAlign: 'right' }]}>
                                ₹{Number(item.total_amount || item.amount || 0).toLocaleString('en-IN')}
                              </Text>
                              <Text style={[styles.tdCell, { width: 130, color: '#64748b', fontSize: 11 }]}>
                                {item.target_collection}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {/* Validation Warnings */}
                    {previewData.errors && previewData.errors.length > 0 && (
                      <View style={styles.warningBox}>
                        <Text style={styles.warningTitle}>
                          ⚠ {previewData.errors.length} Row(s) have missing required fields and will be skipped:
                        </Text>
                        {previewData.errors.slice(0, 4).map((err, i) => (
                          <Text key={i} style={styles.warningItem}>
                            Row {err.row}: {err.reason}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

          </ScrollView>

          {/* Footer Controls */}
          {!importResult && (
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.importBtn,
                  (!previewData || previewData.valid_count === 0 || importing) && { opacity: 0.6 }
                ]}
                onPress={handleConfirmImport}
                disabled={!previewData || previewData.valid_count === 0 || importing}
              >
                {importing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.importBtnText}>Saving to MongoDB...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.importBtnText}>
                      Confirm & Import {previewData?.valid_count ? `(${previewData.valid_count} Entries)` : ''}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalContentMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerCloseBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: 20,
  },
  templateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  templateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 240,
  },
  templateBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
  },
  templateBannerDesc: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 2,
    lineHeight: 16,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#7dd3fc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  uploadCard: {
    marginBottom: 16,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  dropZoneIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ccfbf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  dropZoneSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  modeConfigCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modeConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeConfigTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modeConfigDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  modeButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modeSelectBtnActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  modeSelectBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  modeSelectBtnTextActive: {
    color: '#0f766e',
    fontWeight: '700',
  },
  sheetSelectorCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  sheetSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetSelectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetSelectorDesc: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 15,
  },
  sheetPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  sheetSelectChipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  sheetSelectChipInactive: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    opacity: 0.65,
  },
  sheetChipName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginRight: 6,
  },
  sheetChipNameActive: {
    color: '#0369a1',
    fontWeight: '700',
  },
  sheetChipModeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  sheetChipModeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sheetChipCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sheetChipCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  analyzingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    marginBottom: 16,
  },
  analyzingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  previewSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  previewHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  previewSubheading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statsBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routingPreviewBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  routingTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  collectionPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  collectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  collectionPillName: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  pillCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  tableScrollView: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 12,
  },
  previewTable: {
    minWidth: 900,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  thCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableDataRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tdCell: {
    fontSize: 12,
    color: '#334155',
  },
  boldCell: {
    fontWeight: '600',
    color: '#0f172a',
  },
  inlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  warningItem: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 480,
  },
  summaryCollectionsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
  },
  summarySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  doneBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  importBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
