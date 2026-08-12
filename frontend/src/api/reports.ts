import { authFetch } from "./client";
import type { ProductSalesGranularity, ProductSalesOut, SalesReportOut } from "../types/report";

export function getSalesReport(
  token: string,
  days: 7 | 30 | 90,
  branchId?: number,
  regionId?: number,
): Promise<SalesReportOut> {
  const params = new URLSearchParams({ days: String(days) });
  if (branchId !== undefined) params.set("branch_id", String(branchId));
  if (regionId !== undefined) params.set("region_id", String(regionId));
  return authFetch<SalesReportOut>(token, `/api/reports/sales?${params.toString()}`);
}

// Faz 3 "satış takibi" (PROCESS.md, 2026-08-11) — sadece branch_manager/region_manager/general_manager
// çağırabilir (backend::PRODUCT_SALES_ROLES), diğer roller 403 alır. branchId/regionId — company
// scope'taki bölge kırılımından bir bölgeye "drill-down" için (2026-08-12 eklendi).
export function getProductSales(
  token: string,
  productId: number,
  granularity: ProductSalesGranularity,
  branchId?: number,
  regionId?: number,
): Promise<ProductSalesOut> {
  const params = new URLSearchParams({ granularity });
  if (branchId !== undefined) params.set("branch_id", String(branchId));
  if (regionId !== undefined) params.set("region_id", String(regionId));
  return authFetch<ProductSalesOut>(token, `/api/reports/product-sales/${productId}?${params.toString()}`);
}
