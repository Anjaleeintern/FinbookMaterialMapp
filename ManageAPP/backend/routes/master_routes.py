import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from bson import ObjectId
from models.master_models import (
    MasterItemCreate,
    MasterItemUpdate,
    MasterItemOut,
    MasterItemDetail,
    BulkMasterCreate,
    BulkDeleteRequest,
    MasterListResponse,
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

        results.append(
            MasterItemDetail(
                id=doc_id,
                category=doc.get("category", ""),
                value=doc.get("value", ""),
                status=status_val,
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
            res = await db.masters.delete_many({"_id": {"$in": valid_ids}})
            deleted_count += res.deleted_count

    if payload.category and payload.values:
        cat = payload.category.strip()
        res = await db.masters.delete_many({
            "category": cat,
            "value": {"$in": payload.values}
        })
        deleted_count += res.deleted_count

    return {"success": True, "deleted_count": deleted_count}

async def remove_master_logic(category: str, value: str):
    db = get_database()
    category = category.strip()
    value = value.strip()

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
