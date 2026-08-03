import { authFetch } from "./client";
import type { ReturnItemIn, ReturnOut } from "../types/return";

export function initiateReturn(
  token: string,
  saleId: number,
  returnedItems: ReturnItemIn[],
  newItems: ReturnItemIn[] = [],
): Promise<ReturnOut> {
  return authFetch<ReturnOut>(token, `/api/sales/${saleId}/returns`, {
    method: "POST",
    body: JSON.stringify({ returned_items: returnedItems, new_items: newItems }),
  });
}

export function completeReturn(token: string, returnId: number, pin: string): Promise<ReturnOut> {
  return authFetch<ReturnOut>(token, `/api/returns/${returnId}/complete`, {
    method: "POST",
    body: JSON.stringify({ manager_pin: pin }),
  });
}
