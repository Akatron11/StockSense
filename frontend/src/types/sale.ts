// backend/app/schemas/sale.py ile birebir eşleşir.
export interface SaleItemIn {
  product_id: number;
  quantity: number;
}

export interface SaleItemOut {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface SaleOut {
  id: number;
  branch_id: number;
  items: SaleItemOut[];
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
}
