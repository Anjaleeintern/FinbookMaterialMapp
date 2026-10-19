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

    # Transport
    "transport_type": "transport_type",
    "transporttype": "transport_type",
    "transport_name": "transport_type",
    "transportname": "transport_type",
    "transport": "transport_type",
    "transporter": "transport_type",

    # Type / Mode
    "type_mode": "type_mode",
    "typemode": "type_mode",
    "type": "type_mode",
    "mode": "type_mode",
    "sale_type": "type_mode",
    "saletype": "type_mode",

    # HR Loading Type
    "hr_loading_type": "hr_loading_type",
    "hrloadingtype": "hr_loading_type",
    "hr_type": "hr_loading_type",
    "hrloading": "hr_loading_type",
    "hr_loading": "hr_loading_type",

    # Material
    "material_name": "material_name",
    "materialname": "material_name",
    "material": "material_name",
    "item": "material_name",
    "item_name": "material_name",

    # Party
    "party_name": "party_name",
    "partyname": "party_name",
    "party_ame": "party_name",
    "party": "party_name",
    "customer": "party_name",
    "customer_name": "party_name",

    # Transport
    "transport_own_vehicle": "transport_type",
    "transport_ownvehicle": "transport_type",

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

    # Rate
    "rate": "rate",
    "rate_without_gst": "rate",
    "rate_with_gst": "rate",
    "bhav": "rate",
    "price": "rate",

    # Payment Mode
    "payment_mode": "payment_mode",
    "paymentmode": "payment_mode",
    "payment": "payment_mode",

    # GST Rate
    "gst_rate": "gst_rate",
    "gstrate": "gst_rate",
    "gst": "gst_rate",
    "gst_percent": "gst_rate",
    "gst_%": "gst_rate",
    "gst_5": "gst_rate",
    "gst_18": "gst_rate",
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
    Intelligently detect (type_mode, hr_loading_type) from sheet title and optional header banner.
    Accurately distinguishes HR Loading (which has its own Royalty Sale / Without Royalty sub-types)
    from main Royalty Sale and main Without Royalty.
    """
    s = str(sheet_title or "").strip().lower().replace("_", " ").replace("-", " ")
    b = str(banner_text or "").strip().lower().replace("_", " ").replace("-", " ")

    # 1. HR Loading check FIRST: HR Loading is a distinct mode!
    if "hr" in s or "loading" in s or "hr" in b or "loading" in b:
        # Check sub-type for HR Loading
        sub_type = "Without Royalty"
        if "royalty" in b or "royalty" in s:
            if "without" not in b and "with out" not in b and "without" not in s and "with out" not in s:
                sub_type = "Royalty Sale"
        return "HR Loading", sub_type

    # 2. Main Without Royalty (handles 'with out', 'without', 'non royalty', 'w/o')
    if "without" in s or "with out" in s or "non royalty" in s or "w/o" in s:
        return "Without Royalty", None

    # 3. Main Royalty Sale
    if "royalty" in s:
        return "Royalty Sale", None

    # 4. Credit Sale
    if "credit" in s or "udhar" in s:
        return "Credit Sale", None

    # 5. Cash Sale
    if "cash" in s or "case" in s or "nagad" in s:
        return "Cash Sale", None

    # 6. QR / UPI Sale (handles 'qr', 'qe', 'upi', 'online')
    if "qr" in s or "qe" in s or "upi" in s or "online" in s:
        return "QR Sale", None

    # 7. Default for party ledgers or general sheets
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
    - Automatically detects Type/Mode from sheet tab title (e.g. 'Royalty Sale', 'Cash Sale').
    - Distinguishes HR Loading Royalty/Without Royalty from main Royalty/Without Royalty.
    - Filters empty / template placeholder rows.
    Returns (rows, available_sheets).
    """
    rows: List[Dict[str, Any]] = []
    available_sheets: List[Dict[str, Any]] = []
    fname = filename.lower()

    if fname.endswith(".csv"):
        # Auto-detect mode from CSV filename or default
        csv_mode, csv_sub = detect_mode_and_sub(filename)
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

                if not row_dict.get("type_mode"):
                    row_dict["type_mode"] = csv_mode
                if csv_mode == "HR Loading":
                    row_dict["hr_loading_type"] = csv_sub or "Without Royalty"
                row_dict["_sheet_name"] = filename
                rows.append(row_dict)
                valid_count += 1

        available_sheets.append({
            "name": filename,
            "mode": csv_mode,
            "hr_loading_type": csv_sub,
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

            # Detect sheet mode and HR sub-type
            sheet_mode, sheet_sub = detect_mode_and_sub(sheet.title, banner_text)
            if default_type_mode and not default_type_mode.lower().startswith("auto"):
                sheet_mode = default_type_mode

            key_cols = {"date", "vehicle_no", "party_name", "material_name", "rate", "g_wt", "t_wt", "cum", "type_mode", "challan_no"}

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

            is_core_sheet = sheet_mode in ["Royalty Sale", "Without Royalty", "HR Loading", "Credit Sale", "Cash Sale", "QR Sale"] and not any(party in title_lower for party in ["sageer", "altamash", "nawaz"])

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
                if not p_name:
                    row_dict["party_name"] = sheet.title.strip()

                # Set Mode and HR Loading Type
                if sheet_mode == "HR Loading":
                    row_dict["type_mode"] = "HR Loading"
                    # Preserve explicit row hr_loading_type if present, else use sheet's detected sub
                    if not row_dict.get("hr_loading_type"):
                        row_dict["hr_loading_type"] = sheet_sub or "Royalty Sale"
                else:
                    if not row_dict.get("type_mode"):
                        row_dict["type_mode"] = sheet_mode
                    row_dict["hr_loading_type"] = None

                row_dict["_sheet_name"] = sheet.title.strip()
                row_dict["_sheet_mode"] = sheet_mode
                rows.append(row_dict)

            available_sheets.append({
                "name": sheet.title.strip(),
                "mode": sheet_mode,
                "hr_loading_type": sheet_sub,
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
            transport_type = str(r.get("transport_type") or "").strip()

            # Resolve Type/Mode: column value > sheet title detection > default_type_mode
            type_mode = str(r.get("type_mode") or "").strip()
            if not type_mode:
                sheet_title = r.get("_sheet_name")
                type_mode = detect_mode_from_text(sheet_title) or (default_type_mode or "").strip()

            material_name = str(r.get("material_name") or "").strip()
            party_name = str(r.get("party_name") or "").strip()

            # Validation: essential fields
            missing = []
            if not vehicle_no: missing.append("Vehicle No")
            if not type_mode: missing.append("Type/Mode")
            if not material_name: missing.append("Material Name")
            if not party_name: missing.append("Party Name")

            if missing:
                errors.append({
                    "row": index,
                    "reason": f"Missing required field(s): {', '.join(missing)}",
                    "data": r
                })
                continue

            # Standardize default transport if omitted
            if not transport_type:
                transport_type = "Own / Default"

            # 3. Numeric fields
            cum = parse_float_val(r.get("cum"), 0.0)
            etp_no = str(r.get("etp_no") or "").strip()
            g_wt = parse_float_val(r.get("g_wt"), 0.0)
            t_wt = parse_float_val(r.get("t_wt"), 0.0)
            rate = parse_float_val(r.get("rate"), 0.0)
            gst_rate = parse_float_val(r.get("gst_rate"), 0.0)

            # HR Loading Type
            hr_loading_type = r.get("hr_loading_type")
            if hr_loading_type:
                hr_loading_type = str(hr_loading_type).strip()

            # Payment mode
            payment_mode = r.get("payment_mode")
            if payment_mode:
                payment_mode = str(payment_mode).strip()

            # Always neglect any challan number from Excel to ensure continuous un-interrupted system series
            challan_no = None

            # Create Pydantic model for calculation validation
            entry_create = EntryCreate(
                date=date_str,
                challan_no=None,
                vehicle_no=vehicle_no,
                transport_type=transport_type,
                type_mode=type_mode,
                hr_loading_type=hr_loading_type if type_mode == "HR Loading" else None,
                material_name=material_name,
                party_name=party_name,
                cum=cum,
                etp_no=etp_no,
                g_wt=g_wt,
                t_wt=t_wt,
                rate=rate,
                payment_mode=payment_mode,
                gst_rate=gst_rate,
            )

            # Process full formula calculations
            calc_data = process_entry_calculations(entry_create)
            target_collection = get_collection_name(type_mode)
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

async def execute_bulk_import_to_mongodb(valid_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Saves entries one by one into MongoDB directly into their respective destination collections
    with unique auto-incrementing challan sequences.
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
        # Always generate atomic, unique, continuous challan sequence (001, 002, 003...) from MongoDB counters.
        entry["challan_no"] = await get_next_challan_no()

        entry["created_at"] = datetime.utcnow()
        entry["saved_in"] = target_collection
        entry["entry_source"] = "excel"

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
    """Generate a clean, styled Excel template with instructions and sample rows."""
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
        "TransportType",
        "Type/Mode",
        "HR Loading Type",
        "MaterialName",
        "PartyName",
        "CUM",
        "ETP No",
        "G.WT",
        "T.WT",
        "Rate",
        "Payment Mode",
        "GST Rate"
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
        ["10/14/2026", "CH-0001", "MP09GG1230", "MSK", "Royalty Sale", "", "10MM", "NAWAZ KHAN", 0, "ETP-8921", 60790, 15000, 450, "", 5],
        ["10/14/2026", "CH-0002", "MP09BS6668", "VMPL", "Cash Sale", "", "20MM", "SAGEER PATEL", 0, "", 45000, 12000, 480, "Cash", 0],
        ["10/15/2026", "CH-0003", "MP09GG7934", "MSK", "HR Loading", "With Royalty", "GSB", "PUSHPENDRA", 0, "ETP-9932", 52000, 14000, 390, "", 18],
        ["10/15/2026", "CH-0004", "RJ09GE1458", "VMPL", "Without Royalty", "", "M-SAND", "ALTAMASH KHAN", 12.5, "", 0, 0, 850, "", 0],
        ["10/16/2026", "CH-0005", "MP09GG1150", "MSK", "QR Sale", "", "10MM", "ANIL AARIYA", 0, "", 38000, 11000, 460, "QR", 0]
    ]

    for r_idx, row_data in enumerate(sample_rows, start=2):
        ws.append(row_data)
        for c_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = regular_font
            cell.border = thin_border
            cell.fill = sample_fill
            if c_idx in [1, 2, 3, 4, 5, 6, 14]:
                cell.alignment = Alignment(horizontal="center")
            elif c_idx in [9, 11, 12, 13, 15]:
                cell.alignment = Alignment(horizontal="right")

    # Column widths
    column_widths = {
        'A': 14, 'B': 14, 'C': 16, 'D': 16, 'E': 18, 
        'F': 18, 'G': 16, 'H': 20, 'I': 10, 'J': 14, 
        'K': 12, 'L': 12, 'M': 10, 'N': 16, 'O': 12
    }
    for col_letter, width in column_widths.items():
        ws.column_dimensions[col_letter].width = width

    ws_notes = wb.create_sheet(title="Instructions & Rules")
    notes = [
        ["Column Name", "Required?", "Allowed Values / Examples", "Description"],
        ["Date", "Yes", "MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD", "Delivery transaction date."],
        ["ChallanNo", "Optional", "Leave blank or auto", "Auto-generated sequentially by system (001, 002...) to maintain continuous series across manual and excel entries."],
        ["VehicleNo", "Yes", "MP09GG1230, etc.", "Vehicle registration number."],
        ["TransportType", "No", "MSK, VMPL, etc.", "Transporter name (defaults to 'Own / Default' if blank)."],
        ["Type/Mode", "Yes", "Royalty Sale, Without Royalty, Credit Sale, Cash Sale, QR Sale, HR Loading", "Routes directly to MongoDB collection."],
        ["HR Loading Type", "Conditional", "With Royalty, Without Royalty", "Required only when Type/Mode is 'HR Loading'."],
        ["MaterialName", "Yes", "10MM, 20MM, GSB, M-SAND", "Quarry material delivered."],
        ["PartyName", "Yes", "Customer or Contractor name", "Client party."],
        ["CUM", "Optional", "Numeric (e.g. 10.5)", "Cubic meters."],
        ["ETP No", "Optional", "ETP-8921", "Electronic Transit Pass number."],
        ["G.WT", "Optional", "60790", "Gross weight in kg."],
        ["T.WT", "Optional", "15000", "Tare weight in kg. Net weight = G.WT - T.WT."],
        ["Rate", "Yes", "450", "Rate per Ton or per CUM. Amount = Net Wt * Rate (or CUM * Rate)."],
        ["Payment Mode", "Conditional", "Cash or QR", "Auto-defaults to Cash for Cash Sale, QR for QR Sale."],
        ["GST Rate", "Conditional", "5, 18, or 0", "Auto-calculates GST Amount and Total Amount for Royalty Sale or HR Loading With Royalty."]
    ]
    for row in notes:
        ws_notes.append(row)

    for col in range(1, 5):
        cell = ws_notes.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    ws_notes.column_dimensions['A'].width = 18
    ws_notes.column_dimensions['B'].width = 14
    ws_notes.column_dimensions['C'].width = 30
    ws_notes.column_dimensions['D'].width = 50

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
