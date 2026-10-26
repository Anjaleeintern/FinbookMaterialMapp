import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Share as RNShare,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { api } from '../api/client';

// Converts numbers into Indian currency words matching Tally: 'INR Ninety Three Thousand Only'
const numberToIndianWords = (num) => {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'INR Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (val) => {
    let str = '';
    if (val >= 100) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += b[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += a[val] + ' ';
    }
    return str.trim();
  };

  let result = '';
  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (rem > 0) result += convertLessThanOneThousand(rem);

  return 'INR ' + result.trim() + ' Only';
};

const formatINR = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Generates exact Tally Invoice HTML matching the user's reference image
export const generateTallyInvoiceHtml = (entry, companyName = '') => {
  if (!entry) return '';

  const challanNo = entry.challan_no || entry.serial_no || entry.id || '-';
  const dateStr = entry.date || '';

  const compName = companyName || entry.company_name || 'Organization';
  const compAddress = entry.company_address || '';
  const compEmail = entry.company_email || '';

  const partyName = entry.party_name || entry.customer_name || '-';
  const partyAddress = entry.party_address || entry.party_state || '';

  const paymentMode = entry.payment_mode || (
    entry.type_mode === 'Cash Sale' ? 'Cash' : (entry.type_mode === 'Credit Sale' ? 'Credit' : (entry.type_mode || 'Cash'))
  );

  const vehicleNo = entry.vehicle_no || '-';
  const transportName = entry.transport_name || entry.transport_type || '-';
  const destination = entry.party_state || entry.destination || '-';

  const materialName = entry.material_name || '-';
  const netWt = entry.net_wt !== undefined && entry.net_wt !== null ? entry.net_wt : (entry.quantity || 0);
  const unit = entry.rate_calc_unit || (entry.quantity ? 'Nos' : 'MT');
  const rate = Number(entry.rate || 0.0);
  const amount = Number(entry.amount || (parseFloat(netWt) * rate) || 0.0);
  const totalAmount = Number(entry.total_amount || amount);

  // Additional charges (Royalty / Freight)
  const addChargeName = entry.additional_charge_name || '';
  const addChargeAmt = Number(entry.additional_charge_amount || 0);

  // GST Breakdown
  const cgstAmt = Number(entry.cgst_amount || 0);
  const sgstAmt = Number(entry.sgst_amount || 0);
  const igstAmt = Number(entry.igst_amount || 0);

  let extraRowsHtml = '';
  if (addChargeAmt > 0) {
    extraRowsHtml += `
      <tr>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;"><div style="font-size: 8.5pt; color: #111;">${addChargeName || 'Royalty / Freight Charges'}</div></td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="text-align: right; font-weight: bold; padding: 3px 4px;">${formatINR(addChargeAmt)}</td>
      </tr>
    `;
  }
  if (cgstAmt > 0) {
    extraRowsHtml += `
      <tr>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;"><div style="font-size: 8.5pt; color: #111;">Output CGST @ ${entry.cgst_rate || ''}%</div></td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="text-align: right; font-weight: bold; padding: 3px 4px;">${formatINR(cgstAmt)}</td>
      </tr>
    `;
  }
  if (sgstAmt > 0) {
    extraRowsHtml += `
      <tr>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;"><div style="font-size: 8.5pt; color: #111;">Output SGST @ ${entry.sgst_rate || ''}%</div></td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="text-align: right; font-weight: bold; padding: 3px 4px;">${formatINR(sgstAmt)}</td>
      </tr>
    `;
  }
  if (igstAmt > 0) {
    extraRowsHtml += `
      <tr>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;"><div style="font-size: 8.5pt; color: #111;">Output IGST @ ${entry.igst_rate || ''}%</div></td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="border-right: 1px solid #000; padding: 3px 4px;">&nbsp;</td>
        <td style="text-align: right; font-weight: bold; padding: 3px 4px;">${formatINR(igstAmt)}</td>
      </tr>
    `;
  }

  const amountWords = numberToIndianWords(totalAmount);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${challanNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5pt;
      color: #000000;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .invoice-title {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    table.tally-outer {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
    }
    .tally-outer td, .tally-outer th {
      border: 1px solid #000000;
      vertical-align: top;
    }
    .sub-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sub-table td {
      border: 1px solid #000000;
      padding: 2px 4px;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .lbl {
      font-size: 7.5pt;
      color: #222222;
      line-height: 1.1;
    }
    .val {
      font-size: 8.5pt;
      margin-top: 1px;
      line-height: 1.2;
    }
    .goods-table {
      width: 100%;
      border-collapse: collapse;
    }
    .goods-table th {
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      border-left: none;
      border-right: 1px solid #000000;
      font-size: 8pt;
      font-weight: bold;
      padding: 4px 3px;
    }
    .goods-table th:last-child {
      border-right: none;
    }
    .goods-table td {
      border-left: none;
      border-right: 1px solid #000000;
      border-top: none;
      border-bottom: none;
      padding: 4px 4px;
    }
    .goods-table td:last-child {
      border-right: none;
    }
    .total-row td {
      border-top: 1px solid #000000 !important;
      border-bottom: 1px solid #000000 !important;
      padding: 4px 4px !important;
    }
  </style>
</head>
<body>
  <div class="invoice-title">INVOICE</div>

  <table class="tally-outer">
    <!-- Top Details Row -->
    <tr>
      <!-- Left 50%: Company & Buyer -->
      <td width="50%" style="padding: 0; vertical-align: top;">
        <div style="padding: 5px 6px; min-height: 80px;">
          <div class="bold" style="font-size: 10pt;">${compName}</div>
          ${compAddress ? `<div class="val">${compAddress}</div>` : ''}
          ${compEmail ? `<div class="val">E-Mail : ${compEmail}</div>` : ''}
        </div>
        <div style="border-top: 1px solid #000000; padding: 5px 6px; min-height: 120px;">
          <div class="lbl">Buyer (Bill to)</div>
          <div class="bold" style="font-size: 9.5pt; margin-top: 2px;">${partyName}</div>
          ${partyAddress ? `<div class="val">${partyAddress}</div>` : ''}
        </div>
      </td>

      <!-- Right 50%: Boxed Grid -->
      <td width="50%" style="padding: 0; vertical-align: top;">
        <table class="sub-table" style="margin: -1px;">
          <tr>
            <td width="50%" style="border-top: none; border-left: none;">
              <div class="lbl">Invoice No.</div>
              <div class="bold val">${challanNo}</div>
            </td>
            <td width="50%" style="border-top: none; border-left: none; border-right: none;">
              <div class="lbl">Dated</div>
              <div class="bold val">${dateStr}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Delivery Note</div>
              <div class="val">&nbsp;</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Mode/Terms of Payment</div>
              <div class="val">${paymentMode}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Reference No. &amp; Date.</div>
              <div class="val">&nbsp;</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Other References</div>
              <div class="val">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Buyer's Order No.</div>
              <div class="val">&nbsp;</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Dated</div>
              <div class="val">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Dispatch Doc No.</div>
              <div class="bold val">${vehicleNo}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Delivery Note Date</div>
              <div class="val">${dateStr}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Dispatched through</div>
              <div class="bold val">${transportName}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Destination</div>
              <div class="bold val">${destination}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Vessel/Flight No.</div>
              <div class="bold val">${vehicleNo}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Place of receipt by shipper:</div>
              <div class="bold val">Quarry / Crusher</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">City/Port of Loading</div>
              <div class="bold val">Crusher Site</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">City/Port of Discharge</div>
              <div class="bold val">${destination}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border-left: none; border-right: none; border-bottom: none;">
              <div class="lbl">Terms of Delivery</div>
              <div class="val">&nbsp;</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Middle Goods Table -->
    <tr>
      <td colspan="2" style="padding: 0;">
        <table class="goods-table">
          <thead>
            <tr>
              <th width="4%" class="text-center">Sl<br/>No.</th>
              <th width="50%" style="text-align: left;">Description of Goods</th>
              <th width="13%" class="text-right">Quantity</th>
              <th width="13%" class="text-right">Rate</th>
              <th width="6%" class="text-center">per</th>
              <th width="14%" class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center bold" style="height: 250px; vertical-align: top;">1</td>
              <td style="vertical-align: top;">
                <div class="bold" style="font-size: 9pt;">${materialName}</div>
              </td>
              <td class="text-right bold" style="vertical-align: top;">${netWt} ${unit}</td>
              <td class="text-right" style="vertical-align: top;">${formatINR(rate)}</td>
              <td class="text-center" style="vertical-align: top;">${unit}</td>
              <td class="text-right bold" style="vertical-align: top;">${formatINR(amount)}</td>
            </tr>
            ${extraRowsHtml}
            <tr class="total-row">
              <td style="border-right: none;"></td>
              <td class="bold text-right" style="border-left: none;">Total</td>
              <td class="text-right bold">${netWt} ${unit}</td>
              <td></td>
              <td></td>
              <td class="text-right bold">₹ ${formatINR(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Amount in words & E.&O.E. -->
    <tr>
      <td colspan="2" style="padding: 4px 6px;">
        <table width="100%" style="border-collapse: collapse; border: none;">
          <tr>
            <td style="border: none; padding: 0;">
              <div class="lbl">Amount Chargeable (in words)</div>
              <div class="bold" style="font-size: 8.5pt; margin-top: 2px;">${amountWords}</div>
            </td>
            <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
              <div style="font-size: 8pt; font-style: italic;">E. &amp; O.E</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Declaration and Signature -->
    <tr>
      <td width="50%" style="padding: 5px 6px; vertical-align: top;">
        <div class="bold" style="font-size: 7.5pt;">Declaration</div>
        <div style="font-size: 7pt; margin-top: 3px; line-height: 1.3;">
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>
      </td>
      <td width="50%" style="padding: 5px 6px; vertical-align: top;">
        <div class="bold text-right" style="font-size: 8.5pt;">for ${compName}</div>
        <div style="height: 45px;"></div>
        <div class="text-right" style="font-size: 7.5pt;">Authorised Signatory</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const EntryInvoicePdfModal = ({ visible, entry, company, user, onClose }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [toastMsg, setToastMsg] = useState('');
  const [downloading, setDownloading] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  if (!entry) return null;

  const companyName = company || user?.company_name || user?.name || 'Organization';
  const compAddress = entry.company_address || user?.address || '';
  const compEmail = entry.company_email || user?.email || '';
  const challanNo = entry.challan_no || entry.serial_no || entry.id || '-';
  const dateStr = entry.date || '';
  const partyName = entry.party_name || entry.customer_name || '-';
  const partyAddress = entry.party_address || entry.party_state || '';
  const vehicleNo = entry.vehicle_no || '-';
  const transportName = entry.transport_name || entry.transport_type || '-';
  const destination = entry.party_state || entry.destination || '-';
  const paymentMode = entry.payment_mode || (
    entry.type_mode === 'Cash Sale' ? 'Cash' : (entry.type_mode === 'Credit Sale' ? 'Credit' : (entry.type_mode || 'Cash'))
  );
  const materialName = entry.material_name || '-';
  const netWt = entry.net_wt !== undefined && entry.net_wt !== null ? entry.net_wt : (entry.quantity || 0);
  const unit = entry.rate_calc_unit || (entry.quantity ? 'Nos' : 'MT');
  const rate = Number(entry.rate || 0.0);
  const amount = Number(entry.amount || (parseFloat(netWt) * rate) || 0.0);
  const totalAmount = Number(entry.total_amount || amount);
  const amountWords = numberToIndianWords(totalAmount);

  // 1. VIEW ACTION: Opens native system Print/PDF preview on phone, or new tab on web
  const handleView = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const html = generateTallyInvoiceHtml(entry, companyName);
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
      } else {
        showToast('Please allow popups to view invoice in new window');
      }
    } else {
      try {
        const html = generateTallyInvoiceHtml(entry, companyName);
        await Print.printAsync({ html });
      } catch (err) {
        console.warn('Native view error:', err);
        showToast('Invoice slip is displayed below');
      }
    }
  };

  // 2. DIRECT DOWNLOAD ACTION: Downloads/saves the PDF directly on phone or web
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    showToast('Preparing invoice PDF...');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web Method 1: Backend direct binary PDF download
      try {
        const downloaded = await api.downloadEntryPdf(entry, companyName);
        if (downloaded) {
          showToast('Invoice PDF downloaded directly!');
          setDownloading(false);
          return;
        }
      } catch (err) {
        console.warn('Backend PDF download error, trying client fallback:', err);
      }

      // Web Method 2: Client-side html2pdf fallback
      try {
        if (!window.html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '210mm';
        container.innerHTML = generateTallyInvoiceHtml(entry, companyName);
        document.body.appendChild(container);

        await window.html2pdf()
          .set({
            margin: [8, 10, 8, 10],
            filename: `Invoice_${challanNo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(container)
          .save();

        document.body.removeChild(container);
        showToast('Invoice PDF downloaded directly!');
        setDownloading(false);
        return;
      } catch (clientErr) {
        console.error('Client PDF download error:', clientErr);
      }
    } else {
      // Mobile Method (Android & iOS): Generate real PDF file and present native save/open dialog
      try {
        const html = generateTallyInvoiceHtml(entry, companyName);
        const { uri } = await Print.printToFileAsync({ html });
        const safeChallan = String(challanNo).replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Invoice_${safeChallan}.pdf`;
        const targetPath = `${FileSystem.cacheDirectory}${filename}`;

        await FileSystem.copyAsync({ from: uri, to: targetPath });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(targetPath, {
            mimeType: 'application/pdf',
            dialogTitle: `Save / Download ${filename}`,
            UTI: 'com.adobe.pdf',
          });
          showToast('PDF ready! Choose save destination');
        } else {
          await Print.printAsync({ html });
        }
      } catch (err) {
        console.error('Mobile PDF download error:', err);
        showToast('Download error: ' + (err.message || 'Please try again'));
      }
    }

    setDownloading(false);
  };

  // 3. SHARE ACTION: Opens native Android/iOS system share sheet with PDF attached
  const handleShare = async () => {
    const summaryText = `*INVOICE*
--------------------------------
*Invoice No:* #${challanNo}
*Date:* ${dateStr}
*Buyer:* ${partyName}
*Vehicle No:* ${vehicleNo}
*Material:* ${materialName}
*Quantity:* ${netWt} ${unit}
*Rate:* ₹${formatINR(rate)}
*Total Amount:* ₹${formatINR(totalAmount)}
--------------------------------
${companyName}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Invoice #${challanNo}`,
            text: summaryText,
          });
          showToast('Shared successfully!');
          return;
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.log('Web share failed, falling back to WhatsApp');
          }
        }
      }

      if (typeof window !== 'undefined') {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
        window.open(waUrl, '_blank');
        showToast('Opening WhatsApp to share invoice...');
      }
      return;
    }

    // On Native Phone (Android & iOS) -> Full System Share Sheet (WhatsApp, Gmail, Drive, Bluetooth, etc.)
    try {
      showToast('Opening sharing options...');
      const html = generateTallyInvoiceHtml(entry, companyName);
      const { uri } = await Print.printToFileAsync({ html });
      const safeChallan = String(challanNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Invoice_${safeChallan}.pdf`;
      const sharePath = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.copyAsync({ from: uri, to: sharePath });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(sharePath, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice #${challanNo}`,
          UTI: 'com.adobe.pdf',
        });
        return;
      }
    } catch (err) {
      console.warn('Native PDF file share error, falling back to text share:', err);
    }

    // Fallback: React Native built-in system Share sheet
    try {
      await RNShare.share({
        title: `Invoice #${challanNo}`,
        message: summaryText,
      });
    } catch (err) {
      console.error('System share error:', err);
      showToast('Could not open share options');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isMobile && styles.modalCardMobile]}>
          {/* Header Bar with Action Buttons */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeSuccess}>
                <Ionicons name="checkmark-circle" size={15} color="#059669" style={{ marginRight: 5 }} />
                <Text style={styles.badgeSuccessText}>Saved Successfully</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Invoice #{challanNo}
              </Text>
            </View>

            <View style={styles.actionButtonsRow}>
              {/* 1. VIEW BUTTON */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleView}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={15} color="#0284c7" style={{ marginRight: 5 }} />
                <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>View</Text>
              </TouchableOpacity>

              {/* 2. DIRECT DOWNLOAD BUTTON */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 5 }} />
                ) : (
                  <Ionicons name="download-outline" size={15} color="#ffffff" style={{ marginRight: 5 }} />
                )}
                <Text style={[styles.actionBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </Text>
              </TouchableOpacity>

              {/* 3. SHARE BUTTON */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social-outline" size={15} color="#059669" style={{ marginRight: 5 }} />
                <Text style={[styles.actionBtnText, { color: '#059669' }]}>Share</Text>
              </TouchableOpacity>

              {/* CLOSE BUTTON */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast Notification */}
          {toastMsg ? (
            <View style={styles.toastContainer}>
              <Ionicons name="information-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          ) : null}

          {/* Authentic Tally Invoice Sheet Preview */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={isMobile ? { minWidth: 620 } : { width: '100%', alignItems: 'center' }}
            >
              <View style={[styles.tallySheet, isMobile && { width: 620, minWidth: 620 }]}>
                {/* Header Title */}
                <Text style={styles.tallyTitle}>INVOICE</Text>

              {/* Outer Tally Box */}
              <View style={styles.tallyOuterBox}>
                {/* Top Section: Left 50% Company/Buyer, Right 50% Details Grid */}
                <View style={styles.tallyTopRow}>
                  {/* Left Column: Company & Buyer */}
                  <View style={styles.tallyLeftCol}>
                    <View style={styles.tallyCompanyBox}>
                      <Text style={styles.tallyCompName}>{companyName}</Text>
                      {compAddress ? <Text style={styles.tallyValText}>{compAddress}</Text> : null}
                      {compEmail ? <Text style={styles.tallyValText}>E-Mail : {compEmail}</Text> : null}
                    </View>
                    <View style={styles.tallyBuyerBox}>
                      <Text style={styles.tallyLblText}>Buyer (Bill to)</Text>
                      <Text style={styles.tallyBuyerName}>{partyName}</Text>
                      {partyAddress ? <Text style={styles.tallyValText}>{partyAddress}</Text> : null}
                    </View>
                  </View>

                  {/* Right Column: 9-row boxed grid */}
                  <View style={styles.tallyRightCol}>
                    {/* Row 1: Invoice No. | Dated */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Invoice No.</Text>
                        <Text style={styles.tallyBoldVal}>{challanNo}</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Dated</Text>
                        <Text style={styles.tallyBoldVal}>{dateStr}</Text>
                      </View>
                    </View>

                    {/* Row 2: Delivery Note | Mode/Terms of Payment */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Delivery Note</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Mode/Terms of Payment</Text>
                        <Text style={styles.tallyValText}>{paymentMode}</Text>
                      </View>
                    </View>

                    {/* Row 3: Reference No. & Date. | Other References */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Reference No. & Date.</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Other References</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                    </View>

                    {/* Row 4: Buyer's Order No. | Dated */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Buyer's Order No.</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Dated</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                    </View>

                    {/* Row 5: Dispatch Doc No. | Delivery Note Date */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Dispatch Doc No.</Text>
                        <Text style={styles.tallyBoldVal}>{vehicleNo}</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Delivery Note Date</Text>
                        <Text style={styles.tallyValText}>{dateStr}</Text>
                      </View>
                    </View>

                    {/* Row 6: Dispatched through | Destination */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Dispatched through</Text>
                        <Text style={styles.tallyBoldVal}>{transportName}</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Destination</Text>
                        <Text style={styles.tallyBoldVal}>{destination}</Text>
                      </View>
                    </View>

                    {/* Row 7: Vessel/Flight No. | Place of receipt by shipper */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>Vessel/Flight No.</Text>
                        <Text style={styles.tallyBoldVal}>{vehicleNo}</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Place of receipt by shipper:</Text>
                        <Text style={styles.tallyBoldVal}>Quarry / Crusher</Text>
                      </View>
                    </View>

                    {/* Row 8: City/Port of Loading | City/Port of Discharge */}
                    <View style={styles.gridRow}>
                      <View style={[styles.gridCell, { width: '50%' }]}>
                        <Text style={styles.tallyLblText}>City/Port of Loading</Text>
                        <Text style={styles.tallyBoldVal}>Crusher Site</Text>
                      </View>
                      <View style={[styles.gridCell, { width: '50%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>City/Port of Discharge</Text>
                        <Text style={styles.tallyBoldVal}>{destination}</Text>
                      </View>
                    </View>

                    {/* Row 9: Terms of Delivery */}
                    <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
                      <View style={[styles.gridCell, { width: '100%', borderRightWidth: 0 }]}>
                        <Text style={styles.tallyLblText}>Terms of Delivery</Text>
                        <Text style={styles.tallyValText}>-</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Goods Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thText, { width: '6%', textAlign: 'center' }]}>Sl{"\n"}No.</Text>
                  <Text style={[styles.thText, { width: '48%', textAlign: 'left' }]}>Description of Goods</Text>
                  <Text style={[styles.thText, { width: '14%', textAlign: 'right' }]}>Quantity</Text>
                  <Text style={[styles.thText, { width: '14%', textAlign: 'right' }]}>Rate</Text>
                  <Text style={[styles.thText, { width: '6%', textAlign: 'center' }]}>per</Text>
                  <Text style={[styles.thText, { width: '12%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
                </View>

                {/* Goods Table Body with Tall Blank Space */}
                <View style={styles.tableBodyArea}>
                  {/* Item 1 */}
                  <View style={styles.tableItemRow}>
                    <Text style={[styles.tdText, { width: '6%', textAlign: 'center', fontWeight: 'bold' }]}>1</Text>
                    <View style={[styles.tdCol, { width: '48%' }]}>
                      <Text style={styles.itemTitle}>{materialName}</Text>
                    </View>
                    <Text style={[styles.tdText, { width: '14%', textAlign: 'right', fontWeight: 'bold' }]}>
                      {netWt} {unit}
                    </Text>
                    <Text style={[styles.tdText, { width: '14%', textAlign: 'right' }]}>
                      {formatINR(rate)}
                    </Text>
                    <Text style={[styles.tdText, { width: '6%', textAlign: 'center' }]}>
                      {unit}
                    </Text>
                    <Text style={[styles.tdText, { width: '12%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                      {formatINR(amount)}
                    </Text>
                  </View>

                  {/* Additional Charge Row (if any) */}
                  {entry.additional_charge_amount > 0 && (
                    <View style={styles.tableItemRow}>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <View style={[styles.tdCol, { width: '48%' }]}>
                        <Text style={styles.itemSubtitle}>{entry.additional_charge_name || 'Royalty / Freight Charges'}</Text>
                      </View>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '12%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                        {formatINR(entry.additional_charge_amount)}
                      </Text>
                    </View>
                  )}

                  {/* GST Rows (if any) */}
                  {entry.cgst_amount > 0 && (
                    <View style={styles.tableItemRow}>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <View style={[styles.tdCol, { width: '48%' }]}>
                        <Text style={styles.itemSubtitle}>Output CGST @ {entry.cgst_rate}%</Text>
                      </View>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '12%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                        {formatINR(entry.cgst_amount)}
                      </Text>
                    </View>
                  )}
                  {entry.sgst_amount > 0 && (
                    <View style={styles.tableItemRow}>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <View style={[styles.tdCol, { width: '48%' }]}>
                        <Text style={styles.itemSubtitle}>Output SGST @ {entry.sgst_rate}%</Text>
                      </View>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '14%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '6%' }]}> </Text>
                      <Text style={[styles.tdText, { width: '12%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                        {formatINR(entry.sgst_amount)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Table Total Row */}
                <View style={styles.tableTotalRow}>
                  <Text style={[styles.totalCell, { width: '54%', textAlign: 'right', fontWeight: 'bold' }]}>
                    Total
                  </Text>
                  <Text style={[styles.totalCell, { width: '14%', textAlign: 'right', fontWeight: 'bold' }]}>
                    {netWt} {unit}
                  </Text>
                  <Text style={[styles.totalCell, { width: '14%' }]}> </Text>
                  <Text style={[styles.totalCell, { width: '6%' }]}> </Text>
                  <Text style={[styles.totalCell, { width: '12%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                    ₹ {formatINR(totalAmount)}
                  </Text>
                </View>

                {/* Amount in words & E.&O.E. */}
                <View style={styles.amountWordsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tallyLblText}>Amount Chargeable (in words)</Text>
                    <Text style={styles.amountWordsBold}>{amountWords}</Text>
                  </View>
                  <Text style={styles.eoeText}>E. & O.E</Text>
                </View>

                {/* Bottom Declaration & Signatures */}
                <View style={styles.bottomSection}>
                  <View style={styles.declarationBox}>
                    <Text style={styles.declHeader}>Declaration</Text>
                    <Text style={styles.declBody}>
                      We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                    </Text>
                  </View>
                  <View style={styles.signatureBox}>
                    <Text style={styles.forCompanyText}>for {companyName}</Text>
                    <View style={{ height: 40 }} />
                    <Text style={styles.authorisedSignText}>Authorised Signatory</Text>
                  </View>
                </View>
              </View>
            </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    width: '100%',
    maxWidth: 820,
    height: '92%',
    maxHeight: '94%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  modalCardMobile: {
    width: '100%',
    height: '95%',
    maxHeight: '98%',
    borderRadius: 8,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  downloadBtn: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    marginLeft: 4,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    alignItems: 'center',
  },
  tallySheet: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 760,
    padding: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  tallyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tallyOuterBox: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  tallyTopRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tallyLeftCol: {
    width: '50%',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tallyCompanyBox: {
    padding: 6,
    minHeight: 70,
  },
  tallyCompName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  tallyBuyerBox: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
    padding: 6,
    minHeight: 100,
  },
  tallyBuyerName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 2,
    marginBottom: 2,
  },
  tallyRightCol: {
    width: '50%',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  gridCell: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tallyLblText: {
    fontSize: 9,
    color: '#222222',
  },
  tallyValText: {
    fontSize: 10,
    color: '#000000',
  },
  tallyBoldVal: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
  },
  thText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tableBodyArea: {
    minHeight: 180,
  },
  tableItemRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  tdText: {
    fontSize: 10,
    color: '#000000',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  tdCol: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  itemTitle: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
  },
  itemSubtitle: {
    fontSize: 9.5,
    color: '#333333',
    marginTop: 1,
  },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  totalCell: {
    fontSize: 10.5,
    color: '#000000',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  amountWordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  amountWordsBold: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 2,
  },
  eoeText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#000000',
  },
  bottomSection: {
    flexDirection: 'row',
  },
  declarationBox: {
    width: '50%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  declHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  declBody: {
    fontSize: 8.5,
    color: '#222222',
    lineHeight: 12,
  },
  signatureBox: {
    width: '50%',
    padding: 6,
    justifyContent: 'space-between',
  },
  forCompanyText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#000000',
  },
  authorisedSignText: {
    fontSize: 9.5,
    textAlign: 'right',
    color: '#000000',
  },
});
