from datetime import date

from pydantic import BaseModel


class SalesTrendPoint(BaseModel):
    day: date
    total_sales: float


class TopProductItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    revenue: float


class BreakdownItem(BaseModel):
    id: int
    label: str
    total_sales: float
    profit_margin_pct: float | None = None


class NeverSoldItem(BaseModel):
    product_id: int
    product_name: str


class SalesReportOut(BaseModel):
    scope: str  # "branch" | "region" | "company"
    scope_label: str
    days: int
    branch_count: int
    low_stock_count: int
    total_sales: float
    transaction_count: int
    profit_margin_pct: float | None = None
    profit_margin_amount: float | None = None
    cost_data_coverage_pct: float
    trend: list[SalesTrendPoint]
    top_products: list[TopProductItem]
    breakdown: list[BreakdownItem]
    least_selling: list[TopProductItem]
    never_sold: list[NeverSoldItem]


class ProductSalesTrendPoint(BaseModel):
    period: str
    quantity: int
    revenue: float


class ProductSalesBreakdownItem(BaseModel):
    id: int
    label: str
    quantity: int
    revenue: float


class ProductSalesOut(BaseModel):
    """Faz 3 "satış takibi" (PROCESS.md, 2026-08-11) — bir ürünün haftalık/aylık/yıllık satış trendi
    (adet + tutar birlikte) ve çağıranın yetki alanı içinde bölge/şube kırılımı."""

    product_id: int
    product_name: str
    scope: str  # "branch" | "region" | "company"
    scope_label: str
    granularity: str  # "week" | "month" | "year"
    trend: list[ProductSalesTrendPoint]
    breakdown: list[ProductSalesBreakdownItem]
