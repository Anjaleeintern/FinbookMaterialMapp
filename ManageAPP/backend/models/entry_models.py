from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

ALLOWED_MODES = [
    "Royalty Sale",
    "Without Royalty",
    "Credit Sale",
    "Cash Sale",
    "Case Sale",
    "Case sale"
]

class EntryCreate(BaseModel):
    date: str
    challan_no: Optional[str] = None
    vehicle_no: str
    transport_type: str
    type_mode: str
    sale_type: Optional[str] = None
    hr_loading_type: Optional[str] = None
    material_name: str
    party_name: Optional[str] = None
    customer_name: Optional[str] = None
    party_state: Optional[str] = None
    cum: float = 0.0
    etp_no: Optional[str] = ""
    g_wt: float = 0.0
    t_wt: float = 0.0
    net_wt: Optional[float] = None
    rate: float = 0.0
    rate_calc_unit: Optional[str] = "MT"
    additional_charge_name: Optional[str] = None
    additional_charge_amount: Optional[float] = 0.0
    additional_charges: Optional[list] = None
    taxable_amount: Optional[float] = None
    amount: Optional[float] = None
    payment_mode: Optional[str] = None
    gst_rate: Optional[float] = 0.0
    gst_amount: Optional[float] = None
    cgst_rate: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_rate: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    igst_rate: Optional[float] = 0.0
    igst_amount: Optional[float] = 0.0
    round_off: Optional[float] = 0.0
    total_amount: Optional[float] = None
    entry_source: Optional[str] = "manual"

    @field_validator('type_mode')
    @classmethod
    def validate_type_mode(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Type/Mode cannot be empty")
        return trimmed


    @field_validator('payment_mode')
    @classmethod
    def validate_payment_mode(cls, v: Optional[str]) -> Optional[str]:
        if v:
            trimmed = v.strip()
            low = trimmed.lower()
            if low == "cash":
                return "Cash"
            if low == "qr":
                return "QR"
            if low == "bank":
                return "Bank"
            raise ValueError("Payment Mode must be 'Cash', 'QR', or 'Bank'")
        return None

class EntryOut(BaseModel):
    id: str
    date: str
    challan_no: str
    vehicle_no: str
    transport_type: str
    type_mode: str
    sale_type: Optional[str] = None
    hr_loading_type: Optional[str] = None
    material_name: str
    party_name: str
    customer_name: Optional[str] = None
    party_state: Optional[str] = None
    cum: float
    etp_no: Optional[str] = ""
    g_wt: float
    t_wt: float
    net_wt: float
    rate: float
    rate_calc_unit: Optional[str] = "MT"
    additional_charge_name: Optional[str] = None
    additional_charge_amount: Optional[float] = 0.0
    additional_charges: Optional[list] = None
    taxable_amount: Optional[float] = None
    amount: float
    payment_mode: Optional[str] = None
    gst_rate: float
    gst_amount: float
    cgst_rate: Optional[float] = 0.0
    cgst_amount: Optional[float] = 0.0
    sgst_rate: Optional[float] = 0.0
    sgst_amount: Optional[float] = 0.0
    igst_rate: Optional[float] = 0.0
    igst_amount: Optional[float] = 0.0
    round_off: Optional[float] = 0.0
    total_amount: float
    saved_in: str
    entry_source: Optional[str] = "manual"
    created_at: Optional[datetime] = None

class EntrySummary(BaseModel):
    total_entries: int
    by_collection: dict
