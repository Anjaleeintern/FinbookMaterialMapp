from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

ALLOWED_MODES = [
    "Royalty Sale",
    "Without Royalty",
    "Credit Sale",
    "Cash Sale",
    "Case Sale",
    "Case sale",
    "QR Sale",
    "HR Loading"
]

class EntryCreate(BaseModel):
    date: str
    challan_no: Optional[str] = None
    vehicle_no: str
    transport_type: str
    type_mode: str
    hr_loading_type: Optional[str] = None
    material_name: str
    party_name: str
    cum: float = 0.0
    etp_no: Optional[str] = ""
    g_wt: float = 0.0
    t_wt: float = 0.0
    net_wt: Optional[float] = None
    rate: float = 0.0
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    gst_rate: Optional[float] = 0.0
    gst_amount: Optional[float] = None
    total_amount: Optional[float] = None
    entry_source: Optional[str] = "manual"

    @field_validator('type_mode')
    @classmethod
    def validate_type_mode(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Type/Mode cannot be empty")
        return trimmed

    @field_validator('hr_loading_type')
    @classmethod
    def validate_hr_loading_type(cls, v: Optional[str]) -> Optional[str]:
        if v:
            trimmed = v.strip()
            if trimmed not in ["Royalty Sale", "With Royalty", "Without Royalty"]:
                raise ValueError("HR Loading Type must be 'Royalty Sale', 'With Royalty', or 'Without Royalty'")
            return trimmed
        return None

    @field_validator('payment_mode')
    @classmethod
    def validate_payment_mode(cls, v: Optional[str]) -> Optional[str]:
        if v:
            trimmed = v.strip()
            if trimmed.lower() == "cash":
                return "Cash"
            if trimmed.lower() == "qr":
                return "QR"
            raise ValueError("Payment Mode must be 'Cash' or 'QR'")
        return None

class EntryOut(BaseModel):
    id: str
    date: str
    challan_no: str
    vehicle_no: str
    transport_type: str
    type_mode: str
    hr_loading_type: Optional[str] = None
    material_name: str
    party_name: str
    cum: float
    etp_no: Optional[str] = ""
    g_wt: float
    t_wt: float
    net_wt: float
    rate: float
    amount: float
    payment_mode: Optional[str] = None
    gst_rate: float
    gst_amount: float
    total_amount: float
    saved_in: str
    entry_source: Optional[str] = "manual"
    created_at: Optional[datetime] = None

class EntrySummary(BaseModel):
    total_entries: int
    by_collection: dict
