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
    
    # Initialize indexes
    try:
        # Users email unique index
        await db_instance.db.users.create_index("email", unique=True)
        
        # Masters category + value unique compound index
        await db_instance.db.masters.create_index([("category", 1), ("value", 1)], unique=True)
        
        # Challan counters collection
        counter = await db_instance.db.counters.find_one({"_id": "challan_seq"})
        if not counter:
            await db_instance.db.counters.insert_one({"_id": "challan_seq", "seq": 0})
            
        # Destination collections unique index on challan_no
        for col_name in settings.COLLECTION_MAP.values():
            await db_instance.db[col_name].create_index("challan_no", unique=True)
            
        logger.info("MongoDB connected and indexes verified successfully.")
    except Exception as e:
        logger.warning("Error creating MongoDB indexes: %s", e)

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    return db_instance.db
