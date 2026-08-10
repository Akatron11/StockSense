import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { listStockZones, updateStockZone } from "../api/stockZones";
import { StorePlanCanvas, type ZonePosition, type ZoneSize } from "../components/StorePlanCanvas";
import { StockZoneForm } from "../components/StockZoneForm";
import type { StockZoneOut } from "../types/stockZone";

// Stock Manager'ın kendi şubesi için stok alanının fiziksel düzenini organize ettiği saf zone
// editörü — Seller Manager'ın mağaza/reyon planından (LayoutSuggestionPage) bilinçli olarak
// bağımsız: öneri/skor/ürün ataması yok, sadece isimli zone'lar + sürükle/resize (bkz.
// models/layout.py::StockZone, kullanıcıyla brainstorming 2026-08-10).
export function StockAreaLayoutPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const pageTitle = user ? t(homeLabelForRole(user.role)) : "";

  const [zones, setZones] = useState<StockZoneOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<number, ZonePosition>>({});
  const [sizes, setSizes] = useState<Record<number, ZoneSize>>({});
  const [editingZone, setEditingZone] = useState<StockZoneOut | "new" | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const zoneList = await listStockZones(token);
      setZones(zoneList);
      setPositions(Object.fromEntries(zoneList.map((z) => [z.id, { x: z.x, y: z.y }])));
      setSizes(Object.fromEntries(zoneList.map((z) => [z.id, { width: z.width, height: z.height }])));
    } catch {
      setLoadError(t("stockZone.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canvasZones = useMemo(
    () =>
      zones.map((z) => {
        const size = sizes[z.id] ?? { width: z.width, height: z.height };
        return { id: z.id, name: z.name, width: size.width, height: size.height };
      }),
    [zones, sizes],
  );

  async function handleDragEnd(zoneId: number, x: number, y: number) {
    if (!token) return;
    try {
      await updateStockZone(token, zoneId, { x, y });
      setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, x, y } : z)));
    } catch {
      setZoneError(t("stockZone.saveFailed"));
      await load();
    }
  }

  async function handleResizeEnd(zoneId: number, width: number, height: number) {
    if (!token) return;
    setSizes((prev) => ({ ...prev, [zoneId]: { width, height } }));
    try {
      await updateStockZone(token, zoneId, { width, height });
      setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, width, height } : z)));
    } catch {
      setZoneError(t("stockZone.saveFailed"));
      await load();
    }
  }

  return (
    <AppShell pageTitle={pageTitle}>
      <div className="scope">{t("stockZone.scopeDesc")}</div>

      <section className="panel">
        <div className="panel-head">{t("stockZone.planTitle")}</div>
        <div className="panel-body">
          {zoneError && <div className="error-text">{zoneError}</div>}
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : zones.length === 0 ? (
            <>
              <div className="muted-small" style={{ padding: "12px 0" }}>
                {t("stockZone.emptyState")}
              </div>
              <button className="btn primary sm" onClick={() => setEditingZone("new")}>
                {t("stockZone.addZone")}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn ghost sm" onClick={() => setEditingZone("new")}>
                  {t("stockZone.addZone")}
                </button>
              </div>

              <StorePlanCanvas
                zones={canvasZones}
                positions={positions}
                onPositionsChange={setPositions}
                onDragEnd={handleDragEnd}
                onResizeEnd={handleResizeEnd}
                overlayLines={[]}
                onScoreChange={() => {}}
              />

              <div className="thead" style={{ gridTemplateColumns: "3fr 1fr", marginTop: 12 }}>
                <span>{t("stockZone.colName")}</span>
                <span>{t("stockZone.colAction")}</span>
              </div>
              {zones.map((z) => (
                <div className="trow" style={{ gridTemplateColumns: "3fr 1fr" }} key={z.id}>
                  <span>{z.name}</span>
                  <button className="btn sm ghost" onClick={() => setEditingZone(z)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <div className={`overlay${editingZone ? " open" : ""}`}>
        {editingZone && (
          <div className="modal">
            <StockZoneForm
              zone={editingZone === "new" ? null : editingZone}
              onCancel={() => setEditingZone(null)}
              onSaved={() => {
                setEditingZone(null);
                load();
              }}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
