from pydantic import BaseModel, field_validator
from .phone_utils import normalize_phone_us
from typing import Optional, List
from datetime import datetime


# ---------- Customer ----------
class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return normalize_phone_us(v)


class CustomerOut(CustomerCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone_us(v) if v else v

# ---------- Service ----------
class ServiceCreate(BaseModel):
    name: str
    price: float


class ServiceOut(ServiceCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True


# ---------- Product ----------
class ProductCreate(BaseModel):
    name: str
    category: str
    cost_to_shop: float = 0.0
    price_to_customer: float = 0.0


class ProductOut(ProductCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True


# ---------- Order Items ----------
class OrderItemCreate(BaseModel):
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    quantity: int = 1
    price_charged: float
    racket_model: Optional[str] = None
    string_tension: Optional[str] = None


class OrderItemOut(OrderItemCreate):
    id: int
    service_name: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Orders ----------
class OrderCreate(BaseModel):
    customer_id: int
    notes: Optional[str] = None
    items: List[OrderItemCreate]


class OrderOut(BaseModel):
    id: int
    customer_id: int
    status: str
    notification_status: str
    total_price: float
    notes: Optional[str] = None
    created_at: datetime
    ready_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    items: List[OrderItemOut] = []
    customer: Optional[CustomerOut] = None
    cancelled_at: Optional[datetime] = None

    class Config:
        from_attributes = True
