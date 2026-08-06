import { authFetch } from "./client";
import type { SalesReportOut } from "../types/report";

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
