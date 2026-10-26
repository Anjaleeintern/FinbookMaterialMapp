import io
from xhtml2pdf import pisa

def generate_tally_invoice_html(entry, company_name="Max Electronics"):
    challan_no = entry.get("challan_no") or entry.get("serial_no") or "37"
    date_str = entry.get("date") or "19-Nov-20"
    party_name = entry.get("party_name") or entry.get("customer_name") or "TEL International"
    party_address = entry.get("party_address") or "Lane-2"
    vehicle_no = entry.get("vehicle_no") or "MAX1234"
    transport_name = entry.get("transport_name") or entry.get("transport_type") or "Airway"
    material_name = entry.get("material_name") or "Asus 16.6 inch Monitor"
    net_wt = entry.get("net_wt") or 15
    rate = entry.get("rate") or 6200.00
    unit = entry.get("rate_calc_unit") or ("Nos" if "Monitor" in material_name else "MT")
    amount = entry.get("amount") or (float(net_wt) * float(rate))
    total_amount = entry.get("total_amount") or amount
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{
    size: a4 portrait;
    margin: 8mm 10mm 8mm 10mm;
}}
body {{
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    color: #000;
    margin: 0;
    padding: 0;
}}
.invoice-title {{
    text-align: center;
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 1px;
    margin-bottom: 4px;
}}
table.tally-outer {{
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
}}
td, th {{
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: top;
}}
.sub-table {{
    width: 100%;
    border-collapse: collapse;
    border: none;
}}
.sub-table td {{
    border: 1px solid #000;
    padding: 2px 4px;
}}
.text-right {{
    text-align: right;
}}
.text-center {{
    text-align: center;
}}
.bold {{
    font-weight: bold;
}}
.lbl {{
    font-size: 7.5pt;
    color: #222;
}}
.val {{
    font-size: 8.5pt;
    margin-top: 1px;
}}
.goods-table {{
    width: 100%;
    border-collapse: collapse;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
}}
.goods-table th {{
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: none;
    border-right: 1px solid #000;
    font-size: 8pt;
    font-weight: bold;
    padding: 3px 4px;
}}
.goods-table th:last-child {{
    border-right: none;
}}
.goods-table td {{
    border-left: none;
    border-right: 1px solid #000;
    border-top: none;
    border-bottom: none;
    padding: 3px 4px;
}}
.goods-table td:last-child {{
    border-right: none;
}}
.total-row td {{
    border-top: 1px solid #000 !important;
    border-bottom: 1px solid #000 !important;
}}
</style>
</head>
<body>
<div class="invoice-title">INVOICE</div>

