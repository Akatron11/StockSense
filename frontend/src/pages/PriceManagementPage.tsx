import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listProducts } from "../api/products";
import { listStock, updateStock } from "../api/stock";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";
import type { StockItem } from "../types/stock";

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
      setLoadError("Fiyat listesi alınamadı.");
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
      setSaveError(err instanceof ApiError ? `Kaydedilemedi (${err.status}).` : "Kaydedilemedi.");
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
      setSaveError(err instanceof ApiError ? `Kaldırılamadı (${err.status}).` : "Kaldırılamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle="Fiyat yönetimi">
      <div className="scope">Kapsam: kendi şubesi · boş override → varsayılan fiyat geçerli</div>

      <div className="panel">
        <div className="panel-head">
          Ürün fiyatları
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
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
                <span>Ürün</span>
                <span>Varsayılan</span>
                <span>Şube override</span>
                <span>Geçerli</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  Kayıt yok.
                </div>
              )}
              {filtered.map((row) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }} key={row.product_id}>
                  <span>{row.name}</span>
                  <span>{row.default_price.toFixed(2)}</span>
                  <span>{row.price_override !== null ? row.price_override.toFixed(2) : <span className="pill">yok</span>}</span>
                  <span>{row.effective_price.toFixed(2)}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(row)}>
                    Düzenle
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${editing ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">Şube fiyatı — override</div>
          <div className="modal-body">
            <div className="kv">
              <span>Ürün</span>
              <span>{editing?.name}</span>
            </div>
            <div className="kv">
              <span>Varsayılan fiyat (default_price)</span>
              <span>{editing?.default_price.toFixed(2)}</span>
            </div>
            <div className="field">
              <label>Şube fiyatı (price_override)</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder="boş bırak → varsayılan geçerli"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
              />
            </div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" disabled={saving} onClick={handleClear}>
              Override kaldır
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
