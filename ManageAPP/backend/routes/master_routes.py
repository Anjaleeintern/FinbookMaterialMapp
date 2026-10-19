import io
import csv
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import Response
from bson import ObjectId
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from models.master_models import (
    MasterItemCreate,
    MasterItemUpdate,
    MasterItemOut,
    MasterItemDetail,
    BulkMasterCreate,
    BulkDeleteRequest,
    MasterListResponse,
    PasteMasterImportRequest,
)
from database import get_database

router = APIRouter(prefix="/api/masters", tags=["Masters"])

STANDARD_TYPE_MODES = [
    "Royalty Sale",
    "Without Royalty",
    "Credit Sale",
    "Cash Sale",
    "QR Sale",
    "HR Loading"
]

STATIC_TYPE_MODES = {
    "Royalty Sale",
    "Without Royalty",
    "With Royalty",
    "Credit Sale",
    "Cash Sale",
    "Case Sale",
    "QR Sale",
    "HR Loading"
}

HR_LOADING_SUB_TYPES = [
    "Royalty Sale",
    "Without Royalty"
]

def format_iso_now():
    return datetime.now(timezone.utc).isoformat()

@router.get("", response_model=MasterListResponse)
async def get_all_masters():
    """
    Returns string arrays per category for form dropdowns.
    Only returns Active items (or items where status is not 'Inactive').
    """
    db = get_database()
    cursor = db.masters.find({"status": {"$ne": "Inactive"}}, {"_id": 0, "category": 1, "value": 1})
    items = await cursor.to_list(length=3000)

    result = {
        "VehicleNo": [],
        "TransportName": [],
        "MaterialName": [],
        "PartyName": [],
        "TypeMode": []
    }

    for item in items:
        cat = item.get("category")
        val = item.get("value")
        if not val:
            continue
        if cat == "Type/Mode":
            if val not in result["TypeMode"]:
                result["TypeMode"].append(val)
        elif cat in result and val not in result[cat]:
            result[cat].append(val)

    # Ensure standard Type/Mode options exist
    for std in STANDARD_TYPE_MODES:
        if std not in result["TypeMode"]:
            result["TypeMode"].append(std)

    # Sort all master values alphabetically
    for cat in ["VehicleNo", "TransportName", "MaterialName", "PartyName", "TypeMode"]:
        result[cat].sort()

    return result

@router.get("/all", response_model=List[MasterItemDetail])
async def get_masters_details(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by value"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by Active/Inactive"),
):
    """
    Full detail master list for the Enterprise Masters Management Table.
    Includes ID, Category, Value, Status, CreatedAt, UpdatedAt.
    """
    db = get_database()
    query = {}
    if category and category != "All":
        query["category"] = category
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    if search and search.strip():
        query["value"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    cursor = db.masters.find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=3000)

    results: List[MasterItemDetail] = []
    seen_ids = set()

    for doc in docs:
        doc_id = str(doc.get("_id"))
        if doc_id in seen_ids:
            continue
        seen_ids.add(doc_id)

        created_at = doc.get("created_at") or doc.get("updated_at") or format_iso_now()
        updated_at = doc.get("updated_at") or created_at
        status_val = doc.get("status") or "Active"
        cat = doc.get("category", "")
        val = doc.get("value", "")
        is_static = cat in ["Type/Mode", "TypeMode"] and val in STATIC_TYPE_MODES
        sub_types = HR_LOADING_SUB_TYPES if (cat in ["Type/Mode", "TypeMode"] and val == "HR Loading") else None

        results.append(
            MasterItemDetail(
                id=doc_id,
                category=cat,
                value=val,
                status=status_val,
                is_static=is_static,
                sub_types=sub_types,
                created_at=created_at,
                updated_at=updated_at,
            )
        )

    # If category is Type/Mode or empty, ensure standard modes are seeded/visible in table
    if not category or category == "Type/Mode" or category == "All":
        existing_type_modes = {
            r.value.strip().lower() for r in results if r.category == "Type/Mode"
        }
        for std in STANDARD_TYPE_MODES:
            if std.lower() not in existing_type_modes:
                # Upsert standard mode into DB so it has persistent ID and timestamps
                std_doc = {
                    "category": "Type/Mode",
                    "value": std,
                    "status": "Active",
                    "is_static": True,
                    "created_at": format_iso_now(),
                    "updated_at": format_iso_now(),
                }
                ins = await db.masters.insert_one(std_doc)
                results.append(
                    MasterItemDetail(
                        id=str(ins.inserted_id),
                        category="Type/Mode",
                        value=std,
                        status="Active",
                        is_static=True,
                        sub_types=HR_LOADING_SUB_TYPES if std == "HR Loading" else None,
                        created_at=std_doc["created_at"],
                        updated_at=std_doc["updated_at"],
                    )
                )

    return results

