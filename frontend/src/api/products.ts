import { authFetch } from "./client";
import type { ProductCreatePayload, ProductListOut, ProductRead, ProductUpdatePayload } from "../types/product";

export function searchProducts(token: string, query: string): Promise<ProductRead[]> {
  return authFetch<ProductRead[]>(token, `/api/products/search?q=${encodeURIComponent(query)}`);
}

export interface ListProductsParams {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "sku" | "default_price" | "cost_price";
  sortDir?: "asc" | "desc";
}

export function listProducts(token: string, params: ListProductsParams = {}): Promise<ProductListOut> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.sortBy) search.set("sort_by", params.sortBy);
  if (params.sortDir) search.set("sort_dir", params.sortDir);
  const qs = search.toString();
  return authFetch<ProductListOut>(token, `/api/products${qs ? `?${qs}` : ""}`);
}

export function createProduct(token: string, payload: ProductCreatePayload): Promise<ProductRead> {
  return authFetch<ProductRead>(token, "/api/products", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProduct(token: string, productId: number, payload: ProductUpdatePayload): Promise<ProductRead> {
  return authFetch<ProductRead>(token, `/api/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
