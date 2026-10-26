import os
import re
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # MongoDB Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "materialmapp"

    # JWT Authentication & Security
    JWT_SECRET: str = "materialmapp_super_secure_secret_key_2026_xyz"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 720

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "*"
    
    # Destination routing map for known Type/Mode values
    COLLECTION_MAP: dict = {
        "Royalty Sale": "royalty_sale",
        "Without Royalty": "without_royalty",
        "Credit Sale": "credit_sale",
        "Cash Sale": "cash_sale",
        "Case Sale": "cash_sale",
        "Case sale": "cash_sale",
        "case sale": "cash_sale",
        "QR Sale": "cash_sale"
    }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

def get_collection_name(type_mode: str) -> str:
    if not type_mode:
        return "credit_sale"
    cleaned = type_mode.strip()
    if cleaned in settings.COLLECTION_MAP:
        return settings.COLLECTION_MAP[cleaned]
    low = cleaned.lower()
    if "cash" in low or "case" in low or "qr" in low:
        return "cash_sale"
    if "credit" in low:
        return "credit_sale"
    if "without" in low:
        return "without_royalty"
    if "royalty" in low:
        return "royalty_sale"
    # Clean custom mode to valid MongoDB collection name (e.g. "Special Sale" -> "special_sale")
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', cleaned.lower()).strip('_')
    return slug or "credit_sale"

