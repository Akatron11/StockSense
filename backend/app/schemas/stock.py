from datetime import date

from pydantic import BaseModel, ConfigDict


class StockUpdate(BaseModel):
    quantity: int | None = None
    low_stock_threshold: int | None = None
    price_override: float | None = None


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    branch_id: int
    quantity: int
    low_stock_threshold: int
    price_override: float | None = None
    product_name: str
    sku: str
    best_before_date: date | None = None
    effective_price: float
