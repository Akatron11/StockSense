import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import { formatCurrency } from "../utils/currency";
import type { SalesReportOut } from "../types/report";

interface DrillStep {
  id: number;
  label: string;
}

const DRILLABLE_ROLES = new Set(["region_manager", "general_manager"]);

// UC-14 (en çok/az/hiç satılmayan) + UC-13/16 (satış raporu/kâr marjı) tek bir detay sayfasında.
// "Satış raporları" ve "Kâr marjı / KPI" nav öğeleri ikisi de bu sayfaya gider (aynı veri, tek kaynak
// — kullanıcı kararı, bkz. docs/superpowers/specs/2026-08-06-uc14-reports-detail-page-design.md).
// Ana Sayfa dashboard'larındaki top-5/trend kartlarının tekrarı değil, ayrı bir detay sayfası.
// Drill-down (region_manager/general_manager): backend zaten branch_id/region_id destekliyor
// (bkz. docs/superpowers/specs/2026-08-06-currency-and-report-drilldown-design.md) — bu sayfa sadece
// breadcrumb + tıklanabilir kırılım tablosuyla bunu kullanıyor, backend'e dokunulmadı.
export function ReportsDetailPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const canDrill = user ? DRILLABLE_ROLES.has(user.role) : false;

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [rootLabel, setRootLabel] = useState<string>("");
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const isGeneralManager = user?.role === "general_manager";

    // Sadece EN ÜST seviyedeyken (drillPath boş) region_id'ye gerek yok — general_manager şirket
    // geneli, region_manager kendi bölgesi (backend zaten claims'ten çözüyor). Bir seviye indiğinde
    // (drillPath.length === 1): general_manager için bu bir region_id, region_manager için bu bir
    // branch_id (region_manager'ın altında sadece şube var, bölge yok). İki seviye indiğinde
    // (drillPath.length === 2, sadece general_manager): bu her zaman bir branch_id.
    let effectiveBranchId: number | undefined;
    let effectiveRegionId: number | undefined;
    if (drillPath.length === 1) {
      if (isGeneralManager) {
        effectiveRegionId = drillPath[0].id;
      } else {
        effectiveBranchId = drillPath[0].id;
      }
    } else if (drillPath.length === 2) {
      effectiveBranchId = drillPath[1].id;
    }

    getSalesReport(token, days, effectiveBranchId, effectiveRegionId)
      .then((data) => {
        setReport(data);
        if (drillPath.length === 0) setRootLabel(data.scope === "company" ? t("reports.companyWide") : data.scope_label);
      })
      .catch(() => setError(t("reports.reportLoadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days, drillPath]);

  function handleBreakdownClick(id: number, label: string) {
    setDrillPath((prev) => [...prev, { id, label }]);
  }

  function handleBreadcrumbClick(index: number) {
    // index === -1 -> köke dön (drillPath tamamen boşalır); index >= 0 -> o noktaya kadar kes
    setDrillPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  return (
    <AppShell pageTitle={t("nav.salesReports")}>
      <div className="toolbar">
        <div className="scope">
          {canDrill && rootLabel ? (
            <span className="breadcrumb">
              <button className="breadcrumb-link" onClick={() => handleBreadcrumbClick(-1)}>
                {rootLabel}
              </button>
              {drillPath.map((step, idx) => (
                <span key={step.id}>
                  {" › "}
                  <button className="breadcrumb-link" onClick={() => handleBreadcrumbClick(idx)}>
                    {step.label}
                  </button>
                </span>
              ))}
            </span>
          ) : (
            t("reports.scope", {
              label: report?.scope === "company" ? t("reports.companyWide") : report?.scope_label ?? t("reports.defaultScope"),
            })
          )}
        </div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">{t("common.loading")}</div>
      ) : (
        <>
          <section className={`cards${report.profit_margin_pct === null ? " c3" : ""}`}>
            <div className="card">
              <div className="lbl">{t("reports.totalSales")}</div>
              <div className="page-title">{formatCurrency(report.total_sales)}</div>
            </div>
            {report.profit_margin_pct !== null && (
              <div className="card">
                <div className="lbl">{t("reports.netMargin")}</div>
                <div className="page-title">%{report.profit_margin_pct.toFixed(1)}</div>
                {report.cost_data_coverage_pct < 100 && (
                  <div className="muted-small">{t("reports.costCoverage", { pct: report.cost_data_coverage_pct.toFixed(0) })}</div>
                )}
              </div>
            )}
            <div className="card">
              <div className="lbl">{t("reports.lowStock")}</div>
              <div className="page-title">{report.low_stock_count}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.transactions")}</div>
              <div className="page-title">{report.transaction_count}</div>
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

          {canDrill && report.breakdown.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                {t("reports.breakdownTitle", { label: report.scope === "company" ? t("reports.region") : t("reports.branch") })}
              </div>
              <div className="panel-body">
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <span>{report.scope === "company" ? t("reports.region") : t("reports.branch")}</span>
                  <span>{t("reports.sales")}</span>
                  <span>{t("reports.margin")}</span>
                </div>
                {report.breakdown.map((b) => (
                  <button
                    key={b.id}
                    className="trow trow-clickable"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
                    onClick={() => handleBreakdownClick(b.id, b.label)}
                  >
                    <span>{b.label}</span>
                    <span>{formatCurrency(b.total_sales)}</span>
                    <span>{b.profit_margin_pct !== null ? `%${b.profit_margin_pct.toFixed(1)}` : "—"}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">{t("reports.topProducts")}</div>
              <div className="panel-body">
                {report.top_products.length === 0 && <div className="muted-small">{t("reports.noSalesInRange")}</div>}
                {report.top_products.map((p, idx) => (
                  <div className="item" key={p.product_id}>
                    <span className="rank">{idx + 1}</span>
                    <div className="txt">
                      <span>{p.product_name}</span>
                      <span className="muted-small">{p.quantity} {t("reports.quantityUnit")} · {formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">{t("reports.leastSelling")}</div>
              <div className="panel-body">
                {report.least_selling.length === 0 && <div className="muted-small">{t("reports.noSalesInRange")}</div>}
                {report.least_selling.map((p, idx) => (
                  <div className="item" key={p.product_id}>
                    <span className="rank">{idx + 1}</span>
                    <div className="txt">
                      <span>{p.product_name}</span>
                      <span className="muted-small">{p.quantity} {t("reports.quantityUnit")} · {formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">{t("reports.neverSold")}</div>
            <div className="panel-body">
              {report.never_sold.length === 0 && <div className="muted-small">{t("reports.noNeverSoldInRange")}</div>}
              {report.never_sold.map((p) => (
                <div className="item" key={p.product_id}>
                  <span className="txt">{p.product_name}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
