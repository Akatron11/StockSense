import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import type { SalesReportOut } from "../types/report";

// prototype/genel-mudur-dashboard.html'in React karşılığı. region_manager de aynı bileşeni kullanır
// (navConfig.ts kararı — Bölge Müdürü için ayrı wireframe yoktu, GM deseni bölge kapsamına ölçeklendirildi).
// Backend zaten role'e göre scope'u (region/company) kendisi çözüyor (GET /api/reports/sales).
export function GeneralManagerDashboard() {
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
      .catch(() => setError("Rapor alınamadı."))
      .finally(() => setLoading(false));
  }, [token, days]);

  const breakdownLabel = report?.scope === "region" ? "Şube" : "Bölge";

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="toolbar">
        <div className="scope">Kapsam: {report?.scope_label ?? "..."}</div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">Yükleniyor...</div>
      ) : (
        <>
          <section className="cards">
            <div className="card">
              <div className="lbl">Toplam satış</div>
              <div className="page-title">{report.total_sales.toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="lbl">Net kâr marjı</div>
              <div className="page-title">
                {report.profit_margin_pct !== null ? `%${report.profit_margin_pct.toFixed(1)}` : "—"}
              </div>
              {report.cost_data_coverage_pct < 100 && (
                <div className="muted-small">Maliyet verisi kapsamı: %{report.cost_data_coverage_pct.toFixed(0)}</div>
              )}
            </div>
            <div className="card">
              <div className="lbl">Aktif şube</div>
              <div className="page-title">{report.branch_count}</div>
            </div>
            <div className="card">
              <div className="lbl">Düşük stok (toplam)</div>
              <div className="page-title">{report.low_stock_count}</div>
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">
                Satış trendi <span className="hint">Net satış — son {report.days} gün</span>
              </div>
              <div className="panel-body">
                <SalesTrendChart trend={report.trend} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">{breakdownLabel} kırılımı</div>
              <div className="panel-body">
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <span>{breakdownLabel}</span>
                  <span>Satış</span>
                  <span>Kâr marjı</span>
                </div>
                {report.breakdown.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    Kayıt yok.
                  </div>
                )}
                {report.breakdown.map((b) => (
                  <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr" }} key={b.id}>
                    <span>{b.label}</span>
                    <span>{b.total_sales.toFixed(2)}</span>
                    <span>{b.profit_margin_pct !== null ? `%${b.profit_margin_pct.toFixed(1)}` : "—"}</span>
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
