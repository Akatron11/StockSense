from datetime import date
from typing import Literal

from pydantic import BaseModel


class LowStockItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    quantity: int
    threshold: int
    is_read: bool = False


class ExpiringItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    best_before_date: date
    is_read: bool = False


class NotificationsOut(BaseModel):
    low_stock: list[LowStockItem]
    expiring: list[ExpiringItem]


class NotificationReadIn(BaseModel):
    kind: Literal["low_stock", "expiring"]
    product_id: int
    branch_id: int
