from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Depends
from fastapi.responses import Response
from config import settings, get_collection_name
from database import get_database
from models.entry_models import EntryCreate, EntryOut, EntrySummary
from services.auth_service import get_current_user
from services.challan_service import (
    get_next_challan_no,
    peek_next_challan_no,
    is_challan_no_used,
    extract_challan_number,
    repair_duplicate_challans,
    get_highest_existing_challan_number,
    format_challan_candidate,
)
from services.calculation_service import process_entry_calculations
from services.excel_service import (
    parse_excel_or_csv_bytes,
    process_raw_imported_rows,
    execute_bulk_import_to_mongodb,
    generate_sample_excel_template,
    generate_party_wise_sales_excel,
)
from services.pdf_service import generate_tally_invoice_pdf

router = APIRouter(prefix="/api/entries", tags=["Entries"])


def get_company_scope_query(current_user: dict) -> dict:
    company_id = current_user.get("company_id") or current_user["id"]
    user_id = current_user["id"]
    return {"$or": [{"company_id": str(company_id)}, {"user_id": str(user_id)}]}


def extract_month_key_and_label(date_val):
    """
    Parses date string or date object and returns (month_key, month_label),
    e.g. ('2026-10', 'October 2026'). Returns (None, None) if invalid.
    """
    if not date_val:
        return None, None
    if isinstance(date_val, datetime):
        return date_val.strftime("%Y-%m"), date_val.strftime("%B %Y")

    s = str(date_val).strip()
    if not s:
        return None, None

    # Handle standard YYYY-MM-DD
    if "-" in s:
        parts = s.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            try:
                y = int(parts[0])
                m = int(parts[1])
                dt = datetime(y, m, 1)
                return dt.strftime("%Y-%m"), dt.strftime("%B %Y")
            except Exception:
                pass

    # Handle DD/MM/YYYY or MM/DD/YYYY
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            try:
                p0 = int(parts[0])
                p1 = int(parts[1])
                y = int(parts[2])
                if y < 100:
                    y += 2000
                m = p1 if p0 > 12 else p0
                dt = datetime(y, m, 1)
                return dt.strftime("%Y-%m"), dt.strftime("%B %Y")
            except Exception:
                pass

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            dt = datetime.strptime(s[:10], fmt)
            return dt.strftime("%Y-%m"), dt.strftime("%B %Y")
        except Exception:
            continue

    return None, None


