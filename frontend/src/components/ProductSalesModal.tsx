import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { getProductSales } from "../api/reports";
import { PeriodTrendChart } from "./PeriodTrendChart";
import { formatCurrency } from "../utils/currency";
import type { ProductSalesGranularity, ProductSalesOut } from "../types/report";

interface ProductSalesModalProps {
  productId: number;
  productName: string;
  onClose: () => void;
}

interface DrillStep {
  id: number;
  label: string;
}

const GRANULARITIES: ProductSalesGranularity[] = ["week", "month", "year"];

// Faz 3 "satış takibi" (PROCESS.md, 2026-08-11) — ProductCatalogPage (general_manager) ve
// StockManagerDashboard'daki (branch_manager/region_manager/general_manager) ürün adına
// tıklanınca açılan popup. Backend zaten role kontrolü yapıyor (PRODUCT_SALES_ROLES) — bu
// bileşen sadece zaten yetkili olduğu bilinen bir çağıran tarafından açılmalı.
// Bölge kırılımından şubelere drill-down (2026-08-12, kullanıcı isteği) — ReportsDetailPage'deki
// aynı breadcrumb deseni (company scope'ta bölge listesi tıklanabilir, o bölgenin şube kırılımını açar).
export function ProductSalesModal({ productId, productName, onClose }: ProductSalesModalProps) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const isGeneralManager = user?.role === "general_manager";

  const [granularity, setGranularity] = useState<ProductSalesGranularity>("week");
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [rootLabel, setRootLabel] = useState("");
  const [data, setData] = useState<ProductSalesOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    // Şu an sadece general_manager'ın company scope'u bir seviye drill-down destekliyor (bölge →
    // şube) — region_manager'ın kendi bölgesi zaten en üst seviye, branch_manager'ın kırılımı hiç yok.
    const effectiveRegionId = drillPath.length === 1 && isGeneralManager ? drillPath[0].id : undefined;

    getProductSales(token, productId, granularity, undefined, effectiveRegionId)
      .then((result) => {
        setData(result);
        if (drillPath.length === 0) {
          setRootLabel(result.scope === "company" ? t("reports.companyWide") : result.scope_label);
        }
      })
      .catch(() => setError(t("productSales.loadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, productId, granularity, drillPath]);

  function handleBreakdownClick(id: number, label: string) {
    if (data?.scope !== "company") return;
    setDrillPath((prev) => [...prev, { id, label }]);
  }

  function handleBreadcrumbClick(index: number) {
    setDrillPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  const breakdownLabel = data?.scope === "company" ? t("reports.region") : t("reports.branch");
  const canDrillBreakdown = data?.scope === "company";

  return (
    <div className="overlay open">
      <div className="modal lg">
        <div className="modal-head">{t("productSales.title", { product: productName })}</div>
        <div className="modal-body">
          <div className="toolbar">
            <div className="scope">
              {rootLabel ? (
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
                data &&
                t("reports.scope", { label: data.scope === "company" ? t("reports.companyWide") : data.scope_label })
              )}
            </div>
            <div className="um-lang">
              {GRANULARITIES.map((g) => (
                <span
                  key={g}
                  className={granularity === g ? "on" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => setGranularity(g)}
                >
                  {t(`productSales.granularity.${g}`)}
                </span>
              ))}
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}
          {loading || !data ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-head">{t("productSales.revenueChart")}</div>
                <div className="panel-body">
                  <PeriodTrendChart
                    points={data.trend.map((p) => ({ period: p.period, value: p.revenue }))}
                    formatValue={formatCurrency}
                  />
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">{t("productSales.quantityChart")}</div>
                <div className="panel-body">
                  <PeriodTrendChart
                    points={data.trend.map((p) => ({ period: p.period, value: p.quantity }))}
                    formatValue={(v) => `${v} ${t("reports.quantityUnit")}`}
                  />
                </div>
              </div>

              {data.breakdown.length > 0 && (
                <div className="panel">
                  <div className="panel-head">{t("productSales.breakdownTitle", { label: breakdownLabel })}</div>
                  <div className="panel-body">
                    <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                      <span>{breakdownLabel}</span>
                      <span>{t("productSales.colQuantity")}</span>
                      <span>{t("reports.sales")}</span>
                    </div>
                    {data.breakdown.map((b) =>
                      canDrillBreakdown ? (
                        <button
                          key={b.id}
                          className="trow trow-clickable"
                          style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
                          onClick={() => handleBreakdownClick(b.id, b.label)}
                        >
                          <span>{b.label}</span>
                          <span>
                            {b.quantity} {t("reports.quantityUnit")}
                          </span>
                          <span>{formatCurrency(b.revenue)}</span>
                        </button>
                      ) : (
                        <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr" }} key={b.id}>
                          <span>{b.label}</span>
                          <span>
                            {b.quantity} {t("reports.quantityUnit")}
                          </span>
                          <span>{formatCurrency(b.revenue)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
