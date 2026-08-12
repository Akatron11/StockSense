import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listProducts, createProduct, updateProduct } from "../api/products";
import { ApiError } from "../api/client";
import { ProductSalesModal } from "../components/ProductSalesModal";
import type { ProductRead } from "../types/product";
import { formatCurrency } from "../utils/currency";

// backend/app/routers/reports.py::PRODUCT_SALES_ROLES ile birebir eşleşir (Faz 3 "satış takibi",
// PROCESS.md 2026-08-11) — sadece bu 3 rol ürün adına tıklayınca satış popup'ını görebilir.
const PRODUCT_SALES_ROLES = new Set(["branch_manager", "region_manager", "general_manager"]);

interface ProductFormState {
  name: string;
  sku: string;
  category: string;
  default_price: string;
  cost_price: string;
  best_before_date: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type SortColumn = "name" | "sku" | "default_price" | "cost_price";

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
  const { token, user } = useAuth();
  const canViewSales = user ? PRODUCT_SALES_ROLES.has(user.role) : false;

  const [products, setProducts] = useState<ProductRead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[2]);
  const [sortBy, setSortBy] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const [editing, setEditing] = useState<ProductRead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [salesViewFor, setSalesViewFor] = useState<ProductRead | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listProducts(token, {
        q: appliedQuery || undefined,
        page,
        limit: pageSize,
        sortBy,
        sortDir,
      });
      setProducts(res.items);
      setTotal(res.total);
    } catch {
      setLoadError(t("catalog.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, pageSize, sortBy, sortDir, appliedQuery]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedQuery(searchInput.trim());
  }

  function handleSort(column: SortColumn) {
    setPage(1);
    if (column === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  function sortIndicator(column: SortColumn) {
    if (column !== sortBy) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);
  const hasNextPage = page * pageSize < total;

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
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6 }}>
              <input
                className="input"
                style={{ height: 34 }}
                placeholder={t("catalog.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button className="btn sm ghost" type="submit">
                {t("catalog.searchButton")}
              </button>
            </form>
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
                <span className="th-sortable" onClick={() => handleSort("name")}>
                  {t("catalog.colProduct")}
                  {sortIndicator("name")}
                </span>
                <span className="th-sortable" onClick={() => handleSort("sku")}>
                  {t("catalog.colSku")}
                  {sortIndicator("sku")}
                </span>
                <span>{t("catalog.colCategory")}</span>
                <span className="th-sortable" onClick={() => handleSort("default_price")}>
                  {t("catalog.colSalePrice")}
                  {sortIndicator("default_price")}
                </span>
                <span className="th-sortable" onClick={() => handleSort("cost_price")}>
                  {t("catalog.colCost")}
                  {sortIndicator("cost_price")}
                </span>
                <span />
              </div>
              {products.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
                </div>
              )}
              {products.map((product) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr .7fr" }} key={product.id}>
                  <span>
                    {canViewSales ? (
                      <button className="breadcrumb-link" onClick={() => setSalesViewFor(product)}>
                        {product.name}
                      </button>
                    ) : (
                      product.name
                    )}
                  </span>
                  <span className="muted-small">{product.sku}</span>
                  <span>{product.category ?? "—"}</span>
                  <span>{formatCurrency(product.default_price)}</span>
                  <span>{product.cost_price !== null && product.cost_price !== undefined ? formatCurrency(product.cost_price) : "—"}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(product)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
              {total > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                  <button className="btn sm ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    {t("catalog.prev")}
                  </button>
                  <span className="muted-small" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {t("catalog.pageIndicator", { from: rangeFrom, to: rangeTo, total })}
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {t("catalog.pageSizeLabel")}
                      <select
                        className="input"
                        style={{ height: 28, width: "auto" }}
                        value={pageSize}
                        onChange={(e) => {
                          setPage(1);
                          setPageSize(Number(e.target.value));
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                  </span>
                  <button className="btn sm ghost" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
                    {t("catalog.next")}
                  </button>
                </div>
              )}
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

      {salesViewFor && (
        <ProductSalesModal
          productId={salesViewFor.id}
          productName={salesViewFor.name}
          onClose={() => setSalesViewFor(null)}
        />
      )}
    </AppShell>
  );
}
