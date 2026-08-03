import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { assignShift, listRoster, listWeekShifts } from "../api/shifts";
import { ApiError } from "../api/client";
import type { RosterEmployee, ShiftItem, ShiftUpsertPayload } from "../types/shift";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// d.toISOString() UTC'ye çevirir — yerel saat UTC'den ileriyse (örn. TR, UTC+3) tarihi bir gün
// geriye kaydırabilir. Yerel tarih bileşenlerinden elle string kurmak bu sorunu önler.
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Paz, 1=Pzt...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

interface CellForm {
  employeeId: number;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
}

// prototype/vardiya-takvimi.html'in React karşılığı (UC-21) — sadece operations_chief, şubedeki tüm
// personel (branch_manager hariç, kullanıcı kararı 2026-08-03). Hücreye tıklayınca o personel/gün için
// vardiya saati ya da off ataması yapılır (backend'de upsert).
export function ShiftCalendarPage() {
  const { token } = useAuth();

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [roster, setRoster] = useState<RosterEmployee[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cellForm, setCellForm] = useState<CellForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [rosterData, shiftData] = await Promise.all([
        listRoster(token),
        listWeekShifts(token, toISODate(weekStart)),
      ]);
      setRoster(rosterData);
      setShifts(shiftData);
    } catch {
      setLoadError("Vardiya takvimi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, weekStart]);

  function shiftFor(employeeId: number, isoDate: string): ShiftItem | undefined {
    return shifts.find((s) => s.employee_id === employeeId && s.shift_date === isoDate);
  }

  function openCell(employee: RosterEmployee, day: Date) {
    const isoDate = toISODate(day);
    const existing = shiftFor(employee.id, isoDate);
    setCellForm({
      employeeId: employee.id,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      date: isoDate,
      startTime: existing?.start_time?.slice(0, 5) ?? "",
      endTime: existing?.end_time?.slice(0, 5) ?? "",
      isDayOff: existing?.is_day_off ?? false,
    });
    setSaveError(null);
  }

  async function handleSave() {
    if (!token || !cellForm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: ShiftUpsertPayload = {
        shift_date: cellForm.date,
        is_day_off: cellForm.isDayOff,
        start_time: cellForm.isDayOff ? null : `${cellForm.startTime}:00`,
        end_time: cellForm.isDayOff ? null : `${cellForm.endTime}:00`,
      };
      await assignShift(token, cellForm.employeeId, payload);
      setCellForm(null);
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
    <AppShell pageTitle="Vardiya takvimi">
      <div className="toolbar">
        <div className="scope">Şubedeki tüm personel (login'li + login'siz) — hücreye tıklayınca vardiya/off atanır</div>
        <div className="filters">
          <button className="btn sm ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>◄</button>
          <span className="pill">
            {toISODate(weekStart)} — {toISODate(addDays(weekStart, 6))}
          </span>
          <button className="btn sm ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>►</button>
        </div>
      </div>

      <div className="panel pad">
        {loadError && <div className="error-text">{loadError}</div>}
        {loading ? (
          <div className="muted-small">Yükleniyor...</div>
        ) : (
          <>
            <div className="cal-head" style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(7,1fr)", gap: 6 }}>
              <span className="who">Personel</span>
              {weekDays.map((d, i) => (
                <span key={i}>{DAY_LABELS[i]} {d.getDate()}</span>
              ))}
            </div>
            {roster.length === 0 && (
              <div className="muted-small" style={{ padding: "12px 0" }}>
                Personel yok.
              </div>
            )}
            {roster.map((employee) => (
              <div
                className="cal-row"
                key={employee.id}
                style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(7,1fr)", gap: 6, alignItems: "center", padding: "8px 0" }}
              >
                <span>{employee.first_name} {employee.last_name}</span>
                {weekDays.map((d) => {
                  const isoDate = toISODate(d);
                  const shift = shiftFor(employee.id, isoDate);
                  const dayOff = shift?.is_day_off ?? false;
                  return (
                    <div
                      key={isoDate}
                      onClick={() => openCell(employee, d)}
                      style={{
                        height: 30,
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        border: dayOff ? "1px dashed var(--line)" : "1px solid var(--line-soft)",
                        background: dayOff ? "transparent" : shift ? "#eee" : "transparent",
                        color: dayOff ? "var(--muted)" : "inherit",
                      }}
                    >
                      {dayOff ? "off" : shift ? `${shift.start_time?.slice(0, 5)}-${shift.end_time?.slice(0, 5)}` : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      <div className={`overlay${cellForm ? " open" : ""}`}>
        <div className="modal">
          <div className="modal-head">
            {cellForm?.employeeName} — {cellForm?.date}
          </div>
          <div className="modal-body">
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={cellForm?.isDayOff ?? false}
                  onChange={(e) => cellForm && setCellForm({ ...cellForm, isDayOff: e.target.checked })}
                />{" "}
                Off (izinli gün)
              </label>
            </div>
            {!cellForm?.isDayOff && (
              <div className="form-grid">
                <div className="field">
                  <label>Başlangıç</label>
                  <input
                    className="input"
                    type="time"
                    value={cellForm?.startTime ?? ""}
                    onChange={(e) => cellForm && setCellForm({ ...cellForm, startTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Bitiş</label>
                  <input
                    className="input"
                    type="time"
                    value={cellForm?.endTime ?? ""}
                    onChange={(e) => cellForm && setCellForm({ ...cellForm, endTime: e.target.value })}
                  />
                </div>
              </div>
            )}
            {saveError && <div className="error-text">{saveError}</div>}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setCellForm(null)}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={saving} onClick={handleSave}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
