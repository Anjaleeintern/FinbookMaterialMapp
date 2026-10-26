import io
import os
import logging

logger = logging.getLogger(__name__)

try:
    from xhtml2pdf import pisa
except Exception as e:
    logger.warning("xhtml2pdf could not be imported at startup: %s", e)
    pisa = None

def number_to_indian_words(num):
    """
    Converts numbers into standard Indian numbering system words (Rupees, Lakhs, Crores).
    Matches Tally invoice style: e.g. 'INR Ninety Three Thousand Only'
    """
    try:
        n = int(round(float(num or 0)))
    except Exception:
        return "Zero"
    if n == 0:
        return "Zero"

    a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ]
    b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_less_than_thousand(val):
        s = ""
        if val >= 100:
            s += a[val // 100] + " Hundred "
            val %= 100
        if val >= 20:
            s += b[val // 10] + " "
            val %= 10
        if val > 0:
            s += a[val] + " "
        return s.strip()

    crore = n // 10000000
    rem = n % 10000000
    lakh = rem // 100000
    rem = rem % 100000
    thousand = rem // 1000
    rem = rem % 1000

    parts = []
    if crore > 0:
        parts.append(convert_less_than_thousand(crore) + " Crore")
    if lakh > 0:
        parts.append(convert_less_than_thousand(lakh) + " Lakh")
    if thousand > 0:
        parts.append(convert_less_than_thousand(thousand) + " Thousand")
    if rem > 0:
        parts.append(convert_less_than_thousand(rem))

    words = " ".join(parts).strip()
    return f"INR {words} Only"


def generate_tally_invoice_html(entry: dict, company_name: str = "") -> str:
    """
    Generates exact Tally Invoice HTML matching the user's reference invoice format.
    """
    challan_no = entry.get("challan_no") or entry.get("serial_no") or entry.get("id") or "-"
    date_str = str(entry.get("date") or "")
    
    comp_name = company_name or entry.get("company_name") or "Organization"
    comp_address = entry.get("company_address") or entry.get("user_address") or entry.get("user_state") or entry.get("address") or entry.get("state") or ""
    comp_phone = entry.get("company_phone") or entry.get("user_phone") or entry.get("phone") or ""
    comp_email = entry.get("company_email") or entry.get("email") or ""
    
    party_name = entry.get("party_name") or entry.get("customer_name") or "-"
    party_address = entry.get("party_address") or entry.get("party_state") or ""
    
    payment_mode = entry.get("payment_mode") or (
        "Cash" if entry.get("type_mode") == "Cash Sale"
        else ("Credit" if entry.get("type_mode") == "Credit Sale" else (entry.get("type_mode") or "Cash"))
    )
    
    vehicle_no = entry.get("vehicle_no") or "-"
    transport_name = entry.get("transport_name") or entry.get("transport_type") or "-"
    destination = entry.get("party_state") or entry.get("destination") or "-"
    
    material_name = entry.get("material_name") or "-"
    net_wt = entry.get("net_wt") if entry.get("net_wt") is not None else (entry.get("quantity") or 0)
    unit = entry.get("rate_calc_unit") or ("Nos" if entry.get("quantity") else "MT")
    
    try:
        rate = float(entry.get("rate") or 0.0)
    except Exception:
        rate = 0.0
        
    try:
        amount = float(entry.get("amount") or (float(net_wt) * rate))
    except Exception:
        amount = 0.0
        
    try:
        total_amount = float(entry.get("total_amount") or amount)
    except Exception:
        total_amount = amount

    # Additional charges (Royalty / Freight)
    add_charge_name = entry.get("additional_charge_name") or ""
    try:
        add_charge_amt = float(entry.get("additional_charge_amount") or 0)
    except Exception:
        add_charge_amt = 0.0

    # GST amounts
    try:
        cgst_amt = float(entry.get("cgst_amount") or 0)
        sgst_amt = float(entry.get("sgst_amount") or 0)
        igst_amt = float(entry.get("igst_amount") or 0)
    except Exception:
        cgst_amt, sgst_amt, igst_amt = 0.0, 0.0, 0.0

    extra_rows_html = ""
    if add_charge_amt > 0:
        extra_rows_html += f"""
        <tr>
          <td>&nbsp;</td>
          <td><div style="font-size: 8pt; color: #222;">{add_charge_name or 'Royalty / Freight Charges'}</div></td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td class="text-right bold val">{add_charge_amt:,.2f}</td>
        </tr>
        """

    if cgst_amt > 0:
        extra_rows_html += f"""
        <tr>
          <td>&nbsp;</td>
          <td><div style="font-size: 8pt; color: #222;">Output CGST @ {entry.get('cgst_rate', '')}%</div></td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td class="text-right bold val">{cgst_amt:,.2f}</td>
        </tr>
        """
    if sgst_amt > 0:
        extra_rows_html += f"""
        <tr>
          <td>&nbsp;</td>
          <td><div style="font-size: 8pt; color: #222;">Output SGST @ {entry.get('sgst_rate', '')}%</div></td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td class="text-right bold val">{sgst_amt:,.2f}</td>
        </tr>
        """
    if igst_amt > 0:
        extra_rows_html += f"""
        <tr>
          <td>&nbsp;</td>
          <td><div style="font-size: 8pt; color: #222;">Output IGST @ {entry.get('igst_rate', '')}%</div></td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td class="text-right bold val">{igst_amt:,.2f}</td>
        </tr>
        """

    amount_words = number_to_indian_words(total_amount)

    comp_address_html = f'<div class="val" style="margin-top: 2px;">{comp_address}</div>' if comp_address else ''
    comp_phone_html = f'<div class="val" style="font-size: 8pt; color: #333; margin-top: 2px;">Contact: {comp_phone}</div>' if comp_phone else ''
    comp_email_html = f'<div class="val" style="font-size: 8pt; color: #333; margin-top: 1px;">E-Mail : {comp_email}</div>' if comp_email else ''
    party_address_html = f'<div class="val">{party_address}</div>' if party_address else ''

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice - {challan_no}</title>
<style>
@page {{
    size: a4 portrait;
    margin: 8mm 10mm 8mm 10mm;
}}
* {{
    box-sizing: border-box;
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
    margin-bottom: 5px;
}}
table.tally-outer {{
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #000;
}}
.tally-outer td, .tally-outer th {{
    border: 1px solid #000;
    vertical-align: top;
}}
.sub-table {{
    width: 100%;
    border-collapse: collapse;
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
}}
.goods-table th {{
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: none;
    border-right: 1px solid #000;
    font-size: 8pt;
    font-weight: bold;
    padding: 4px 3px;
}}
.goods-table th:last-child {{
    border-right: none;
}}
.goods-table td {{
    border-left: none;
    border-right: 1px solid #000;
    border-top: none;
    border-bottom: none;
    padding: 4px 4px;
}}
.goods-table td:last-child {{
    border-right: none;
}}
.total-row td {{
    border-top: 1px solid #000 !important;
    border-bottom: 1px solid #000 !important;
    padding: 4px 4px !important;
}}
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
        <div class="bold" style="font-size: 10pt;">{comp_name}</div>
        {comp_address_html}
        {comp_phone_html}
        {comp_email_html}
      </div>
      <div style="border-top: 1px solid #000; padding: 5px 6px; min-height: 120px;">
        <div class="lbl">Buyer (Bill to)</div>
        <div class="bold" style="font-size: 9.5pt; margin-top: 2px;">{party_name}</div>
        {party_address_html}
      </div>
    </td>

    <!-- Right 50%: Boxed Grid -->
    <td width="50%" style="padding: 0; vertical-align: top;">
      <table class="sub-table" style="margin: -1px;">
        <tr>
          <td width="50%" style="border-top: none; border-left: none;">
            <div class="lbl">Invoice No.</div>
            <div class="bold val">{challan_no}</div>
          </td>
          <td width="50%" style="border-top: none; border-left: none; border-right: none;">
            <div class="lbl">Dated</div>
            <div class="bold val">{date_str}</div>
          </td>
        </tr>
        <tr>
          <td style="border-left: none;">
            <div class="lbl">Delivery Note</div>
            <div class="val">&nbsp;</div>
          </td>
          <td style="border-left: none; border-right: none;">
            <div class="lbl">Mode/Terms of Payment</div>
            <div class="val">{payment_mode}</div>
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
            <div class="bold val">{vehicle_no}</div>
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
            <div class="bold val">{destination}</div>
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
            <div class="bold val">{destination}</div>
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
              <div class="bold" style="font-size: 9pt;">{material_name}</div>
            </td>
            <td class="text-right bold" style="vertical-align: top;">{net_wt} {unit}</td>
            <td class="text-right" style="vertical-align: top;">{rate:,.2f}</td>
            <td class="text-center" style="vertical-align: top;">{unit}</td>
            <td class="text-right bold" style="vertical-align: top;">{amount:,.2f}</td>
          </tr>
          {extra_rows_html}
          <tr class="total-row">
            <td style="border-right: none;"></td>
            <td class="bold text-right" style="border-left: none;">Total</td>
            <td class="text-right bold">{net_wt} {unit}</td>
            <td></td>
            <td></td>
            <td class="text-right bold">Rs. {total_amount:,.2f}</td>
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
            <div class="bold" style="font-size: 8.5pt; margin-top: 2px;">{amount_words}</div>
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
      <div class="bold text-right" style="font-size: 8.5pt;">for {comp_name}</div>
      <div style="height: 45px;"></div>
      <div class="text-right" style="font-size: 7.5pt;">Authorised Signatory</div>
    </td>
  </tr>
</table>

</body>
</html>"""
    return html


def generate_tally_invoice_pdf(entry: dict, company_name: str = "") -> bytes:
    """
    Renders the Tally invoice HTML and compiles it to raw PDF bytes.
    """
    global pisa
    if pisa is None:
        try:
            from xhtml2pdf import pisa as _pisa
            pisa = _pisa
        except Exception as e:
            raise RuntimeError(f"xhtml2pdf library is not available on this server: {e}")

    html_code = generate_tally_invoice_html(entry, company_name)
    out = io.BytesIO()
    pstatus = pisa.CreatePDF(html_code, dest=out)
    if hasattr(pstatus, 'err') and pstatus.err:
        raise RuntimeError(f"PDF compilation error: {pstatus.err}")
    return out.getvalue()

