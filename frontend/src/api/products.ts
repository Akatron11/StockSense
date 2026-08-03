import { authFetch } from "./client";
import type { ProductCreatePayload, ProductRead, ProductUpdatePayload } from "../types/product";

export function searchProducts(token: string, query: string): Promise<ProductRead[]> {
  return authFetch<ProductRead[]>(token, `/api/products/search?q=${encodeURIComponent(query)}`);
}

export function listProducts(token: string): Promise<ProductRead[]> {
  return authFetch<ProductRead[]>(token, "/api/products");
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
