import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { Avatar } from "../components/Avatar";
import { listProducts, searchProducts } from "../api/products";
import { createSale, getSale, listRecentSales } from "../api/sales";
import { initiateReturn, completeReturn } from "../api/returns";
import { getLoginBranding } from "../api/auth";
import { applyBrandColor } from "../theme/brandColor";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";
import type { SaleDetail, SaleListItem } from "../types/sale";
import "../styles/pos.css";

interface CartLine {
  product: ProductRead;
  quantity: number;
}

function formatSaleDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// prototype/kasiyer-pos.html'in React karşılığı — kasıtlı olarak AppShell/sidebar kullanmıyor (tam ekran POS).
export function CashierPos() {
  const { t, i18n } = useTranslation();
  const { token, user, logout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [scanQuery, setScanQuery] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<ProductRead | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [catalog, setCatalog] = useState<ProductRead[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<SaleListItem[]>([]);
  const [saleListError, setSaleListError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [saleDetailError, setSaleDetailError] = useState<string | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [pendingReturnId, setPendingReturnId] = useState<number | null>(null);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [returnPin, setReturnPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    // AppShell hiç mount olmadığı için (kasiyer doğrudan /pos'a yönlenir) marka rengi/logo burada
    // ayrıca çekilip uygulanıyor — aksi halde POS ekranında hiçbir zaman marka teması görünmezdi.
    getLoginBranding()
      .then((b) => {
        applyBrandColor(b.primary_color);
        setLogoUrl(b.logo_url);
      })
      .catch(() => applyBrandColor(null));
  }, []);

  useEffect(() => {
    if (!token) return;
    listProducts(token)
      .then(setCatalog)
      .catch(() => setCatalogError(t("pos.catalogLoadError")));
  }, [token]);

  useEffect(() => {
    if (!token || !returnModalOpen) return;
    setSaleListError(null);
    listRecentSales(token)
      .then(setRecentSales)
      .catch(() => setSaleListError(t("pos.saleListError")));
  }, [token, returnModalOpen]);

  if (!token) return null;

  const subtotal = cart.reduce((sum, line) => sum + line.product.default_price * line.quantity, 0);

  function addToCart(product: ProductRead) {
    setLastScanned(product);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setScanError(null);
    if (!scanQuery.trim()) return;
    try {
      const results = await searchProducts(token as string, scanQuery.trim());
      if (results.length === 0) {
        setScanError(t("pos.productNotFound"));
        return;
      }
      addToCart(results[0]);
      setScanQuery("");
    } catch {
      setScanError(t("pos.searchError"));
    }
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity < 1) return;
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l)));
  }

  function removeLine(productId: number) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  async function handleCompleteSale() {
    setSaleSubmitting(true);
    setSaleError(null);
    try {
      const sale = await createSale(
        token as string,
        cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        paymentMethod,
      );
      setLastSaleTotal(sale.total);
      setCart([]);
      setLastScanned(null);
      setPayModalOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSaleError(t("pos.insufficientStock"));
      } else {
        setSaleError(t("pos.saleFailed"));
      }
    } finally {
      setSaleSubmitting(false);
    }
  }

  function resetReturnState() {
    setSelectedSale(null);
    setReturnQuantities({});
    setReturnError(null);
    setSaleDetailError(null);
  }

  async function handleSelectSale(saleId: number) {
    setSaleDetailError(null);
    try {
      const detail = await getSale(token as string, saleId);
      setSelectedSale(detail);
      const initial: Record<number, number> = {};
      for (const item of detail.items) {
        if (item.returnable_quantity > 0) initial[item.product_id] = item.returnable_quantity;
      }
      setReturnQuantities(initial);
    } catch {
      setSaleDetailError(t("pos.saleDetailError"));
    }
  }

  function setReturnQuantity(productId: number, quantity: number, max: number) {
    setReturnQuantities((prev) => {
      if (quantity < 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: Math.min(quantity, max) };
    });
  }

  async function handleInitiateReturn(e: FormEvent) {
    e.preventDefault();
    setReturnError(null);
    if (!selectedSale) {
      setReturnError(t("pos.selectSaleFirst"));
      return;
    }
    const items = Object.entries(returnQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ product_id: Number(productId), quantity }));
    if (items.length === 0) {
      setReturnError(t("pos.selectAtLeastOne"));
      return;
    }
    setReturnSubmitting(true);
    try {
      const ret = await initiateReturn(token as string, selectedSale.id, items);
      setPendingReturnId(ret.id);
      setReturnModalOpen(false);
      resetReturnState();
      setPinModalOpen(true);
    } catch (err) {
      setReturnError(
        err instanceof ApiError ? t("pos.returnFailedWithStatus", { status: err.status }) : t("pos.returnFailed"),
      );
    } finally {
      setReturnSubmitting(false);
    }
  }

  async function handleCompletePin(e: FormEvent) {
    e.preventDefault();
    if (!pendingReturnId) return;
    setPinError(null);
    setPinSubmitting(true);
    try {
      await completeReturn(token as string, pendingReturnId, returnPin);
      setPinModalOpen(false);
      setReturnPin("");
      setPendingReturnId(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPinError(t("pos.pinInvalid"));
      } else {
        setPinError(t("pos.completeFailed"));
      }
    } finally {
      setPinSubmitting(false);
    }
  }

  const roleText = user ? roleLabel(t, user.role) : "";

  return (
    <div>
      <header className="posbar">
        <div className="posbar-left">
          <span className="logo-sm">
            {logoUrl ? <img src={logoUrl} alt={t("chrome.logoAlt")} className="logo-sm-img" /> : "LOGO"}
          </span>
          <span className="pos-role">{roleText} · POS</span>
        </div>
        <div className={`usermenu${userMenuOpen ? " open" : ""}`}>
          <Avatar name={user?.full_name} onClick={() => setUserMenuOpen((v) => !v)} />
          <div className="usermenu-pop">
            <div className="um-head">
              <span>{user?.full_name}</span>
              <span className="muted-small">{roleText}</span>
            </div>
            <div className="um-div" />
            <div className="um-row">
              {t("chrome.language")}
              <span className="um-lang">
                <span className={i18n.language === "tr" ? "on" : ""} onClick={() => i18n.changeLanguage("tr")} style={{ cursor: "pointer" }}>
                  TR
                </span>
                <span className="sep" />
                <span className={i18n.language === "en" ? "on" : ""} onClick={() => i18n.changeLanguage("en")} style={{ cursor: "pointer" }}>
                  EN
                </span>
              </span>
            </div>
            {user?.role !== "cashier" && (
              <>
                <div className="um-div" />
                <Link to="/" className="um-row um-row-clickable">
                  {t("pos.backToPanel")}
                </Link>
              </>
            )}
            <div className="um-div" />
            <div className="um-row um-row-clickable" onClick={logout}>
              {t("chrome.logout")}
            </div>
          </div>
        </div>
      </header>

      <div className="pos">
        <section className="panel pad">
          <form className="scan" onSubmit={handleSearch}>
            <input
              placeholder={t("pos.scanPlaceholder")}
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
            />
            <button className="btn" type="submit">
              {t("pos.search")}
            </button>
          </form>
          {scanError && <div className="pos-error">{scanError}</div>}
          {catalogError && <div className="pos-error">{catalogError}</div>}

          {catalog.length > 0 && (
            <div className="product-list">
              {catalog.map((product) => (
                <div className="product-row" key={product.id} onClick={() => addToCart(product)}>
                  <span>{product.name}</span>
                  <span className="muted-small">{product.sku}</span>
                  <span>{product.default_price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {lastScanned && (
            <div className="scanned">
              <div className="thumb" />
              <div className="info">
                <span>{lastScanned.name}</span>
                <span className="muted-small">{lastScanned.sku}</span>
              </div>
              <span className="skt">{t("reports.bbd", { date: lastScanned.best_before_date ?? "—" })}</span>
            </div>
          )}

          <div className="cart-head">
            <span>{t("pos.product")}</span>
            <span>{t("pos.quantity")}</span>
            <span>{t("pos.unitPrice")}</span>
            <span>{t("pos.amount")}</span>
            <span />
          </div>
          {cart.length === 0 && (
            <div className="muted-small" style={{ padding: "12px 0" }}>
              {t("pos.cartEmpty")}
            </div>
          )}
          {cart.map((line) => (
            <div className="cart-row" key={line.product.id}>
              <span>{line.product.name}</span>
              <input
                className="qty-input"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => updateQuantity(line.product.id, Number(e.target.value))}
              />
              <span>{line.product.default_price.toFixed(2)}</span>
              <span>{(line.product.default_price * line.quantity).toFixed(2)}</span>
              <button className="rm" onClick={() => removeLine(line.product.id)} title={t("vendor.remove")}>
                ×
              </button>
            </div>
          ))}
        </section>

        <aside className="panel pad">
          <div className="totals">
            <div className="trow">
              <span>{t("pos.subtotal")}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="trow">
              <span>{t("pos.discount")}</span>
              <span>0.00</span>
            </div>
            <div className="trow grand">
              <span>{t("pos.total")}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
          </div>
          {lastSaleTotal !== null && (
            <div className="muted-small" style={{ marginTop: 10 }}>
              {t("pos.lastSaleCompleted", { total: lastSaleTotal.toFixed(2) })}
            </div>
          )}
          <div className="side-actions">
            <button className="btn primary" disabled={cart.length === 0} onClick={() => setPayModalOpen(true)}>
              {t("pos.completeSale")}
            </button>
            <button className="btn ghost" onClick={() => setReturnModalOpen(true)}>
              {t("pos.returnExchange")}
            </button>
          </div>
        </aside>
      </div>

      {/* ÖDEME MODALI */}
      <div className={`overlay${payModalOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">{t("pos.payModalTitle")}</div>
          <div className="modal-body">
            <div className="kv">
              <span>{t("pos.total")}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="field">
              <label>{t("pos.paymentMethod")}</label>
              <div className="paytypes">
                <div
                  className={`paytype${paymentMethod === "cash" ? " selected" : ""}`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  {t("pos.cash")}
                </div>
                <div
                  className={`paytype${paymentMethod === "card" ? " selected" : ""}`}
                  onClick={() => setPaymentMethod("card")}
                >
                  {t("pos.card")}
                </div>
              </div>
            </div>
            {saleError && <div className="pos-error">{saleError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setPayModalOpen(false)}>
              {t("common.cancel")}
            </button>
            <button className="btn primary" disabled={saleSubmitting} onClick={handleCompleteSale}>
              {saleSubmitting ? t("pos.confirming") : t("pos.confirm")}
            </button>
          </div>
        </div>
      </div>

      {/* İADE / DEĞİŞİM MODALI */}
      <div className={`overlay${returnModalOpen ? " open" : ""}`}>
        <div className="modal">
          <form onSubmit={handleInitiateReturn}>
            <div className="modal-head">{t("pos.returnExchange")}</div>
            <div className="modal-body">
              {!selectedSale && (
                <div>
                  <div className="field">
                    <label>{t("pos.recentSalesLabel")}</label>
                  </div>
                  {saleListError && <div className="pos-error">{saleListError}</div>}
                  {recentSales.length === 0 && !saleListError && (
                    <div className="muted-small">{t("pos.noSalesYet")}</div>
                  )}
                  <div className="mini-list">
                    {recentSales.map((sale) => (
                      <div
                        className="mrow um-row-clickable"
                        key={sale.id}
                        onClick={() => handleSelectSale(sale.id)}
                      >
                        <span>
                          #{sale.id} — {formatSaleDate(sale.sale_date, i18n.language)}
                        </span>
                        <span className="muted-small">
                          {sale.total.toFixed(2)} · {sale.payment_method === "cash" ? t("pos.cash") : t("pos.card")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {saleDetailError && <div className="pos-error">{saleDetailError}</div>}
                </div>
              )}

              {selectedSale && (
                <div>
                  <div className="field">
                    <label>{t("pos.selectedSaleLabel", { id: selectedSale.id, date: formatSaleDate(selectedSale.sale_date, i18n.language) })}</label>
                  </div>
                  <div className="mini-list">
                    {selectedSale.items.map((item) => {
                      const checked = item.product_id in returnQuantities;
                      return (
                        <div className="mrow" key={item.product_id}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: item.returnable_quantity === 0 ? 0.5 : 1 }}>
                            <input
                              type="checkbox"
                              disabled={item.returnable_quantity === 0}
                              checked={checked}
                              onChange={(e) =>
                                setReturnQuantity(
                                  item.product_id,
                                  e.target.checked ? item.returnable_quantity : 0,
                                  item.returnable_quantity,
                                )
                              }
                            />
                            {item.product_name}
                            {item.returnable_quantity === 0 && (
                              <span className="muted-small">{t("pos.alreadyReturned")}</span>
                            )}
                          </label>
                          {checked && (
                            <input
                              className="qty-input"
                              type="number"
                              min={1}
                              max={item.returnable_quantity}
                              value={returnQuantities[item.product_id]}
                              onChange={(e) =>
                                setReturnQuantity(item.product_id, Number(e.target.value), item.returnable_quantity)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" className="btn ghost sm" onClick={resetReturnState}>
                    {t("pos.differentSale")}
                  </button>
                </div>
              )}

              <div className="hintbox">{t("pos.pinHint")}</div>
              {returnError && <div className="pos-error">{returnError}</div>}
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setReturnModalOpen(false);
                  resetReturnState();
                }}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn primary" disabled={returnSubmitting || !selectedSale}>
                {returnSubmitting ? t("pos.submitting") : t("pos.complete")}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PIN ONAY MODALI */}
      <div className={`overlay${pinModalOpen ? " open" : ""}`}>
        <div className="modal">
          <form onSubmit={handleCompletePin}>
            <div className="modal-head">{t("pos.pinModalTitle")}</div>
            <div className="modal-body">
              <div className="field">
                <label>{t("pos.pinLabel")}</label>
                <input
                  className="input"
                  style={{ letterSpacing: "0.5em", width: 160 }}
                  value={returnPin}
                  onChange={(e) => setReturnPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
              <div className="hintbox">{t("pos.pinHintFull")}</div>
              {pinError && <div className="pos-error">{pinError}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setPinModalOpen(false)}>
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn primary" disabled={pinSubmitting}>
                {pinSubmitting ? t("pos.confirming") : t("pos.confirm")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
