from datetime import datetime

from pydantic import BaseModel


class ReturnItemIn(BaseModel):
    product_id: int
    quantity: int


class ReturnCreate(BaseModel):
    returned_items: list[ReturnItemIn]
    new_items: list[ReturnItemIn] = []


class ReturnComplete(BaseModel):
    manager_pin: str


class ReturnItemOut(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class ReturnOut(BaseModel):
    id: int
    sale_id: int
    returned_items: list[ReturnItemOut]
    new_items: list[ReturnItemOut]
    net_amount: float
    status: str
    created_at: datetime
    completed_by: int | None = None
    completed_at: datetime | None = None
