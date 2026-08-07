import { authFetch } from "./client";
import type { StockItem, StockUpdatePayload } from "../types/stock";

// branchId sadece region_manager/general_manager için gerekli (kendi branch_id'leri yok, bkz.
// backend/app/routers/stock.py::_resolve_target_branch) — diğer roller kendi şubelerini örtük kullanır.
export function listStock(token: string, branchId?: number): Promise<StockItem[]> {
  const qs = branchId !== undefined ? `?branch_id=${branchId}` : "";
  return authFetch<StockItem[]>(token, `/api/stock${qs}`);
}

export function updateStock(
  token: string,
  productId: number,
  payload: StockUpdatePayload,
  branchId?: number,
): Promise<StockItem> {
  const qs = branchId !== undefined ? `?branch_id=${branchId}` : "";
  return authFetch<StockItem>(token, `/api/stock/${productId}${qs}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
