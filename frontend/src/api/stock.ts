import { authFetch } from "./client";
import type { BranchStockItem, StockItem, StockUpdatePayload } from "../types/stock";

// branchId sadece region_manager/general_manager için gerekli (kendi branch_id'leri yok, bkz.
// backend/app/routers/stock.py::_resolve_target_branch) — diğer roller kendi şubelerini örtük kullanır.
export function listStock(token: string, branchId?: number): Promise<StockItem[]> {
  const qs = branchId !== undefined ? `?branch_id=${branchId}` : "";
  return authFetch<StockItem[]>(token, `/api/stock${qs}`);
}

// Faz 3 "quantity takibi" (PROCESS.md, 2026-08-11) — sadece branch_manager/region_manager/general_manager
// çağırabilir (backend::QUANTITY_TRACKING_ROLES), diğer roller 403 alır.
export function listStockByProduct(token: string, productId: number): Promise<BranchStockItem[]> {
  return authFetch<BranchStockItem[]>(token, `/api/stock/product/${productId}/branches`);
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
