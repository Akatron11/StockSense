import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { searchProducts } from "../api/products";
import { updateStock } from "../api/stock";
import { createLayoutZone, deleteLayoutZone, updateLayoutZone } from "../api/layoutZones";
import { ApiError } from "../api/client";
import type { LayoutZoneOut, LayoutZoneProduct } from "../types/layoutZone";

interface ZoneEditorFormProps {
  zone: LayoutZoneOut | null; // null = yeni zone oluşturuluyor
  onSaved: () => void;
  onCancel: () => void;
}

// Zone kurma/düzenleme formu (zone editörü B seçeneği — sadece ad/boyut form ile girilir, konum
// StorePlanCanvas'ta sürüklenir). Ürün atama aranabilir/filtrelenebilir seçiciyle yapılır (checklist
// değil — büyük kataloglarda kullanılamaz, bkz. spec karar #5).
// Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
export function ZoneEditorForm({ zone, onSaved, onCancel }: ZoneEditorFormProps) {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [name, setName] = useState(zone?.name ?? "");
  const [width, setWidth] = useState(String(zone?.width ?? 100));
  const [height, setHeight] = useState(String(zone?.height ?? 60));
  const [assigned, setAssigned] = useState<LayoutZoneProduct[]>(zone?.products ?? []);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LayoutZoneProduct[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Create modunda createLayoutZone başarılı olduktan sonra ama ürün ataması (updateStock)
  // başarısız olursa, zone prop'u hala null kalır (parent'tan geliyor, değişmiyor) — bu yüzden
  // retry'de zone'un zaten oluşturulduğunu buradan takip ediyoruz, ikinci kez create'e düşmesin diye.
  const [createdZoneId, setCreatedZoneId] = useState<number | null>(null);

  async function handleSearch() {
    if (!token || !query.trim()) return;
    setSearchError(null);
    try {
      const results = await searchProducts(token, query.trim());
      setSearchResults(results.map((p) => ({ id: p.id, name: p.name })));
    } catch {
      setSearchError(t("layoutZone.searchError"));
    }
  }

  function addProduct(product: LayoutZoneProduct) {
    if (assigned.some((p) => p.id === product.id)) return;
    setAssigned([...assigned, product]);
  }

  function removeProduct(productId: number) {
    setAssigned(assigned.filter((p) => p.id !== productId));
  }

  async function handleSubmit() {
    if (!token) return;
    const widthNum = Number(width);
    const heightNum = Number(height);
    if (!name.trim() || !widthNum || !heightNum) {
      setSaveError(t("layoutZone.invalidForm"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const effectiveZoneId = zone?.id ?? createdZoneId;
      let savedZone: { id: number };
      if (effectiveZoneId) {
        savedZone = await updateLayoutZone(token, effectiveZoneId, { name, width: widthNum, height: heightNum });
      } else {
        savedZone = await createLayoutZone(token, { name, width: widthNum, height: heightNum });
        setCreatedZoneId(savedZone.id);
      }

      const previousIds = zone?.products.map((p) => p.id) ?? [];
      const currentIds = assigned.map((p) => p.id);
      const removedIds = previousIds.filter((id) => !currentIds.includes(id));
      const addedIds = currentIds.filter((id) => !previousIds.includes(id));

      await Promise.all([
        ...removedIds.map((id) => updateStock(token, id, { zone_id: null })),
        ...addedIds.map((id) => updateStock(token, id, { zone_id: savedZone.id })),
      ]);

      onSaved();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? t("common.saveFailedWithStatus", { status: err.status }) : t("common.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !zone) return;
    setSaving(true);
    setSaveError(null);
    try {
      await deleteLayoutZone(token, zone.id);
      onSaved();
    } catch {
      setSaveError(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // Bu bileşen her zaman LayoutSuggestionPage'deki `.overlay > .modal` sarmalayıcısının içinde
  // render edilir (bkz. Task 9) — bu yüzden `.panel` değil `.modal-head`/`.modal-body`/`.modal-foot`
  // kullanıyor (StockManagerDashboard'daki mevcut modal deseniyle tutarlı, iç içe kutu görünümü
  // olmasın diye).
  return (
    <>
      <div className="modal-head">{zone ? t("layoutZone.editTitle") : t("layoutZone.createTitle")}</div>
      <div className="modal-body">
        <div className="field">
          <label>{t("layoutZone.nameLabel")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t("layoutZone.widthLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("layoutZone.heightLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{t("layoutZone.productsLabel")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              placeholder={t("layoutZone.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="btn ghost sm" type="button" onClick={handleSearch}>
              {t("pos.search")}
            </button>
          </div>
          {searchError && <div className="error-text">{searchError}</div>}
          {searchResults.map((p) => (
            <div className="trow" style={{ gridTemplateColumns: "2fr 1fr" }} key={p.id}>
              <span>{p.name}</span>
              <button className="btn ghost sm" type="button" onClick={() => addProduct(p)}>
                {t("layoutZone.addProduct")}
              </button>
            </div>
          ))}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{t("layoutZone.assignedProducts")}</label>
          {assigned.length === 0 && <div className="muted-small">{t("layoutZone.noProductsYet")}</div>}
          {assigned.map((p) => (
            <div className="trow" style={{ gridTemplateColumns: "2fr 1fr" }} key={p.id}>
              <span>{p.name}</span>
              <button className="btn ghost sm" type="button" onClick={() => removeProduct(p.id)}>
                {t("common.remove")}
              </button>
            </div>
          ))}
        </div>

        {saveError && <div className="error-text">{saveError}</div>}
      </div>
      <div className="modal-foot">
        {zone && (
          <button className="btn ghost" type="button" disabled={saving} onClick={handleDelete}>
            {t("common.delete")}
          </button>
        )}
        <button className="btn ghost" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" type="button" disabled={saving} onClick={handleSubmit}>
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </>
  );
}
