// backend/app/routers/reports.py::ROLES_WITH_ACCESS ile birebir eşleşir — stock_manager
// GET /api/reports/sales'e backend'de zaten erişemiyor (403 alır), bu yüzden mobilde de
// rapor tab'ları hiç gösterilmiyor, sadece Bildirimler tab'ı görünür.
const REPORT_ROLES = new Set(["branch_manager", "seller_manager", "region_manager", "general_manager"]);

export function canAccessReports(role: string): boolean {
  return REPORT_ROLES.has(role);
}

// docs/superpowers/specs/2026-08-11-mobile-companion-app-design.md karar 1 — mobil app sadece
// bu 5 rol için tasarlandı (cashier/company_it/vendor_manager kapsam dışı, backend'de bunlara
// özel bir kısıt yok — Sprint 6 review bulgusu, 2026-08-13: client-side'da eklendi, kullanıcı
// yanlış rolle giriş yapınca boş bir ekranla baş başa kalmasın diye).
const MOBILE_ALLOWED_ROLES = new Set([
  "seller_manager",
  "stock_manager",
  "branch_manager",
  "region_manager",
  "general_manager",
]);

export function isMobileAllowedRole(role: string): boolean {
  return MOBILE_ALLOWED_ROLES.has(role);
}
