import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { listShifts } from "../api/shifts";
import { listStock } from "../api/stock";
import type { ShiftItem } from "../types/shift";
import type { StockItem } from "../types/stock";

// backend/app/routers/notifications.py::EXPIRING_WITHIN_DAYS ile aynı eşik.
const EXPIRING_WITHIN_DAYS = 7;

// prototype/sef-dashboard.html'in React karşılığı. **Karar (kullanıcı onaylı, PROCESS.md):** mimari
// (madde 331) Operasyon Şefi'ni SKT bildirim hedefi olarak hariç tutuyor — "Karar ver" akışı yok, bu liste
// sadece salt-okunur bilgi amaçlı (asıl indirim/fiyat kararı Seller Manager'ın `price_override` yetkisinde).
export function OperationsChiefDashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [expiringItems, setExpiringItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([listShifts(token), listStock(token)])
      .then(([shiftData, stockData]) => {
        setShifts(shiftData);
        setExpiringItems(
          stockData.filter((item) => {
            if (!item.best_before_date) return false;
            const daysLeft = (new Date(item.best_before_date).getTime() - Date.now()) / 86_400_000;
            return daysLeft >= 0 && daysLeft <= EXPIRING_WITHIN_DAYS;
          }),
        );
      })
      .catch(() => setError(t("reports.dashboardLoadError")))
      .finally(() => setLoading(false));
  }, [token]);

  const workingCount = shifts.filter((s) => !s.is_day_off).length;
  const offCount = shifts.filter((s) => s.is_day_off).length;

  return (
    <AppShell pageTitle={activeLabel}>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div className="muted-small">{t("common.loading")}</div>
      ) : (
        <>
          <section className="cards">
            <div className="card">
              <div className="lbl">{t("reports.opsWorkingCard")}</div>
              <div className="page-title">{workingCount}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.opsPendingExpiryCard")}</div>
              <div className="page-title">{expiringItems.length}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.opsOffCard")}</div>
              <div className="page-title">{offCount}</div>
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">
                {t("reports.todayShiftTitle")} <span className="hint">{t("reports.fromShiftCalendar")}</span>
              </div>
              <div className="panel-body">
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                  <span>{t("reports.colStaff")}</span>
                  <span>{t("reports.colStart")}</span>
                  <span>{t("reports.colEnd")}</span>
                  <span>{t("reports.colStatus")}</span>
                </div>
                {shifts.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    {t("reports.noShiftToday")}
                  </div>
                )}
                {shifts.map((s) => (
                  <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }} key={s.employee_id}>
                    <span>{s.employee_name}</span>
                    <span>{s.start_time?.slice(0, 5) ?? "—"}</span>
                    <span>{s.end_time?.slice(0, 5) ?? "—"}</span>
                    <span className="pill">{s.is_day_off ? t("shifts.off") : t("reports.working")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                {t("reports.expiringProductsTitle")} <span className="hint">{t("reports.infoOnly")}</span>
              </div>
              <div className="panel-body">
                <div className="hintbox">{t("reports.readonlyHint")}</div>
                {expiringItems.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    {t("reports.noExpiring")}
                  </div>
                )}
                {expiringItems.map((item) => (
                  <div className="item" key={item.product_id}>
                    <div className="txt">
                      <span>{item.product_name}</span>
                      <span className="muted-small">{t("reports.bbd", { date: item.best_before_date })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
