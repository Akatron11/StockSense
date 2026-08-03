import { authFetch } from "./client";
import type { SaleItemIn, SaleOut } from "../types/sale";

export function createSale(token: string, items: SaleItemIn[], paymentMethod: string): Promise<SaleOut> {
  return authFetch<SaleOut>(token, "/api/sales", {
    method: "POST",
    body: JSON.stringify({ items, payment_method: paymentMethod }),
  });
}