@router.get("/party-wise-sales/export")
async def export_party_wise_sales(
    month: Optional[str] = Query(None, description="Month filter (e.g. '2026-10', 'October 2026', or 'all')"),
    current_user: dict = Depends(get_current_user)
):
    """
    Download Party-wise Sales in Excel format for a selected month or all time.
    """
    db = get_database()
    scope_filter = get_company_scope_query(current_user)

    collections = ["credit_sale", "cash_sale", "royalty_sale", "without_royalty"]
    all_entries = []

    for col in collections:
        cursor = db[col].find(scope_filter)
        docs = await cursor.to_list(length=10000)
        for doc in docs:
            doc["_collection"] = col
            all_entries.append(doc)

    month_filter = (month or "").strip().lower()
    selected_label = "All Time"

    filtered_entries = []
    for e in all_entries:
        m_key, m_lbl = extract_month_key_and_label(e.get("date"))
        if not month_filter or month_filter == "all":
            filtered_entries.append(e)
        else:
            if (m_key and month_filter == m_key.lower()) or (m_lbl and month_filter in m_lbl.lower()):
                filtered_entries.append(e)
                if selected_label == "All Time" and m_lbl:
                    selected_label = m_lbl

    if month_filter and month_filter != "all" and selected_label == "All Time":
        selected_label = month.strip()

    # Aggregate by party
    party_map = {}
    total_sales = 0.0
    total_trips = 0
    total_net_wt = 0.0
    total_royalty = 0.0
    total_non_royalty = 0.0
    total_cash = 0.0
    total_credit = 0.0

    for e in filtered_entries:
        p_name = (e.get("party_name") or e.get("customer_name") or "Unspecified Party").strip()
        amt = float(e.get("total_amount") or e.get("amount") or 0.0)
        wt = float(e.get("net_wt") or 0.0)
        col = e.get("_collection", "")
        sale_type = str(e.get("sale_type") or "").lower()
        mode = str(e.get("type_mode") or "").lower()

        if p_name not in party_map:
            party_map[p_name] = {
                "name": p_name,
                "total": 0.0,
                "trips": 0,
                "net_wt": 0.0,
                "royalty": 0.0,
                "non_royalty": 0.0,
                "cash": 0.0,
                "credit": 0.0,
            }

        party_map[p_name]["total"] += amt
        party_map[p_name]["trips"] += 1
        party_map[p_name]["net_wt"] += wt

        total_sales += amt
        total_trips += 1
        total_net_wt += wt

        if "royalty" in col or "royalty" in sale_type:
            if "without" in col or "without" in sale_type:
                party_map[p_name]["non_royalty"] += amt
                total_non_royalty += amt
            else:
                party_map[p_name]["royalty"] += amt
                total_royalty += amt
        else:
            party_map[p_name]["non_royalty"] += amt
            total_non_royalty += amt

        if "cash" in col or "cash" in mode or "qr" in mode or "bank" in mode:
            party_map[p_name]["cash"] += amt
            total_cash += amt
        else:
            party_map[p_name]["credit"] += amt
            total_credit += amt

    # Sort descending by total purchase
    party_list = sorted(party_map.values(), key=lambda x: x["total"], reverse=True)

    totals = {
        "total_amount": total_sales,
        "total_trips": total_trips,
        "total_net_wt": total_net_wt,
        "total_royalty": total_royalty,
        "total_non_royalty": total_non_royalty,
        "total_cash": total_cash,
        "total_credit": total_credit,
    }

    excel_bytes = generate_party_wise_sales_excel(party_list, selected_label, totals)
    safe_name = selected_label.replace(" ", "_").replace("/", "-").lower()

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=party_wise_sales_{safe_name}.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/template")
async def download_excel_template():
    """Download a formatted sample Excel template for bulk entry import."""
    content = generate_sample_excel_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=material_entries_sample_template.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.post("/import-excel")
