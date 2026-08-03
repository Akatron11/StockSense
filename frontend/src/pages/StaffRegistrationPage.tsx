import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { createEmployee, listEmployees, updateEmployee } from "../api/employees";
import { ApiError } from "../api/client";
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
      setLoadError("Personel listesi alınamadı.");
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

  return (
    <AppShell pageTitle="Personel kayıtları">
      <div className="scope">Login'siz personel (kasap, manav, raf düzenleyici vb.) — sadece vardiya amaçlı kayıt</div>
      <div className="panel">
        <div className="panel-head">
          Personel
          <span className="filters">
            <input
              className="input"
              style={{ height: 34 }}
              placeholder="Ara: ad soyad"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn sm primary" onClick={openCreate}>
              Yeni personel
            </button>
          </span>
        </div>
        <div className="panel-body">
          {loadError && <div className="error-text">{loadError}</div>}
          {loading ? (
            <div className="muted-small">Yükleniyor...</div>
          ) : (
            <>
              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr" }}>
                <span>Ad soyad</span>
                <span>Yaş</span>
                <span>Durum</span>
                <span />
              </div>
              {filtered.length === 0 && (
                <div className="muted-small" style={{ padding: "12px 0" }}>
                  Kayıt yok.
                </div>
              )}
              {filtered.map((employee) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr .8fr" }} key={employee.id}>
                  <span>{employee.first_name} {employee.last_name}</span>
                  <span>{employee.age}</span>
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
          <div className="modal-head">{editing ? "Personeli düzenle" : "Login'siz personel kaydı"}</div>
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
            <div className="hintbox">Kullanıcı adı / şifre yok — sisteme giriş yapmaz. Rol: "Personel". Yalnızca vardiya için kayıt.</div>
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setModalOpen(false)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? "Kaydediliyor..." : editing ? "Kaydet" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
