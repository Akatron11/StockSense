// backend/app/schemas/product.py::ProductRead ile birebir eşleşir.
export interface ProductRead {
  id: number;
  name: string;
  sku: string;
  category?: string | null;
  default_price: number;
  cost_price?: number | null;
  best_before_date?: string | null;
  is_active: boolean;
}

export interface ProductCreatePayload {
  name: string;
  sku: string;
  category?: string | null;
  default_price: number;
  cost_price?: number | null;
  best_before_date?: string | null;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload>;
