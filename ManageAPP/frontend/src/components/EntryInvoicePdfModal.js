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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../api/client';
import { downloadService } from '../services/downloadService';
import { TopDownloadBanner } from './TopDownloadBanner';

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

// Generates exact Delivery Challan HTML matching the user's uploaded reference image
export const generateDeliveryChallanHtml = (entry, companyName = '', user = null) => {
  if (!entry) return '';

  const challanNo = entry.challan_no || entry.serial_no || entry.id || '-';
  const dateStr = entry.date || '';

  const compName = companyName || user?.company_name || (user?.name ? `${user.name}'s Organization` : (entry.company_name || "Admin's Organization"));
  const compAddress = entry.company_address || user?.address || user?.state || user?.location || '';
  const compPhone = entry.company_phone || user?.phone || user?.mobile || '';
  const compEmail = entry.company_email || user?.email || '';

  const partyName = entry.party_name || entry.customer_name || '-';
  const partyAddress = entry.party_address || entry.party_state || entry.destination || '-';

  const paymentMode = entry.payment_mode || (
    entry.type_mode === 'Cash Sale' ? 'Cash' : (entry.type_mode === 'Credit Sale' ? 'Credit' : (entry.type_mode || 'Credit'))
  );

  const vehicleNo = entry.vehicle_no || '-';
  const transportName = entry.transport_name || entry.transport_type || '-';
  const destination = entry.destination || entry.party_state || partyAddress || '-';
  const deliveryLoc = entry.delivery_location || 'Quarry / Crusher';
  const dispatchFrom = entry.dispatch_from || 'Crusher Site';

  const materialName = entry.material_name || '-';
  const netWt = entry.net_wt !== undefined && entry.net_wt !== null ? entry.net_wt : (entry.quantity || 0);
  const unit = entry.rate_calc_unit || (entry.quantity ? 'Nos' : 'MT');
  const remarks = entry.remarks || 'As dispatched';

  const compMeta = [compAddress, compPhone ? `Phone: ${compPhone}` : '', compEmail ? `Email: ${compEmail}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Delivery Challan - ${challanNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #000000;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    .dc-title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .dc-comp {
      text-align: center;
      font-size: 10.5pt;
      font-weight: bold;
      color: #1e293b;
    }
    .dc-meta {
      text-align: center;
      font-size: 8pt;
      color: #475569;
      margin-top: 3px;
    }
    table.dc-grid {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
      margin-top: 16px;
      margin-bottom: 18px;
    }
    table.dc-grid td {
      border: 1px solid #000000;
      padding: 7px 10px;
      font-size: 9pt;
      vertical-align: middle;
    }
    .dc-lbl {
      font-weight: bold;
      color: #000000;
    }
    .dc-sec-head {
      font-size: 10.5pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    table.dc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
    }
    table.dc-table th {
      border: 1px solid #000000;
      background: #f1f5f9;
      padding: 7px 10px;
      font-size: 9pt;
      font-weight: bold;
      text-align: left;
    }
    table.dc-table td {
      border: 1px solid #000000;
      padding: 10px 10px;
      font-size: 9pt;
      vertical-align: top;
    }
    .dc-purpose {
      border: 1px solid #000000;
      padding: 8px 12px;
      font-size: 8.5pt;
      margin-top: 20px;
      margin-bottom: 25px;
    }
    table.dc-sig {
      width: 100%;
      border-collapse: collapse;
      border: none;
      margin-top: 20px;
    }
    table.dc-sig td {
      border: none;
      padding: 0;
      vertical-align: top;
    }
    .dc-sig-line {
      border-top: 1px solid #777777;
      margin-top: 5px;
      margin-bottom: 25px;
      width: 90%;
    }
    .dc-footer {
      margin-top: 25px;
      font-size: 8pt;
      color: #333333;
    }
  </style>
</head>
<body>
  <div class="dc-title">DELIVERY CHALLAN</div>
  <div class="dc-comp">${compName}</div>
  ${compMeta ? `<div class="dc-meta">${compMeta}</div>` : ''}

  <table class="dc-grid">
    <tr>
      <td width="20%" class="dc-lbl">Challan No.</td>
      <td width="30%">${challanNo}</td>
      <td width="22%" class="dc-lbl">Date</td>
      <td width="28%">${dateStr}</td>
    </tr>
    <tr>
      <td class="dc-lbl">Buyer / Consignee</td>
      <td>${partyName}</td>
      <td class="dc-lbl">Payment Terms</td>
      <td>${paymentMode}</td>
    </tr>
    <tr>
      <td class="dc-lbl">State</td>
      <td>${partyAddress}</td>
      <td class="dc-lbl">Vehicle No.</td>
      <td>${vehicleNo}</td>
    </tr>
    <tr>
      <td class="dc-lbl">Transporter</td>
      <td>${transportName}</td>
      <td class="dc-lbl">Delivery Location</td>
      <td>${deliveryLoc}</td>
    </tr>
    <tr>
      <td class="dc-lbl">Dispatch From</td>
      <td>${dispatchFrom}</td>
      <td class="dc-lbl">Destination</td>
      <td>${destination}</td>
    </tr>
  </table>

  <div class="dc-sec-head">GOODS / MATERIAL DETAILS</div>

  <table class="dc-table">
    <thead>
      <tr>
        <th width="7%">Sr.</th>
        <th width="45%">Description of Material</th>
        <th width="14%">Quantity</th>
        <th width="14%">Unit</th>
        <th width="20%">Remarks</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><b>${materialName}</b></td>
        <td>${netWt}</td>
        <td>${unit}</td>
        <td>${remarks}</td>
      </tr>
    </tbody>
  </table>

  <div class="dc-purpose">
    <b>Purpose:</b> Record of goods dispatched / delivered. This challan is not a tax invoice.
  </div>

  <table class="dc-sig">
    <tr>
      <td width="50%">
        <b>Receiver's Signature</b>
        <div class="dc-sig-line"></div>
        <div>Name: ______________________</div>
        <div style="margin-top: 8px;">Date: &nbsp;______________________</div>
      </td>
      <td width="50%">
        <b>Authorised Signatory</b>
        <div class="dc-sig-line"></div>
        <div>For ${compName}</div>
        <div style="margin-top: 8px;">Signature: ______________________</div>
      </td>
    </tr>
  </table>

  <div class="dc-footer">
    Material received in apparent good condition, subject to verification.
  </div>
</body>
</html>`;
};

// Generates Tally Invoice HTML with real stone quarry project headings
export const generateTallyInvoiceHtml = (entry, companyName = '', user = null) => {
  if (!entry) return '';

  const challanNo = entry.challan_no || entry.serial_no || entry.id || '-';
  const dateStr = entry.date || '';

  const compName = companyName || user?.company_name || (user?.name ? `${user.name}'s Organization` : (entry.company_name || "Admin's Organization"));
  const compAddress = entry.company_address || user?.address || user?.state || user?.location || '';
  const compPhone = entry.company_phone || user?.phone || user?.mobile || '';
  const compEmail = entry.company_email || user?.email || '';

  const partyName = entry.party_name || entry.customer_name || '-';
  const partyAddress = entry.party_address || entry.party_state || '';

  const paymentMode = entry.payment_mode || (
    entry.type_mode === 'Cash Sale' ? 'Cash' : (entry.type_mode === 'Credit Sale' ? 'Credit' : (entry.type_mode || 'Cash'))
  );

  const vehicleNo = entry.vehicle_no || '-';
  const transportName = entry.transport_name || entry.transport_type || '-';
  const destination = entry.destination || entry.party_state || '-';
  const deliveryLoc = entry.delivery_location || 'Quarry / Crusher';
  const dispatchFrom = entry.dispatch_from || 'Crusher Site';

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
      padding: 3px 5px;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .lbl {
      font-size: 7.5pt;
      color: #000000;
      line-height: 1.1;
    }
    .val {
      font-size: 8.5pt;
      margin-top: 1px;
      line-height: 1.2;
      color: #000000;
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
      color: #000000;
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
      color: #000000;
    }
    .goods-table td:last-child {
      border-right: none;
    }
    .total-row td {
      border-top: 1px solid #000000 !important;
      border-bottom: 1px solid #000000 !important;
      padding: 4px 4px !important;
      color: #000000;
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
          ${compAddress ? `<div class="val" style="margin-top: 2px;">${compAddress}</div>` : ''}
          ${compPhone ? `<div class="val" style="font-size: 8pt; color: #000000; margin-top: 2px;">Contact: ${compPhone}</div>` : ''}
          ${compEmail ? `<div class="val" style="font-size: 8pt; color: #000000; margin-top: 1px;">E-Mail : ${compEmail}</div>` : ''}
        </div>
        <div style="border-top: 1px solid #000000; padding: 5px 6px; min-height: 120px;">
          <div class="lbl">Buyer / Consignee (Bill to)</div>
          <div class="bold" style="font-size: 9.5pt; margin-top: 2px;">${partyName}</div>
          ${partyAddress ? `<div class="val">${partyAddress}</div>` : ''}
        </div>
      </td>

      <!-- Right 50%: Boxed Grid tailored for stone quarry dispatch -->
      <td width="50%" style="padding: 0; vertical-align: top;">
        <table class="sub-table" style="margin: -1px;">
          <tr>
            <td width="50%" style="border-top: none; border-left: none;">
              <div class="lbl">Challan / Invoice No.</div>
              <div class="bold val">${challanNo}</div>
            </td>
            <td width="50%" style="border-top: none; border-left: none; border-right: none;">
              <div class="lbl">Dated</div>
              <div class="bold val">${dateStr}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Vehicle No.</div>
              <div class="bold val">${vehicleNo}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Payment Terms</div>
              <div class="val">${paymentMode}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Transporter</div>
              <div class="bold val">${transportName}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Delivery Location</div>
              <div class="bold val">${deliveryLoc}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none;">
              <div class="lbl">Dispatch From</div>
              <div class="bold val">${dispatchFrom}</div>
            </td>
            <td style="border-left: none; border-right: none;">
              <div class="lbl">Destination</div>
              <div class="bold val">${destination}</div>
            </td>
          </tr>
          <tr>
            <td style="border-left: none; border-bottom: none;">
              <div class="lbl">Material Name</div>
              <div class="bold val">${materialName}</div>
            </td>
            <td style="border-left: none; border-right: none; border-bottom: none;">
              <div class="lbl">Dispatched Quantity</div>
              <div class="bold val">${netWt} ${unit}</div>
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
              <th width="50%" style="text-align: left;">Description of Material / Goods</th>
              <th width="13%" class="text-right">Quantity</th>
              <th width="13%" class="text-right">Rate</th>
              <th width="6%" class="text-center">per</th>
              <th width="14%" class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center bold" style="height: 220px; vertical-align: top;">1</td>
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

// Generates Stripe / Modern Card HTML
export const generateStripeInvoiceHtml = (entry, companyName = '', user = null) => {
  if (!entry) return '';

  const challanNo = entry.challan_no || entry.serial_no || entry.id || '-';
  const dateStr = entry.date || '';

  const compName = companyName || user?.company_name || (user?.name ? `${user.name}'s Organization` : (entry.company_name || "Admin's Organization"));
  const compAddress = entry.company_address || user?.address || user?.state || user?.location || '';
  const compPhone = entry.company_phone || user?.phone || user?.mobile || '';

  const partyName = entry.party_name || entry.customer_name || '-';
  const partyAddress = entry.party_address || entry.party_state || entry.destination || '';

  const paymentMode = entry.payment_mode || (
    entry.type_mode === 'Cash Sale' ? 'Cash' : (entry.type_mode === 'Credit Sale' ? 'Credit' : (entry.type_mode || 'Cash'))
  );

  const vehicleNo = entry.vehicle_no || '-';
  const transportName = entry.transport_name || entry.transport_type || '-';
  const destination = entry.destination || entry.party_state || partyAddress || '-';

  const materialName = entry.material_name || '-';
  const netWt = entry.net_wt !== undefined && entry.net_wt !== null ? entry.net_wt : (entry.quantity || 0);
  const unit = entry.rate_calc_unit || (entry.quantity ? 'Nos' : 'MT');
  const rate = Number(entry.rate || 0.0);
  const amount = Number(entry.amount || (parseFloat(netWt) * rate) || 0.0);
  const totalAmount = Number(entry.total_amount || amount);
  const amountWords = numberToIndianWords(totalAmount);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Slip - ${challanNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1e293b; margin: 0; padding: 0; background: #ffffff; }
    .stripe-card { border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 12px; padding: 14px; background: #ffffff; }
    .stripe-header { border-left: 5px solid #0284c7; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 8.5pt; font-weight: bold; }
    .badge-blue { background: #e0f2fe; color: #0284c7; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .total-banner { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; }
  </style>
</head>
<body>
  <div class="stripe-card stripe-header">
    <div style="font-size: 14pt; font-weight: bold; color: #0f172a;">${compName}</div>
    ${compAddress ? `<div style="font-size: 9pt; color: #64748b; margin-top: 2px;">${compAddress}</div>` : ''}
    ${compPhone ? `<div style="font-size: 8.5pt; color: #64748b;">Phone: ${compPhone}</div>` : ''}
    <div style="height: 1px; background: #e2e8f0; margin: 10px 0;"></div>
    <table width="100%">
      <tr>
        <td>
          <div style="font-size: 8pt; color: #64748b; text-transform: uppercase;">Challan / Invoice No</div>
          <div style="font-size: 13pt; font-weight: bold; color: #0284c7;">#${challanNo}</div>
        </td>
        <td style="text-align: center;">
          <div style="font-size: 8pt; color: #64748b; text-transform: uppercase;">Date</div>
          <div style="font-size: 11pt; font-weight: bold;">${dateStr}</div>
        </td>
        <td style="text-align: right;">
          <div style="font-size: 8pt; color: #64748b; text-transform: uppercase;">Payment Terms</div>
          <span class="badge ${paymentMode === 'Cash' ? 'badge-green' : 'badge-blue'}">${paymentMode}</span>
        </td>
      </tr>
    </table>
  </div>

  <div class="stripe-card">
    <div style="font-size: 9pt; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">Buyer / Consignee</div>
    <div style="font-size: 12pt; font-weight: bold; color: #0f172a;">${partyName}</div>
    ${partyAddress ? `<div style="font-size: 9pt; color: #64748b; margin-top: 2px;">${partyAddress}</div>` : ''}
  </div>

  <div class="stripe-card">
    <div style="font-size: 9pt; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-bottom: 8px;">Dispatch & Transport Details</div>
    <table width="100%">
      <tr>
        <td width="50%">
          <div style="font-size: 8.5pt; color: #64748b;">Vehicle No:</div>
          <div style="font-size: 11pt; font-weight: bold; color: #0f172a;">${vehicleNo}</div>
        </td>
        <td width="50%">
          <div style="font-size: 8.5pt; color: #64748b;">Transporter:</div>
          <div style="font-size: 10.5pt; color: #1e293b;">${transportName}</div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 8px;">
          <div style="font-size: 8.5pt; color: #64748b;">Dispatch From:</div>
          <div style="font-size: 10.5pt; color: #1e293b;">Crusher Site</div>
        </td>
        <td style="padding-top: 8px;">
          <div style="font-size: 8.5pt; color: #64748b;">Destination:</div>
          <div style="font-size: 10.5pt; color: #1e293b;">${destination}</div>
        </td>
      </tr>
    </table>
  </div>

  <div class="stripe-card">
    <div style="font-size: 9pt; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-bottom: 8px;">Material & Quantity</div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
      <div style="font-size: 12pt; font-weight: bold; color: #0284c7;">${materialName}</div>
      <div style="font-size: 10.5pt; margin-top: 4px;">Quantity: <b>${netWt} ${unit}</b></div>
      ${rate > 0 ? `<div style="font-size: 10pt; color: #475569; margin-top: 2px;">Rate: ₹${formatINR(rate)} / ${unit}</div>` : ''}
    </div>
  </div>

  <div class="total-banner">
    <table width="100%">
      <tr>
        <td style="font-size: 11pt; font-weight: bold; color: #065f46;">TOTAL AMOUNT</td>
        <td style="text-align: right; font-size: 16pt; font-weight: bold; color: #059669;">₹${formatINR(totalAmount)}</td>
      </tr>
    </table>
    <div style="font-size: 9pt; color: #047857; margin-top: 6px; font-style: italic;">Amount in words: ${amountWords}</div>
  </div>

  <table width="100%" style="margin-top: 35px;">
    <tr>
      <td width="50%" style="font-size: 8.5pt; color: #64748b; font-style: italic;">
        Material received in apparent good condition.
      </td>
      <td width="50%" style="text-align: right;">
        <div style="font-size: 9.5pt; font-weight: bold;">for ${compName}</div>
        <div style="height: 35px;"></div>
        <div style="font-size: 8.5pt; color: #64748b;">Authorised Signatory</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Dispatches to the appropriate HTML generator
export const generateInvoiceHtml = (entry, companyName = '', user = null, mode = 'challan') => {
  if (mode === 'tally') {
    return generateTallyInvoiceHtml(entry, companyName, user);
  } else if (mode === 'stripe') {
    return generateStripeInvoiceHtml(entry, companyName, user);
  }
  return generateDeliveryChallanHtml(entry, companyName, user);
};

export const EntryInvoicePdfModal = ({ visible, entry, company, user, onClose }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const insets = useSafeAreaInsets();
  // Safe distance from top so the modal stays well clear of the phone's status bar, clock, battery, and camera notch:
  const topSafe = Platform.OS === 'web'
    ? 16
    : Platform.OS === 'android'
      ? Math.max(StatusBar.currentHeight || 28, insets?.top || 0, 28) + 14
      : Math.max(insets?.top || 44, 44) + 10;
  const bottomSafe = Platform.OS === 'web'
    ? 16
    : Math.max(insets?.bottom || 16, 16) + 10;

  const [toastMsg, setToastMsg] = useState('');
  const [downloading, setDownloading] = useState(false);
  // Default to 'tally' - user wants Tally View PDF directly, no template switching
  const [viewMode, setViewMode] = useState('tally');
  const [a4FitMode, setA4FitMode] = useState('fit'); // 'fit' | 'wide'

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  if (!entry) return null;

  const companyName = company || user?.company_name || (user?.name ? `${user.name}'s Organization` : (entry.company_name || "Admin's Organization"));
  const compAddress = entry.company_address || user?.address || user?.state || user?.location || '';
  const compPhone = entry.company_phone || user?.phone || user?.mobile || '';
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
    const html = generateInvoiceHtml(entry, companyName, user, viewMode);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.click();
        }
      } catch (e) {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.open();
          printWin.document.write(html);
          printWin.document.close();
        } else {
          showToast('Please allow popups to view document');
        }
      }
    } else {
      try {
        await Print.printAsync({ html });
      } catch (err) {
        console.warn('Native view error:', err);
        showToast('Document slip is displayed below');
      }
    }
  };

  // 2. DIRECT DOWNLOAD ACTION: Downloads/saves the PDF directly on phone or web
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    const docTitle = viewMode === 'challan' ? 'Delivery Challan' : (viewMode === 'stripe' ? 'Stripe Slip' : 'Invoice');
    showToast(`Preparing ${docTitle} PDF...`);

    const safeChallan = String(challanNo).replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = viewMode === 'challan' ? 'Challan' : (viewMode === 'stripe' ? 'Slip' : 'Invoice');
    const filename = `${prefix}_${safeChallan}.pdf`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web Method 1: Backend direct binary PDF download
      try {
        const downloaded = await api.downloadEntryPdf(entry, companyName, viewMode);
        if (downloaded) {
          showToast(`${docTitle} PDF downloaded directly!`);
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
        container.innerHTML = generateInvoiceHtml(entry, companyName, user, viewMode);
        document.body.appendChild(container);

        await window.html2pdf()
          .set({
            margin: [8, 10, 8, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          })
          .from(container)
          .save();

        document.body.removeChild(container);
        showToast(`${docTitle} PDF downloaded directly!`);
        setDownloading(false);
        return;
      } catch (clientErr) {
        console.error('Client PDF download error:', clientErr);
      }
    } else {
      // Mobile Method (Android & iOS): Generate real PDF file and present native save/open dialog
      try {
        const html = generateInvoiceHtml(entry, companyName, user, viewMode);
        const targetPath = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;

        // Generate PDF file with base64 encoded data so we don't depend on unreadable cache paths
        const printResult = await Print.printToFileAsync({ html, base64: true });
        let fileUri = printResult.uri;

        if (printResult.base64) {
          try {
            await FileSystem.writeAsStringAsync(targetPath, printResult.base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            fileUri = targetPath;
          } catch (writeErr) {
            console.warn('Could not write base64 to targetPath, using printResult.uri:', writeErr);
          }
        }

        // Register download with downloadService: Shows the top notification banner & triggers native open
        await downloadService.registerCompletedDownload({
          fileUri,
          filename,
          mimeType: 'application/pdf',
          title: `${docTitle} #${challanNo} Ready`,
          openImmediately: true,
        });

        showToast(`${docTitle} PDF ready! Tap banner above to open anytime`);
      } catch (err) {
        console.error('Mobile PDF download error:', err);
        showToast('Download error: ' + (err.message || 'Please try again'));
      }
    }

    setDownloading(false);
  };

  // 3. SHARE ACTION: Opens native Android/iOS system share sheet with PDF attached
  const handleShare = async () => {
    const docTitle = viewMode === 'challan' ? 'DELIVERY CHALLAN' : (viewMode === 'stripe' ? 'DELIVERY SLIP' : 'INVOICE');
    const summaryText = `*${docTitle}*
--------------------------------
*Challan No:* #${challanNo}
*Date:* ${dateStr}
*Buyer:* ${partyName}
*Vehicle No:* ${vehicleNo}
*Transporter:* ${transportName}
*Dispatch From:* Crusher Site
*Destination:* ${destination}
*Material:* ${materialName}
*Quantity:* ${netWt} ${unit}
${viewMode !== 'challan' ? `*Rate:* ₹${formatINR(rate)}\n*Total:* ₹${formatINR(totalAmount)}\n` : ''}--------------------------------
${companyName}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `${docTitle} #${challanNo}`,
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
        showToast('Opening WhatsApp to share document...');
      }
      return;
    }

    // On Native Phone (Android & iOS) -> Full System Share Sheet (WhatsApp, Gmail, Drive, Bluetooth, etc.)
    try {
      showToast('Opening sharing options...');
      const html = generateInvoiceHtml(entry, companyName, user, viewMode);
      const safeChallan = String(challanNo).replace(/[^a-zA-Z0-9_-]/g, '_');
      const prefix = viewMode === 'challan' ? 'Challan' : (viewMode === 'stripe' ? 'Slip' : 'Invoice');
      const filename = `${prefix}_${safeChallan}.pdf`;
      const sharePath = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${filename}`;

      const printResult = await Print.printToFileAsync({ html, base64: true });
      let fileUri = printResult.uri;

      if (printResult.base64) {
        try {
          await FileSystem.writeAsStringAsync(sharePath, printResult.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          fileUri = sharePath;
        } catch (writeErr) {
          console.warn('Could not write base64 to sharePath, using printResult.uri:', writeErr);
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${docTitle} #${challanNo}`,
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
        title: `${docTitle} #${challanNo}`,
        message: summaryText,
      });
    } catch (err) {
      console.error('System share error:', err);
      showToast('Could not open share options');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={[styles.modalOverlay, { paddingTop: topSafe, paddingBottom: bottomSafe }]}>
        <TopDownloadBanner />
        <View style={styles.modalCard}>

          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeSuccess}>
                <Ionicons name="checkmark-circle" size={13} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.badgeSuccessText}>Saved ✓</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>#{challanNo}</Text>
            </View>
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleView} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={14} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading
                  ? <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
                  : <Ionicons name="download-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />}
                <Text style={[styles.actionBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                  {downloading ? 'PDF...' : 'PDF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-social-outline" size={14} color="#000000" style={{ marginRight: 4 }} />
                <Text style={styles.actionBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close invoice"
              >
                <Ionicons name="close" size={20} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast */}
          {toastMsg ? (
            <View style={styles.toastContainer}>
              <Ionicons name="information-circle" size={15} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View>
          ) : null}

          {/* Full-Screen Scrollable Tally Invoice Matching Image 2 */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <View style={styles.invoiceSheet}>
              {/* Top Main Heading */}
              <Text style={styles.invoiceMainTitle}>INVOICE</Text>
              {/* Top Table: Left 50% (Company & Buyer) | Right 50% (5-Row Dispatch Details Grid) */}
              <View style={styles.topTable}>
                {/* Left Column: Company (top) & Buyer (bottom) */}
                <View style={styles.buyerCell}>
                  {/* Company Box */}
                  <View style={styles.companySubBox}>
                    <Text style={styles.tCompName}>{companyName}</Text>
                    {compAddress ? <Text style={styles.tCompAddr}>{compAddress}</Text> : null}
                    {compPhone ? <Text style={styles.tCompAddr}>Contact: {compPhone}</Text> : null}
                    {compEmail ? <Text style={styles.tCompAddr}>E-Mail : {compEmail}</Text> : null}
                  </View>

                  {/* Buyer Box */}
                  <View style={styles.buyerSubBox}>
                    <Text style={styles.tCellLabel}>Buyer (Bill to)</Text>
                    <Text style={styles.tBuyerName}>{partyName}</Text>
                    {partyAddress ? <Text style={styles.tBuyerAddr}>{partyAddress}</Text> : null}
                    {paymentMode ? (
                      <View style={{ marginTop: 4 }}>
                        <Text style={styles.tCellLabel}>Mode/Terms of Payment</Text>
                        <Text style={styles.tCellVal}>{paymentMode}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Right Column: 5-row quarry dispatch details grid */}
                <View style={styles.detailGrid}>
                  {/* Row 1: Invoice No & Date */}
                  <View style={styles.dRow}>
                    <View style={styles.dCell}>
                      <Text style={styles.tCellLabel}>Invoice No.</Text>
                      <Text style={styles.tCellBold}>{challanNo}</Text>
                    </View>
                    <View style={[styles.dCell, styles.dCellNoBorderRight]}>
                      <Text style={styles.tCellLabel}>Dated</Text>
                      <Text style={styles.tCellBold}>{dateStr}</Text>
                    </View>
                  </View>

                  {/* Row 2: Vehicle No & Payment Terms */}
                  <View style={styles.dRow}>
                    <View style={styles.dCell}>
                      <Text style={styles.tCellLabel}>Vehicle No.</Text>
                      <Text style={styles.tCellBold}>{vehicleNo}</Text>
                    </View>
                    <View style={[styles.dCell, styles.dCellNoBorderRight]}>
                      <Text style={styles.tCellLabel}>Payment Terms</Text>
                      <Text style={styles.tCellBold}>{paymentMode}</Text>
                    </View>
                  </View>

                  {/* Row 3: Transporter & Delivery Location */}
                  <View style={styles.dRow}>
                    <View style={styles.dCell}>
                      <Text style={styles.tCellLabel}>Transporter</Text>
                      <Text style={styles.tCellBold}>{transportName}</Text>
                    </View>
                    <View style={[styles.dCell, styles.dCellNoBorderRight]}>
                      <Text style={styles.tCellLabel}>Delivery Location</Text>
                      <Text style={styles.tCellBold}>{entry.delivery_location || 'Quarry / Crusher'}</Text>
                    </View>
                  </View>

                  {/* Row 4: Dispatch From & Destination */}
                  <View style={styles.dRow}>
                    <View style={styles.dCell}>
                      <Text style={styles.tCellLabel}>Dispatch From</Text>
                      <Text style={styles.tCellBold}>{entry.dispatch_from || 'Crusher Site'}</Text>
                    </View>
                    <View style={[styles.dCell, styles.dCellNoBorderRight]}>
                      <Text style={styles.tCellLabel}>Destination</Text>
                      <Text style={styles.tCellBold}>{destination}</Text>
                    </View>
                  </View>

                  {/* Row 5: Material Name & Dispatched Quantity */}
                  <View style={[styles.dRow, styles.dRowNoBorderBottom]}>
                    <View style={styles.dCell}>
                      <Text style={styles.tCellLabel}>Material Name</Text>
                      <Text style={styles.tCellBold}>{materialName}</Text>
                    </View>
                    <View style={[styles.dCell, styles.dCellNoBorderRight]}>
                      <Text style={styles.tCellLabel}>Dispatched Quantity</Text>
                      <Text style={styles.tCellBold}>{netWt} {unit}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Goods Table */}
              <View style={styles.goodsTable}>
                <View style={styles.gHeaderRow}>
                  <Text style={[styles.gTh, { width: '8%', textAlign: 'center' }]}>Sl No.</Text>
                  <Text style={[styles.gTh, { flex: 1, textAlign: 'left' }]}>Description of Goods</Text>
                  <Text style={[styles.gTh, { width: '17%', textAlign: 'right' }]}>Quantity</Text>
                  <Text style={[styles.gTh, { width: '16%', textAlign: 'right' }]}>Rate</Text>
                  <Text style={[styles.gTh, { width: '10%', textAlign: 'center' }]}>per</Text>
                  <Text style={[styles.gTh, { width: '19%', textAlign: 'right', borderRightWidth: 0 }]}>Amount</Text>
                </View>

                <View style={styles.gBodyArea}>
                  {/* Main item row */}
                  <View style={styles.gDataRow}>
                    <Text style={[styles.gTd, { width: '8%', textAlign: 'center', fontWeight: 'bold' }]}>1</Text>
                    <View style={[styles.gTdCol, { flex: 1 }]}>
                      <Text style={styles.gItemName}>{materialName}</Text>
                    </View>
                    <Text style={[styles.gTd, { width: '17%', textAlign: 'right', fontWeight: 'bold' }]}>{netWt} {unit}</Text>
                    <Text style={[styles.gTd, { width: '16%', textAlign: 'right' }]}>{formatINR(rate)}</Text>
                    <Text style={[styles.gTd, { width: '10%', textAlign: 'center' }]}>{unit}</Text>
                    <Text style={[styles.gTd, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>{formatINR(amount)}</Text>
                  </View>

                  {entry.additional_charge_amount > 0 && (
                    <View style={styles.gDataRow}>
                      <Text style={[styles.gTd, { width: '8%' }]}> </Text>
                      <View style={[styles.gTdCol, { flex: 1 }]}>
                        <Text style={styles.gSubItem}>{entry.additional_charge_name || 'Royalty / Freight Charges'}</Text>
                      </View>
                      <Text style={[styles.gTd, { width: '17%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '16%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '10%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>{formatINR(entry.additional_charge_amount)}</Text>
                    </View>
                  )}
                  {entry.cgst_amount > 0 && (
                    <View style={styles.gDataRow}>
                      <Text style={[styles.gTd, { width: '8%' }]}> </Text>
                      <View style={[styles.gTdCol, { flex: 1 }]}>
                        <Text style={[styles.gSubItem, { fontStyle: 'italic' }]}>Output CGST @ {entry.cgst_rate}%</Text>
                      </View>
                      <Text style={[styles.gTd, { width: '17%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '16%', textAlign: 'right' }]}>{entry.cgst_rate}%</Text>
                      <Text style={[styles.gTd, { width: '10%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>{formatINR(entry.cgst_amount)}</Text>
                    </View>
                  )}
                  {entry.sgst_amount > 0 && (
                    <View style={styles.gDataRow}>
                      <Text style={[styles.gTd, { width: '8%' }]}> </Text>
                      <View style={[styles.gTdCol, { flex: 1 }]}>
                        <Text style={[styles.gSubItem, { fontStyle: 'italic' }]}>Output SGST @ {entry.sgst_rate}%</Text>
                      </View>
                      <Text style={[styles.gTd, { width: '17%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '16%', textAlign: 'right' }]}>{entry.sgst_rate}%</Text>
                      <Text style={[styles.gTd, { width: '10%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>{formatINR(entry.sgst_amount)}</Text>
                    </View>
                  )}
                  {entry.igst_amount > 0 && (
                    <View style={styles.gDataRow}>
                      <Text style={[styles.gTd, { width: '8%' }]}> </Text>
                      <View style={[styles.gTdCol, { flex: 1 }]}>
                        <Text style={[styles.gSubItem, { fontStyle: 'italic' }]}>Output IGST @ {entry.igst_rate}%</Text>
                      </View>
                      <Text style={[styles.gTd, { width: '17%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '16%', textAlign: 'right' }]}>{entry.igst_rate}%</Text>
                      <Text style={[styles.gTd, { width: '10%' }]}> </Text>
                      <Text style={[styles.gTd, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>{formatINR(entry.igst_amount)}</Text>
                    </View>
                  )}

                  {/* Continuous vertical column lines matching Image 2 */}
                  <View style={styles.gFillerRow}>
                    <View style={[styles.gFillerCell, { width: '8%' }]} />
                    <View style={[styles.gFillerCell, { flex: 1 }]} />
                    <View style={[styles.gFillerCell, { width: '17%' }]} />
                    <View style={[styles.gFillerCell, { width: '16%' }]} />
                    <View style={[styles.gFillerCell, { width: '10%' }]} />
                    <View style={[styles.gFillerCell, { width: '19%', borderRightWidth: 0 }]} />
                  </View>
                </View>

                {/* Total Row */}
                <View style={styles.gTotalRow}>
                  <Text style={[styles.gTotalCell, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>Total</Text>
                  <Text style={[styles.gTotalCell, { width: '17%', textAlign: 'right', fontWeight: 'bold' }]}>{netWt} {unit}</Text>
                  <Text style={[styles.gTotalCell, { width: '16%' }]}> </Text>
                  <Text style={[styles.gTotalCell, { width: '10%' }]}> </Text>
                  <Text style={[styles.gTotalCell, { width: '19%', textAlign: 'right', fontWeight: 'bold', borderRightWidth: 0 }]}>
                    Rs. {formatINR(totalAmount)}
                  </Text>
                </View>
              </View>

              {/* Amount in words */}
              <View style={styles.amtWordsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amtWordsLabel}>Amount Chargeable (in words)</Text>
                  <Text style={styles.amtWordsBold}>{amountWords}</Text>
                </View>
                <Text style={styles.eoeText}>E. & O.E</Text>
              </View>

              {/* Declaration + Signatures */}
              <View style={styles.declSigRow}>
                <View style={styles.declBox}>
                  <Text style={styles.declTitle}>Declaration</Text>
                  <Text style={styles.declText}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </Text>
                </View>
                <View style={styles.sigBox}>
                  <Text style={styles.forCompText}>for {companyName}</Text>
                  <View style={{ flex: 1, minHeight: 35 }} />
                  <Text style={styles.authSignText}>Authorised Signatory</Text>
                </View>
              </View>
            </View>

            <Text style={styles.footerNote}>This is a Computer Generated Invoice</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 820,
    flex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#000000',
    borderWidth: 1.5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  downloadBtn: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#000000',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginHorizontal: 10,
    marginTop: 6,
    borderRadius: 4,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '500',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
    backgroundColor: '#e2e8f0', // Neutral PDF viewer background to make the white paper pop
  },
  scrollContent: {
    padding: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  invoiceMainTitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
    paddingVertical: 7,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
    textTransform: 'uppercase',
  },
  invoiceSheet: {
    backgroundColor: '#ffffff', // Pure white paper
    width: '100%',
    maxWidth: 740,
    borderWidth: 1.5,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 12,
  },
  topTable: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  buyerCell: {
    width: '50%',
    borderRightWidth: 1.5,
    borderRightColor: '#000000',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  companySubBox: {
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 70,
  },
  tCompName: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  tCompAddr: {
    fontSize: 9.5,
    color: '#000000',
    marginTop: 1,
    lineHeight: 13,
  },
  buyerSubBox: {
    padding: 6,
    minHeight: 70,
  },
  tBuyerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 2,
    marginBottom: 2,
  },
  tBuyerAddr: {
    fontSize: 9.5,
    color: '#000000',
    marginTop: 1,
    lineHeight: 13,
  },
  tCellLabel: {
    fontSize: 8.5,
    color: '#000000',
    fontWeight: '600',
  },
  tCellVal: {
    fontSize: 10,
    color: '#000000',
    marginTop: 1,
  },
  tCellBold: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 1,
  },
  detailGrid: {
    width: '50%',
    backgroundColor: '#ffffff',
  },
  dRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  dRowNoBorderBottom: {
    borderBottomWidth: 0,
  },
  dCell: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  dCellNoBorderRight: {
    borderRightWidth: 0,
  },
  goodsTable: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
  },
  gHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
  },
  gTh: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gBodyArea: {
    minHeight: 120,
    backgroundColor: '#ffffff',
  },
  gDataRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0,
  },
  gTd: {
    fontSize: 10,
    color: '#000000',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gTdCol: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gItemName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  gSubItem: {
    fontSize: 9.5,
    color: '#000000',
  },
  gFillerRow: {
    minHeight: 70,
    flexDirection: 'row',
  },
  gFillerCell: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  gTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: '#000000',
    backgroundColor: '#ffffff',
  },
  gTotalCell: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  amtWordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    backgroundColor: '#ffffff',
  },
  amtWordsLabel: {
    fontSize: 8.5,
    color: '#000000',
    fontWeight: '600',
  },
  amtWordsBold: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 2,
  },
  eoeText: {
    fontSize: 9.5,
    fontStyle: 'italic',
    color: '#000000',
    alignSelf: 'flex-start',
  },
  declSigRow: {
    flexDirection: 'row',
    minHeight: 85,
    backgroundColor: '#ffffff',
  },
  declBox: {
    width: '50%',
    borderRightWidth: 1.5,
    borderRightColor: '#000000',
    padding: 6,
  },
  declTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
  },
  declText: {
    fontSize: 8.5,
    color: '#000000',
    lineHeight: 12,
  },
  sigBox: {
    width: '50%',
    padding: 6,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  forCompText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#000000',
  },
  authSignText: {
    fontSize: 9.5,
    color: '#000000',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 9,
    color: '#000000',
    padding: 6,
    marginTop: 2,
  },
});


