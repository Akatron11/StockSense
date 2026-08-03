// backend/app/schemas/stock.py::StockOut ile birebir eşleşir.
export interface StockItem {
  product_id: number;
  branch_id: number;
  quantity: number;
  low_stock_threshold: number;
  price_override: number | null;
  product_name: string;
  sku: string;
  best_before_date: string | null;
  effective_price: number;
}

export interface StockUpdatePayload {
  quantity?: number;
  low_stock_threshold?: number;
  price_override?: number | null;
}
