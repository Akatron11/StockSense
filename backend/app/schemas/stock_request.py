from datetime import datetime

from pydantic import BaseModel


class StockRequestCreate(BaseModel):
    product_id: int
    quantity: int


class StockRequestOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    branch_id: int
    quantity: int
    requested_by: int
    created_at: datetime
