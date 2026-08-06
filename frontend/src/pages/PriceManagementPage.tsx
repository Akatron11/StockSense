import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listProducts } from "../api/products";
import { listStock, updateStock } from "../api/stock";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";
import type { StockItem } from "../types/stock";
import { formatCurrency } from "../utils/currency";

interface PriceRow {
  product_id: number;
  name: string;
  sku: string;
  default_price: number;
  price_override: number | null;
  effective_price: number;
}

// prototype/fiyat-yonetimi.html'in React karşılığı (UC-07 — Seller Manager, kendi şubesi). Backend
// zaten hazırdı (GET /api/products + GET/PATCH /api/stock, price_override zaten sadece seller_manager'a
// açık) — burada sadece frontend eklendi, backend'e dokunulmadı.
export function PriceManagementPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [overrideInput, setOverrideInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [products, stock] = await Promise.all([listProducts(token), listStock(token)]);
      const stockByProduct = new Map<number, StockItem>(stock.map((s) => [s.product_id, s]));
      setRows(
        products.map((p: ProductRead) => {
          const s = stockByProduct.get(p.id);
          return {
            product_id: p.id,
            name: p.name,
            sku: p.sku,
            default_price: p.default_price,
            price_override: s?.price_override ?? null,
            effective_price: s?.effective_price ?? p.default_price,
          };
        }),
      );
    } catch {
      setLoadError(t("price.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
  });

  function openEdit(row: PriceRow) {
    setEditing(row);
    setOverrideInput(row.price_override !== null ? String(row.price_override) : "");
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing || !token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateStock(token, editing.product_id, {
        price_override: overrideInput.trim() === "" ? null : Number(overrideInput),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? t("common.saveFailedWithStatus", { status: err.status }) : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!editing || !token) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateStock(token, editing.product_id, { price_override: null });
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? t("price.removeFailedWithStatus", { status: err.status }) : t("price.removeFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={t("nav.priceManagement")}>
      <div className="scope">{t("price.scopeDesc")}</div>

      <div className="panel">
        <div className="panel-head">
          {t("price.title")}
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder={t("price.searchPlaceholder")}
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
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
                <span>{t("price.colProduct")}</span>
                <span>{t("price.colDefault")}</span>
                <span>{t("price.colOverride")}</span>
                <span>{t("price.colEffective")}</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
                </div>
              )}
              {filtered.map((row) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }} key={row.product_id}>
                  <span>{row.name}</span>
                  <span>{formatCurrency(row.default_price)}</span>
                  <span>{row.price_override !== null ? formatCurrency(row.price_override) : <span className="pill">{t("common.none")}</span>}</span>
                  <span>{formatCurrency(row.effective_price)}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(row)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${editing ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">{t("price.modalTitle")}</div>
          <div className="modal-body">
            <div className="kv">
              <span>{t("price.product")}</span>
              <span>{editing?.name}</span>
            </div>
            <div className="kv">
              <span>{t("price.defaultPrice")}</span>
              <span>{editing?.default_price !== undefined ? formatCurrency(editing.default_price) : ""}</span>
            </div>
            <div className="field">
              <label>{t("price.overrideLabel")}</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder={t("price.overridePlaceholder")}
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
              />
            </div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" disabled={saving} onClick={handleClear}>
              {t("price.removeOverride")}
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
