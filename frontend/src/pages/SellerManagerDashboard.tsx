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

// backend/app/routers/notifications.py::EXPIRING_WITHIN_DAYS ile aynı eşik.
const EXPIRING_WITHIN_DAYS = 7;

// prototype/seller-manager-dashboard.html'in React karşılığı. "Layout önerisi" (co-occurrence/Apriori)
// hiç tasarlanmamış ayrı bir ML özelliği — kapsam dışı bırakıldı, panel yer tutucu olarak kalıyor.
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
      .catch(() => setError("Pano verisi alınamadı."))
      .finally(() => setLoading(false));
  }, [token, days]);

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="toolbar">
        <div className="scope">Kapsam: {report?.scope_label ?? "kendi şubesi"}</div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">Yükleniyor...</div>
      ) : (
        <>
          <section className="cards c3">
            <div className="card">
              <div className="lbl">Satış</div>
              <div className="page-title">{report.total_sales.toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="lbl">SKT / indirim bekleyen</div>
              <div className="page-title">{expiringCount ?? "—"}</div>
            </div>
            <div className="card">
              <div className="lbl">Layout önerisi durumu</div>
              <div className="muted-small">Kapsam dışı (ayrı ML özelliği)</div>
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
              <div className="panel-head">Layout önerisi <span className="hint">co-occurrence / Apriori</span></div>
              <div className="panel-body">
                <div className="muted-small">
                  Bu özellik henüz tasarlanmadı — SRS/mimaride ayrı bir madde olarak bekliyor.
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
