import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { createStockZone, deleteStockZone, updateStockZone } from "../api/stockZones";
import { ApiError } from "../api/client";
import type { StockZoneOut } from "../types/stockZone";

interface StockZoneFormProps {
  zone: StockZoneOut | null; // null = yeni zone oluşturuluyor
  onSaved: () => void;
  onCancel: () => void;
}

// Stok alanı zone formu — sadece ad + boyut (ZoneEditorForm'un aksine ürün ataması yok, bkz.
// models/layout.py::StockZone). Konum StorePlanCanvas'ta sürüklenir/resize edilir.
export function StockZoneForm({ zone, onSaved, onCancel }: StockZoneFormProps) {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [name, setName] = useState(zone?.name ?? "");
  const [width, setWidth] = useState(String(zone?.width ?? 100));
  const [height, setHeight] = useState(String(zone?.height ?? 60));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!token) return;
    const widthNum = Number(width);
    const heightNum = Number(height);
    if (!name.trim() || !widthNum || !heightNum) {
      setSaveError(t("stockZone.invalidForm"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (zone) {
        await updateStockZone(token, zone.id, { name, width: widthNum, height: heightNum });
      } else {
        await createStockZone(token, { name, width: widthNum, height: heightNum });
      }
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
      await deleteStockZone(token, zone.id);
      onSaved();
    } catch {
      setSaveError(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal-head">{zone ? t("stockZone.editTitle") : t("stockZone.createTitle")}</div>
      <div className="modal-body">
        <div className="field">
          <label>{t("stockZone.nameLabel")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t("stockZone.widthLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("stockZone.heightLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
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
