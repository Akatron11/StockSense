import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { listStock, updateStock } from "../api/stock";
import { ApiError } from "../api/client";
import type { StockItem } from "../types/stock";

// backend/app/routers/notifications.py::EXPIRING_WITHIN_DAYS ile aynı eşik (madde 11/UC-12).
const EXPIRING_WITHIN_DAYS = 7;

// prototype/stok-manager-dashboard.html'in React karşılığı — Stok Yöneticisi'nin "Ana sayfa"sı zaten şube stok
// listesinin kendisi (ayrı bir rapor/KPI backend'i gerekmiyor, mevcut GET/PATCH /api/stock yeterli).
export function StockManagerDashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<StockItem | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listStock(token));
    } catch {
      setLoadError("Stok listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.product_name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
  });

  const lowStockCount = items.filter((item) => item.quantity < item.low_stock_threshold).length;
  const expiringCount = items.filter((item) => {
    if (!item.best_before_date) return false;
    const days = (new Date(item.best_before_date).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= EXPIRING_WITHIN_DAYS;
  }).length;

  function openEdit(item: StockItem) {
    setEditing(item);
    setQuantityInput(String(item.quantity));
    setThresholdInput(String(item.low_stock_threshold));
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing || !token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateStock(token, editing.product_id, {
        quantity: Number(quantityInput),
        low_stock_threshold: Number(thresholdInput),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? `Kaydedilemedi (${err.status}).` : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="scope">Kapsam: kendi şubesi</div>

      <section className="cards c3">
        <div className="card">
          <div className="lbl">Düşük stoktaki ürün</div>
          <div className="page-title">{lowStockCount}</div>
        </div>
        <div className="card">
          <div className="lbl">SKT yaklaşan ürün</div>
          <div className="page-title">{expiringCount}</div>
        </div>
        <div className="card">
          <div className="lbl">Toplam ürün çeşidi</div>
          <div className="page-title">{items.length}</div>
        </div>
      </section>

      <div className="panel">
        <div className="panel-head">
          Şube stoğu
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder="Ara: ürün / SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">Yükleniyor...</div>
          ) : (
            <>
              <div className="thead stock-row">
                <span>Ürün</span>
                <span>SKU</span>
                <span>Stok</span>
                <span>Eşik</span>
                <span>Fiyat</span>
                <span>Durum</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  Kayıt yok.
                </div>
              )}
              {filtered.map((item) => {
                const low = item.quantity < item.low_stock_threshold;
                return (
                  <div className="trow stock-row" key={item.product_id}>
                    <span>{item.product_name}</span>
                    <span className="muted-small">{item.sku}</span>
                    <span>{item.quantity}</span>
                    <span>{item.low_stock_threshold}</span>
                    <span>{item.effective_price.toFixed(2)}</span>
                    <span className="pill">{low ? "düşük" : "yeterli"}</span>
                    <button className="btn sm ghost" onClick={() => openEdit(item)}>
                      Düzenle
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${editing ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">Stok / düşük stok eşiği düzenle</div>
          <div className="modal-body">
            <div className="field">
              <label>Ürün</label>
              <div className="input" style={{ display: "flex", alignItems: "center" }}>
                {editing?.product_name}
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Stok miktarı</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Düşük stok eşiği</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                />
              </div>
            </div>
            <div className="hintbox">
              Eşik ürün bazlı yapılandırılır; stok bu değerin altına düşünce ilgili role bildirim gider.
            </div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setEditing(null)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
