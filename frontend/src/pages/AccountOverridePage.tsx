import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { AppShell } from "../components/AppShell";
import { listEmployeesCompanyWide, resetEmployeePassword } from "../api/employees";
import { apiErrorMessage } from "../api/client";
import type { EmployeeOut } from "../types/employee";

// UC-19 (Şirket IT Override) — Company IT'in kendi şirketindeki HER çalışanın şifresini,
// hiyerarşiden bağımsız olarak sıfırlayabildiği sayfa. EmployeeManagementPage.tsx'in hiyerarşi-
// bazlı create/manage desenine bilinçli olarak karışmıyor (spec karar 5). Kilit açma / zorunlu
// şifre değiştirme / yetki devri kapsam dışı (spec karar 2/3/10). Detay:
// docs/superpowers/specs/2026-08-14-company-it-account-override-design.md
export function AccountOverridePage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [target, setTarget] = useState<EmployeeOut | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setEmployees(await listEmployeesCompanyWide(token));
    } catch {
      setLoadError(t("accountOverride.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.username ?? "").toLowerCase().includes(q)
    );
  });

  function openReset(employee: EmployeeOut) {
    setTarget(employee);
    setNewPassword("");
    setSaveError(null);
  }

  async function handleReset() {
    if (!token || !target) return;
    setSaving(true);
    setSaveError(null);
    try {
      await resetEmployeePassword(token, target.id, { new_password: newPassword });
      setTarget(null);
    } catch (err) {
      setSaveError(apiErrorMessage(err, t("accountOverride.resetFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={t("nav.accountOverride")}>
      <div className="scope">{t("accountOverride.scopeDesc")}</div>
      <div className="panel">
        <div className="panel-head">
          {t("accountOverride.title")}
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder={t("employees.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr .8fr" }}>
                <span>{t("employees.colName")}</span>
                <span>{t("employees.colRole")}</span>
                <span>{t("employees.colUsername")}</span>
                <span>{t("employees.colStatus")}</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
                </div>
              )}
              {filtered.map((employee) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr .8fr" }} key={employee.id}>
                  <span>{employee.first_name} {employee.last_name}</span>
                  <span>{roleLabel(t, employee.role)}</span>
                  <span className="muted-small">{employee.username ?? "—"}</span>
                  <span className="pill">{employee.is_active ? t("common.active") : t("common.inactive")}</span>
                  <button className="btn sm ghost" onClick={() => openReset(employee)}>
                    {t("accountOverride.resetPassword")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${target ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">
            {target ? t("accountOverride.modalTitle", { name: `${target.first_name} ${target.last_name}` }) : ""}
          </div>
          <div className="modal-body">
            <div className="field">
              <label>{t("accountOverride.newPassword")}</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="hintbox">{t("accountOverride.resetHint")}</div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setTarget(null)}>
              {t("common.cancel")}
            </button>
            <button className="btn primary" disabled={saving || !newPassword} onClick={handleReset}>
              {saving ? t("common.saving") : t("accountOverride.resetPassword")}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
