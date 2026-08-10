from datetime import date

from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    name: str
    sku: str
    category: str | None = None
    default_price: float
    cost_price: float | None = None
    best_before_date: date | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category: str | None = None
    default_price: float | None = None
    cost_price: float | None = None
    best_before_date: date | None = None


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class ProductListOut(BaseModel):
    items: list[ProductRead]
    total: int
