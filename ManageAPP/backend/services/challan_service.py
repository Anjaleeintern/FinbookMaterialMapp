import re
import logging
from pymongo import ReturnDocument
from database import get_database

from config import settings, get_collection_name

logger = logging.getLogger(__name__)

async def get_all_dest_collections() -> list:
    """Return all known destination collections plus any dynamic ones configured in masters."""
    db = get_database()
    cols = set(settings.COLLECTION_MAP.values())
    try:
        cursor_modes = db.masters.find({"category": "Type/Mode"})
        modes = await cursor_modes.to_list(length=500)
        for m in modes:
            val = m.get("value")
            if val:
                cols.add(get_collection_name(val))
    except Exception:
        pass
    return list(cols)

def extract_challan_number(challan_str: str) -> int:
    """Extract integer number from strings like '0015', '015', '15', 'CH-0015'."""
    if not challan_str:
        return 0
    match = re.search(r'(\d+)', str(challan_str))
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return 0
    return 0

def format_challan_candidate(seq_num: int, fmt: str = None) -> str:
    """
    Format challan number with at least 3 digits zero-padded: 001, 002, 003...
    Guarantees continuous consistent series across manual and excel entries.
    """
    try:
        val = int(seq_num)
        return f"{val:03d}"
    except (ValueError, TypeError):
        return str(seq_num)

async def get_highest_existing_challan_number() -> int:
    """Scan all collections to find the absolute highest challan number actually stored in MongoDB."""
    db = get_database()
    max_num = 0
    collections = await get_all_dest_collections()
    for col_name in collections:
        try:
            cursor = db[col_name].find({}, {"challan_no": 1})
            docs = await cursor.to_list(length=20000)
            for doc in docs:
                c_no = doc.get("challan_no")
                num = extract_challan_number(c_no)
                if num > max_num:
                    max_num = num
        except Exception as e:
            logger.warning("Error reading challan from %s: %s", col_name, e)
    return max_num

async def sync_challan_counter() -> int:
    """
    Ensure db.counters has seq in sync with highest existing challan number in the database.
    """
    db = get_database()
    max_existing = await get_highest_existing_challan_number()

    if max_existing == 0:
        target_seq = 0
    else:
        counter = await db.counters.find_one({"_id": "challan_seq"})
        current_seq = counter.get("seq", 0) if counter else 0
        if current_seq < max_existing or current_seq > (max_existing + 20):
            target_seq = max_existing
        else:
            target_seq = max(current_seq, max_existing)

    await db.counters.update_one(
        {"_id": "challan_seq"},
        {"$set": {"seq": target_seq}},
        upsert=True
    )
    return target_seq

async def detect_challan_format() -> str:
    """Default format is 3-digit numeric series (001, 002, 003...)."""
    return "NUM"

async def is_challan_no_used(challan_no: str, exclude_id: str = None) -> bool:
    """Check if a challan_no is already used in any collection, checking both raw and formatted variants."""
    if not challan_no:
        return False
    db = get_database()
    collections = await get_all_dest_collections()
    num = extract_challan_number(challan_no)

    variants = {str(challan_no).strip()}
    if num > 0:
        variants.add(str(num))
        variants.add(f"{num:03d}")
        variants.add(f"{num:04d}")
        variants.add(f"CH-{num:04d}")
        variants.add(f"CH-{num:03d}")
        variants.add(f"CH-{num}")

    for col_name in collections:
        try:
            for v in variants:
                doc = await db[col_name].find_one({"challan_no": v}, {"_id": 1})
                if doc:
                    if exclude_id and str(doc["_id"]) == str(exclude_id):
                        continue
                    return True
        except Exception:
            pass
    return False

async def repair_duplicate_challans():
    """Find any duplicate challan_no across collections and fix them sequentially."""
    db = get_database()
    seen = {}
    duplicates = []
    collections = await get_all_dest_collections()

    for col_name in collections:
        try:
            cursor = db[col_name].find({}, {"challan_no": 1, "created_at": 1, "date": 1})
            docs = await cursor.to_list(length=10000)
            for doc in docs:
                c_no = doc.get("challan_no")
                if c_no:
                    if c_no in seen:
                        duplicates.append((col_name, doc["_id"], c_no, doc.get("created_at") or doc.get("date")))
                    else:
                        seen[c_no] = (col_name, doc["_id"])
        except Exception as e:
            logger.warning("Error scanning duplicates in %s: %s", col_name, e)

    if duplicates:
        highest = await get_highest_existing_challan_number()
        for col_name, doc_id, old_c_no, _ in duplicates:
            highest += 1
            new_c_no = format_challan_candidate(highest)
            logger.info("Fixing duplicate challan %s in %s -> %s", old_c_no, col_name, new_c_no)
            await db[col_name].update_one({"_id": doc_id}, {"$set": {"challan_no": new_c_no}})

        await db.counters.update_one(
            {"_id": "challan_seq"},
            {"$set": {"seq": highest}},
            upsert=True
        )

async def get_next_challan_no() -> str:
    """Atomically generate the next unique challan number continuing the existing DB series (001, 002, 003...)."""
    db = get_database()

    # Atomically increment counter
    counter = await db.counters.find_one_and_update(
        {"_id": "challan_seq"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    seq_num = counter.get("seq", 1)
    cand = format_challan_candidate(seq_num)

    # Self-healing loop in case number was pre-seeded or already used in DB
    while await is_challan_no_used(cand):
        counter = await db.counters.find_one_and_update(
            {"_id": "challan_seq"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        seq_num = counter.get("seq", 1)
        cand = format_challan_candidate(seq_num)

    return cand

async def peek_next_challan_no() -> str:
    """Peek what the next challan number will be in the series without incrementing (001, 002, 003...)."""
    db = get_database()
    max_existing = await get_highest_existing_challan_number()
    if max_existing == 0:
        base_seq = 0
    else:
        counter = await db.counters.find_one({"_id": "challan_seq"})
        current_seq = counter.get("seq", 0) if counter else 0
        if current_seq < max_existing or current_seq > (max_existing + 20):
            base_seq = max_existing
        else:
            base_seq = max(current_seq, max_existing)

    next_seq = base_seq + 1
    cand = format_challan_candidate(next_seq)
    while await is_challan_no_used(cand):
        next_seq += 1
        cand = format_challan_candidate(next_seq)

    return cand
