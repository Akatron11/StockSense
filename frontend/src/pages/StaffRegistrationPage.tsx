import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { createEmployee, listEmployees, updateEmployee } from "../api/employees";
import { apiErrorMessage } from "../api/client";
import type { EmployeeOut } from "../types/employee";

interface FormState {
  first_name: string;
  last_name: string;
  age: string;
  address: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { first_name: "", last_name: "", age: "", address: "", is_active: true };

// prototype/personel-kaydi.html'in React karşılığı (UC-20) — login'siz personel (kasap, manav, raf
// düzenleyici vb.), sadece operations_chief kullanır, sabit role: "staff", username/password/PIN yok.
export function StaffRegistrationPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [staff, setStaff] = useState<EmployeeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<EmployeeOut | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      setStaff(await listEmployees(token));
    } catch {
      setLoadError(t("staff.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = staff.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(employee: EmployeeOut) {
    setEditing(employee);
    setForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      age: String(employee.age),
      address: employee.address,
      is_active: employee.is_active,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await updateEmployee(token, editing.id, {
          first_name: form.first_name,
          last_name: form.last_name,
          age: Number(form.age),
          address: form.address,
          is_active: form.is_active,
        });
      } else {
        await createEmployee(token, {
          first_name: form.first_name,
          last_name: form.last_name,
          role: "staff",
          age: Number(form.age),
          address: form.address,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setSaveError(apiErrorMessage(err, t("common.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={t("nav.staffRecords")}>
      <div className="scope">{t("staff.scopeDesc")}</div>
      <div className="panel">
        <div className="panel-head">
          {t("staff.title")}
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder={t("staff.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn sm primary" onClick={openCreate}>
              {t("staff.newStaff")}
            </button>
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr" }}>
                <span>{t("staff.colName")}</span>
                <span>{t("staff.colAge")}</span>
                <span>{t("staff.colStatus")}</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  {t("common.noRecords")}
                </div>
              )}
              {filtered.map((employee) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr" }} key={employee.id}>
                  <span>{employee.first_name} {employee.last_name}</span>
                  <span>{employee.age}</span>
                  <span className="pill">{employee.is_active ? t("common.active") : t("common.inactive")}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(employee)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${modalOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">{editing ? t("staff.editTitle") : t("staff.createTitle")}</div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label>{t("common.firstName")}</label>
                <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("common.lastName")}</label>
                <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>{t("common.age")}</label>
                <input className="input" type="number" min={0} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("common.address")}</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            {editing && (
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />{" "}
                  {t("staff.activeCheckbox")}
                </label>
              </div>
            )}
            <div className="hintbox">{t("staff.hint")}</div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
