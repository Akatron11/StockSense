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
      .catch(() => setError("Pano verisi alınamadı."))
      .finally(() => setLoading(false));
  }, [token]);

  const workingCount = shifts.filter((s) => !s.is_day_off).length;
  const offCount = shifts.filter((s) => s.is_day_off).length;

  return (
    <AppShell pageTitle={activeLabel}>
      {error && <div className="error-text">{error}</div>}
      {loading ? (
        <div className="muted-small">Yükleniyor...</div>
      ) : (
        <>
          <section className="cards">
            <div className="card">
              <div className="lbl">Bugün vardiyadaki personel</div>
              <div className="page-title">{workingCount}</div>
            </div>
            <div className="card">
              <div className="lbl">Bekleyen SKT / indirim bilgisi</div>
              <div className="page-title">{expiringItems.length}</div>
            </div>
            <div className="card">
              <div className="lbl">İzinli / off personel</div>
              <div className="page-title">{offCount}</div>
            </div>
          </section>

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">
                Bugünkü vardiya <span className="hint">Vardiya takviminden</span>
              </div>
              <div className="panel-body">
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                  <span>Personel</span>
                  <span>Başlangıç</span>
                  <span>Bitiş</span>
                  <span>Durum</span>
                </div>
                {shifts.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    Bugün için vardiya kaydı yok.
                  </div>
                )}
                {shifts.map((s) => (
                  <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }} key={s.employee_id}>
                    <span>{s.employee_name}</span>
                    <span>{s.start_time?.slice(0, 5) ?? "—"}</span>
                    <span>{s.end_time?.slice(0, 5) ?? "—"}</span>
                    <span className="pill">{s.is_day_off ? "off" : "vardiyada"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                SKT / indirim yaklaşan ürünler <span className="hint">bilgi amaçlı</span>
              </div>
              <div className="panel-body">
                <div className="hintbox">
                  Bu liste salt-okunur — indirim/fiyat kararı Seller Manager yetkisinde (`price_override`).
                  Operasyon Şefi raf yerleşimi için bilgi amaçlı görür.
                </div>
                {expiringItems.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    Yaklaşan SKT'li ürün yok.
                  </div>
                )}
                {expiringItems.map((item) => (
                  <div className="item" key={item.product_id}>
                    <div className="txt">
                      <span>{item.product_name}</span>
                      <span className="muted-small">SKT: {item.best_before_date}</span>
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
