import { authFetch, API_BASE_URL, ApiError } from "./client";
import type {
  ProductCreatePayload,
  ProductListOut,
  ProductRead,
  ProductUpdatePayload,
  ImportResult,
} from "../types/product";

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

export async function importProducts(token: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/products/import`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as ImportResult;
}

export async function downloadImportTemplate(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/products/import/template`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => null));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "urun_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