@router.post("", response_model=MasterItemOut)
async def add_master_item(item: MasterItemCreate):
    db = get_database()
    category = item.category.strip()
    value = item.value.strip()
    status_val = (item.status or "Active").strip()

    # Case-insensitive duplicate check within this category
    regex_pattern = f"^{re.escape(value)}$"
    existing = await db.masters.find_one({
        "category": category,
        "value": {"$regex": regex_pattern, "$options": "i"}
    })

    now_iso = format_iso_now()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item '{value}' already exists in {category} (must be unique)."
        )

    doc = {
        "category": category,
        "value": value,
        "status": status_val,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    insert_res = await db.masters.insert_one(doc)

    return {
        "id": str(insert_res.inserted_id),
        "category": category,
        "value": value,
        "status": status_val,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

@router.put("/{item_id}", response_model=MasterItemDetail)
async def update_master_item(item_id: str, payload: MasterItemUpdate):
    db = get_database()
    try:
        obj_id = ObjectId(item_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid master ID format")

    doc = await db.masters.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Master item not found")

    update_fields = {"updated_at": format_iso_now()}

    if payload.value is not None:
        trimmed_val = payload.value.strip()
        if not trimmed_val:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Value cannot be empty")
        
        # Check uniqueness if value changed
        if trimmed_val.lower() != doc.get("value", "").lower():
            regex_pattern = f"^{re.escape(trimmed_val)}$"
            existing = await db.masters.find_one({
                "category": doc.get("category"),
                "value": {"$regex": regex_pattern, "$options": "i"},
                "_id": {"$ne": obj_id}
            })
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Item '{trimmed_val}' already exists in {doc.get('category')}."
                )
        update_fields["value"] = trimmed_val

    if payload.status is not None:
        st = payload.status.strip()
        if st not in ["Active", "Inactive"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'Active' or 'Inactive'")
        update_fields["status"] = st

    await db.masters.update_one({"_id": obj_id}, {"$set": update_fields})
    updated_doc = await db.masters.find_one({"_id": obj_id})

    return MasterItemDetail(
        id=str(updated_doc["_id"]),
        category=updated_doc.get("category", ""),
        value=updated_doc.get("value", ""),
        status=updated_doc.get("status", "Active"),
        created_at=updated_doc.get("created_at") or format_iso_now(),
        updated_at=updated_doc.get("updated_at") or format_iso_now(),
    )

@router.post("/bulk")
async def bulk_add_masters(payload: BulkMasterCreate):
    db = get_database()
    category = payload.category.strip()
    status_val = payload.status or "Active"
    now_iso = format_iso_now()

    added = []
    skipped = []

    for raw in payload.items:
        val = raw.strip()
        if not val:
            continue
        regex_pattern = f"^{re.escape(val)}$"
        existing = await db.masters.find_one({
            "category": category,
            "value": {"$regex": regex_pattern, "$options": "i"}
        })
        if existing:
            skipped.append(val)
        else:
            doc = {
                "category": category,
                "value": val,
                "status": status_val,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            res = await db.masters.insert_one(doc)
            added.append({"id": str(res.inserted_id), "value": val})

    return {
        "success": True,
        "category": category,
        "added_count": len(added),
        "skipped_count": len(skipped),
        "added": added,
        "skipped": skipped,
    }

@router.post("/bulk-delete")
async def bulk_delete_masters(payload: BulkDeleteRequest):
    db = get_database()
    deleted_count = 0

    if payload.ids:
        valid_ids = []
        for id_str in payload.ids:
            try:
                valid_ids.append(ObjectId(id_str))
            except Exception:
                pass
        if valid_ids:
            # Protect static Type/Mode items from being deleted by ID
            protected_docs = await db.masters.find({
                "_id": {"$in": valid_ids},
                "category": {"$in": ["Type/Mode", "TypeMode"]},
                "value": {"$in": list(STATIC_TYPE_MODES)}
            }, {"_id": 1}).to_list(length=100)
            protected_id_set = {d["_id"] for d in protected_docs}
            deletable_ids = [i for i in valid_ids if i not in protected_id_set]

            if deletable_ids:
                res = await db.masters.delete_many({"_id": {"$in": deletable_ids}})
                deleted_count += res.deleted_count

    if payload.category and payload.values:
        cat = payload.category.strip()
        deletable_values = payload.values
        if cat in ["Type/Mode", "TypeMode"]:
            deletable_values = [v for v in payload.values if v.strip() not in STATIC_TYPE_MODES]
        if deletable_values:
            res = await db.masters.delete_many({
                "category": cat,
                "value": {"$in": deletable_values}
            })
            deleted_count += res.deleted_count

    return {"success": True, "deleted_count": deleted_count}

async def remove_master_logic(category: str, value: str):
    db = get_database()
    category = category.strip()
    value = value.strip()

    # Block deletion of protected static Type/Mode
    if category in ["Type/Mode", "TypeMode"] and value in STATIC_TYPE_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete static system Type/Mode '{value}'. This is a permanent master data."
        )

    regex_pattern = f"^{re.escape(value)}$"
    result = await db.masters.delete_one({
        "category": category,
        "value": {"$regex": regex_pattern, "$options": "i"}
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item '{value}' in category '{category}' not found."
        )

    return {"message": f"Successfully deleted '{value}' from '{category}'"}

@router.delete("")
async def delete_master_query(category: str = Query(...), value: str = Query(...)):
    return await remove_master_logic(category, value)

@router.delete("/{category:path}/{value}")
async def delete_master_path(category: str, value: str):
    return await remove_master_logic(category, value)

# =============================================================================
# MULTI-COLUMN EXCEL / CSV MASTER DATA IMPORT ENGINE
# =============================================================================

MASTER_CATEGORY_MAP = {
    # VehicleNo
    "vehicle_no": "VehicleNo",
    "vehicleno": "VehicleNo",
    "vehicle": "VehicleNo",
    "vehicles": "VehicleNo",
    "vehicle_number": "VehicleNo",
    "vehiclenumber": "VehicleNo",
    "veh_no": "VehicleNo",
    "gadi_no": "VehicleNo",
    "gadi": "VehicleNo",
    "truck_no": "VehicleNo",
    "truck": "VehicleNo",
    "truckno": "VehicleNo",
    "car_no": "VehicleNo",
    "lorry_no": "VehicleNo",

    # TransportName
    "transport_name": "TransportName",
    "transportname": "TransportName",
    "transport_type": "TransportName",
    "transporttype": "TransportName",
    "transport": "TransportName",
    "transporter": "TransportName",
    "transporter_name": "TransportName",
    "transportername": "TransportName",
    "transports": "TransportName",
    "msk_or_other": "TransportName",
    "msk_other": "TransportName",
    "msk": "TransportName",

    # MaterialName
    "material_name": "MaterialName",
    "materialname": "MaterialName",
    "material": "MaterialName",
    "materials": "MaterialName",
    "item_name": "MaterialName",
    "itemname": "MaterialName",
    "item": "MaterialName",
    "items": "MaterialName",
    "product": "MaterialName",
    "product_name": "MaterialName",
    "goods": "MaterialName",

    # PartyName
    "party_name": "PartyName",
    "partyname": "PartyName",
    "party": "PartyName",
    "parties": "PartyName",
    "customer": "PartyName",
    "customer_name": "PartyName",
    "buyer": "PartyName",
    "buyer_name": "PartyName",
    "client": "PartyName",
    "client_name": "PartyName",
    "party_buyer": "PartyName",

    # Type/Mode
    "type_mode": "Type/Mode",
    "typemode": "Type/Mode",
    "type_mode_name": "Type/Mode",
    "type": "Type/Mode",
    "mode": "Type/Mode",
    "payment_mode": "Type/Mode",
    "sale_type": "Type/Mode",
    "saletype": "Type/Mode",
    "transaction_type": "Type/Mode",
    "loading_type": "Type/Mode",
}

IGNORE_HEADERS = {
    "id", "s_no", "sr_no", "sno", "srno", "no", "date", "entry_date", 
    "challan_no", "challan", "gross_wt", "tare_wt", "net_wt", "rate", 
    "amount", "gst_rate", "gst_amount", "total_amount", "cum", "etp_no"
}

INVALID_MASTER_VALUES = {
    "0", "0.0", "00", "-", "--", "---", "none", "null", "nan", "nil", "n/a", "na", "", "undefined", "false", "true"
}

def match_header_to_category(header: Any) -> Optional[str]:
    if header is None:
        return None
    raw = str(header).strip().lower()
    cleaned = re.sub(r'[\s\.\-\/\(\)\%\_]+', '_', raw).strip('_')
    if cleaned in IGNORE_HEADERS:
        return None
    if cleaned in MASTER_CATEGORY_MAP:
        return MASTER_CATEGORY_MAP[cleaned]
    if any(k in cleaned for k in ["veh", "gadi", "truck"]):
        return "VehicleNo"
    if any(k in cleaned for k in ["transp", "msk"]):
        return "TransportName"
    if any(k in cleaned for k in ["mater", "item", "prod", "goods"]):
        return "MaterialName"
    if any(k in cleaned for k in ["party", "cust", "buyer", "client"]):
        return "PartyName"
    if any(k in cleaned for k in ["type", "mode"]):
        return "Type/Mode"
    return None

def extract_masters_from_excel_bytes(file_bytes: bytes, default_category: str = "VehicleNo") -> Dict[str, List[str]]:
    """
    Extracts masters from an Excel file (.xlsx, .xls).
    Critically processes EACH sheet independently so multi-sheet workbooks
    (e.g. Sheet 1: Vehicle Master, Sheet 2: Party Master, Sheet 3: Material Master)
    never mix up columns across different sheets.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    extracted: Dict[str, Set[str]] = {
        "VehicleNo": set(),
        "TransportName": set(),
        "MaterialName": set(),
        "PartyName": set(),
        "Type/Mode": set()
    }
    seen_lower: Dict[str, Set[str]] = {k: set() for k in extracted}

    for sheet in wb.worksheets:
        title_lower = sheet.title.lower().strip()
        if any(skip in title_lower for skip in ["readme", "instruction", "help", "notes"]):
            continue

        sheet_rows = [list(r) for r in sheet.iter_rows(values_only=True) if any(c is not None and str(c).strip() != "" for c in r)]
        if not sheet_rows:
            continue

        col_map: Dict[int, str] = {}
        start_row = 0

        # 1. First search first 5 rows for column headers matching master categories
        for idx, r in enumerate(sheet_rows[:5]):
            m = {}
            for c_idx, cell in enumerate(r):
                cat = match_header_to_category(cell)
                if cat:
                    m[c_idx] = cat
            if len(m) > 0:
                col_map = m
                start_row = idx + 1
                break
        else:
            # 2. If no column headers matched, check if sheet title itself indicates master category
            sheet_cat = match_header_to_category(sheet.title)
            if sheet_cat:
                col_map = {0: sheet_cat}
                start_row = 0
            elif len(wb.worksheets) == 1:
                valid_default = default_category if default_category in extracted else "VehicleNo"
                col_map = {0: valid_default}
                start_row = 0

        # Extract values for this sheet's mapped columns
        for r in sheet_rows[start_row:]:
            for c_idx, cat in col_map.items():
                if c_idx < len(r) and r[c_idx] is not None:
                    cell_val = r[c_idx]
                    if isinstance(cell_val, float) and cell_val.is_integer():
                        val = str(int(cell_val)).strip()
                    else:
                        val = str(cell_val).strip()

                    val = re.sub(r'^["\']|["\']$', '', val).strip()
                    val_lower = val.lower()
                    if not val or val_lower in INVALID_MASTER_VALUES:
                        continue

                    val_norm = re.sub(r'[\s\.\-\/\(\)\%\_]+', '_', val_lower).strip('_')
                    if val_norm in {
                        "vehicle_no", "vehicleno", "transport_name", "transportname",
                        "material_name", "materialname", "party_name", "partyname",
                        "type_mode", "typemode", "vehicle_number", "customer_name"
                    }:
                        continue

                    if val_lower not in seen_lower[cat]:
                        seen_lower[cat].add(val_lower)
                        extracted[cat].add(val)

    return {k: sorted(list(v)) for k, v in extracted.items() if len(v) > 0}

def extract_masters_from_rows(rows: List[List[Any]], default_category: str = "VehicleNo") -> Dict[str, List[str]]:
    """
    Extracts masters from a 2D table of rows (used for CSV and pasted text).
    """
    if not rows:
        return {}

    header_row_idx = -1
    col_to_category: Dict[int, str] = {}

    for idx, r in enumerate(rows[:5]):
        matched = {}
        for c_idx, cell in enumerate(r):
            cat = match_header_to_category(cell)
            if cat:
                matched[c_idx] = cat
        if len(matched) > 0:
            header_row_idx = idx
            col_to_category = matched
            break

    if not col_to_category:
        non_empty_cols = set()
        for r in rows:
            for c_idx, cell in enumerate(r):
                if cell is not None and str(cell).strip():
                    non_empty_cols.add(c_idx)

        valid_default = default_category if default_category in ["VehicleNo", "TransportName", "MaterialName", "PartyName", "Type/Mode"] else "VehicleNo"

        if len(non_empty_cols) == 1:
            col_to_category[list(non_empty_cols)[0]] = valid_default
            first_val = str(rows[0][list(non_empty_cols)[0]]).strip().lower()
            if any(k in first_val for k in ["vehicle", "transport", "material", "party", "type", "mode", "header", "name", "val"]):
                header_row_idx = 0
            else:
                header_row_idx = -1
        else:
            header_row_idx = -1
            if non_empty_cols:
                col_to_category[min(non_empty_cols)] = valid_default

    extracted: Dict[str, Set[str]] = {
        "VehicleNo": set(),
        "TransportName": set(),
        "MaterialName": set(),
        "PartyName": set(),
        "Type/Mode": set()
    }
    seen_lower: Dict[str, Set[str]] = {k: set() for k in extracted}

    start_row = header_row_idx + 1 if header_row_idx >= 0 else 0

    for r in rows[start_row:]:
        for c_idx, cat in col_to_category.items():
            if c_idx < len(r):
                cell_val = r[c_idx]
                if cell_val is None:
                    continue
                if isinstance(cell_val, float) and cell_val.is_integer():
                    val = str(int(cell_val)).strip()
                else:
                    val = str(cell_val).strip()

                val = re.sub(r'^["\']|["\']$', '', val).strip()
                val_lower = val.lower()
                if not val or val_lower in INVALID_MASTER_VALUES:
                    continue

                val_norm = re.sub(r'[\s\.\-\/\(\)\%\_]+', '_', val_lower).strip('_')
                if val_norm in {
                    "vehicle_no", "vehicleno", "transport_name", "transportname",
                    "material_name", "materialname", "party_name", "partyname",
                    "type_mode", "typemode", "vehicle_number", "customer_name"
                }:
                    continue

                if val_lower not in seen_lower[cat]:
                    seen_lower[cat].add(val_lower)
                    extracted[cat].add(val)

    return {k: sorted(list(v)) for k, v in extracted.items() if len(v) > 0}

def parse_csv_bytes_to_rows(file_bytes: bytes) -> List[List[Any]]:
    text = ""
    for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = file_bytes.decode(enc)
            break
        except Exception:
            pass
    if not text:
        text = file_bytes.decode("utf-8", errors="ignore")

    sample = text[:2048]
    delimiter = ","
    if "\t" in sample and sample.count("\t") > sample.count(","):
        delimiter = "\t"
    elif ";" in sample and sample.count(";") > sample.count(","):
        delimiter = ";"

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = []
    for r in reader:
        if any(cell is not None and str(cell).strip() != "" for cell in r):
            rows.append(r)
    return rows

def parse_pasted_text_to_rows(raw_text: str) -> List[List[Any]]:
    lines = raw_text.splitlines()
    rows = []
    delimiter = "\t" if any("\t" in l for l in lines) else ("," if any("," in l for l in lines) else None)
    for l in lines:
        if not l.strip():
            continue
        if delimiter:
            parts = [p.strip() for p in l.split(delimiter)]
        else:
            parts = [l.strip()]
        rows.append(parts)
    return rows

async def process_master_extracted(extracted: Dict[str, List[str]], preview_only: bool, filename: str):
    db = get_database()
    now_iso = format_iso_now()

    LABELS = {
        "VehicleNo": "Vehicle No",
        "TransportName": "Transport",
        "MaterialName": "Material",
        "PartyName": "Party Name",
        "Type/Mode": "Type / Mode"
    }

    result_categories = {}
    to_insert_by_cat = {}
    total_new = 0
    total_duplicates = 0

    for cat in ["VehicleNo", "TransportName", "MaterialName", "PartyName", "Type/Mode"]:
        items = extracted.get(cat, [])
        if not items:
            continue

        cursor = db.masters.find({"category": cat}, {"value": 1})
        existing_docs = await cursor.to_list(length=10000)
        existing_set = {d.get("value", "").strip().lower() for d in existing_docs}

        new_items = []
        dups = []
        for val in items:
            if val.strip().lower() in existing_set:
                dups.append(val)
            else:
                new_items.append(val)

        total_new += len(new_items)
        total_duplicates += len(dups)
        to_insert_by_cat[cat] = new_items

        result_categories[cat] = {
            "category": cat,
            "label": LABELS.get(cat, cat),
            "total_found": len(items),
            "new_count": len(new_items),
            "duplicate_count": len(dups),
            "sample_new": new_items[:12],
            "sample_duplicates": dups[:5],
            "all_new": new_items,
        }

    if not preview_only and total_new > 0:
        docs_to_insert = []
        for cat, items_list in to_insert_by_cat.items():
            for val in items_list:
                docs_to_insert.append({
                    "category": cat,
                    "value": val,
                    "status": "Active",
                    "created_at": now_iso,
                    "updated_at": now_iso,
                })
        if docs_to_insert:
            await db.masters.insert_many(docs_to_insert)

    return {
        "success": True,
        "filename": filename,
        "preview": preview_only,
        "categories": result_categories,
        "total_new": total_new,
        "total_duplicates": total_duplicates,
        "message": f"{'Preview: Found' if preview_only else 'Successfully imported'} {total_new} new items across {len(result_categories)} categories ({total_duplicates} duplicates skipped)."
    }

@router.get("/template")
async def download_master_template(format: str = Query("xlsx", description="xlsx or csv")):
    headers = ["Vehicle No", "Transport Name", "Material Name", "Party Name", "Type / Mode"]
    sample_rows = [
        ["MP09DD5763", "VMPL", "10MM", "NAWAZ KHAN", "Royalty Sale"],
        ["MP09HH9584", "MSK", "20MM", "ALTAMASH KHAN", "Without Royalty"],
        ["MH12AB1234", "BALAJI LOGISTICS", "GSB", "SAGEER PATEL", "Credit Sale"],
        ["RJ14CD5678", "SPEED FREIGHT", "M-SAND", "PUSHPENDRA", "Cash Sale"],
        ["GJ01XY7890", "", "WMM", "ANIL AARIYA", "QR Sale"],
        ["", "", "", "", "HR Loading"],
    ]

    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for r in sample_rows:
            writer.writerow(r)
        csv_data = output.getvalue().encode("utf-8")
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="Finbook_Masters_Template.csv"'}
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Masters"

    header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    border_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
    center_align = Alignment(horizontal="center", vertical="center")

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = cell_border

    for r in sample_rows:
        ws.append(r)

    for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.font = data_font
            cell.border = cell_border

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 4, 18)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    xlsx_data = output.getvalue()

    return Response(
        content=xlsx_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Finbook_Masters_Template.xlsx"'}
    )

@router.post("/import-file")
async def import_masters_from_file(
    file: UploadFile = File(...),
    preview: Optional[bool] = Form(None),
    preview_only: Optional[bool] = Query(None),
    default_category: Optional[str] = Form(None),
    default_cat_query: Optional[str] = Query(None, alias="default_category")
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    is_preview = True
    if preview is not None:
        is_preview = bool(preview)
    elif preview_only is not None:
        is_preview = bool(preview_only)

    fallback_cat = default_category or default_cat_query or "VehicleNo"

    fname = file.filename.lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xls") or fname.endswith(".csv") or fname.endswith(".txt")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Please upload an Excel (.xlsx, .xls) or CSV (.csv, .txt) file."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            extracted = extract_masters_from_excel_bytes(file_bytes, default_category=fallback_cat)
        else:
            rows = parse_csv_bytes_to_rows(file_bytes)
            if not rows:
                raise HTTPException(status_code=400, detail="No data rows found in the uploaded file.")
            extracted = extract_masters_from_rows(rows, default_category=fallback_cat)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    if not extracted:
        raise HTTPException(status_code=400, detail="No valid master items found in the file.")

    return await process_master_extracted(extracted, is_preview, file.filename)

@router.post("/import-pasted")
async def import_masters_from_pasted(
    payload: PasteMasterImportRequest,
    preview_only: Optional[bool] = Query(None)
):
    is_preview = payload.preview if payload.preview is not None else (preview_only if preview_only is not None else True)
    raw_text = payload.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Pasted text is empty.")

    rows = parse_pasted_text_to_rows(raw_text)
    if not rows:
        raise HTTPException(status_code=400, detail="No valid lines found in pasted text.")

    extracted = extract_masters_from_rows(rows, default_category=payload.default_category or "VehicleNo")
    if not extracted:
        raise HTTPException(status_code=400, detail="No valid master items detected in pasted text.")

    return await process_master_extracted(extracted, preview_only, "pasted_text")
