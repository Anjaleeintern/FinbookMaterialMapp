import io
import csv
import re
from datetime import datetime, date
from typing import List, Dict, Any, Tuple, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from config import get_collection_name
from models.entry_models import EntryCreate
from services.calculation_service import process_entry_calculations
from services.challan_service import get_next_challan_no, is_challan_no_used, extract_challan_number
from database import get_database

# Header variations map for flexible matching
HEADER_MAP = {
    # Date
    "date": "date",
    "entry_date": "date",
    "entrydate": "date",
    "tarikh": "date",
    "challan_date": "date",

    # Challan
    "challan_no": "challan_no",
    "challanno": "challan_no",
    "challan": "challan_no",
    "challan_number": "challan_no",
    "challannumber": "challan_no",

    # Vehicle
    "vehicle_no": "vehicle_no",
    "vehicleno": "vehicle_no",
    "vehicle_number": "vehicle_no",
    "vehiclenumber": "vehicle_no",
    "vehicle": "vehicle_no",
    "truck_no": "vehicle_no",
    "gadi_no": "vehicle_no",

    # Transport Name
    "transport_name": "transport_name",
    "transportname": "transport_name",
    "transport_type": "transport_name",
    "transporttype": "transport_name",
    "transport": "transport_name",
    "transporter": "transport_name",
    "transport_own_vehicle": "transport_name",
    "transport_ownvehicle": "transport_name",

    # Sales Mode
    "sales_mode": "sales_mode",
    "salesmode": "sales_mode",
    "sale_mode": "sales_mode",
    "salemode": "sales_mode",
    "sales_mode_type": "sales_mode",
    "type_mode": "sales_mode",
    "typemode": "sales_mode",
    "type": "sales_mode",
    "mode": "sales_mode",

    # Payment Mode
    "payment_mode": "payment_mode",
    "paymentmode": "payment_mode",
    "payment": "payment_mode",
    "pay_mode": "payment_mode",

    # Customer Name (Cash Sale)
    "customer_name": "customer_name",
    "customername": "customer_name",
    "customer": "customer_name",

    # Party Name (Credit Sale)
    "party_name": "party_name",
    "partyname": "party_name",
    "party": "party_name",
    "parties": "party_name",
    "client": "party_name",
    "buyer": "party_name",

    # Sale Type (Royalty Sale / Without Royalty)
    "sale_type": "sale_type",
    "saletype": "sale_type",
    "royalty_type": "sale_type",

    # Material Name
    "material_name": "material_name",
    "materialname": "material_name",
    "material": "material_name",
    "item": "material_name",
    "item_name": "material_name",

    # CUM
    "cum": "cum",
    "m3": "cum",
    "cubic_meter": "cum",

    # ETP No
    "etp_no": "etp_no",
    "etpno": "etp_no",
    "etp": "etp_no",
    "etp_number": "etp_no",

    # Weights
    "g_wt": "g_wt",
    "gwt": "g_wt",
    "gross_wt": "g_wt",
    "gross_weight": "g_wt",
    "grossweight": "g_wt",
    
    "t_wt": "t_wt",
    "twt": "t_wt",
    "tare_wt": "t_wt",
    "tare_weight": "t_wt",
    "tareweight": "t_wt",

    "net_weight": "net_wt",
    "net_wt": "net_wt",
    "net_wt_after_moisture": "net_wt",
    "net_weight_after_moisture": "net_wt",

    # Rate Calculation Unit
    "rate_calc_unit": "rate_calc_unit",
    "rate_calculation_unit": "rate_calc_unit",
    "rate_unit": "rate_calc_unit",
    "unit": "rate_calc_unit",

    # Rate
    "rate": "rate",
    "rate_without_gst": "rate",
    "rate_with_gst": "rate",
    "bhav": "rate",
    "price": "rate",

    # Amount
    "amount": "amount",
    "material_amount": "amount",
    "amt": "amount",

    # Additional Charge
    "additional_charge_name": "additional_charge_name",
    "additional_charge": "additional_charge_name",
    "additionalcharge": "additional_charge_name",
    "charge_name": "additional_charge_name",
    "other_charges_name": "additional_charge_name",

    "additional_charge_amount": "additional_charge_amount",
    "additional_charge_amt": "additional_charge_amount",
    "charge_amount": "additional_charge_amount",
    "other_charges": "additional_charge_amount",

    # Party State
    "party_state": "party_state",
    "state": "party_state",

    # Taxable Base Amount
    "taxable_amount": "taxable_amount",
    "taxable_base_amount": "taxable_amount",
    "taxable_value": "taxable_amount",

    # GST Rate
    "gst_rate": "gst_rate",
    "gstrate": "gst_rate",
    "gst": "gst_rate",
    "gst_percent": "gst_rate",
    "gst_%": "gst_rate",
    "gst_rate_%": "gst_rate",
    "gst_5": "gst_rate",
    "gst_18": "gst_rate",

    # CGST, SGST, IGST Amounts
    "cgst_amount": "cgst_amount",
    "cgst": "cgst_amount",
    "sgst_amount": "sgst_amount",
    "sgst": "sgst_amount",
    "igst_amount": "igst_amount",
    "igst": "igst_amount",

    # Total Amount
    "total_amount": "total_amount",
    "total": "total_amount",
    "grand_total": "total_amount",
}

def clean_header_name(header: Any) -> str:
    """Normalize column header to snake_case without special characters."""
    if header is None:
        return ""
    text = str(header).strip().lower()
    text = re.sub(r'[\s\.\-\/\(\)\%\_]+', '_', text).strip('_')
    return HEADER_MAP.get(text, text)

