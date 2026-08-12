from datetime import date

from pydantic import BaseModel, ConfigDict


class StockUpdate(BaseModel):
    quantity: int | None = None
    low_stock_threshold: int | None = None
    price_override: float | None = None
    zone_id: int | None = None


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    branch_id: int
    quantity: int
    low_stock_threshold: int
    price_override: float | None = None
    zone_id: int | None = None
    product_name: str
    sku: str
    best_before_date: date | None = None
    effective_price: float


class BranchStockOut(BaseModel):
    """Bir ürünün, çağıranın yetki alanındaki (kendi şube/bölge/şirket) her şubedeki durumu —
    PROCESS.md Faz 3 "quantity takibi" (2026-08-11). region_id/region_name sadece general_manager
    için doldurulur (2026-08-12 eklendi — company scope'ta şube listesini bölgeye göre gruplamak
    için); region_manager/branch_manager'da zaten tek bölge/şube olduğu için None kalır."""

    branch_id: int
    branch_name: str
    region_id: int | None = None
    region_name: str | None = None
    quantity: int
    low_stock_threshold: int
    effective_price: float
