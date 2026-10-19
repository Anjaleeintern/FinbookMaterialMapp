from pydantic import BaseModel, field_validator
from typing import List, Optional

class MasterItemCreate(BaseModel):
    category: str
    value: str
    status: Optional[str] = "Active"

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = ["VehicleNo", "TransportName", "MaterialName", "PartyName", "Type/Mode"]
        normalized = v.strip()
        if normalized not in allowed:
            raise ValueError(f"Category must be one of: {', '.join(allowed)}")
        return normalized

    @field_validator('value')
    @classmethod
    def validate_value(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Value cannot be empty")
        return trimmed

class MasterItemUpdate(BaseModel):
    value: Optional[str] = None
    status: Optional[str] = None

class MasterItemDetail(BaseModel):
    id: str
    category: str
    value: str
    status: str = "Active"
    is_static: Optional[bool] = False
    sub_types: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class BulkMasterCreate(BaseModel):
    category: str
    items: List[str]
    status: Optional[str] = "Active"

class BulkDeleteRequest(BaseModel):
    ids: Optional[List[str]] = None
    category: Optional[str] = None
    values: Optional[List[str]] = None

class MasterItemOut(BaseModel):
    id: str
    category: str
    value: str
    status: str = "Active"
    is_static: Optional[bool] = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class MasterListResponse(BaseModel):
    VehicleNo: List[str]
    TransportName: List[str]
    MaterialName: List[str]
    PartyName: List[str]
    TypeMode: List[str]

class PasteMasterImportRequest(BaseModel):
    raw_text: str
    default_category: Optional[str] = "VehicleNo"

