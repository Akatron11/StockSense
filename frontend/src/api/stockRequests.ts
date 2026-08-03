import { authFetch } from "./client";
import type { StockRequestItem } from "../types/stockRequest";

export function listStockRequests(token: string): Promise<StockRequestItem[]> {
  return authFetch<StockRequestItem[]>(token, "/api/stock-requests");
}

export function createStockRequest(token: string, productId: number, quantity: number): Promise<StockRequestItem> {
  return authFetch<StockRequestItem>(token, "/api/stock-requests", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}
