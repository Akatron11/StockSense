import { authFetch } from "./client";
import type { SaleDetail, SaleItemIn, SaleListItem, SaleOut } from "../types/sale";

export function createSale(token: string, items: SaleItemIn[], paymentMethod: string): Promise<SaleOut> {
  return authFetch<SaleOut>(token, "/api/sales", {
    method: "POST",
    body: JSON.stringify({ items, payment_method: paymentMethod }),
  });
}

export function listRecentSales(token: string): Promise<SaleListItem[]> {
  return authFetch<SaleListItem[]>(token, "/api/sales");
}

export function getSale(token: string, saleId: number): Promise<SaleDetail> {
  return authFetch<SaleDetail>(token, `/api/sales/${saleId}`);
}
