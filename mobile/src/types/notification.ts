// backend/app/schemas/notification.py ile birebir eşleşir.
export interface LowStockItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  quantity: number;
  threshold: number;
  is_read: boolean;
}

export interface ExpiringItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  best_before_date: string;
  is_read: boolean;
}

export interface NotificationsOut {
  low_stock: LowStockItem[];
  expiring: ExpiringItem[];
}

export type NotificationKind = "low_stock" | "expiring";

export interface NotificationReadIn {
  kind: NotificationKind;
  product_id: number;
  branch_id: number;
}
