import certifi
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB at %s", settings.MONGODB_URL)
    client_kwargs = {}
    if "mongodb+srv://" in settings.MONGODB_URL or "ssl=true" in settings.MONGODB_URL.lower():
        client_kwargs["tlsCAFile"] = certifi.where()
    
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL, **client_kwargs)
    db_instance.db = db_instance.client[settings.DB_NAME]
    
    # Initialize indexes and perform migrations
    try:
        # 1. Users email unique index
        await db_instance.db.users.create_index("email", unique=True)
        
        # 2. Upgrade masters indexes to per-user compound index
        try:
            await db_instance.db.masters.drop_index("category_1_value_1")
        except Exception:
            pass
        await db_instance.db.masters.create_index(
            [("user_id", 1), ("category", 1), ("value", 1)],
            unique=True,
            sparse=True
        )
        await db_instance.db.masters.create_index([("user_id", 1), ("status", 1)])
        
        # 3. Upgrade destination collections indexes to per-user compound index
        for col_name in settings.COLLECTION_MAP.values():
            try:
                await db_instance.db[col_name].drop_index("challan_no_1")
            except Exception:
                pass
            await db_instance.db[col_name].create_index(
                [("user_id", 1), ("challan_no", 1)],
                unique=True,
                sparse=True
            )
            await db_instance.db[col_name].create_index([("user_id", 1), ("created_at", -1)])
            
        # 4. Migrate any legacy unassigned records to admin user so new signups stay 100% blank
        admin_user = await db_instance.db.users.find_one({"email": "admin@materialmapp.com"})
        admin_id = str(admin_user["_id"]) if admin_user else None
        
        if admin_id:
            for col_name in settings.COLLECTION_MAP.values():
                await db_instance.db[col_name].update_many(
                    {"user_id": {"$exists": False}},
                    {"$set": {"user_id": admin_id, "user_email": "admin@materialmapp.com"}}
                )
            await db_instance.db.masters.update_many(
                {"user_id": {"$exists": False}, "category": {"$ne": "Type/Mode"}},
                {"$set": {"user_id": admin_id}}
            )

        # 5. Ensure standard Type/Mode masters are flagged as is_system=True
        for std in ["Royalty Sale", "Without Royalty", "Credit Sale", "Cash Sale", "QR Sale", "HR Loading"]:
            await db_instance.db.masters.update_many(
                {"category": "Type/Mode", "value": std},
                {"$set": {"is_system": True, "is_static": True}}
            )

        logger.info("MongoDB connected, per-user indexes & system configurations initialized successfully.")
    except Exception as e:
        logger.warning("Error creating MongoDB indexes / migrations: %s", e)

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    return db_instance.db
