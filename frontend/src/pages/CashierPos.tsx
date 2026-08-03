import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { searchProducts } from "../api/products";
import { createSale } from "../api/sales";
import { initiateReturn, completeReturn } from "../api/returns";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";
import "../styles/pos.css";

interface CartLine {
  product: ProductRead;
  quantity: number;
}

interface ReturnItemDraft {
  productId: string;
  quantity: string;
}

// prototype/kasiyer-pos.html'in React karşılığı — kasıtlı olarak AppShell/sidebar kullanmıyor (tam ekran POS).
export function CashierPos() {
  const { token, user, logout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [scanQuery, setScanQuery] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<ProductRead | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnItemDraft[]>([{ productId: "", quantity: "1" }]);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [pendingReturnId, setPendingReturnId] = useState<number | null>(null);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [returnPin, setReturnPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  if (!token) return null;

  const subtotal = cart.reduce((sum, line) => sum + line.product.default_price * line.quantity, 0);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setScanError(null);
    if (!scanQuery.trim()) return;
    try {
      const results = await searchProducts(token as string, scanQuery.trim());
      if (results.length === 0) {
        setScanError("Ürün bulunamadı.");
        return;
      }
      const found = results[0];
      setLastScanned(found);
      setCart((prev) => {
        const existing = prev.find((l) => l.product.id === found.id);
        if (existing) {
          return prev.map((l) => (l.product.id === found.id ? { ...l, quantity: l.quantity + 1 } : l));
        }
        return [...prev, { product: found, quantity: 1 }];
      });
      setScanQuery("");
    } catch {
      setScanError("Arama sırasında hata oluştu.");
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
        setSaleError("Sepetteki bazı ürünlerde yeterli stok yok.");
      } else {
        setSaleError("Satış tamamlanamadı.");
      }
    } finally {
      setSaleSubmitting(false);
    }
  }

  async function handleInitiateReturn(e: FormEvent) {
    e.preventDefault();
    setReturnError(null);
    const saleId = Number(returnSaleId);
    if (!saleId) {
      setReturnError("Geçerli bir satış no girin.");
      return;
    }
    const items = returnItems
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ product_id: Number(i.productId), quantity: Number(i.quantity) }));
    if (items.length === 0) {
      setReturnError("En az bir ürün girin.");
      return;
    }
    setReturnSubmitting(true);
    try {
      const ret = await initiateReturn(token as string, saleId, items);
      setPendingReturnId(ret.id);
      setReturnModalOpen(false);
      setPinModalOpen(true);
    } catch (err) {
      setReturnError(err instanceof ApiError ? `İade başlatılamadı (${err.status}).` : "İade başlatılamadı.");
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
      setReturnSaleId("");
      setReturnItems([{ productId: "", quantity: "1" }]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPinError("PIN hatalı.");
      } else {
        setPinError("Onay tamamlanamadı.");
      }
    } finally {
      setPinSubmitting(false);
    }
  }

  const roleText = user ? roleLabel(user.role) : "";

  return (
    <div>
      <header className="posbar">
        <div className="posbar-left">
          <span className="logo-sm">LOGO</span>
          <span className="pos-role">{roleText} · POS</span>
        </div>
        <div className={`usermenu${userMenuOpen ? " open" : ""}`}>
          <div className="avatar" onClick={() => setUserMenuOpen((v) => !v)} />
          <div className="usermenu-pop">
            <div className="um-head">
              <span>{user?.full_name}</span>
              <span className="muted-small">{roleText}</span>
            </div>
            <div className="um-div" />
            <div className="um-row">
              Dil / Language
              <span className="um-lang">
                <span className="on">TR</span>
                <span className="sep" />
                <span>EN</span>
              </span>
            </div>
            {user?.role !== "cashier" && (
              <>
                <div className="um-div" />
                <Link to="/" className="um-row um-row-clickable">
                  Panele dön
                </Link>
              </>
            )}
            <div className="um-div" />
            <div className="um-row um-row-clickable" onClick={logout}>
              Çıkış
            </div>
          </div>
        </div>
      </header>

      <div className="pos">
        <section className="panel pad">
          <form className="scan" onSubmit={handleSearch}>
            <input
              placeholder="Barkod okut / SKU gir"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
            />
            <button className="btn" type="submit">
              Ara
            </button>
          </form>
          {scanError && <div className="pos-error">{scanError}</div>}

          {lastScanned && (
            <div className="scanned">
              <div className="thumb" />
              <div className="info">
                <span>{lastScanned.name}</span>
                <span className="muted-small">{lastScanned.sku}</span>
              </div>
              <span className="skt">SKT: {lastScanned.best_before_date ?? "—"}</span>
            </div>
          )}

          <div className="cart-head">
            <span>Ürün</span>
            <span>Adet</span>
            <span>Birim fiyat</span>
            <span>Tutar</span>
            <span />
          </div>
          {cart.length === 0 && (
            <div className="muted-small" style={{ padding: "12px 0" }}>
              Sepet boş.
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
              <button className="rm" onClick={() => removeLine(line.product.id)} title="Kaldır">
                ×
              </button>
            </div>
          ))}
        </section>

        <aside className="panel pad">
          <div className="totals">
            <div className="trow">
              <span>Ara toplam</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="trow">
              <span>İndirim</span>
              <span>0.00</span>
            </div>
            <div className="trow grand">
              <span>Toplam</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
          </div>
          {lastSaleTotal !== null && (
            <div className="muted-small" style={{ marginTop: 10 }}>
              Son satış tamamlandı — toplam {lastSaleTotal.toFixed(2)}
            </div>
          )}
          <div className="side-actions">
            <button className="btn primary" disabled={cart.length === 0} onClick={() => setPayModalOpen(true)}>
              Satışı tamamla
            </button>
            <button className="btn ghost" onClick={() => setReturnModalOpen(true)}>
              İade / Değişim
            </button>
          </div>
        </aside>
      </div>

      {/* ÖDEME MODALI */}
      <div className={`overlay${payModalOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">Ödeme — satışı tamamla</div>
          <div className="modal-body">
            <div className="kv">
              <span>Toplam</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="field">
              <label>Ödeme yöntemi</label>
              <div className="paytypes">
                <div
                  className={`paytype${paymentMethod === "cash" ? " selected" : ""}`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  Nakit
                </div>
                <div
                  className={`paytype${paymentMethod === "card" ? " selected" : ""}`}
                  onClick={() => setPaymentMethod("card")}
                >
                  Kart
                </div>
              </div>
            </div>
            {saleError && <div className="pos-error">{saleError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setPayModalOpen(false)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={saleSubmitting} onClick={handleCompleteSale}>
              {saleSubmitting ? "Onaylanıyor..." : "Onayla"}
            </button>
          </div>
        </div>
      </div>

      {/* İADE / DEĞİŞİM MODALI */}
      <div className={`overlay${returnModalOpen ? " open" : ""}`}>
        <div className="modal">
          <form onSubmit={handleInitiateReturn}>
            <div className="modal-head">İade / Değişim</div>
            <div className="modal-body">
              <div className="field">
                <label>İşlem (satış) no</label>
                <input
                  className="input"
                  value={returnSaleId}
                  onChange={(e) => setReturnSaleId(e.target.value)}
                  placeholder="Satış ID"
                />
              </div>
              <div>
                <div className="field">
                  <label>İade edilecek ürünler (ürün ID / adet)</label>
                </div>
                <div className="mini-list">
                  {returnItems.map((item, idx) => (
                    <div className="mrow" key={idx}>
                      <input
                        placeholder="Ürün ID"
                        value={item.productId}
                        onChange={(e) => {
                          const next = [...returnItems];
                          next[idx] = { ...next[idx], productId: e.target.value };
                          setReturnItems(next);
                        }}
                      />
                      <input
                        className="qty-input"
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...returnItems];
                          next[idx] = { ...next[idx], quantity: e.target.value };
                          setReturnItems(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setReturnItems([...returnItems, { productId: "", quantity: "1" }])}
                >
                  + Ürün ekle
                </button>
              </div>
              <div className="hintbox">
                Tamamlamak için yetkili onayı (PIN) gerekir — iade, onay anında kesinleşir.
              </div>
              {returnError && <div className="pos-error">{returnError}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setReturnModalOpen(false)}>
                Vazgeç
              </button>
              <button type="submit" className="btn primary" disabled={returnSubmitting}>
                {returnSubmitting ? "Gönderiliyor..." : "Tamamla"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PIN ONAY MODALI */}
      <div className={`overlay${pinModalOpen ? " open" : ""}`}>
        <div className="modal">
          <form onSubmit={handleCompletePin}>
            <div className="modal-head">İade onayı — yetkili PIN</div>
            <div className="modal-body">
              <div className="field">
                <label>Onaylayan PIN (4–6 hane)</label>
                <input
                  className="input"
                  style={{ letterSpacing: "0.5em", width: 160 }}
                  value={returnPin}
                  onChange={(e) => setReturnPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
              <div className="hintbox">
                PIN, o şubede onay yetkisi olan kullanıcıyla eşleştirilir (Stock Manager, Seller Manager,
                Operasyon Şefi ya da yardımcıları).
              </div>
              {pinError && <div className="pos-error">{pinError}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setPinModalOpen(false)}>
                Vazgeç
              </button>
              <button type="submit" className="btn primary" disabled={pinSubmitting}>
                {pinSubmitting ? "Onaylanıyor..." : "Onayla"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
