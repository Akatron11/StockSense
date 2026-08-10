import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { getLayoutSuggestion, applyLayoutSuggestion } from "../api/layoutSuggestion";
import { listLayoutZones, updateLayoutZone } from "../api/layoutZones";
import { StorePlanCanvas, type OverlayLine, type ZonePosition, type ZoneSize } from "../components/StorePlanCanvas";
import { ZoneEditorForm } from "../components/ZoneEditorForm";
import { ApiError } from "../api/client";
import type { LayoutSuggestionOut } from "../types/layoutSuggestion";
import type { LayoutZoneOut } from "../types/layoutZone";

// prototype/layout-onerisi.html'in React karşılığı — wireframe'deki "raf 1..raf 12" grid'i
// kullanılmıyor (DB'de gerçek bir raf/planogram kavramı yoktu, kullanıcı kararı 2026-08-05).
// 2026-08-07'de SHOULD (floor-plan/zone görselleştirme) + COULD (simülasyon) eklendi — bkz.
// docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md. MUST (çift/skor
// listesi + "Uygula") değişmedi, plan bölümü onun üzerine eklendi.
export function LayoutSuggestionPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const pageTitle = user ? t(homeLabelForRole(user.role)) : "";

  const [data, setData] = useState<LayoutSuggestionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [zones, setZones] = useState<LayoutZoneOut[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [positions, setPositions] = useState<Record<number, ZonePosition>>({});
  const [sizes, setSizes] = useState<Record<number, ZoneSize>>({});
  const [editingZone, setEditingZone] = useState<LayoutZoneOut | "new" | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [zoneLoadError, setZoneLoadError] = useState<string | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [baselineScore, setBaselineScore] = useState<number | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    setZonesLoading(true);
    setZoneLoadError(null);
    const suggestionPromise = (async () => {
      try {
        const suggestion = await getLayoutSuggestion(token);
        setData(suggestion);
      } catch {
        setLoadError(t("layoutSuggestion.loadError"));
      } finally {
        setLoading(false);
      }
    })();
    const zonePromise = (async () => {
      try {
        const zoneList = await listLayoutZones(token);
        setZones(zoneList);
        setPositions(Object.fromEntries(zoneList.map((z) => [z.id, { x: z.x, y: z.y }])));
        setSizes(Object.fromEntries(zoneList.map((z) => [z.id, { width: z.width, height: z.height }])));
      } catch {
        setZoneLoadError(t("layoutZone.loadError"));
      } finally {
        setZonesLoading(false);
      }
    })();
    await Promise.all([suggestionPromise, zonePromise]);
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

  const overlayLines: OverlayLine[] = useMemo(
    () =>
      (data?.suggestions ?? [])
        .filter(
          (s) =>
            s.product_a_zone_id !== null &&
            s.product_b_zone_id !== null &&
            s.product_a_zone_id !== s.product_b_zone_id,
        )
        .map((s) => ({
          key: `${s.product_a_id}-${s.product_b_id}`,
          zoneAId: s.product_a_zone_id,
          zoneBId: s.product_b_zone_id,
          score: s.score,
          productAName: s.product_a_name,
          productBName: s.product_b_name,
        })),
    [data],
  );

  async function handleDragEnd(zoneId: number, x: number, y: number) {
    if (simulating || !token) return;
    try {
      await updateLayoutZone(token, zoneId, { x, y });
      setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, x, y } : z)));
    } catch {
      setZoneError(t("layoutZone.saveFailed"));
      await load();
    }
  }

  async function handleResizeEnd(zoneId: number, width: number, height: number) {
    if (simulating || !token) return;
    try {
      await updateLayoutZone(token, zoneId, { width, height });
      setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, width, height } : z)));
    } catch {
      setZoneError(t("layoutZone.saveFailed"));
      await load();
    }
  }

  function handleToggleSimulation() {
    if (!simulating) {
      setBaselineScore(liveScore);
      setSimulating(true);
    } else {
      setPositions(Object.fromEntries(zones.map((z) => [z.id, { x: z.x, y: z.y }])));
      setSizes(Object.fromEntries(zones.map((z) => [z.id, { width: z.width, height: z.height }])));
      setSimulating(false);
      setBaselineScore(null);
    }
  }

  async function handleSaveSimulation() {
    if (!token) return;
    const changed = zones.filter((z) => {
      const pos = positions[z.id];
      const size = sizes[z.id];
      return (pos && (pos.x !== z.x || pos.y !== z.y)) || (size && (size.width !== z.width || size.height !== z.height));
    });
    setZoneError(null);
    try {
      await Promise.all(
        changed.map((z) =>
          updateLayoutZone(token, z.id, {
            x: positions[z.id]?.x ?? z.x,
            y: positions[z.id]?.y ?? z.y,
            width: sizes[z.id]?.width ?? z.width,
            height: sizes[z.id]?.height ?? z.height,
          }),
        ),
      );
      setSimulating(false);
      setBaselineScore(null);
      await load();
    } catch {
      setZoneError(t("layoutZone.saveFailed"));
    }
  }

  async function handleApply(productAId: number, productBId: number) {
    if (!token) return;
    const key = `${productAId}-${productBId}`;
    setApplyingKey(key);
    setApplyError(null);
    try {
      await applyLayoutSuggestion(token, productAId, productBId);
      await load();
    } catch (err) {
      setApplyError(
        err instanceof ApiError
          ? t("layoutSuggestion.applyFailedWithStatus", { status: err.status })
          : t("layoutSuggestion.applyFailed"),
      );
    } finally {
      setApplyingKey(null);
    }
  }

  const scoreDelta = baselineScore !== null && liveScore !== null ? liveScore - baselineScore : null;

  return (
    <AppShell pageTitle={pageTitle}>
      <div className="scope">{t("layoutSuggestion.scopeDesc")}</div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          {t("layoutZone.planTitle")}
          {liveScore !== null ? (
            <span className="hint">
              {simulating && baselineScore !== null
                ? t("layoutZone.scoreSimulating", { baseline: baselineScore, live: liveScore, delta: scoreDelta })
                : t("layoutZone.scoreLabel", { score: liveScore })}
            </span>
          ) : (
            zones.length > 0 && <span className="hint">{t("layoutZone.scoreUnavailable")}</span>
          )}
        </div>
        <div className="panel-body">
          {zoneError && <div className="error-text">{zoneError}</div>}
          {zoneLoadError && <div className="error-text">{zoneLoadError}</div>}
          {zonesLoading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : zones.length === 0 ? (
            <>
              <div className="muted-small" style={{ padding: "12px 0" }}>
                {t("layoutZone.emptyState")}
              </div>
              <button className="btn primary sm" onClick={() => setEditingZone("new")}>
                {t("layoutZone.addZone")}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn ghost sm" onClick={() => setEditingZone("new")}>
                  {t("layoutZone.addZone")}
                </button>
                <button className="btn ghost sm" onClick={handleToggleSimulation}>
                  {simulating ? t("layoutZone.exitSimulation") : t("layoutZone.startSimulation")}
                </button>
                {simulating && (
                  <button className="btn primary sm" onClick={handleSaveSimulation}>
                    {t("common.save")}
                  </button>
                )}
              </div>

              <StorePlanCanvas
                zones={canvasZones}
                positions={positions}
                onPositionsChange={setPositions}
                onDragEnd={handleDragEnd}
                onResizeEnd={(zoneId, width, height) => {
                  setSizes((prev) => ({ ...prev, [zoneId]: { width, height } }));
                  handleResizeEnd(zoneId, width, height);
                }}
                overlayLines={overlayLines}
                onScoreChange={setLiveScore}
              />

              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr", marginTop: 12 }}>
                <span>{t("layoutZone.colName")}</span>
                <span>{t("layoutZone.colProductCount")}</span>
                <span>{t("layoutZone.colAction")}</span>
              </div>
              {zones.map((z) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr" }} key={z.id}>
                  <span>{z.name}</span>
                  <span>{z.products.length}</span>
                  <button className="btn sm ghost" onClick={() => setEditingZone(z)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          {data ? t("layoutSuggestion.computedFromSales") : ""}
          {data && (
            <span className="hint">{t("layoutSuggestion.salesCount", { total: data.branch_sales_count })}</span>
          )}
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {applyError && <div className="error-text">{applyError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "3fr 1fr 1fr" }}>
                <span>{t("layoutSuggestion.colPair")}</span>
                <span>{t("layoutSuggestion.colScore")}</span>
                <span>{t("layoutSuggestion.colAction")}</span>
              </div>
              {data?.suggestions.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("layoutSuggestion.noSuggestionsYet")}
                </div>
              )}
              {data?.suggestions.map((s) => {
                const key = `${s.product_a_id}-${s.product_b_id}`;
                return (
                  <div className="trow" style={{ gridTemplateColumns: "3fr 1fr 1fr" }} key={key}>
                    <span>
                      {s.product_a_name} ↔ {s.product_b_name}
                    </span>
                    <span>{Math.round(s.score * 100)}%</span>
                    <span>
                      {s.applied ? (
                        <span className="pill">{t("layoutSuggestion.applied")}</span>
                      ) : (
                        <button
                          className="btn ghost sm"
                          disabled={applyingKey === key}
                          onClick={() => handleApply(s.product_a_id, s.product_b_id)}
                        >
                          {t("layoutSuggestion.apply")}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      <div className={`overlay${editingZone ? " open" : ""}`}>
        {editingZone && (
          <div className="modal">
            <ZoneEditorForm
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
