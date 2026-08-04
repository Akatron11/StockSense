from datetime import datetime

from pydantic import BaseModel


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int


class SaleCreate(BaseModel):
    items: list[SaleItemIn]
    payment_method: str


class SaleItemOut(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class SaleOut(BaseModel):
    id: int
    branch_id: int
    items: list[SaleItemOut]
    total: float
    payment_method: str
    status: str
    created_at: datetime


class SaleListItem(BaseModel):
    id: int
    sale_date: datetime
    total: float
    payment_method: str


class SaleDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    returnable_quantity: int


class SaleDetail(BaseModel):
    id: int
    sale_date: datetime
    branch_id: int
    total: float
    payment_method: str
    items: list[SaleDetailItem]
