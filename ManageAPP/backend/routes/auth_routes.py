import time
from collections import defaultdict
from typing import Dict, List
from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Request
from models.auth_models import (
    UserLogin,
    UserRegister,
    Token,
    UserOut,
    UserProfileUpdate,
    ChangePasswordRequest,
)
from services.auth_service import hash_password, verify_password, create_access_token, get_current_user
from database import get_database

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Rate limiting for login: max 4 requests per 60-second window per IP
_login_rate_limits: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60.0  # seconds
MAX_LOGIN_ATTEMPTS = 4

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

def check_login_rate_limit(ip: str):
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    
    # Filter attempts that fall within the sliding 60-second window
    attempts = [t for t in _login_rate_limits[ip] if t > window_start]
    
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        retry_after = int(attempts[0] + RATE_LIMIT_WINDOW - now) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again after a minute.",
            headers={"Retry-After": str(max(1, retry_after))}
        )
    
    attempts.append(now)
    _login_rate_limits[ip] = attempts

def clear_login_rate_limits():
    """Clear in-memory login rate limit store (useful for testing)."""
    _login_rate_limits.clear()

@router.post("/register", response_model=UserOut)
async def register(user: UserRegister):
    db = get_database()
    email_lower = user.email.lower().strip()
    existing = await db.users.find_one({"email": email_lower})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    user_doc = {
        "email": email_lower,
        "password_hash": hash_password(user.password),
        "name": user.name.strip(),
        "role": user.role or "admin",
        "phone": "",
        "state": "",
        "company_id": user.company_id.strip() if user.company_id else None,
        "company_name": user.company_name.strip() if user.company_name else f"{user.name.strip()}'s Organization",
    }
    result = await db.users.insert_one(user_doc)
    cid = user_doc["company_id"] or str(result.inserted_id)
    cname = user_doc["company_name"] or f"{user.name.strip()}'s Organization"
    return {
        "id": str(result.inserted_id),
        "email": user_doc["email"],
        "name": user_doc["name"],
        "role": user_doc["role"],
        "phone": user_doc.get("phone", ""),
        "state": user_doc.get("state", ""),
        "company_id": str(cid),
        "company_name": str(cname),
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request):
    client_ip = get_client_ip(request)
    check_login_rate_limit(client_ip)

    db = get_database()
    email_lower = credentials.email.lower().strip()
    user = await db.users.find_one({"email": email_lower})
    
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["email"], "role": user.get("role", "admin")})
    cid = user.get("company_id") or user.get("org_id") or str(user["_id"])
    cname = user.get("company_name") or f"{user.get('name', 'User')}'s Organization"
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", "User"),
            "role": user.get("role", "admin"),
            "phone": user.get("phone", ""),
            "state": user.get("state", ""),
            "company_id": str(cid),
            "company_name": str(cname),
        }
    }

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserOut)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    user_id = current_user["id"]
    
    update_fields = {}
    if profile_data.name is not None and profile_data.name.strip():
        update_fields["name"] = profile_data.name.strip()
    if profile_data.phone is not None:
        update_fields["phone"] = profile_data.phone.strip()
    if profile_data.state is not None:
        update_fields["state"] = profile_data.state.strip()
    if profile_data.email is not None and profile_data.email.strip():
        new_email = profile_data.email.lower().strip()
        if new_email != current_user["email"]:
            existing = await db.users.find_one({"email": new_email, "_id": {"$ne": ObjectId(user_id)}})
            if existing:
                raise HTTPException(status_code=400, detail="This email is already in use by another user")
            update_fields["email"] = new_email

    if update_fields:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})

    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    cid = updated.get("company_id") or updated.get("org_id") or str(updated["_id"])
    cname = updated.get("company_name") or f"{updated.get('name', 'User')}'s Organization"
    return {
        "id": str(updated["_id"]),
        "email": updated["email"],
        "name": updated.get("name", "User"),
        "role": updated.get("role", "admin"),
        "phone": updated.get("phone", ""),
        "state": updated.get("state", ""),
        "company_id": str(cid),
        "company_name": str(cname),
    }

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    user_id = current_user["id"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password does not match")
        
    if len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

    new_hash = hash_password(payload.new_password)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": new_hash}})
    return {"success": True, "message": "Password changed successfully"}

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

