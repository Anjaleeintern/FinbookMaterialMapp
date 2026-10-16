from fastapi import APIRouter, HTTPException, status, Depends
from models.auth_models import UserLogin, UserRegister, Token, UserOut
from services.auth_service import hash_password, verify_password, create_access_token, get_current_user
from database import get_database

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

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
        "role": user.role or "admin"
    }
    result = await db.users.insert_one(user_doc)
    return {
        "id": str(result.inserted_id),
        "email": user_doc["email"],
        "name": user_doc["name"],
        "role": user_doc["role"]
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", "User"),
            "role": user.get("role", "admin")
        }
    }

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"message": "Logged out successfully"}
