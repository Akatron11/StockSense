// backend/app/schemas/report.py::SalesReportOut ile birebir eşleşir.
export interface SalesTrendPoint {
  day: string;
  total_sales: number;
}

export interface TopProductItem {
  product_id: number;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface BreakdownItem {
  id: number;
  label: string;
  total_sales: number;
  profit_margin_pct: number | null;
}

export interface NeverSoldItem {
  product_id: number;
  product_name: string;
}

export interface SalesReportOut {
  scope: "branch" | "region" | "company";
  scope_label: string;
  days: number;
  branch_count: number;
  low_stock_count: number;
  total_sales: number;
  transaction_count: number;
  profit_margin_pct: number | null;
  profit_margin_amount: number | null;
  cost_data_coverage_pct: number;
  trend: SalesTrendPoint[];
  top_products: TopProductItem[];
  breakdown: BreakdownItem[];
  least_selling: TopProductItem[];
  never_sold: NeverSoldItem[];
}

// backend/app/schemas/report.py::ProductSalesOut ile birebir eşleşir (Faz 3 "satış takibi").
export type ProductSalesGranularity = "week" | "month" | "year";

export interface ProductSalesTrendPoint {
  period: string;
  quantity: number;
  revenue: number;
}

export interface ProductSalesBreakdownItem {
  id: number;
  label: string;
  quantity: number;
  revenue: number;
}

export interface ProductSalesOut {
  product_id: number;
  product_name: string;
  scope: "branch" | "region" | "company";
  scope_label: string;
  granularity: ProductSalesGranularity;
  trend: ProductSalesTrendPoint[];
  breakdown: ProductSalesBreakdownItem[];
}
