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

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
