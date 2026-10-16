import asyncio
from database import connect_to_mongo, close_mongo_connection, get_database
from services.auth_service import hash_password
from services.calculation_service import process_entry_calculations
from models.entry_models import EntryCreate
from config import settings

INITIAL_MASTERS = [
    # VehicleNo
    {"category": "VehicleNo", "value": "MP09GG1230"},
    {"category": "VehicleNo", "value": "MP09BS6668"},
    {"category": "VehicleNo", "value": "MP09GG7934"},
    {"category": "VehicleNo", "value": "MP09GG1150"},
    {"category": "VehicleNo", "value": "RJ09GE1458"},
    # TransportName
    {"category": "TransportName", "value": "MSK"},
    {"category": "TransportName", "value": "VMPL"},
    # MaterialName
    {"category": "MaterialName", "value": "10MM"},
    {"category": "MaterialName", "value": "20MM"},
    {"category": "MaterialName", "value": "GSB"},
    {"category": "MaterialName", "value": "M-SAND"},
    # PartyName
    {"category": "PartyName", "value": "NAWAZ KHAN"},
    {"category": "PartyName", "value": "ALTAMASH KHAN"},
    {"category": "PartyName", "value": "SAGEER PATEL"},
    {"category": "PartyName", "value": "PUSHPENDRA"},
    {"category": "PartyName", "value": "ANIL AARIYA"},
]

INITIAL_ENTRIES = [
    {
        "date": "10/13/2026",
        "challan_no": "CH-0001",
        "vehicle_no": "RJ09GE1458",
        "transport_type": "VMPL",
        "type_mode": "HR Loading",
        "hr_loading_type": "Without Royalty",
        "party_name": "ALTAMASH KHAN",
        "material_name": "M-SAND",
        "cum": 26.0,
        "etp_no": "2601581706",
        "g_wt": 60790.0,
        "t_wt": 14710.0,
        "rate": 350.0
    },
    {
        "date": "10/13/2026",
        "challan_no": "CH-0002",
        "vehicle_no": "MP09BS6668",
        "transport_type": "VMPL",
        "type_mode": "HR Loading",
        "hr_loading_type": "With Royalty",
        "party_name": "SAGEER PATEL",
        "material_name": "GSB",
        "cum": 10.0,
        "etp_no": "12345677",
        "g_wt": 12000.0,
        "t_wt": 1000.0,
        "rate": 400.0,
        "gst_rate": 5.0
    },
    {
        "date": "10/14/2026",
        "challan_no": "CH-0003",
        "vehicle_no": "MP09GG1230",
        "transport_type": "VMPL",
        "type_mode": "Royalty Sale",
        "party_name": "ANIL AARIYA",
        "material_name": "20MM",
        "cum": 25.0,
        "etp_no": "2601581709",
        "g_wt": 12000.0,
        "t_wt": 3000.0,
        "rate": 500.0,
        "gst_rate": 5.0
    },
    {
        "date": "10/14/2026",
        "challan_no": "CH-0004",
        "vehicle_no": "MP09GG1150",
        "transport_type": "MSK",
        "type_mode": "Cash Sale",
        "party_name": "ALTAMASH KHAN",
        "material_name": "20MM",
        "cum": 5.0,
        "g_wt": 5000.0,
        "t_wt": 4000.0,
        "rate": 600.0,
        "payment_mode": "Cash"
    },
    {
        "date": "10/14/2026",
        "challan_no": "CH-0005",
        "vehicle_no": "MP09GG1230",
        "transport_type": "VMPL",
        "type_mode": "Royalty Sale",
        "party_name": "PUSHPENDRA",
        "material_name": "10MM",
        "cum": 25.0,
        "etp_no": "123432",
        "g_wt": 12000.0,
        "t_wt": 1323.0,
        "rate": 450.0,
        "gst_rate": 5.0
    },
    {
        "date": "10/14/2026",
        "challan_no": "CH-0006",
        "vehicle_no": "MP09GG1230",
        "transport_type": "VMPL",
        "type_mode": "Royalty Sale",
        "party_name": "SAGEER PATEL",
        "material_name": "20MM",
        "cum": 25.0,
        "g_wt": 25000.0,
        "t_wt": 10000.0,
        "rate": 480.0,
        "gst_rate": 5.0
    }
]

async def seed():
    await connect_to_mongo()
    db = get_database()
    print("Seeding database...")

    # 1. Seed Admin User
    existing_user = await db.users.find_one({"email": "admin@materialmapp.com"})
    if not existing_user:
        await db.users.insert_one({
            "email": "admin@materialmapp.com",
            "password_hash": hash_password("admin123"),
            "name": "Admin User",
            "role": "admin"
        })
        print("Default admin created: admin@materialmapp.com / admin123")
    else:
        print("Admin user already exists.")

    # 2. Seed Masters from Screenshot 1
    for m in INITIAL_MASTERS:
        await db.masters.update_one(
            {"category": m["category"], "value": m["value"]},
            {"$set": m},
            upsert=True
        )
    print(f"Seeded {len(INITIAL_MASTERS)} master items with unique indexes.")

    # 3. Seed Existing Entries directly to destination collections
    for item in INITIAL_ENTRIES:
        entry_obj = EntryCreate(**item)
        calc_data = process_entry_calculations(entry_obj)
        target_col = settings.COLLECTION_MAP[calc_data["type_mode"]]
        calc_data["saved_in"] = target_col
        
        await db[target_col].update_one(
            {"challan_no": calc_data["challan_no"]},
            {"$set": calc_data},
            upsert=True
        )
    print(f"Seeded {len(INITIAL_ENTRIES)} entries directly to their destination collections.")

    # 4. Set Challan sequence counter to 6 so next is CH-0007
    await db.counters.update_one(
        {"_id": "challan_seq"},
        {"$set": {"seq": 6}},
        upsert=True
    )
    print("Challan sequence counter set to 6 (Next: CH-0007).")

    await close_mongo_connection()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
