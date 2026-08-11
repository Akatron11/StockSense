// backend/app/routers/reports.py::ROLES_WITH_ACCESS ile birebir eşleşir — stock_manager
// GET /api/reports/sales'e backend'de zaten erişemiyor (403 alır), bu yüzden mobilde de
// rapor tab'ları hiç gösterilmiyor, sadece Bildirimler tab'ı görünür.
const REPORT_ROLES = new Set(["branch_manager", "seller_manager", "region_manager", "general_manager"]);

export function canAccessReports(role: string): boolean {
  return REPORT_ROLES.has(role);
}
