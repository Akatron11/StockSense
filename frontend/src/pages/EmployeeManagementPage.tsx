import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { AppShell } from "../components/AppShell";
import { createEmployee, listEmployees, updateEmployee } from "../api/employees";
import { listBranches, listRegions } from "../api/org";
import { ApiError } from "../api/client";
import type { EmployeeOut } from "../types/employee";
import type { BranchOut, RegionOut } from "../types/org";

// backend/app/routers/employees.py::CREATABLE_ROLES ile birebir eşleşir.
const CREATABLE_ROLES: Record<string, string[]> = {
  branch_manager: ["cashier", "stock_manager", "seller_manager"],
  region_manager: ["branch_manager"],
  general_manager: ["region_manager"],
  company_it: ["general_manager"],
};

// backend/app/services/manager_pin.py::PIN_APPROVER_ROLES ile birebir eşleşir.
const PIN_APPROVER_ROLES = ["stock_manager", "seller_manager", "operations_chief"];

interface FormState {
  first_name: string;
  last_name: string;
  age: string;
  address: string;
  username: string;
  password: string;
  role: string;
  branch_id: string;
  region_id: string;
  manager_pin: string;
  is_active: boolean;
}

function emptyForm(defaultRole: string): FormState {
  return {
    first_name: "",
    last_name: "",
    age: "",
    address: "",
    username: "",
    password: "",
    role: defaultRole,
    branch_id: "",
    region_id: "",
    manager_pin: "",
    is_active: true,
  };
}

// prototype/hesap-yonetimi.html'in React karşılığı. Wireframe sadece branch_manager senaryosunu
// gösteriyordu (hedef her zaman kendi şube, seçici yok) — region_manager/general_manager/company_it
// backend'de aynı /api/employees'i kullandığı için bu sayfa role-agnostic kuruldu (kullanıcı kararı,
// 2026-08-03). region_manager'da hedef şube, general_manager'da hedef bölge seçici eklendi
// (bunun için yeni GET /api/branches ve GET /api/regions endpoint'leri açıldı).
export function EmployeeManagementPage() {
  const { token, user } = useAuth();
  const creatorRole = user?.role ?? "";
  const targetRoles = CREATABLE_ROLES[creatorRole] ?? [];

  const [employees, setEmployees] = useState<EmployeeOut[]>([]);
  const [branches, setBranches] = useState<BranchOut[]>([]);
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<EmployeeOut | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(targetRoles[0] ?? ""));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [emps, branchList, regionList] = await Promise.all([
        listEmployees(token),
        creatorRole === "region_manager" ? listBranches(token) : Promise.resolve([]),
        creatorRole === "general_manager" ? listRegions(token) : Promise.resolve([]),
      ]);
      setEmployees(emps);
      setBranches(branchList);
      setRegions(regionList);
    } catch {
      setLoadError("Hesap listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, creatorRole]);

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.username ?? "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(targetRoles[0] ?? ""));
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(employee: EmployeeOut) {
    setEditing(employee);
    setForm({
      ...emptyForm(employee.role),
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
          ...(form.manager_pin ? { manager_pin: form.manager_pin } : {}),
        });
      } else {
        await createEmployee(token, {
          first_name: form.first_name,
          last_name: form.last_name,
          role: form.role,
          age: Number(form.age),
          address: form.address,
          username: form.username,
          password: form.password,
          branch_id: creatorRole === "region_manager" ? Number(form.branch_id) : undefined,
          region_id: creatorRole === "general_manager" ? Number(form.region_id) : undefined,
          manager_pin: PIN_APPROVER_ROLES.includes(form.role) && form.manager_pin ? form.manager_pin : undefined,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = typeof err.body === "object" && err.body !== null ? (err.body as { detail?: string }).detail : null;
        setSaveError(detail ?? `Kaydedilemedi (${err.status}).`);
      } else {
        setSaveError("Kaydedilemedi.");
      }
    } finally {
      setSaving(false);
    }
  }

  const showRoleSelect = targetRoles.length > 1;
  const canPickPin = !editing && PIN_APPROVER_ROLES.includes(form.role);
  const canEditPin = editing !== null && PIN_APPROVER_ROLES.includes(editing.role);

  return (
    <AppShell pageTitle="Hesap yönetimi">
      <div className="scope">
        Üst seviye, bir alt seviyeyi oluşturur ({roleLabel(creatorRole)} → {targetRoles.map(roleLabel).join(" / ")})
      </div>
      <div className="panel">
        <div className="panel-head">
          Hesaplar
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder="Ara: ad / kullanıcı adı"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn sm primary" onClick={openCreate} disabled={targetRoles.length === 0}>
              Yeni hesap
            </button>
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">Yükleniyor...</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr .8fr" }}>
                <span>Ad</span>
                <span>Rol</span>
                <span>Kullanıcı adı</span>
                <span>Durum</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  Kayıt yok.
                </div>
              )}
              {filtered.map((employee) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr .8fr" }} key={employee.id}>
                  <span>{employee.first_name} {employee.last_name}</span>
                  <span>{roleLabel(employee.role)}</span>
                  <span className="muted-small">{employee.username ?? "—"}</span>
                  <span className="pill">{employee.is_active ? "aktif" : "pasif"}</span>
                  <button className="btn sm ghost" onClick={() => openEdit(employee)}>
                    Düzenle
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={`overlay${modalOpen ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">{editing ? "Hesabı düzenle" : "Yeni hesap oluştur"}</div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label>Ad</label>
                <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Soyad</label>
                <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>

            {!editing && (
              <div className="field">
                <label>Rol (bir alt seviye)</label>
                {showRoleSelect ? (
                  <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {targetRoles.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" value={roleLabel(form.role)} disabled />
                )}
              </div>
            )}

            {!editing && creatorRole === "region_manager" && (
              <div className="field">
                <label>Hedef şube</label>
                <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                  <option value="">Seçiniz...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!editing && creatorRole === "general_manager" && (
              <div className="field">
                <label>Hedef bölge</label>
                <select className="input" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                  <option value="">Seçiniz...</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-grid">
              <div className="field">
                <label>Yaş</label>
                <input className="input" type="number" min={0} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div className="field">
                <label>Adres</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            {!editing && (
              <div className="form-grid">
                <div className="field">
                  <label>Kullanıcı adı</label>
                  <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="field">
                  <label>Geçici şifre</label>
                  <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
            )}

            {(canPickPin || canEditPin) && (
              <div className="field">
                <label>Manager PIN {editing ? "(değiştirmek için doldurun)" : "(iade onayı için)"}</label>
                <input className="input" value={form.manager_pin} onChange={(e) => setForm({ ...form, manager_pin: e.target.value })} />
              </div>
            )}

            {editing && (
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />{" "}
                  Aktif
                </label>
              </div>
            )}

            <div className="hintbox">
              Rol listesi role göre kısıtlıdır: {roleLabel(creatorRole)} sadece {targetRoles.map(roleLabel).join(" / ")} açabilir.
            </div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setModalOpen(false)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? "Kaydediliyor..." : editing ? "Kaydet" : "Oluştur"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
