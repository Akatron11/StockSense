// backend/app/schemas/notification.py ile birebir eşleşir.
export interface LowStockItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  quantity: number;
  threshold: number;
}

export interface ExpiringItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  best_before_date: string;
}

export interface NotificationsOut {
  low_stock: LowStockItem[];
  expiring: ExpiringItem[];
}
