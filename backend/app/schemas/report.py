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
