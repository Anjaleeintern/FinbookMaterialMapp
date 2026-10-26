from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "admin"
    company_id: Optional[str] = None
    company_name: Optional[str] = None

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = ""
    state: Optional[str] = ""
    company_id: Optional[str] = ""
    company_name: Optional[str] = ""

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    state: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