async def import_excel_entries(
    file: UploadFile = File(...),
    preview_only: bool = Query(False, description="Set to true to preview parsed data without saving to MongoDB"),
    default_type_mode: Optional[str] = Query(None, description="Optional default mode if not present in sheet or file"),
    selected_sheets: Optional[str] = Query(None, description="Comma-separated list of sheet names to import"),
    current_user: dict = Depends(get_current_user)
):
    """
    Import delivery entries in bulk via Excel (.xlsx, .xls) or CSV file.
    - Accurately detects Type/Mode from sheet tab title.
    - Rows are parsed, validated, sorted date-wise ascending.
    - When preview_only is False, entries are sequentially assigned Challan numbers
      and inserted directly into their destination collections with the user's ID.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    fname = file.filename.lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xls") or fname.endswith(".csv")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file."
        )

    cleaned_default_mode = None
    if default_type_mode and default_type_mode.strip() and not default_type_mode.strip().lower().startswith("auto"):
        cleaned_default_mode = default_type_mode.strip()

    selected_sheets_list = None
    if selected_sheets and selected_sheets.strip():
        selected_sheets_list = [s.strip() for s in selected_sheets.split(",") if s.strip()]

    try:
        file_bytes = await file.read()
        raw_rows, available_sheets = parse_excel_or_csv_bytes(
            file_bytes,
            file.filename,
            default_type_mode=cleaned_default_mode,
            selected_sheets=selected_sheets_list
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {str(e)}"
        )

    if not raw_rows:
        return {
            "preview": True,
            "filename": file.filename,
            "available_sheets": available_sheets,
            "total_rows_found": 0,
            "valid_count": 0,
            "error_count": 0,
            "by_collection": {},
            "preview_items": [],
            "errors": []
        }

    valid_entries, errors = process_raw_imported_rows(raw_rows, default_type_mode=cleaned_default_mode)

    if preview_only:
        by_col = {}
        for item in valid_entries:
            col = item.get("target_collection", "general_sale")
            by_col[col] = by_col.get(col, 0) + 1

        next_cand = await peek_next_challan_no(user_id=current_user["id"])
        start_seq = extract_challan_number(next_cand)

        safe_preview = []
        for idx, v in enumerate(valid_entries[:50]):
            item_copy = dict(v)
            if "_sort_date" in item_copy:
                del item_copy["_sort_date"]
            item_copy["challan_no"] = format_challan_candidate(start_seq + idx)
            safe_preview.append(item_copy)

        sheet_names = sorted(list(set(str(r.get("_sheet_name", "")) for r in raw_rows if r.get("_sheet_name"))))
        detected_modes = sorted(list(set(str(v.get("type_mode", "")) for v in valid_entries if v.get("type_mode"))))

        return {
            "preview": True,
            "filename": file.filename,
            "available_sheets": available_sheets,
            "sheet_names": sheet_names,
            "detected_modes": detected_modes,
            "total_rows_found": len(raw_rows),
            "valid_count": len(valid_entries),
            "error_count": len(errors),
            "by_collection": by_col,
            "preview_items": safe_preview,
            "errors": errors[:50]
        }

    if not valid_entries:
        raise HTTPException(
            status_code=400,
            detail=f"No valid entries found to import. {len(errors)} error(s) detected: {errors[0]['reason'] if errors else ''}"
        )

    import_result = await execute_bulk_import_to_mongodb(
        valid_entries,
        user_id=current_user["id"],
        user_email=current_user["email"],
        company_id=current_user.get("company_id") or current_user["id"]
    )
    import_result["filename"] = file.filename
    import_result["total_rows_found"] = len(raw_rows)
    import_result["error_count"] = len(errors)
    import_result["errors"] = errors[:50]

    return import_result

@router.get("/next-challan")
async def get_next_challan(current_user: dict = Depends(get_current_user)):
    challan = await peek_next_challan_no(user_id=current_user["id"])
    return {"next_challan_no": challan}

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_entry(entry: EntryCreate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    
    type_mode = entry.type_mode.strip()
    if not type_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type/Mode is required"
        )

    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id

    if not entry.party_state and entry.party_name:
        party_doc = await db.masters.find_one({
            "category": "PartyName",
            "value": entry.party_name.strip(),
            "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]
        })
        if party_doc and party_doc.get("state"):
            entry.party_state = party_doc.get("state")

    target_collection = get_collection_name(type_mode)
    calc_data = process_entry_calculations(entry)

    calc_data["user_id"] = user_id
    calc_data["company_id"] = company_id
    calc_data["user_email"] = current_user["email"]

    # Strictly unique auto-incrementing ChallanNo in continuous series (001, 002, 003...) for this user
    provided_challan = (calc_data.get("challan_no") or "").strip()
    if not provided_challan or await is_challan_no_used(provided_challan, user_id=user_id):
        calc_data["challan_no"] = await get_next_challan_no(user_id=user_id)
    else:
        num = extract_challan_number(provided_challan)
        if num > 0:
            formatted = format_challan_candidate(num)
            if await is_challan_no_used(formatted, user_id=user_id):
                calc_data["challan_no"] = await get_next_challan_no(user_id=user_id)
            else:
                calc_data["challan_no"] = formatted
                await db.counters.update_one(
                    {"_id": f"challan_seq_{user_id}"},
                    {"$max": {"seq": num}},
                    upsert=True
                )
        else:
            calc_data["challan_no"] = await get_next_challan_no(user_id=user_id)

    calc_data["created_at"] = datetime.now(timezone.utc)
    calc_data["saved_in"] = target_collection
    calc_data["entry_source"] = "manual"

    result = await db[target_collection].insert_one(calc_data)

    calc_data["id"] = str(result.inserted_id)
    if "_id" in calc_data:
        del calc_data["_id"]

    return {
        "success": True,
        "message": f"Entry directly saved in collection '{target_collection}'",
        "saved_in": target_collection,
        "entry": calc_data
    }

@router.get("", response_model=List[EntryOut])
async def get_all_entries(
    search: Optional[str] = Query(None, description="Search across VehicleNo, ChallanNo, PartyName, MaterialName"),
    source: Optional[str] = Query(None, description="Filter by entry source: 'excel' or 'manual'"),
    limit: int = Query(500, ge=1, le=2000),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    all_entries = []
    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id
    scope_filter = get_company_scope_query(current_user)

    # Get all collections from known map + dynamically from masters Type/Mode for this user/company
    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col_name in collections_to_query:
        if source and source.strip().lower() in ["excel", "manual"]:
            query_filter = {"$and": [scope_filter, {"entry_source": source.strip().lower()}]}
        else:
            query_filter = scope_filter

        cursor = db[col_name].find(query_filter).sort("created_at", -1).limit(limit)
        items = await cursor.to_list(length=limit)
        for item in items:
            item["id"] = str(item["_id"])
            item["saved_in"] = col_name
            item["entry_source"] = str(item.get("entry_source") or "excel")
            item["cum"] = float(item.get("cum") or 0.0)
            item["etp_no"] = str(item.get("etp_no") or "")
            item["g_wt"] = float(item.get("g_wt") or 0.0)
            item["t_wt"] = float(item.get("t_wt") or 0.0)
            item["net_wt"] = float(item.get("net_wt") or 0.0)
            item["rate"] = float(item.get("rate") or 0.0)
            item["amount"] = float(item.get("amount") or 0.0)
            item["gst_rate"] = float(item.get("gst_rate") or 0.0)
            item["gst_amount"] = float(item.get("gst_amount") or 0.0)
            item["total_amount"] = float(item.get("total_amount") or item.get("amount") or 0.0)
            all_entries.append(item)

    # Sort combined entries by created_at or date descending
    all_entries.sort(key=lambda x: str(x.get("created_at") or x.get("date")), reverse=True)

    # Apply search filter if provided
    if search:
        s_lower = search.strip().lower()
        all_entries = [
            e for e in all_entries
            if s_lower in str(e.get("challan_no", "")).lower()
            or s_lower in str(e.get("vehicle_no", "")).lower()
            or s_lower in str(e.get("party_name", "")).lower()
            or s_lower in str(e.get("material_name", "")).lower()
            or s_lower in str(e.get("type_mode", "")).lower()
            or s_lower in str(e.get("entry_source", "")).lower()
        ]

    return all_entries[:limit]

@router.get("/summary", response_model=EntrySummary)
async def get_summary(current_user: dict = Depends(get_current_user)):
    db = get_database()
    counts = {}
    total = 0
    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id
    scope_filter = get_company_scope_query(current_user)

    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col_name in collections_to_query:
        c = await db[col_name].count_documents(scope_filter)
        counts[col_name] = c
        total += c

    return {
        "total_entries": total,
        "by_collection": counts
    }


class BulkDeleteEntryItem(BaseModel):
    id: str
    saved_in: Optional[str] = None


class BulkDeleteEntriesRequest(BaseModel):
    items: Optional[List[BulkDeleteEntryItem]] = None
    ids: Optional[List[str]] = None


@router.post("/bulk-delete")
async def bulk_delete_entries(payload: BulkDeleteEntriesRequest, current_user: dict = Depends(get_current_user)):
    """
    Bulk delete delivery entries from their respective MongoDB collections belonging to current user.
    """
    db = get_database()
    deleted_count = 0
    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id
    scope_filter = get_company_scope_query(current_user)
    grouped_by_col = {}

    if payload.items:
        for item in payload.items:
            col = item.saved_in or "unknown"
            if col not in grouped_by_col:
                grouped_by_col[col] = []
            try:
                grouped_by_col[col].append(ObjectId(item.id))
            except Exception:
                pass

    if payload.ids:
        if "unknown" not in grouped_by_col:
            grouped_by_col["unknown"] = []
        for id_str in payload.ids:
            try:
                grouped_by_col["unknown"].append(ObjectId(id_str))
            except Exception:
                pass

    # Delete from specified collections ensuring authorized company/user matches
    for col, ids in grouped_by_col.items():
        if col != "unknown" and ids:
            try:
                res = await db[col].delete_many({"_id": {"$in": ids}, **scope_filter})
                deleted_count += res.deleted_count
            except Exception as e:
                print(f"[BulkDelete Error] Failed deleting from {col}: {e}")

    # For unknown collections, check across all known collections
    unknown_ids = grouped_by_col.get("unknown", [])
    if unknown_ids:
        collections_to_query = set(settings.COLLECTION_MAP.values())
        cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]})
        modes = await cursor_modes.to_list(length=500)
        for m in modes:
            val = m.get("value")
            if val:
                collections_to_query.add(get_collection_name(val))

        for col in collections_to_query:
            try:
                res = await db[col].delete_many({"_id": {"$in": unknown_ids}, **scope_filter})
                deleted_count += res.deleted_count
            except Exception as e:
                print(f"[BulkDelete Error] Failed searching {col}: {e}")

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} entries"
    }


@router.put("/{entry_id}")
async def update_entry(
    entry_id: str,
    entry: EntryCreate,
    saved_in: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Update an existing delivery entry by ID for current user/company.
    Recalculates weights, rate, amounts, additional charges, and GST.
    Handles moving to target collection if type_mode changed.
    """
    db = get_database()
    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id
    scope_filter = get_company_scope_query(current_user)

    try:
        obj_id = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    calc_data = process_entry_calculations(entry)
    calc_data["user_id"] = user_id
    calc_data["company_id"] = company_id
    calc_data["updated_at"] = datetime.now(timezone.utc)

    target_collection = get_collection_name(calc_data["type_mode"])
    calc_data["saved_in"] = target_collection

    existing_doc = None
    existing_col = None

    if saved_in:
        existing_doc = await db[saved_in].find_one({"_id": obj_id, **scope_filter})
        if existing_doc:
            existing_col = saved_in

    if not existing_doc:
        collections_to_query = set(settings.COLLECTION_MAP.values())
        cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]})
        modes = await cursor_modes.to_list(length=500)
        for m in modes:
            val = m.get("value")
            if val:
                collections_to_query.add(get_collection_name(val))

        for col in collections_to_query:
            doc = await db[col].find_one({"_id": obj_id, **scope_filter})
            if doc:
                existing_doc = doc
                existing_col = col
                break

    if not existing_doc:
        raise HTTPException(status_code=404, detail="Entry not found to update")

    # Preserve challan_no if not provided
    if not calc_data.get("challan_no"):
        calc_data["challan_no"] = existing_doc.get("challan_no")

    # Preserve created_at and entry_source
    calc_data["created_at"] = existing_doc.get("created_at") or datetime.now(timezone.utc)
    if not calc_data.get("entry_source"):
        calc_data["entry_source"] = existing_doc.get("entry_source", "manual")

    if existing_col == target_collection:
        res = await db[target_collection].find_one_and_update(
            {"_id": obj_id, **scope_filter},
            {"$set": calc_data},
            return_document=True
        )
        res["id"] = str(res["_id"])
        del res["_id"]
        return {
            "success": True,
            "message": "Entry updated successfully",
            "saved_in": target_collection,
            "entry": res
        }
    else:
        # Move document to new collection
        await db[existing_col].delete_one({"_id": obj_id, **scope_filter})
        calc_data["_id"] = obj_id
        await db[target_collection].insert_one(calc_data)
        calc_data["id"] = str(obj_id)
        del calc_data["_id"]
        return {
            "success": True,
            "message": f"Entry updated and moved to '{target_collection}'",
            "saved_in": target_collection,
            "entry": calc_data
        }


