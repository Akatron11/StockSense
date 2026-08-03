// backend/app/schemas/return_.py ile birebir eşleşir.
export interface ReturnItemIn {
  product_id: number;
  quantity: number;
}

export interface ReturnItemOut {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface ReturnOut {
  id: number;
  sale_id: number;
  returned_items: ReturnItemOut[];
  new_items: ReturnItemOut[];
  net_amount: number;
  status: string;
  created_at: string;
  completed_by: number | null;
  completed_at: string | null;
}
