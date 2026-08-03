from datetime import date

from pydantic import BaseModel


class LowStockItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    quantity: int
    threshold: int


class ExpiringItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    best_before_date: date


class NotificationsOut(BaseModel):
    low_stock: list[LowStockItem]
    expiring: list[ExpiringItem]