@router.delete("/{entry_id}")
async def delete_single_entry(
    entry_id: str,
    saved_in: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a single delivery entry by ID for current user.
    """
    db = get_database()
    user_id = current_user["id"]
    company_id = current_user.get("company_id") or user_id
    scope_filter = get_company_scope_query(current_user)
    try:
        obj_id = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    if saved_in:
        res = await db[saved_in].delete_one({"_id": obj_id, **scope_filter})
        if res.deleted_count > 0:
            return {"success": True, "deleted_count": 1, "collection": saved_in}
        raise HTTPException(status_code=404, detail="Entry not found in specified collection")

    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"company_id": company_id}, {"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col in collections_to_query:
        res = await db[col].delete_one({"_id": obj_id, **scope_filter})
        if res.deleted_count > 0:
            return {"success": True, "deleted_count": 1, "collection": col}

    raise HTTPException(status_code=404, detail="Entry not found")


class DownloadPdfPayload(BaseModel):
    entry: dict
    company_name: Optional[str] = None


@router.post("/download-pdf")
async def download_entry_pdf_direct(payload: DownloadPdfPayload):
    """
    Renders and directly downloads the delivery entry as a Tally invoice PDF.
    """
    entry_dict = payload.entry
    challan_no = entry_dict.get("challan_no") or entry_dict.get("serial_no") or entry_dict.get("id") or "slip"
    pdf_bytes = generate_tally_invoice_pdf(entry_dict, payload.company_name or "")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Invoice_{challan_no}.pdf"'
        }
    )

