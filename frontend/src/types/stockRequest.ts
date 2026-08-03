// backend/app/schemas/stock_request.py::StockRequestOut ile birebir eşleşir.
export interface StockRequestItem {
  id: number;
  product_id: number;
  product_name: string;
  branch_id: number;
  quantity: number;
  requested_by: number;
  created_at: string;
}
