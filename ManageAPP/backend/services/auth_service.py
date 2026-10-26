import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from typing import Optional
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from config import settings
from database import get_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"{salt}${hashed}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        salt, hashed = stored_hash.split("$")
        computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
        return secrets.compare_digest(hashed, computed)
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme), auth_token: Optional[str] = Query(None)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    actual_token = token or auth_token
    if not actual_token:
        raise credentials_exception
    try:
        payload = jwt.decode(actual_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_database()
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    company_id = user.get("company_id") or user.get("org_id") or str(user["_id"])
    company_name = user.get("company_name") or f"{user.get('name', 'User')}'s Organization"
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", "User"),
        "role": user.get("role", "admin"),
        "phone": user.get("phone", ""),
        "state": user.get("state", ""),
        "company_id": str(company_id),
        "company_name": str(company_name),
    }
