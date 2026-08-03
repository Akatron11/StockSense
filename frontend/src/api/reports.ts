import { authFetch } from "./client";
import type { SalesReportOut } from "../types/report";

export function getSalesReport(token: string, days: 7 | 30 | 90): Promise<SalesReportOut> {
  return authFetch<SalesReportOut>(token, `/api/reports/sales?days=${days}`);
}
