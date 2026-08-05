import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listProducts, createProduct, updateProduct } from "../api/products";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";

interface ProductFormState {
  name: string;
  sku: string;
  category: string;
  default_price: string;
  cost_price: string;
  best_before_date: string;
}

const EMPTY_FORM: ProductFormState = {
  name: "",
  sku: "",
  category: "",
  default_price: "",
  cost_price: "",
  best_before_date: "",
};

function toFormState(product: ProductRead): ProductFormState {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category ?? "",
    default_price: String(product.default_price),
    cost_price: product.cost_price !== null && product.cost_price !== undefined ? String(product.cost_price) : "",
    best_before_date: product.best_before_date ?? "",
  };
}

// prototype/urun-katalogu.html'in React karşılığı (UC-06 — sadece general_manager yazabilir, backend
// zaten 403 ile koruyor). Backend'de tam CRUD hazırdı, burada sadece frontend eklendi.
export function ProductCatalogPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [products, setProducts] = useState<ProductRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<ProductRead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setProducts(await listProducts(token));
    } catch {
      setLoadError(t("catalog.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(product: ProductRead) {
    setEditing(product);
    setForm(toFormState(product));
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category || null,
        default_price: Number(form.default_price),
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        best_before_date: form.best_before_date || null,
      };
      if (editing) {
        await updateProduct(token, editing.id, payload);
      } else {
        await createProduct(token, payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? t("common.saveFailedWithStatus", { status: err.status }) : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={t("nav.productCatalog")}>
      <div className="scope">{t("catalog.scopeDesc")}</div>

      <div className="panel">
        <div className="panel-head">
          {t("catalog.title")}
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder={t("catalog.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn sm primary" onClick={openCreate}>
              {t("catalog.newProduct")}
            </button>
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr .7fr" }}>
                <span>{t("catalog.colProduct")}</span>
                <span>{t("catalog.colSku")}</span>
                <span>{t("catalog.colCategory")}</span>
                <span>{t("catalog.colSalePrice")}</span>
                <span>{t("catalog.colCost")}</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
                </div>
              )}
              {filtered.map((product) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr .7fr" }} key={product.id}>
                  <span>{product.name}</span>
                  <span className="muted-small">{product.sku}</span>
                  <span>{product.category ?? "—"}</span>
                  <span>{product.default_price.toFixed(2)}</span>
                  <span>{product.cost_price !== null && product.cost_price !== undefined ? product.cost_price.toFixed(2) : "—"}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(product)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${modalOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">{t("catalog.modalTitle")}</div>
          <div className="modal-body">
            <div className="field">
              <label>{t("catalog.productName")}</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>{t("catalog.sku")}</label>
                <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("catalog.category")}</label>
                <input
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>{t("catalog.salePriceFull")}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.default_price}
                  onChange={(e) => setForm({ ...form, default_price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t("catalog.costFull")}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>{t("catalog.bbd")}</label>
              <input
                className="input"
                type="date"
                value={form.best_before_date}
                onChange={(e) => setForm({ ...form, best_before_date: e.target.value })}
              />
            </div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setModalOpen(false)}>
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
