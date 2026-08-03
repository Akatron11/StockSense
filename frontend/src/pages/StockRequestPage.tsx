import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { searchProducts } from "../api/products";
import { listStockRequests, createStockRequest } from "../api/stockRequests";
import { ApiError } from "../api/client";
import type { ProductRead } from "../types/product";
import type { StockRequestItem } from "../types/stockRequest";

// prototype/merkez-depo-talebi.html'in React karşılığı (UC-09 — sadece stock_manager). "Durum" sütunu
// wireframe'de "bekliyor"/"geldi" idi ama madde 11 kararı gereği merkez depo sınırsız kaynak, onay/red
// süreci yok — her talep anında karşılanıyor, o yüzden burada sabit "tamamlandı" gösteriliyor.
export function StockRequestPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const activeLabel = user ? t(homeLabelForRole(user.role)) : "";

  const [requests, setRequests] = useState<StockRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ProductRead | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setRequests(await listStockRequests(token));
    } catch {
      setLoadError("Talep listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearchError(null);
    if (!token || !query.trim()) return;
    try {
      const results = await searchProducts(token, query.trim());
      if (results.length === 0) {
        setSearchError("Ürün bulunamadı.");
        setPicked(null);
        return;
      }
      setPicked(results[0]);
    } catch {
      setSearchError("Arama sırasında hata oluştu.");
    }
  }

  async function handleCreateRequest() {
    if (!token || !picked) return;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setSubmitError("Geçerli bir miktar girin.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createStockRequest(token, picked.id, qty);
      setPicked(null);
      setQuery("");
      setQuantity("1");
      await load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? `Talep oluşturulamadı (${err.status}).` : "Talep oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell pageTitle={activeLabel}>
      <div className="scope">Şube stoğu yetersizse ürün merkez depodan getirtilir (fiziksel lojistik kapsam dışı)</div>

      <section className="grid2">
        <div className="panel">
          <div className="panel-head">Yeni talep</div>
          <div className="panel-body">
            <form onSubmit={handleSearch}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Ürün</label>
                <input
                  className="input"
                  placeholder="Ürün ara / SKU"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="btn ghost sm" type="submit">
                Ara
              </button>
            </form>
            {searchError && <div className="error-text">{searchError}</div>}
            {picked && (
              <div className="hintbox" style={{ marginTop: 14 }}>
                Seçili ürün: {picked.name} ({picked.sku})
              </div>
            )}
            <div className="field" style={{ marginTop: 14, marginBottom: 14 }}>
              <label>Miktar</label>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            {submitError && <div className="error-text">{submitError}</div>}
            <button
              className="btn primary block"
              disabled={!picked || submitting}
              onClick={handleCreateRequest}
            >
              {submitting ? "Gönderiliyor..." : "Talep oluştur"}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Talepler</div>
          <div className="panel-body">
            {loadError && <div className="error-text">{loadError}</div>}
            {loading ? (
              <div className="muted-small">Yükleniyor...</div>
            ) : (
              <>
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                  <span>Ürün</span>
                  <span>Miktar</span>
                  <span>Tarih</span>
                  <span>Durum</span>
                </div>
                {requests.length === 0 && (
                  <div className="muted-small" style={{ padding: "12px 0" }}>
                    Henüz talep yok.
                  </div>
                )}
                {requests.map((r) => (
                  <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }} key={r.id}>
                    <span>{r.product_name}</span>
                    <span>{r.quantity}</span>
                    <span className="muted-small">{new Date(r.created_at).toLocaleDateString("tr-TR")}</span>
                    <span className="pill">tamamlandı</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