<table class="tally-outer">
  <!-- Top Details Section -->
  <tr>
    <!-- Left Column: Company & Buyer -->
    <td width="50%" style="padding: 0; vertical-align: top;">
      <div style="padding: 4px 6px; min-height: 85px;">
        <div class="bold" style="font-size: 10pt;">{company_name}</div>
        <div class="val">A 204, Shivaji Nagar, Bengaluru</div>
        <div class="val">E-Mail : Max@guruelectronics.com</div>
      </div>
      <div style="border-top: 1px solid #000; padding: 4px 6px; min-height: 120px;">
        <div class="lbl">Buyer (Bill to)</div>
        <div class="bold" style="font-size: 9.5pt; margin-top: 2px;">{party_name}</div>
        <div class="val">{party_address}</div>
      </div>
    </td>

    <!-- Right Column: Boxed Grid -->
    <td width="50%" style="padding: 0; vertical-align: top;">
      <table class="sub-table" style="margin: -1px;">
        <tr>
          <td width="50%" style="border-top: none; border-left: none;">
            <div class="lbl">Invoice No.</div>
            <div class="bold val" style="font-size: 9pt;">{challan_no}</div>
          </td>
          <td width="50%" style="border-top: none; border-left: none; border-right: none;">
            <div class="lbl">Dated</div>
            <div class="bold val" style="font-size: 9pt;">{date_str}</div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Delivery Note</div>
            <div class="val">{entry.get("serial_no", "")}</div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Mode/Terms of Payment</div>
            <div class="val">{entry.get("payment_mode", "Cash")}</div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Reference No. &amp; Date.</div>
            <div class="val"></div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Other References</div>
            <div class="val"></div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Buyer's Order No.</div>
            <div class="val"></div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Dated</div>
            <div class="val"></div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Dispatch Doc No.</div>
            <div class="bold val">{entry.get("etp_no") or vehicle_no}</div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Delivery Note Date</div>
            <div class="val">{date_str}</div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Dispatched through</div>
            <div class="bold val">{transport_name}</div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Destination</div>
            <div class="bold val">{entry.get("party_state") or "New York"}</div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Vessel/Flight No.</div>
            <div class="bold val">{vehicle_no}</div>
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
            <div class="bold val">{entry.get("party_state") or "Site"}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="border-left: none; border-right: none; border-bottom: none; min-height: 25px;">
            <div class="lbl">Terms of Delivery</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Table of Goods -->
  <tr>
    <td colspan="2" style="padding: 0;">
      <table class="goods-table">
        <thead>
          <tr>
            <th width="5%" class="text-center">Sl<br/>No.</th>
            <th width="53%" style="text-align: left;">Description of Goods</th>
            <th width="12%" class="text-right">Quantity</th>
            <th width="12%" class="text-right">Rate</th>
            <th width="6%" class="text-center">per</th>
            <th width="12%" class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <!-- Item row -->
          <tr style="min-height: 260px;">
            <td class="text-center bold" style="height: 240px; vertical-align: top;">1</td>
            <td style="vertical-align: top;">
              <div class="bold" style="font-size: 9pt;">{material_name}</div>
            </td>
            <td class="text-right bold" style="vertical-align: top;">{net_wt} {unit}</td>
            <td class="text-right" style="vertical-align: top;">{rate:,.2f}</td>
            <td class="text-center" style="vertical-align: top;">{unit}</td>
            <td class="text-right bold" style="vertical-align: top;">{amount:,.2f}</td>
          </tr>

          <!-- Total row -->
          <tr class="total-row">
            <td style="border-right: none;"></td>
            <td class="bold text-right" style="border-left: none;">Total</td>
            <td class="text-right bold">{net_wt} {unit}</td>
            <td></td>
            <td></td>
            <td class="text-right bold">₹ {total_amount:,.2f}</td>
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
            <div class="bold" style="font-size: 8.5pt; margin-top: 2px;">INR Ninety Three Thousand Only</div>
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
    <td width="50%" style="padding: 4px 6px; vertical-align: top;">
      <div class="bold" style="font-size: 7.5pt;">Declaration</div>
      <div style="font-size: 7pt; margin-top: 2px; line-height: 1.25;">
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
      </div>
    </td>
    <td width="50%" style="padding: 4px 6px; vertical-align: top;">
      <div class="bold text-right" style="font-size: 8pt;">for {company_name}</div>
      <div style="height: 40px;"></div>
      <div class="text-right" style="font-size: 7.5pt;">Authorised Signatory</div>
    </td>
  </tr>
</table>

</body>
</html>"""
    return html

sample_entry = {
    "challan_no": "37",
    "date": "19-Nov-20",
    "party_name": "TEL International",
    "party_address": "Lane-2",
    "material_name": "Asus 16.6 inch Monitor",
    "net_wt": "15",
    "rate": 6200.00,
    "amount": 93000.00,
    "total_amount": 93000.00,
    "vehicle_no": "MAX1234",
    "transport_name": "Airway",
    "payment_mode": "Cash",
}

html_code = generate_tally_invoice_html(sample_entry)
out = io.BytesIO()
pisa.CreatePDF(html_code, dest=out)
print("SUCCESS: PDF compiled with byte length:", len(out.getvalue()))
