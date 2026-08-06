import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import type { SalesReportOut } from "../types/report";
import { formatCurrency } from "../utils/currency";

// prototype/shube-mudur-dashboard.html'in React karşılığı. Wireframe'de "Bu ay" sabit aralıktı; kullanıcı
// kararıyla seçilebilir aralığa (7/30/90 gün) geçildi (satış raporu backend tasarımı, PROCESS.md).
export function BranchManagerDashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getSalesReport(token, days)
      .then(setReport)
      .catch(() => setError(t("reports.reportLoadError")))
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
          <section className="cards">
            <div className="card">
              <div className="lbl">{t("reports.totalSales")}</div>
              <div className="page-title">{formatCurrency(report.total_sales)}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.netMargin")}</div>
              <div className="page-title">
                {report.profit_margin_pct !== null ? `%${report.profit_margin_pct.toFixed(1)}` : "—"}
              </div>
              {report.cost_data_coverage_pct < 100 && (
                <div className="muted-small">{t("reports.costCoverage", { pct: report.cost_data_coverage_pct.toFixed(0) })}</div>
              )}
            </div>
            <div className="card">
              <div className="lbl">{t("reports.lowStock")}</div>
              <div className="page-title">{report.low_stock_count}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.transactions")}</div>
              <div className="page-title">{report.transaction_count}</div>
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">
                {t("reports.salesTrend")} <span className="hint">{t("reports.netSalesLast", { days: report.days })}</span>
              </div>
              <div className="panel-body">
                <SalesTrendChart trend={report.trend} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">{t("reports.topProducts")}</div>
              <div className="panel-body">
                {report.top_products.length === 0 && <div className="muted-small">{t("reports.noSalesInRange")}</div>}
                {report.top_products.map((p, idx) => (
                  <div className="item" key={p.product_id}>
                    <span className="rank">{idx + 1}</span>
                    <div className="txt">
                      <span>{p.product_name}</span>
                      <span className="muted-small">
                        {p.quantity} adet · {formatCurrency(p.revenue)}
                      </span>
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