def parse_date_val(val: Any) -> Tuple[str, datetime]:
    """Parse various date formats into standardized 'MM/DD/YYYY' string and a sortable datetime."""
    if val is None or val == "":
        today = datetime.now()
        return today.strftime("%m/%d/%Y"), today
    
    if isinstance(val, (datetime, date)):
        dt = val if isinstance(val, datetime) else datetime(val.year, val.month, val.day)
        return dt.strftime("%m/%d/%Y"), dt
    
    val_str = str(val).strip()
    # Try various date formats
    for fmt in (
        "%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", 
        "%Y/%m/%d", "%d.%m.%Y", "%m-%d-%Y", "%Y.%m.%d"
    ):
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime("%m/%d/%Y"), dt
        except ValueError:
            pass
            
    # Fallback: if not parsed, return as string and now as dt
    return val_str, datetime.now()

def parse_float_val(val: Any, default: float = 0.0) -> float:
    """Safely convert value to float."""
    if val is None or val == "":
        return default
    try:
        # Remove commas, currency symbols, whitespace
        cleaned = re.sub(r'[^\d\.\-]', '', str(val))
        return float(cleaned) if cleaned else default
    except (ValueError, TypeError):
        return default

def detect_mode_and_sub(sheet_title: Any, banner_text: Any = "") -> Tuple[str, Optional[str]]:
    """
    Intelligently detect (type_mode, None) from sheet title and optional header banner.
    HR Loading is removed. Supports Without Royalty, Royalty Sale, Credit Sale, Cash Sale, QR Sale.
    """
    s = str(sheet_title or "").strip().lower().replace("_", " ").replace("-", " ")
    b = str(banner_text or "").strip().lower().replace("_", " ").replace("-", " ")

    # 1. Main Without Royalty (handles 'with out', 'without', 'non royalty', 'w/o')
    if "without" in s or "with out" in s or "non royalty" in s or "w/o" in s:
        return "Without Royalty", None

    # 2. Main Royalty Sale
    if "royalty" in s:
        return "Royalty Sale", None

    # 3. Credit Sale
    if "credit" in s or "udhar" in s:
        return "Credit Sale", None

    # 4. Cash Sale / QR Sale (handles 'cash', 'case', 'nagad', 'qr', 'qe', 'upi', 'online')
    if "cash" in s or "case" in s or "nagad" in s or "qr" in s or "qe" in s or "upi" in s or "online" in s:
        return "Cash Sale", None

    # 5. Default for party ledgers or general sheets
    return "Credit Sale", None

def detect_mode_from_text(text: Any) -> Optional[str]:
    mode, _ = detect_mode_and_sub(text)
    return mode

