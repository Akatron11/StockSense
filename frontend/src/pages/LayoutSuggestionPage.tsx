import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { getLayoutSuggestion, applyLayoutSuggestion } from "../api/layoutSuggestion";
import { ApiError } from "../api/client";
import type { LayoutSuggestionOut } from "../types/layoutSuggestion";

// prototype/layout-onerisi.html'in React karşılığı — wireframe'deki "raf 1..raf 12" grid'i
// kullanılmıyor (DB'de gerçek bir raf/planogram kavramı yok, kullanıcı kararı 2026-08-05, bkz.
// docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md). Sadece çift/skor
// listesi + çift bazında "Uygula" gösteriliyor.
export function LayoutSuggestionPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const pageTitle = user ? t(homeLabelForRole(user.role)) : "";

  const [data, setData] = useState<LayoutSuggestionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setData(await getLayoutSuggestion(token));
    } catch {
      setLoadError(t("layoutSuggestion.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  return (
    <AppShell pageTitle={pageTitle}>
      <div className="scope">{t("layoutSuggestion.scopeDesc")}</div>

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
    </AppShell>
  );
}
