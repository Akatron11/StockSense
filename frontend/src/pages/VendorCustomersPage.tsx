import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { getBranding, getFeatures, listCompanies, updateBranding, updateFeature } from "../api/companies";
import { ApiError } from "../api/client";
import type { BrandingOut, CompanyOut, FeatureOut } from "../types/company";

const FEATURE_LABELS: Record<string, string> = {
  layout_onerisi: "Layout önerisi",
  mobil_app: "Mobil app",
  merkez_depo_senaryosu: "Merkez depo senaryosu",
  kpi_modulu: "KPI modülü",
};

// prototype/satici-yonetici-panel.html'in React karşılığı — sadece "Müşteriler" listesi + "Yönet"
// modalı (UC-22 feature flag'leri + UC-23 branding). Day-0 kurulum (UC-17) ve "rol" konfigürasyonu
// (var olan çalışanla çıkarım yapılıyor, ayrı bir config yok) bu turun kapsamı dışı (kullanıcı kararı,
// 2026-08-03) — nav'daki o iki öğe path'siz bırakıldı.
export function VendorCustomersPage() {
  const { token } = useAuth();

  const [companies, setCompanies] = useState<CompanyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [managing, setManaging] = useState<CompanyOut | null>(null);
  const [features, setFeatures] = useState<FeatureOut[]>([]);
  const [branding, setBranding] = useState<BrandingOut | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setCompanies(await listCompanies(token));
    } catch {
      setLoadError("Müşteri listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = companies.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.subdomain.toLowerCase().includes(q);
  });

  async function openManage(company: CompanyOut) {
    if (!token) return;
    setManaging(company);
    setSaveError(null);
    setModalLoading(true);
    try {
      const [featureData, brandingData] = await Promise.all([
        getFeatures(token, company.id),
        getBranding(token, company.id),
      ]);
      setFeatures(featureData);
      setBranding(brandingData);
    } catch {
      setSaveError("Müşteri detayları alınamadı.");
    } finally {
      setModalLoading(false);
    }
  }

  async function toggleFeature(featureName: string, enabled: boolean) {
    if (!token || !managing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateFeature(token, managing.id, featureName, enabled);
      setFeatures((prev) => prev.map((f) => (f.feature_name === featureName ? { ...f, enabled } : f)));
    } catch (err) {
      setSaveError(err instanceof ApiError ? `Kaydedilemedi (${err.status}).` : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding() {
    if (!token || !managing || !branding) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateBranding(token, managing.id, {
        logo_url: branding.logo_url || null,
        primary_color: branding.primary_color || null,
        display_name: branding.display_name,
      });
      setBranding(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? `Kaydedilemedi (${err.status}).` : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle="Müşteriler (tenant)">
      <div className="scope">Platform yönetimi — tenant üstü</div>
      <div className="panel">
        <div className="panel-head">
          Müşteriler
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder="Ara: şirket / subdomain"
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
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr .8fr" }}>
                <span>Şirket</span>
                <span>Subdomain</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  Kayıt yok.
                </div>
              )}
              {filtered.map((company) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr .8fr" }} key={company.id}>
                  <span>{company.name}</span>
                  <span className="muted-small">{company.subdomain}</span>
                  <button className="btn sm ghost" onClick={() => openManage(company)}>
                    Yönet
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${managing ? " open" : ""}`}>
        <div className="modal lg">
          <div className="modal-head">Müşteri yönetimi — {managing?.name}</div>
          <div className="modal-body">
            {modalLoading ? (
              <div className="muted-small">Yükleniyor...</div>
            ) : (
              <>
                <div className="field">
                  <label>Aktif feature'lar (company_features)</label>
                  {features.map((f) => (
                    <div key={f.feature_name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        disabled={saving}
                        onChange={(e) => toggleFeature(f.feature_name, e.target.checked)}
                      />
                      <span>{FEATURE_LABELS[f.feature_name] ?? f.feature_name}</span>
                    </div>
                  ))}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Logo URL</label>
                    <input
                      className="input"
                      value={branding?.logo_url ?? ""}
                      onChange={(e) => branding && setBranding({ ...branding, logo_url: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Ana renk</label>
                    <input
                      className="input"
                      type="color"
                      value={branding?.primary_color ?? "#000000"}
                      onChange={(e) => branding && setBranding({ ...branding, primary_color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>İşletme adı (branding)</label>
                  <input
                    className="input"
                    value={branding?.display_name ?? ""}
                    onChange={(e) => branding && setBranding({ ...branding, display_name: e.target.value })}
                  />
                </div>
                {saveError && <div className="error-text">{saveError}</div>}
              </>
            )}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setManaging(null)}>
              Kapat
            </button>
            <button className="btn primary" disabled={saving || modalLoading} onClick={saveBranding}>
              {saving ? "Kaydediliyor..." : "Branding'i kaydet"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
