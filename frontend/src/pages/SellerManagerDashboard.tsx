import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import { listStock } from "../api/stock";
import type { SalesReportOut } from "../types/report";
import { formatCurrency } from "../utils/currency";

// backend/app/routers/notifications.py::EXPIRING_WITHIN_DAYS ile aynı eşik.
const EXPIRING_WITHIN_DAYS = 7;

// prototype/seller-manager-dashboard.html'in React karşılığı.
export function SellerManagerDashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getSalesReport(token, days),
      listStock(token).then((items) =>
        items.filter((item) => {
          if (!item.best_before_date) return false;
          const daysLeft = (new Date(item.best_before_date).getTime() - Date.now()) / 86_400_000;
          return daysLeft >= 0 && daysLeft <= EXPIRING_WITHIN_DAYS;
        }).length,
      ),
    ])
      .then(([reportData, expiring]) => {
        setReport(reportData);
        setExpiringCount(expiring);
      })
      .catch(() => setError(t("reports.dashboardLoadError")))
      .finally(() => setLoading(false));
  }, [token, days]);

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="toolbar">
        <div className="scope">{t("reports.scope", { label: report?.scope_label ?? t("reports.defaultScope") })}</div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">{t("common.loading")}</div>
      ) : (
        <>
          <section className="cards c2">
            <div className="card">
              <div className="lbl">{t("reports.sellerSalesCard")}</div>
              <div className="page-title">{formatCurrency(report.total_sales)}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.expiringDiscountCard")}</div>
              <div className="page-title">{expiringCount ?? "—"}</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              {t("reports.salesTrend")} <span className="hint">{t("reports.netSalesLast", { days: report.days })}</span>
            </div>
            <div className="panel-body">
              <SalesTrendChart trend={report.trend} />
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
