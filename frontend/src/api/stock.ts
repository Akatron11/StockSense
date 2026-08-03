import { authFetch } from "./client";
import type { StockItem, StockUpdatePayload } from "../types/stock";

export function listStock(token: string): Promise<StockItem[]> {
  return authFetch<StockItem[]>(token, "/api/stock");
}

export function updateStock(token: string, productId: number, payload: StockUpdatePayload): Promise<StockItem> {
  return authFetch<StockItem>(token, `/api/stock/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
