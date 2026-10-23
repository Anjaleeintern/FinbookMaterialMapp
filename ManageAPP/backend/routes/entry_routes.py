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
)

router = APIRouter(prefix="/api/entries", tags=["Entries"])

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
        user_email=current_user["email"]
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

    target_collection = get_collection_name(type_mode)
    calc_data = process_entry_calculations(entry)

    user_id = current_user["id"]
    calc_data["user_id"] = user_id
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

    # Get all collections from known map + dynamically from masters Type/Mode for this user
    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col_name in collections_to_query:
        query_filter = {"user_id": user_id}
        if source and source.strip().lower() in ["excel", "manual"]:
            query_filter["entry_source"] = source.strip().lower()

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

    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col_name in collections_to_query:
        c = await db[col_name].count_documents({"user_id": user_id})
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

    # Delete from specified collections ensuring user_id matches
    for col, ids in grouped_by_col.items():
        if col != "unknown" and ids:
            try:
                res = await db[col].delete_many({"_id": {"$in": ids}, "user_id": user_id})
                deleted_count += res.deleted_count
            except Exception as e:
                print(f"[BulkDelete Error] Failed deleting from {col}: {e}")

    # For unknown collections, check across all known collections
    unknown_ids = grouped_by_col.get("unknown", [])
    if unknown_ids:
        collections_to_query = set(settings.COLLECTION_MAP.values())
        cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"user_id": user_id}, {"is_system": True}]})
        modes = await cursor_modes.to_list(length=500)
        for m in modes:
            val = m.get("value")
            if val:
                collections_to_query.add(get_collection_name(val))

        for col in collections_to_query:
            try:
                res = await db[col].delete_many({"_id": {"$in": unknown_ids}, "user_id": user_id})
                deleted_count += res.deleted_count
            except Exception as e:
                print(f"[BulkDelete Error] Failed searching {col}: {e}")

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} entries"
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
    try:
        obj_id = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    if saved_in:
        res = await db[saved_in].delete_one({"_id": obj_id, "user_id": user_id})
        if res.deleted_count > 0:
            return {"success": True, "deleted_count": 1, "collection": saved_in}
        raise HTTPException(status_code=404, detail="Entry not found in specified collection")

    collections_to_query = set(settings.COLLECTION_MAP.values())
    cursor_modes = db.masters.find({"category": "Type/Mode", "$or": [{"user_id": user_id}, {"is_system": True}]})
    modes = await cursor_modes.to_list(length=500)
    for m in modes:
        val = m.get("value")
        if val:
            collections_to_query.add(get_collection_name(val))

    for col in collections_to_query:
        res = await db[col].delete_one({"_id": obj_id, "user_id": user_id})
        if res.deleted_count > 0:
            return {"success": True, "deleted_count": 1, "collection": col}

    raise HTTPException(status_code=404, detail="Entry not found")

