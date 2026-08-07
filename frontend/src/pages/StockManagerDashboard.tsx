import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listStock, updateStock } from "../api/stock";
import { ApiError } from "../api/client";
import { useBranchScope } from "../hooks/useBranchScope";
import type { StockItem } from "../types/stock";
import { formatCurrency } from "../utils/currency";

// backend/app/routers/notifications.py::EXPIRING_WITHIN_DAYS ile aynı eşik (madde 11/UC-12).
const EXPIRING_WITHIN_DAYS = 7;

// prototype/stok-manager-dashboard.html'in React karşılığı — Stok Yöneticisi'nin "Ana sayfa"sı zaten şube stok
// listesinin kendisi (ayrı bir rapor/KPI backend'i gerekmiyor, mevcut GET/PATCH /api/stock yeterli).
// Mimari madde 2 — yetki kalıtımı gereği branch_manager/region_manager/general_manager da bu ekranı kullanır
// (2026-08-07); "nav.stockList"/"nav.stock" üzerinden `/stock` route'una da bağlı, sadece stock_manager'ın
// "Ana sayfa"sı değil.
export function StockManagerDashboard() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = t("nav.stockList");
  const { needsSelector, branches, branchId, setBranchId } = useBranchScope(user?.role, token);

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
    if (needsSelector && branchId === undefined) return;
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listStock(token, branchId));
    } catch {
      setLoadError(t("stockManager.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId]);

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
      await updateStock(
        token,
        editing.product_id,
        {
          quantity: Number(quantityInput),
          low_stock_threshold: Number(thresholdInput),
        },
        branchId,
      );
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? t("common.saveFailedWithStatus", { status: err.status }) : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="scope">{needsSelector ? t("stockManager.scopeDescMulti") : t("stockManager.scopeDesc")}</div>

      {needsSelector && (
        <div className="field" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label>{t("stockManager.branchSelectLabel")}</label>
          <select
            className="input"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(Number(e.target.value))}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="cards c3">
        <div className="card">
          <div className="lbl">{t("stockManager.lowStockCard")}</div>
          <div className="page-title">{lowStockCount}</div>
        </div>
        <div className="card">
          <div className="lbl">{t("stockManager.expiringCard")}</div>
          <div className="page-title">{expiringCount}</div>
        </div>
        <div className="card">
          <div className="lbl">{t("stockManager.totalVarietiesCard")}</div>
          <div className="page-title">{items.length}</div>
        </div>
      </section>

      <div className="panel">
        <div className="panel-head">
          {t("stockManager.panelTitle")}
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder={t("stockManager.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="thead stock-row">
                <span>{t("stockManager.colProduct")}</span>
                <span>{t("stockManager.colSku")}</span>
                <span>{t("stockManager.colStock")}</span>
                <span>{t("stockManager.colThreshold")}</span>
                <span>{t("stockManager.colPrice")}</span>
                <span>{t("stockManager.colStatus")}</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
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
                    <span>{formatCurrency(item.effective_price)}</span>
                    <span className="pill">{low ? t("stockManager.low") : t("stockManager.sufficient")}</span>
                    <button className="btn sm ghost" onClick={() => openEdit(item)}>
                      {t("common.edit")}
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
          <div className="modal-head">{t("stockManager.modalTitle")}</div>
          <div className="modal-body">
            <div className="field">
              <label>{t("stockManager.product")}</label>
              <div className="input" style={{ display: "flex", alignItems: "center" }}>
                {editing?.product_name}
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>{t("stockManager.quantityLabel")}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label>{t("stockManager.thresholdLabel")}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                />
              </div>
            </div>
            <div className="hintbox">{t("stockManager.hint")}</div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