def parse_excel_or_csv_bytes(
    file_bytes: bytes,
    filename: str,
    default_type_mode: Optional[str] = None,
    selected_sheets: Optional[List[str]] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parse Excel (.xlsx, .xls) or CSV bytes into a list of normalized row dictionaries.
    - Iterates ALL sheets in the workbook (multi-sheet support).
    - Automatically detects Type/Mode from sheet tab title or row columns.
    - Filters empty / template placeholder rows.
    Returns (rows, available_sheets).
    """
    rows: List[Dict[str, Any]] = []
    available_sheets: List[Dict[str, Any]] = []
    fname = filename.lower()

    if fname.endswith(".csv"):
        # Auto-detect mode from CSV filename or default
        csv_mode, _ = detect_mode_and_sub(filename)
        if default_type_mode:
            csv_mode = default_type_mode

        # Decode CSV content with fallback encodings
        for encoding in ["utf-8-sig", "utf-8", "latin1", "cp1252"]:
            try:
                decoded = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            decoded = file_bytes.decode("utf-8", errors="replace")

        reader = csv.reader(io.StringIO(decoded))
        header_row = None
        valid_count = 0
        for r in reader:
            if not r or all(c.strip() == "" for c in r):
                continue
            if header_row is None:
                header_row = [clean_header_name(c) for c in r]
            else:
                row_dict = {}
                for idx, col_name in enumerate(header_row):
                    if idx < len(r) and col_name:
                        row_dict[col_name] = r[idx].strip()
                
                v_no = str(row_dict.get("vehicle_no") or "").strip()
                if not v_no or v_no in ["0", "#REF!", "None", "-", "0.0"]:
                    continue

                mode_val = row_dict.get("sales_mode") or row_dict.get("type_mode") or csv_mode
                row_dict["sales_mode"] = mode_val
                row_dict["type_mode"] = mode_val
                row_dict["_sheet_name"] = filename
                rows.append(row_dict)
                valid_count += 1

        available_sheets.append({
            "name": filename,
            "mode": csv_mode,
            "hr_loading_type": None,
            "rows_count": valid_count,
            "is_core": True
        })
    else:
        # Load via openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

        for sheet in wb.worksheets:
            sheet_title_clean = sheet.title.strip()
            title_lower = sheet_title_clean.lower()
            if any(skip in title_lower for skip in ["readme", "instruction", "help", "notes"]):
                continue

            rows_iter = list(sheet.iter_rows(values_only=True))
            if not rows_iter:
                continue

            # Look through first 10 rows for banner text & header row
            banner_text = ""
            r0_non_empty = [c for c in rows_iter[0] if c is not None and str(c).strip() != ""]
            header_row = None
            header_row_idx = 0

            if len(r0_non_empty) <= 2 and len(rows_iter) > 1:
                banner_text = str(r0_non_empty[0])
                header_row_idx = 1

            # Detect sheet mode
            sheet_mode, _ = detect_mode_and_sub(sheet.title, banner_text)
            if default_type_mode and not default_type_mode.lower().startswith("auto"):
                sheet_mode = default_type_mode

            key_cols = {"date", "vehicle_no", "party_name", "material_name", "rate", "g_wt", "t_wt", "cum", "sales_mode", "type_mode", "challan_no", "customer_name"}

            # Search up to row 10 for true header row
            for r_idx in range(header_row_idx, min(10, len(rows_iter))):
                r = rows_iter[r_idx]
                if not r or all(v is None or str(v).strip() == "" for v in r):
                    continue
                cleaned_cells = [clean_header_name(v) for v in r if v is not None]
                matches = sum(1 for c in cleaned_cells if c in key_cols)
                if matches >= 2:
                    header_row = [clean_header_name(v) for v in r]
                    header_row_idx = r_idx
                    break

            if header_row is None:
                continue

            is_core_sheet = sheet_mode in ["Royalty Sale", "Without Royalty", "Credit Sale", "Cash Sale"] and not any(party in title_lower for party in ["sageer", "altamash", "nawaz"])

            # Check if this sheet is selected for import
            should_import = True
            if selected_sheets is not None:
                should_import = (sheet.title.strip() in selected_sheets or sheet.title in selected_sheets)

            sheet_valid_rows = 0

            # Parse data rows after header row
            for row in rows_iter[header_row_idx + 1:]:
                if not row or all(v is None or str(v).strip() in ["", "0", "#REF!"] for v in row):
                    continue
                row_dict = {}
                for idx, col_name in enumerate(header_row):
                    if idx < len(row) and col_name:
                        val = row[idx]
                        row_dict[col_name] = val

                # Silently skip placeholder/empty template rows
                v_no = str(row_dict.get("vehicle_no") or "").strip()
                if not v_no or v_no in ["0", "#REF!", "None", "-", "0.0"]:
                    continue

                sheet_valid_rows += 1

                if not should_import:
                    continue

                # Auto-assign party name from sheet title if party ledger sheet
                p_name = str(row_dict.get("party_name") or "").strip()
                if not p_name and not row_dict.get("customer_name"):
                    row_dict["party_name"] = sheet.title.strip()

                mode_val = row_dict.get("sales_mode") or row_dict.get("type_mode") or sheet_mode
                row_dict["sales_mode"] = mode_val
                row_dict["type_mode"] = mode_val

                row_dict["_sheet_name"] = sheet.title.strip()
                row_dict["_sheet_mode"] = sheet_mode
                rows.append(row_dict)

            available_sheets.append({
                "name": sheet.title.strip(),
                "mode": sheet_mode,
                "hr_loading_type": None,
                "rows_count": sheet_valid_rows,
                "is_core": is_core_sheet,
                "selected": should_import and is_core_sheet if selected_sheets is None else should_import
            })

    return rows, available_sheets

def process_raw_imported_rows(
    raw_rows: List[Dict[str, Any]],
    default_type_mode: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Validate, normalize, calculate, and sort imported rows by date.
    Maps directly to Create Entry form fields:
    - Sales Mode (Cash Sale / Credit Sale / Royalty Sale / Without Royalty / QR Sale)
    - Sale Type (Royalty Sale / Without Royalty)
    - Transport Name, Customer Name, Party Name, Rate Calculation Unit (MT/CUM)
    - Additional Charges & GST
    Destination collection is routed according to Sales Mode.
    Returns (valid_entries, errors).
    """
    valid_entries = []
    errors = []

    for index, r in enumerate(raw_rows, start=2):  # Row 1 is header
        try:
            # 1. Date normalization & sort key
            date_str, date_obj = parse_date_val(r.get("date"))

            # 2. Extract and sanitize key fields
            vehicle_no = str(r.get("vehicle_no") or "").strip().upper()
            transport_name = str(r.get("transport_name") or r.get("transport_type") or "").strip()
            if not transport_name:
                transport_name = "Own / Default"

            # Resolve Sales Mode: row value > sheet title detection > default_type_mode
            raw_mode = str(r.get("sales_mode") or r.get("type_mode") or "").strip()
            if not raw_mode:
                sheet_title = r.get("_sheet_name")
                raw_mode = detect_mode_from_text(sheet_title) or (default_type_mode or "").strip()

            mode_lower = raw_mode.lower()
            if "cash" in mode_lower or "case" in mode_lower or "qr" in mode_lower or "upi" in mode_lower:
                mode = "Cash Sale"
            elif "credit" in mode_lower or "udhar" in mode_lower:
                mode = "Credit Sale"
            elif "without" in mode_lower:
                mode = "Without Royalty"
            elif "royalty" in mode_lower:
                mode = "Royalty Sale"
            elif raw_mode:
                mode = raw_mode
            else:
                mode = "Credit Sale"

            # Sale Type (Royalty Sale / Without Royalty)
            raw_sale_type = str(r.get("sale_type") or "").strip()
            if "without" in raw_sale_type.lower():
                sale_type = "Without Royalty"
            elif "royalty" in raw_sale_type.lower():
                sale_type = "Royalty Sale"
            elif raw_sale_type:
                sale_type = raw_sale_type
            elif mode == "Royalty Sale":
                sale_type = "Royalty Sale"
            elif mode == "Without Royalty":
                sale_type = "Without Royalty"
            else:
                sale_type = None

            # Customer Name & Party Name based on Sales Mode
            raw_cust = str(r.get("customer_name") or "").strip()
            raw_party = str(r.get("party_name") or "").strip()

            if mode == "Cash Sale":
                customer_name = raw_cust or raw_party or "Cash Customer"
                party_name = customer_name
                raw_pm = str(r.get("payment_mode") or "").strip()
                if raw_pm.lower() in ["bank", "online"]:
                    payment_mode = "Bank"
                elif raw_pm.lower() in ["qr", "upi"] or "qr" in mode_lower or "upi" in mode_lower:
                    payment_mode = "QR"
                else:
                    payment_mode = "Cash"
            else:
                customer_name = None
                party_name = raw_party or raw_cust
                payment_mode = None

            material_name = str(r.get("material_name") or "").strip()

            # Validation: essential fields
            missing = []
            if not vehicle_no: missing.append("Vehicle No")
            if not mode: missing.append("Sales Mode")
            if not material_name: missing.append("Material Name")
            if mode == "Credit Sale" and not party_name: missing.append("Party Name")
            if mode == "Cash Sale" and not customer_name: missing.append("Customer Name")

            if missing:
                errors.append({
                    "row": index,
                    "reason": f"Missing required field(s): {', '.join(missing)}",
                    "data": r
                })
                continue

            # 3. Numeric & Calculation fields
            cum = parse_float_val(r.get("cum"), 0.0)
            etp_no = str(r.get("etp_no") or "").strip()
            g_wt = parse_float_val(r.get("g_wt"), 0.0)
            t_wt = parse_float_val(r.get("t_wt"), 0.0)
            rate = parse_float_val(r.get("rate"), 0.0)
            gst_rate = parse_float_val(r.get("gst_rate"), 0.0)

            # Rate Calculation Unit (MT or CUM)
            raw_unit = str(r.get("rate_calc_unit") or "").strip().upper()
            rate_calc_unit = "CUM" if ("CUM" in raw_unit or "M3" in raw_unit) else "MT"

            # Additional Charge
            additional_charge_name = str(r.get("additional_charge_name") or "").strip() or None
            additional_charge_amount = parse_float_val(r.get("additional_charge_amount"), 0.0)

            # Party State
            party_state = str(r.get("party_state") or "").strip() or "Madhya Pradesh"

            # Create Pydantic model for calculation validation
            entry_create = EntryCreate(
                date=date_str,
                challan_no=None,
                vehicle_no=vehicle_no,
                transport_type=transport_name,
                type_mode=mode,
                sale_type=sale_type,
                hr_loading_type=None,
                material_name=material_name,
                party_name=party_name,
                customer_name=customer_name,
                party_state=party_state,
                cum=cum,
                etp_no=etp_no,
                g_wt=g_wt,
                t_wt=t_wt,
                rate=rate,
                rate_calc_unit=rate_calc_unit,
                additional_charge_name=additional_charge_name,
                additional_charge_amount=additional_charge_amount,
                payment_mode=payment_mode,
                gst_rate=gst_rate,
            )

            # Process full formula calculations
            calc_data = process_entry_calculations(entry_create)
            target_collection = get_collection_name(mode)
            calc_data["target_collection"] = target_collection
            calc_data["_sort_date"] = date_obj
            calc_data["row_number"] = index

            valid_entries.append(calc_data)

        except Exception as e:
            errors.append({
                "row": index,
                "reason": str(e),
                "data": r
            })

    # Sort valid entries date-wise ascending as requested by user
    valid_entries.sort(key=lambda x: x["_sort_date"])
    return valid_entries, errors

async def execute_bulk_import_to_mongodb(
    valid_entries: List[Dict[str, Any]],
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    company_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Saves entries one by one into MongoDB directly into their respective destination collections
    with unique auto-incrementing challan sequences for this user and company.
    """
    db = get_database()
    saved_count = 0
    by_collection = {}
    saved_records = []

    for entry in valid_entries:
        target_collection = entry.pop("target_collection", None) or get_collection_name(entry.get("type_mode", ""))
        entry.pop("_sort_date", None)
        row_num = entry.pop("row_number", None)

        # STRICT REQUIREMENT: Neglect any Excel challan number to maintain un-interrupted system series.
        # Always generate atomic, unique, continuous challan sequence (001, 002, 003...) from MongoDB counters for this user.
        entry["challan_no"] = await get_next_challan_no(user_id=user_id)

        entry["created_at"] = datetime.utcnow()
        entry["saved_in"] = target_collection
        entry["entry_source"] = "excel"
        if user_id:
            entry["user_id"] = user_id
        if user_email:
            entry["user_email"] = user_email
        if company_id or user_id:
            entry["company_id"] = company_id or user_id

        # Direct destination insert — zero staging
        result = await db[target_collection].insert_one(entry)
        entry["id"] = str(result.inserted_id)
        if "_id" in entry:
            del entry["_id"]

        saved_count += 1
        by_collection[target_collection] = by_collection.get(target_collection, 0) + 1
        saved_records.append({
            "challan_no": entry.get("challan_no"),
            "vehicle_no": entry.get("vehicle_no"),
            "type_mode": entry.get("type_mode"),
            "target_collection": target_collection,
            "net_wt": entry.get("net_wt"),
            "total_amount": entry.get("total_amount"),
            "date": entry.get("date"),
        })

    return {
        "success": True,
        "total_saved": saved_count,
        "by_collection": by_collection,
        "records": saved_records[:50]  # preview of saved records
    }

def generate_sample_excel_template() -> bytes:
    """
    Generate clean, styled Excel template matching Create Entry form fields.
    Columns:
    Date, ChallanNo, VehicleNo, Transport Name, Sales Mode, Payment Mode, Customer Name,
    Party Name, Sale Type, MaterialName, CUM, ETP No, G.WT, T.WT, Net Wt,
    Rate Calculation Unit, Rate, Amount, Additional Charge Name, Additional Charge Amount,
    Party State, Taxable Base Amount, GST Rate (%), CGST Amount, SGST Amount, IGST Amount, Total Amount.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Delivery Entries Template"

    # Styling colors
    primary_color = "134E4A" # Dark teal matching app header
    header_fill = PatternFill(start_color=primary_color, end_color=primary_color, fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    
    sample_fill = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
    regular_font = Font(name="Segoe UI", size=10)
    
    thin_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB')
    )

    headers = [
        "Date",
        "ChallanNo",
        "VehicleNo",
        "Transport Name",
        "Sales Mode",
        "Payment Mode",
        "Customer Name",
        "Party Name",
        "Sale Type",
        "MaterialName",
        "CUM",
        "ETP No",
        "G.WT",
        "T.WT",
        "Net Wt",
        "Rate Calculation Unit",
        "Rate",
        "Amount",
        "Additional Charge Name",
        "Additional Charge Amount",
        "Party State",
        "Taxable Base Amount",
        "GST Rate (%)",
        "CGST Amount",
        "SGST Amount",
        "IGST Amount",
        "Total Amount"
    ]

    ws.append(headers)

    # Apply header styles
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    sample_rows = [
        ["10/14/2026", "CH-0001", "MP09GG1230", "MSK", "Credit Sale", "", "", "NAWAZ KHAN", "Royalty Sale", "10MM", 0, "ETP-8921", 50.00, 15.00, 35.00, "MT", 450, 15750.00, "Loading Charge", 500.00, "Madhya Pradesh", 16250.00, 18, 1462.50, 1462.50, 0, 19175.00],
        ["10/14/2026", "CH-0002", "MP09BS6668", "VMPL", "Cash Sale", "Cash", "RAMESH PATEL", "", "", "20MM", 0, "", 40.00, 12.00, 28.00, "MT", 480, 13440.00, "", 0, "Madhya Pradesh", 13440.00, 0, 0, 0, 0, 13440.00],
        ["10/15/2026", "CH-0003", "RJ09GE1458", "VMPL", "Credit Sale", "", "", "ALTAMASH KHAN", "Without Royalty", "M-SAND", 12.5, "", 0, 0, 0, "CUM", 850, 10625.00, "Weighbridge Charge", 300.00, "Rajasthan", 10925.00, 5, 0, 0, 546.25, 11471.25],
        ["10/15/2026", "CH-0004", "MP09GG1150", "MSK", "Cash Sale", "Bank", "VIJAY SHARMA", "", "", "10MM", 0, "", 38.00, 10.00, 28.00, "MT", 460, 12880.00, "", 0, "Madhya Pradesh", 12880.00, 12, 772.80, 772.80, 0, 14425.60],
        ["10/16/2026", "CH-0005", "GJ01XY7890", "DELHI CARRIERS", "Credit Sale", "", "", "PUSHPENDRA", "Royalty Sale", "GSB", 0, "ETP-9932", 45.00, 12.00, 33.00, "MT", 390, 12870.00, "", 0, "Madhya Pradesh", 12870.00, 5, 321.75, 321.75, 0, 13513.50]
    ]

    for r_idx, row_data in enumerate(sample_rows, start=2):
        ws.append(row_data)
        for c_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = regular_font
            cell.border = thin_border
            cell.fill = sample_fill
            # Align center for text/dates, right for numeric
            if c_idx in [1, 2, 3, 4, 5, 6, 9, 10, 16]:
                cell.alignment = Alignment(horizontal="center")
            elif c_idx in [11, 13, 14, 15, 17, 18, 20, 22, 23, 24, 25, 26, 27]:
                cell.alignment = Alignment(horizontal="right")

    # Column widths for all 27 columns
    widths = [14, 14, 16, 18, 16, 14, 20, 22, 16, 16, 10, 14, 12, 12, 12, 18, 10, 14, 20, 16, 18, 18, 14, 14, 14, 14, 16]
    for idx, width in enumerate(widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    ws_notes = wb.create_sheet(title="Instructions & Rules")
    notes = [
        ["Column Name", "Required?", "Allowed Values / Examples", "Description"],
        ["Date", "Yes", "MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD", "Delivery transaction date."],
        ["ChallanNo", "Optional", "Leave blank or auto", "Auto-generated sequentially by system (001, 002...) to maintain continuous series across manual and excel entries."],
        ["VehicleNo", "Yes", "MP09GG1230, etc.", "Vehicle registration number."],
        ["Transport Name", "No", "MSK, VMPL, etc.", "Transporter name (defaults to 'Own / Default' if blank)."],
        ["Sales Mode", "Yes", "Credit Sale, Cash Sale, Royalty Sale, Without Royalty, QR Sale", "Routes directly to destination MongoDB collection."],
        ["Payment Mode", "Conditional", "Cash, Bank, QR", "Applicable for Cash Sale."],
        ["Customer Name", "Conditional", "Customer Name", "Required for Cash Sale. Saved in database without affecting party ledger."],
        ["Party Name", "Conditional", "Client / Contractor name", "Required for Credit Sale."],
        ["Sale Type", "Optional", "Royalty Sale, Without Royalty", "Distinguishes Royalty vs Without Royalty transaction."],
        ["MaterialName", "Yes", "10MM, 20MM, GSB, M-SAND", "Quarry material delivered."],
        ["CUM", "Optional", "Numeric (e.g. 12.5)", "Cubic meters."],
        ["ETP No", "Optional", "ETP-8921", "Electronic Transit Pass number."],
        ["G.WT", "Optional", "50.00 (in Tons)", "Gross weight in Tons."],
        ["T.WT", "Optional", "15.00 (in Tons)", "Tare weight in Tons."],
        ["Net Wt", "Optional", "Auto: G.WT - T.WT", "Calculated Net Weight in Tons."],
        ["Rate Calculation Unit", "No", "MT, CUM", "If MT: Amount = Net Wt * Rate. If CUM: Amount = CUM * Rate."],
        ["Rate", "Yes", "450", "Rate per Ton (MT) or per CUM."],
        ["Amount", "Optional", "Calculated", "Base material amount (Rate * Net Wt or Rate * CUM)."],
        ["Additional Charge Name", "Optional", "Loading Charge, Weighbridge Charge", "Name of extra/loading charge."],
        ["Additional Charge Amount", "Optional", "Numeric (e.g. 500)", "Extra charge added to taxable base."],
        ["Party State", "No", "Madhya Pradesh, Rajasthan, etc.", "Defaults to Madhya Pradesh (determines CGST+SGST vs IGST)."],
        ["Taxable Base Amount", "Optional", "Calculated", "Amount + Additional Charge Amount."],
        ["GST Rate (%)", "No", "0, 5, 12, 18", "GST percentage applicable."],
        ["CGST Amount", "Optional", "Calculated", "50% of GST Amount for Intra-state (MP)."],
        ["SGST Amount", "Optional", "Calculated", "50% of GST Amount for Intra-state (MP)."],
        ["IGST Amount", "Optional", "Calculated", "100% of GST Amount for Inter-state (outside MP)."],
        ["Total Amount", "Optional", "Calculated", "Taxable Base Amount + GST Amount."]
    ]
    for row in notes:
        ws_notes.append(row)

    for col in range(1, 5):
        cell = ws_notes.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    ws_notes.column_dimensions['A'].width = 24
    ws_notes.column_dimensions['B'].width = 14
    ws_notes.column_dimensions['C'].width = 34
    ws_notes.column_dimensions['D'].width = 54

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def generate_party_wise_sales_excel(
    party_list: List[Dict[str, Any]],
    month_label: str = "All Time",
    totals: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Generate a beautifully styled Excel (.xlsx) report of Party-wise Sales for a given month or all time.
    Includes summary headers, rank, party name, total sales, deliveries, net weight, royalty/non-royalty breakdown, and grand totals.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Party Wise Sales"

    # Styling definitions
    title_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="E2E8F0")

    header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    total_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    total_font = Font(name="Calibri", size=11, bold=True, color="166534")

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    regular_font = Font(name="Calibri", size=10, bold=False, color="0F172A")
    rank_font = Font(name="Calibri", size=10, bold=True, color="1E3A8A")

    thin_border_side = Side(style="thin", color="CBD5E1")
    thin_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    total_top_border = Side(style="thin", color="059669")
    total_bottom_border = Side(style="double", color="059669")
    total_border = Border(left=thin_border_side, right=thin_border_side, top=total_top_border, bottom=total_bottom_border)

    total_amount = totals.get("total_amount", 0.0) if totals else sum(p.get("total", 0.0) for p in party_list)
    total_trips = totals.get("total_trips", 0) if totals else sum(p.get("trips", 0) for p in party_list)

    # 1. Title Banner (Rows 1-2)
    ws.merge_cells("A1:J1")
    ws.row_dimensions[1].height = 28
    title_cell = ws["A1"]
    title_cell.value = f"PARTY-WISE SALES REPORT — {month_label.upper()}"
    title_cell.fill = title_fill
    title_cell.font = title_font
    title_cell.alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:J2")
    ws.row_dimensions[2].height = 20
    sub_cell = ws["A2"]
    now_str = datetime.now().strftime("%d-%b-%Y %I:%M %p")
    sub_cell.value = f"Generated: {now_str}   |   Parties: {len(party_list)}   |   Total Sales: ₹{total_amount:,.2f}   |   Trips: {total_trips}"
    sub_cell.fill = title_fill
    sub_cell.font = subtitle_font
    sub_cell.alignment = Alignment(horizontal="center", vertical="center")

    # Empty spacer row
    ws.row_dimensions[3].height = 10

    # 2. Table Headers (Row 4)
    headers = [
        "Rank",
        "Party Name",
        "Total Sales (₹)",
        "Trips / Deliveries",
        "Net Weight (MT)",
        "Royalty Sale (₹)",
        "Without Royalty (₹)",
        "Cash Sale (₹)",
        "Credit Sale (₹)",
        "% Share of Month"
    ]
    ws.row_dimensions[4].height = 24
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # 3. Party Data Rows
    current_row = 5
    for idx, p in enumerate(party_list, start=1):
        ws.row_dimensions[current_row].height = 20
        p_total = float(p.get("total", 0.0) or 0.0)
        p_trips = int(p.get("trips", 0) or 0)
        p_net_wt = float(p.get("net_wt", 0.0) or 0.0)
        p_royalty = float(p.get("royalty", 0.0) or 0.0)
        p_non_royalty = float(p.get("non_royalty", 0.0) or 0.0)
        p_cash = float(p.get("cash", 0.0) or 0.0)
        p_credit = float(p.get("credit", 0.0) or 0.0)
        share = (p_total / total_amount * 100.0) if total_amount > 0 else 0.0

        row_vals = [
            f"#{idx}",
            p.get("name", "Unspecified"),
            round(p_total, 2),
            p_trips,
            round(p_net_wt, 2),
            round(p_royalty, 2),
            round(p_non_royalty, 2),
            round(p_cash, 2),
            round(p_credit, 2),
            f"{share:.1f}%"
        ]
        ws.append(row_vals)

        is_even = (idx % 2 == 0)
        row_fill = zebra_fill if is_even else None

        for c_idx in range(1, len(row_vals) + 1):
            cell = ws.cell(row=current_row, column=c_idx)
            cell.font = rank_font if c_idx == 1 else regular_font
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border

            # Number formatting and alignments
            if c_idx == 1:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif c_idx == 2:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            elif c_idx in [3, 6, 7, 8, 9]:
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = "#,##0.00"
            elif c_idx == 4:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.number_format = "#,##0"
            elif c_idx == 5:
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = "#,##0.00"
            elif c_idx == 10:
                cell.alignment = Alignment(horizontal="right", vertical="center")

        current_row += 1

    # 4. Grand Total Summary Row
    ws.row_dimensions[current_row].height = 24
    total_net_wt = totals.get("total_net_wt", 0.0) if totals else sum(p.get("net_wt", 0.0) for p in party_list)
    total_royalty = totals.get("total_royalty", 0.0) if totals else sum(p.get("royalty", 0.0) for p in party_list)
    total_non_royalty = totals.get("total_non_royalty", 0.0) if totals else sum(p.get("non_royalty", 0.0) for p in party_list)
    total_cash = totals.get("total_cash", 0.0) if totals else sum(p.get("cash", 0.0) for p in party_list)
    total_credit = totals.get("total_credit", 0.0) if totals else sum(p.get("credit", 0.0) for p in party_list)

    total_vals = [
        "TOTAL",
        f"{len(party_list)} Parties",
        round(total_amount, 2),
        total_trips,
        round(total_net_wt, 2),
        round(total_royalty, 2),
        round(total_non_royalty, 2),
        round(total_cash, 2),
        round(total_credit, 2),
        "100.0%"
    ]
    ws.append(total_vals)
    for c_idx in range(1, len(total_vals) + 1):
        cell = ws.cell(row=current_row, column=c_idx)
        cell.fill = total_fill
        cell.font = total_font
        cell.border = total_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif c_idx == 2:
            cell.alignment = Alignment(horizontal="left", vertical="center")
        elif c_idx in [3, 6, 7, 8, 9]:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "#,##0.00"
        elif c_idx == 4:
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.number_format = "#,##0"
        elif c_idx == 5:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "#,##0.00"
        elif c_idx == 10:
            cell.alignment = Alignment(horizontal="right", vertical="center")

    # 5. Auto column widths
    col_widths = [10, 32, 18, 18, 16, 18, 18, 16, 16, 18]
    for idx, width in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def normalize_date_display(val: Any) -> str:
    """
    Normalizes any date (string or datetime object) into standard DD/MM/YYYY format.
    Handles:
      - 24/10/26 or 24/10/2026 (DD/MM/YY or DD/MM/YYYY)
      - 10/27/2026 (MM/DD/YYYY)
      - 2026-10-27 or 2026/10/27 (YYYY-MM-DD)
      - 27-10-2026 (DD-MM-YYYY)
      - datetime or date objects
    """
    if not val:
        return "-"
    if isinstance(val, (datetime, date)):
        return val.strftime("%d/%m/%Y")

    s = str(val).strip()
    if not s:
        return "-"

    # ISO format YYYY-MM-DD
    iso_match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", s)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        return f"{d:02d}/{m:02d}/{y:04d}"

    # DD/MM/YYYY, MM/DD/YYYY, or DD/MM/YY
    parts_match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})", s)
    if parts_match:
        p1, p2, p3 = int(parts_match.group(1)), int(parts_match.group(2)), int(parts_match.group(3))
        year = p3 if p3 >= 1000 else (2000 + p3 if p3 < 70 else 1900 + p3)

        if p1 > 12 and p2 <= 12:
            day, month = p1, p2
        elif p2 > 12 and p1 <= 12:
            day, month = p2, p1
        else:
            day, month = p1, p2

        return f"{day:02d}/{month:02d}/{year:04d}"

    return s


def generate_all_entries_excel(entries: List[Dict[str, Any]], title_label: str = "All Delivery Entries") -> bytes:
    """
    Generate a beautifully formatted Excel spreadsheet containing all columns and details
    of delivery entries, complete with professional styling, uniform DD/MM/YYYY dates,
    properly aligned headings, and a Grand Total row.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Delivery Entries"
    ws.views.sheetView[0].showGridLines = True

    primary_color = "0284C7"       # Vibrant Ocean Blue header
    header_fill = PatternFill(start_color=primary_color, end_color=primary_color, fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    regular_font = Font(name="Calibri", size=10, color="0F172A")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")

    total_fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid")
    total_font = Font(name="Calibri", size=11, bold=True, color="0369A1")

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0")
    )

    total_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="medium", color="0284C7"),
        bottom=Side(style="double", color="0284C7")
    )

    headers = [
        "S.No.",
        "Date",
        "Challan No.",
        "Vehicle No.",
        "Transport Name",
        "Sales Mode",
        "Payment Mode",
        "Customer / Party Name",
        "Sale Type",
        "Material Name",
        "State",
        "ETP No.",
        "CUM",
        "Gross Wt (MT)",
        "Tare Wt (MT)",
        "Net Wt (MT)",
        "Rate Unit",
        "Rate (₹)",
        "Material Amount (₹)",
        "Addl Charge Name",
        "Addl Charge (₹)",
        "Taxable Amount (₹)",
        "GST Rate (%)",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Total GST (₹)",
        "Round Off (₹)",
        "Total Amount (₹)",
        "Entry Source"
    ]

    num_cols = len(headers)

    # 1. Row 1: Title Banner
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=num_cols)
    title_cell = ws.cell(row=1, column=1)
    title_cell.value = "MaterialMApp • All Delivery Entries Report"
    title_cell.font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    title_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 28

    # 2. Row 2: Subtitle Info
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=num_cols)
    sub_cell = ws.cell(row=2, column=1)
    generated_at = datetime.now().strftime("%d-%b-%Y %I:%M %p")
    sub_cell.value = f"Report: {title_label}  |  Generated on: {generated_at}  |  Total Records: {len(entries)}"
    sub_cell.font = Font(name="Calibri", size=10, italic=True, color="64748B")
    sub_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[2].height = 18

    # 3. Row 3: Blank separator row
    ws.row_dimensions[3].height = 10

    # 4. Row 4: Column Headers (written directly cell-by-cell without ws.append to avoid misalignments)
    header_row = 4
    ws.row_dimensions[header_row].height = 30
    for col_idx, h_text in enumerate(headers, start=1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.value = h_text
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
        cell.border = thin_border

    tot_cum = 0.0
    tot_gwt = 0.0
    tot_twt = 0.0
    tot_netwt = 0.0
    tot_amt = 0.0
    tot_add_charge = 0.0
    tot_taxable = 0.0
    tot_cgst = 0.0
    tot_sgst = 0.0
    tot_igst = 0.0
    tot_gst = 0.0
    tot_round_off = 0.0
    tot_total = 0.0

    current_row = 5
    for idx, e in enumerate(entries, start=1):
        ws.row_dimensions[current_row].height = 22

        cum = float(e.get("cum") or 0.0)
        gwt = float(e.get("g_wt") or 0.0)
        twt = float(e.get("t_wt") or 0.0)
        netwt = float(e.get("net_wt") or (gwt - twt if gwt >= twt else 0.0))
        rate = float(e.get("rate") or 0.0)
        rate_unit = str(e.get("rate_calc_unit") or "MT").strip().upper()
        amt = float(e.get("amount") or 0.0)
        if amt == 0.0 and rate > 0:
            amt = round(cum * rate if rate_unit == "CUM" else netwt * rate, 2)

        add_name = str(e.get("additional_charge_name") or "").strip()
        add_amt = float(e.get("additional_charge_amount") or 0.0)
        taxable = float(e.get("taxable_amount") or (amt + add_amt))
        gst_r = float(e.get("gst_rate") or 0.0)
        cgst = float(e.get("cgst_amount") or 0.0)
        sgst = float(e.get("sgst_amount") or 0.0)
        igst = float(e.get("igst_amount") or 0.0)
        gst_total = float(e.get("gst_amount") or (cgst + sgst + igst))
        round_off = float(e.get("round_off") or 0.0)
        total = float(e.get("total_amount") or (taxable + gst_total + round_off))

        tot_cum += cum
        tot_gwt += gwt
        tot_twt += twt
        tot_netwt += netwt
        tot_amt += amt
        tot_add_charge += add_amt
        tot_taxable += taxable
        tot_cgst += cgst
        tot_sgst += sgst
        tot_igst += igst
        tot_gst += gst_total
        tot_round_off += round_off
        tot_total += total

        type_mode = str(e.get("type_mode") or "").strip()
        cust_name = str(e.get("customer_name") or "").strip()
        pty_name = str(e.get("party_name") or "").strip()
        display_party = cust_name if (type_mode == "Cash Sale" and cust_name) else (pty_name or cust_name or "-")

        payment_mode = str(e.get("payment_mode") or "").strip()
        if not payment_mode and type_mode == "Cash Sale":
            payment_mode = "Cash"
        elif not payment_mode and type_mode == "Credit Sale":
            payment_mode = "Credit"

        # Normalized unified DD/MM/YYYY date
        date_str = normalize_date_display(e.get("date"))

        row_vals = [
            idx,
            date_str,
            str(e.get("challan_no") or ""),
            str(e.get("vehicle_no") or ""),
            str(e.get("transport_type") or e.get("transport_name") or "-"),
            type_mode or "-",
            payment_mode or "-",
            display_party,
            str(e.get("sale_type") or e.get("hr_loading_type") or "-"),
            str(e.get("material_name") or "-"),
            str(e.get("party_state") or "Madhya Pradesh"),
            str(e.get("etp_no") or "-"),
            round(cum, 2),
            round(gwt, 2),
            round(twt, 2),
            round(netwt, 2),
            rate_unit,
            round(rate, 2),
            round(amt, 2),
            add_name or "-",
            round(add_amt, 2),
            round(taxable, 2),
            f"{gst_r:.1f}%" if gst_r > 0 else "0%",
            round(cgst, 2),
            round(sgst, 2),
            round(igst, 2),
            round(gst_total, 2),
            round(round_off, 2),
            round(total, 2),
            "Manual" if str(e.get("entry_source") or "").lower() == "manual" else "Excel"
        ]

        is_even = (idx % 2 == 0)
        row_fill = zebra_fill if is_even else None

        for c_idx, val in enumerate(row_vals, start=1):
            cell = ws.cell(row=current_row, column=c_idx)
            cell.value = val
            cell.font = regular_font
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border

            # S.No., Date, Challan, Vehicle, Unit, GST Rate, Source -> Center
            if c_idx in [1, 2, 3, 4, 12, 17, 23, 30]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            # Text columns -> Left
            elif c_idx in [5, 6, 7, 8, 9, 10, 11, 20]:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            # Numeric columns -> Right formatted
            else:
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = "#,##0.00"

        current_row += 1

    # Grand Total Row
    ws.row_dimensions[current_row].height = 26
    total_row_vals = [
        "TOTAL",
        f"{len(entries)} Entries",
        "", "", "", "", "", "", "", "", "", "",
        round(tot_cum, 2),
        round(tot_gwt, 2),
        round(tot_twt, 2),
        round(tot_netwt, 2),
        "",
        "",
        round(tot_amt, 2),
        "",
        round(tot_add_charge, 2),
        round(tot_taxable, 2),
        "",
        round(tot_cgst, 2),
        round(tot_sgst, 2),
        round(tot_igst, 2),
        round(tot_gst, 2),
        round(tot_round_off, 2),
        round(tot_total, 2),
        ""
    ]

    for c_idx, val in enumerate(total_row_vals, start=1):
        cell = ws.cell(row=current_row, column=c_idx)
        cell.value = val
        cell.fill = total_fill
        cell.font = total_font
        cell.border = total_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal="center", vertical="center")
        elif c_idx in [13, 14, 15, 16, 19, 21, 22, 24, 25, 26, 27, 28, 29]:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "#,##0.00"
        else:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    col_widths = {
        1: 8,   # S.No
        2: 15,  # Date (DD/MM/YYYY)
        3: 14,  # Challan No.
        4: 16,  # Vehicle No.
        5: 20,  # Transport Name
        6: 15,  # Sales Mode
        7: 15,  # Payment Mode
        8: 26,  # Customer / Party Name
        9: 16,  # Sale Type
        10: 18, # Material Name
        11: 18, # State
        12: 14, # ETP No.
        13: 12, # CUM
        14: 16, # Gross Wt (MT)
        15: 16, # Tare Wt (MT)
        16: 16, # Net Wt (MT)
        17: 12, # Rate Unit
        18: 14, # Rate
        19: 18, # Material Amount
        20: 20, # Addl Charge Name
        21: 16, # Addl Charge
        22: 18, # Taxable Amount
        23: 14, # GST Rate
        24: 14, # CGST
        25: 14, # SGST
        26: 14, # IGST
        27: 16, # Total GST
        28: 14, # Round Off
        29: 18, # Total Amount
        30: 14, # Entry Source
    }

    for col_idx, width in col_widths.items():
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()



