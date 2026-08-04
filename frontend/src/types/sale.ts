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

export interface SaleListItem {
  id: number;
  sale_date: string;
  total: number;
  payment_method: string;
}

export interface SaleDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  returnable_quantity: number;
}

export interface SaleDetail {
  id: number;
  sale_date: string;
  branch_id: number;
  total: number;
  payment_method: string;
  items: SaleDetailItem[];
}
