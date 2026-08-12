// backend/app/schemas/stock.py::StockOut ile birebir eşleşir.
export interface StockItem {
  product_id: number;
  branch_id: number;
  quantity: number;
  low_stock_threshold: number;
  price_override: number | null;
  zone_id: number | null;
  product_name: string;
  sku: string;
  best_before_date: string | null;
  effective_price: number;
}

// backend/app/schemas/stock.py::BranchStockOut ile birebir eşleşir (Faz 3 "quantity takibi").
// region_id/region_name sadece general_manager'da (company scope) dolu gelir.
export interface BranchStockItem {
  branch_id: number;
  branch_name: string;
  region_id: number | null;
  region_name: string | null;
  quantity: number;
  low_stock_threshold: number;
  effective_price: number;
}

export interface StockUpdatePayload {
  quantity?: number;
  low_stock_threshold?: number;
  price_override?: number | null;
  zone_id?: number | null;
}
