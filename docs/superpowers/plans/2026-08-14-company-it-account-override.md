# Company IT Account Override (UC-19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `company_it` a working "Hesap override" panel (`/account-override`) that can reset the
password of any employee in its own company regardless of hierarchy, plus a bulk-create option for
`general_manager` accounts folded into the existing `/employees` page.

**Architecture:** Two new `company_it`-only backend endpoints (`GET /api/employees/company-wide`,
`POST /api/employees/{id}/reset-password`) added to the existing `employees.py` router — no new
router file, no new tables. The frontend gets one new page (`AccountOverridePage.tsx`, reusing
`EmployeeManagementPage.tsx`'s list/search/modal patterns) plus a "Toplu ekle" modal bolted onto
`EmployeeManagementPage.tsx` that calls the existing `POST /api/employees` row-by-row, reusing
`Day0SetupPage.tsx`'s partial-failure/retry pattern (`createdId: number | null` per row).

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19 + TypeScript, react-i18next.

## Global Constraints

- Yeni iki endpoint (`GET /api/employees/company-wide`, `POST /api/employees/{id}/reset-password`)
  sadece `company_it` — `require_role(claims, "company_it")` ile.
- Kilit açma özelliği, zorunlu şifre değiştirme bayrağı, ve yetki devri (UC-19'un 3. alt-yeteneği)
  tamamen kapsam dışı (spec karar 2/3/10).
- Toplu oluşturma hedefi sadece `general_manager` — yeni bir backend endpoint'i **yok**, mevcut
  `POST /api/employees` satır satır çağrılır (spec karar 6/8).
- Audit/log (kimin ne zaman kimin şifresini sıfırladığı) ve Company IT'in kendi şifresini
  sıfırlamasının engellenmesi — ikisi de bilinçli olarak kapsam dışı (`TR dosyalar/PROCESS.md`,
  2026-08-14 güncellemesi).
- Kod tabanında otomatik test altyapısı yok — mevcut konvansiyon curl/tarayıcı ile uçtan uca
  doğrulama.
- Test kullanıcıları: `testco` subdomain'inde `companyit1`/`genmgr1`/`cashier1` (hepsi
  `Test1234!`) — `backend/seed_test_data.py`.
- Spec: `docs/superpowers/specs/2026-08-14-company-it-account-override-design.md`.

---

## Task 1: Backend — `GET /api/employees/company-wide`

**Files:**
- Modify: `backend/app/routers/employees.py`

**Interfaces:**
- Produces: `GET /api/employees/company-wide` — `company_it`, `200` + `list[EmployeeOut]` (çağıranın
  `company_id`'sindeki tüm çalışanlar, hiyerarşiden bağımsız), `403` diğer rollere.

- [ ] **Step 1: Mevcut davranışı doğrula (endpoint henüz yok, 404 bekleniyor)**

Backend çalışıyor olmalı (`cd backend && python -m uvicorn app.main:app --app-dir . --host 0.0.0.0
--port 8000`).

```bash
ITOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"companyit1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X GET http://testco.localhost:8000/api/employees/company-wide \
  -H "Authorization: Bearer $ITOKEN"
```
Expected: `404` (route henüz yok).

- [ ] **Step 2: `require_role` import'unu ekle**

`backend/app/routers/employees.py`'nin başındaki import satırını güncelle:

```python
from ..deps import get_current_claims, require_role
```

- [ ] **Step 3: Endpoint'i ekle**

`list_employees` fonksiyonundan hemen sonra (`create_employee`'den önce) ekle:

```python
@router.get("/company-wide", response_model=list[EmployeeOut])
def list_employees_company_wide(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-19 (Şirket IT Override) — hiyerarşiden bağımsız, çağıranın company_id'sindeki tüm
    çalışanları döner (_manageable_query'den ayrı, çünkü company_it hiyerarşi zincirinde değil).
    Detay: docs/superpowers/specs/2026-08-14-company-it-account-override-design.md"""
    require_role(claims, "company_it")
    query = select(Employee).where(
        Employee.company_id == claims["company_id"], Employee.is_active.is_(True)
    )
    return db.scalars(query).all()
```

- [ ] **Step 4: Başarılı listelemeyi doğrula (tüm roller tek listede)**

```bash
curl -s -X GET http://testco.localhost:8000/api/employees/company-wide \
  -H "Authorization: Bearer $ITOKEN" | python -c "
import sys, json
data = json.load(sys.stdin)
usernames = {e['username'] for e in data if e['username']}
roles = {e['role'] for e in data}
print('cashier1' in usernames, 'genmgr1' in usernames, 'companyit1' in usernames)
print(sorted(roles))
"
```
Expected: `True True True`, ardından en az `['cashier', 'company_it', 'general_manager', ...]`
içeren bir rol listesi (branch_manager/region_manager/stock_manager/seller_manager/
operations_chief/staff de dahil — seed'deki testco çalışanlarının tamamı).

- [ ] **Step 5: Yetkisiz rol reddini doğrula**

```bash
GTOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"genmgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X GET http://testco.localhost:8000/api/employees/company-wide \
  -H "Authorization: Bearer $GTOKEN"
```
Expected: `403`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/employees.py
git commit -m "feat: add GET /api/employees/company-wide for company_it (UC-19)"
```

---

## Task 2: Backend — `POST /api/employees/{id}/reset-password`

**Files:**
- Modify: `backend/app/schemas/employee.py`
- Modify: `backend/app/routers/employees.py`

**Interfaces:**
- Consumes: Task 1'in `GET /api/employees/company-wide`'ı (test için hedef `id` bulmakta
  kullanılıyor).
- Produces: `PasswordReset(new_password: str)` — boş string reddedilir (`min_length=1`).
  `POST /api/employees/{id}/reset-password` — `company_it`, `200` + `EmployeeOut`, `404` (hedef yok
  ya da başka şirkete ait), `422` (boş şifre), `403` diğer rollere.

- [ ] **Step 1: `PasswordReset` şemasını ekle**

`backend/app/schemas/employee.py`'nin başındaki import satırını güncelle:

```python
from pydantic import BaseModel, ConfigDict, Field
```

Dosyanın sonuna (`EmployeeOut` sınıfından sonra) ekle:

```python


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=1)
```

- [ ] **Step 2: Mevcut davranışı doğrula (endpoint henüz yok, 404 bekleniyor)**

```bash
CID=$(curl -s -X GET http://testco.localhost:8000/api/employees/company-wide \
  -H "Authorization: Bearer $ITOKEN" | python -c "
import sys, json
data = json.load(sys.stdin)
print([e['id'] for e in data if e['username'] == 'cashier1'][0])
")
echo "CID=$CID"

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/employees/$CID/reset-password \
  -H "Authorization: Bearer $ITOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123!"}'
```
Expected: `404` (route henüz yok — `$ITOKEN` Task 1'deki token, süresi dolmuşsa yeniden al).

- [ ] **Step 3: Endpoint'i ekle**

`backend/app/routers/employees.py`'nin şema import satırını güncelle:

```python
from ..schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate, PasswordReset
```

`update_employee` fonksiyonundan sonra, dosyanın sonuna ekle:

```python


@router.post("/{employee_id}/reset-password", response_model=EmployeeOut)
def reset_employee_password(
    employee_id: int,
    payload: PasswordReset,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """UC-19 (Şirket IT Override) — Company IT, kendi şirketindeki HER çalışanın şifresini
    hiyerarşiden bağımsız sıfırlayabilir (spec karar 4). Zorunlu-değiştirme bayrağı yok (karar 3),
    audit log kapsam dışı (bkz. TR dosyalar/PROCESS.md, 2026-08-14).
    Detay: docs/superpowers/specs/2026-08-14-company-it-account-override-design.md"""
    require_role(claims, "company_it")
    employee = db.scalar(
        select(Employee).where(Employee.id == employee_id, Employee.company_id == claims["company_id"])
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(employee)
    return employee
```

- [ ] **Step 4: Başarılı sıfırlamayı ve yeni şifreyle girişi doğrula**

```bash
curl -s -X POST http://testco.localhost:8000/api/employees/$CID/reset-password \
  -H "Authorization: Bearer $ITOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123!"}'
```
Expected: `200` + güncellenmiş `EmployeeOut` (`"username":"cashier1"`).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cashier1","password":"NewPass123!"}'
```
Expected: `200`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cashier1","password":"Test1234!"}'
```
Expected: `401` (eski şifre artık geçersiz).

- [ ] **Step 5: Test verisini eski haline döndür**

```bash
curl -s -X POST http://testco.localhost:8000/api/employees/$CID/reset-password \
  -H "Authorization: Bearer $ITOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":"Test1234!"}'
```
Expected: `200` (seed şifresi geri yüklendi — sonraki test çalıştırmaları etkilenmesin diye).

- [ ] **Step 6: 404 (yok/başka şirket) ve 422 (boş şifre) davranışlarını doğrula**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/employees/999999/reset-password \
  -H "Authorization: Bearer $ITOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123!"}'
```
Expected: `404`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/employees/$CID/reset-password \
  -H "Authorization: Bearer $ITOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":""}'
```
Expected: `422`.

- [ ] **Step 7: Yetkisiz rol reddini doğrula**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/employees/$CID/reset-password \
  -H "Authorization: Bearer $GTOKEN" -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123!"}'
```
Expected: `403`.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/employee.py backend/app/routers/employees.py
git commit -m "feat: add POST /api/employees/{id}/reset-password for company_it (UC-19)"
```

---

## Task 3: Frontend — tipler ve API istemcisi

**Files:**
- Modify: `frontend/src/types/employee.ts`
- Modify: `frontend/src/api/employees.ts`

**Interfaces:**
- Consumes: Task 1/2'nin backend endpoint'leri.
- Produces: `PasswordResetPayload { new_password: string }`, `listEmployeesCompanyWide(token):
  Promise<EmployeeOut[]>`, `resetEmployeePassword(token, employeeId, payload): Promise<EmployeeOut>`.

- [ ] **Step 1: `types/employee.ts`'e ekle**

`frontend/src/types/employee.ts`'in sonuna ekle:

```typescript

export interface PasswordResetPayload {
  new_password: string;
}
```

- [ ] **Step 2: `api/employees.ts`'e ekle**

`frontend/src/api/employees.ts`'in import satırını güncelle:

```typescript
import type { EmployeeCreatePayload, EmployeeOut, EmployeeUpdatePayload, PasswordResetPayload } from "../types/employee";
```

Dosyanın sonuna ekle:

```typescript

export function listEmployeesCompanyWide(token: string): Promise<EmployeeOut[]> {
  return authFetch<EmployeeOut[]>(token, "/api/employees/company-wide");
}

export function resetEmployeePassword(token: string, employeeId: number, payload: PasswordResetPayload): Promise<EmployeeOut> {
  return authFetch<EmployeeOut>(token, `/api/employees/${employeeId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/employee.ts frontend/src/api/employees.ts
git commit -m "feat: add company-wide employee list and password reset API client functions"
```

---

## Task 4: Frontend — `AccountOverridePage.tsx`

**Files:**
- Create: `frontend/src/pages/AccountOverridePage.tsx`

**Interfaces:**
- Consumes: Task 3'ün `listEmployeesCompanyWide`/`resetEmployeePassword`, `../auth/roleLabels::roleLabel`,
  `../api/client::apiErrorMessage`, `../types/employee::EmployeeOut`.
- Produces: `AccountOverridePage` React bileşeni (named export, projedeki desenle tutarlı).

**Mimari:** `EmployeeManagementPage.tsx`'in liste/arama/modal desenini birebir izliyor — tek fark
hedef listenin `listEmployeesCompanyWide` (hiyerarşi filtresiz) olması ve satır aksiyonunun
"düzenle" yerine "şifre sıfırla" modalı açması. i18n key'leri henüz yok (Task 5'te eklenecek) —
bu task sadece tip kontrolüyle doğrulanıyor, tarayıcı testi Task 5'te (nav+route bağlandıktan sonra).

- [ ] **Step 1: Bileşeni yaz**

```typescript
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
```

- [ ] **Step 2: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter (i18n key'lerinin henüz `tr.json`/`en.json`'da olmaması tip hatası
vermez — `t()` çağrıları string literal kabul eder).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AccountOverridePage.tsx
git commit -m "feat: add AccountOverridePage for company_it password override (UC-19)"
```

---

## Task 5: Frontend — nav + route + i18n bağlama (`AccountOverridePage`)

**Files:**
- Modify: `frontend/src/components/navConfig.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: Task 4'ün `AccountOverridePage`.

- [ ] **Step 1: `navConfig.ts`'teki `company_it` bloğuna path ekle**

`frontend/src/components/navConfig.ts`'te:

```typescript
        { label: "nav.accountOverride", icon: "override" },
```

satırını:

```typescript
        { label: "nav.accountOverride", path: "/account-override", icon: "override" },
```

yap. (`homeLabelForRole` bu öğeyi zaten ilk sırada kabul ediyor, `company_it`'in artık gerçek bir
ana sayfası oluyor — boş placeholder'ın yerini alıyor.)

- [ ] **Step 2: `App.tsx`'e route ekle**

`frontend/src/App.tsx`'teki import satırlarına ekle:

```typescript
import { AccountOverridePage } from "./pages/AccountOverridePage";
```

`/employees` route'undan hemen sonra ekle:

```tsx
          <Route
            path="/account-override"
            element={
              <ProtectedRoute>
                <AccountOverridePage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: `tr.json`'a `accountOverride` namespace'ini ekle**

`frontend/src/i18n/locales/tr.json`'daki `"day0"` bloğundan hemen önce, üst seviyeye yeni bir
namespace ekle:

```json
  "accountOverride": {
    "title": "Hesap override",
    "scopeDesc": "Kapsam: şirket geneli (hiyerarşiden bağımsız, her rol) — sadece şifre sıfırlama",
    "loadError": "Çalışan listesi alınamadı.",
    "resetPassword": "Şifre sıfırla",
    "modalTitle": "{{name}} — şifre sıfırla",
    "newPassword": "Yeni şifre",
    "resetHint": "Company IT yeni şifreyi kendisi belirler — kullanıcı bir sonraki girişte değiştirmeye zorlanmaz.",
    "resetFailed": "Şifre sıfırlanamadı."
  },
```

- [ ] **Step 4: `en.json`'a aynı namespace'i ekle**

`frontend/src/i18n/locales/en.json`'daki `"day0"` bloğundan hemen önce:

```json
  "accountOverride": {
    "title": "Account override",
    "scopeDesc": "Scope: company-wide (hierarchy-independent, every role) — password reset only",
    "loadError": "Could not load the employee list.",
    "resetPassword": "Reset password",
    "modalTitle": "{{name}} — reset password",
    "newPassword": "New password",
    "resetHint": "Company IT sets the new password directly — the user is not forced to change it on next login.",
    "resetFailed": "Could not reset the password."
  },
```

- [ ] **Step 5: JSON geçerliliğini doğrula**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 7: Tarayıcıda uçtan uca doğrula**

`testco.localhost:5173`'te `companyit1`/`Test1234!` ile giriş yap:
1. Sidebar'da "Hesap override" artık tıklanabilir, ana sayfa artık boş placeholder değil.
2. `/account-override`'da testco'daki tüm çalışanlar (farklı roller/şubeler) tek listede
   görünüyor — `cashier1`, `genmgr1`, `companyit1` dahil.
3. Arama kutusuna `"cashier"` yaz → sadece `cashier1`/`cashier2` kalmalı.
4. `cashier1` satırında "Şifre sıfırla" → modal açılıyor, yeni şifre gir (`"BrowserTest1!"`) →
   "Şifre sıfırla" butonuna bas → modal kapanıyor, hata yok.
5. `cashier1` ile `"BrowserTest1!"` şifresiyle giriş yapılabildiğini doğrula (ayrı bir sekme/
   tarayıcı oturumu ya da login sayfasından).
6. Şifreyi tekrar `/account-override` üzerinden `Test1234!`'e geri sıfırla (test verisini
   bozmamak için).
7. Konsol hatasız.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/navConfig.ts frontend/src/App.tsx frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: wire up AccountOverridePage nav, route, and i18n keys"
```

---

## Task 6: Frontend — `EmployeeManagementPage.tsx`'e "Toplu ekle" modalı

**Files:**
- Modify: `frontend/src/pages/EmployeeManagementPage.tsx`
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `../api/employees::createEmployee` (mevcut), `../api/client::apiErrorMessage` (mevcut).
- Produces: `EmployeeManagementPage` içine gömülü toplu-oluşturma modalı — sadece
  `creatorRole === "company_it"` iken görünür.

**Mimari:** `Day0SetupPage.tsx`'in `UserDraft`/`createdId` desenindeki sadeleştirilmiş bir versiyonu
— hedef rol her zaman `general_manager` olduğu için rol seçici yok, branch/region alanı yok (spec
karar 6/7: `company_it → general_manager` zaten branch/region istemiyor,
`backend/app/routers/employees.py::create_employee`'deki `elif creator_role == "company_it": pass`
dalıyla tutarlı).

- [ ] **Step 1: Modül-seviyesi taslak yardımcıları ve state'i ekle**

`frontend/src/pages/EmployeeManagementPage.tsx`'teki `emptyForm` fonksiyonundan hemen sonra ekle:

```typescript

let nextBulkDraftId = 1;
function newBulkDraftId(): string {
  return String(nextBulkDraftId++);
}

interface BulkUserDraft {
  draftId: string;
  first_name: string;
  last_name: string;
  age: string;
  address: string;
  username: string;
  password: string;
  createdId: number | null;
}

function emptyBulkDraft(): BulkUserDraft {
  return {
    draftId: newBulkDraftId(),
    first_name: "",
    last_name: "",
    age: "",
    address: "",
    username: "",
    password: "",
    createdId: null,
  };
}
```

`EmployeeManagementPage` bileşeni içindeki state tanımlarının sonuna (`saving` state'inden hemen
sonra) ekle:

```typescript
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkUserDraft[]>([emptyBulkDraft()]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
```

- [ ] **Step 2: Toplu-oluşturma fonksiyonlarını ekle**

`handleSave` fonksiyonundan hemen sonra ekle:

```typescript

  function openBulkCreate() {
    setBulkRows([emptyBulkDraft()]);
    setBulkError(null);
    setBulkOpen(true);
  }

  function addBulkRow() {
    setBulkRows((prev) => [...prev, emptyBulkDraft()]);
  }

  function updateBulkRow(draftId: string, patch: Partial<BulkUserDraft>) {
    setBulkRows((prev) => prev.map((r) => (r.draftId === draftId ? { ...r, ...patch } : r)));
  }

  async function handleBulkSubmit() {
    if (!token) return;
    setBulkSubmitting(true);
    setBulkError(null);
    try {
      const next = [...bulkRows];
      for (let i = 0; i < next.length; i++) {
        const row = next[i];
        if (row.createdId !== null || !row.first_name.trim()) continue;
        const created = await createEmployee(token, {
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          role: "general_manager",
          age: Number(row.age),
          address: row.address.trim(),
          username: row.username.trim(),
          password: row.password,
        });
        next[i] = { ...row, createdId: created.id };
        setBulkRows([...next]);
      }
      setBulkOpen(false);
      await load();
    } catch (err) {
      setBulkError(apiErrorMessage(err, t("employees.bulkSubmitFailed")));
    } finally {
      setBulkSubmitting(false);
    }
  }
```

**Kısmi hata davranışı:** `createEmployee` bir satırda hata fırlatırsa (`409`/`422`) `catch` bloğu
döngüyü durdurur — önceki satırlar `setBulkRows` ile zaten `createdId` işaretli kaydedilmiş olur,
modal açık kalır (`setBulkOpen(false)` hiç çalışmaz). "Tekrar dene"ye basmak `handleBulkSubmit`'i
tekrar çağırır, `createdId !== null` olan satırları atlar (spec karar 8).

- [ ] **Step 3: "Toplu ekle" butonunu ekle**

`{t("employees.newAccount")}` butonunu içeren `<span className="filters">` bloğunu bul:

```tsx
            <button className="btn sm primary" onClick={openCreate} disabled={targetRoles.length === 0}>
              {t("employees.newAccount")}
            </button>
```

Bu satırdan hemen sonra ekle:

```tsx
            {creatorRole === "company_it" && (
              <button className="btn sm ghost" onClick={openBulkCreate}>
                {t("employees.bulkAdd")}
              </button>
            )}
```

- [ ] **Step 4: Toplu-oluşturma modalını ekle**

Mevcut `<div className={`overlay${modalOpen ? " open" : ""}`}>...</div>` bloğunun kapanışından
hemen sonra (bileşenin `return` ifadesindeki son `</AppShell>`'den önce) ekle:

```tsx

      {creatorRole === "company_it" && (
        <div className={`overlay${bulkOpen ? " open" : ""}`}>
          <div className="modal">
            <div className="modal-head">{t("employees.bulkModalTitle")}</div>
            <div className="modal-body">
              {bulkRows.map((row) => (
                <div key={row.draftId} className="panel" style={{ marginBottom: 12 }}>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("common.firstName")}</label>
                        <input
                          className="input"
                          value={row.first_name}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { first_name: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>{t("common.lastName")}</label>
                        <input
                          className="input"
                          value={row.last_name}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { last_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("common.age")}</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={row.age}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { age: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>{t("common.address")}</label>
                        <input
                          className="input"
                          value={row.address}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { address: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("employees.username")}</label>
                        <input
                          className="input"
                          value={row.username}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { username: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>{t("employees.tempPassword")}</label>
                        <input
                          className="input"
                          type="password"
                          value={row.password}
                          disabled={row.createdId !== null}
                          onChange={(e) => updateBulkRow(row.draftId, { password: e.target.value })}
                        />
                      </div>
                    </div>
                    {row.createdId !== null && (
                      <div className="muted-small">{t("day0.alreadyCreated")}</div>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn sm ghost" onClick={addBulkRow}>
                {t("employees.bulkAddRow")}
              </button>
              {bulkError && <div className="error-text">{bulkError}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setBulkOpen(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" disabled={bulkSubmitting} onClick={handleBulkSubmit}>
                {bulkSubmitting ? t("common.saving") : bulkError ? t("day0.retry") : t("employees.create")}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: `tr.json`'daki `employees` namespace'ine yeni key'leri ekle**

`frontend/src/i18n/locales/tr.json`'daki `"employees"` bloğundaki `"create": "Oluştur"` satırından
hemen önce ekle:

```json
    "bulkAdd": "Toplu ekle",
    "bulkModalTitle": "Toplu hesap oluştur (Genel Müdür)",
    "bulkAddRow": "Hesap ekle",
    "bulkSubmitFailed": "Toplu oluşturma sırasında hata oluştu.",
```

- [ ] **Step 6: `en.json`'daki `employees` namespace'ine aynı key'leri ekle**

`frontend/src/i18n/locales/en.json`'daki `"employees"` bloğundaki `"create": "Create"` satırından
hemen önce ekle:

```json
    "bulkAdd": "Bulk add",
    "bulkModalTitle": "Bulk create accounts (General Manager)",
    "bulkAddRow": "Add account",
    "bulkSubmitFailed": "An error occurred during bulk creation.",
```

- [ ] **Step 7: JSON geçerliliğini ve tip kontrolünü doğrula**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"`
Expected: `ok`

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 8: Tarayıcıda uçtan uca doğrula (başarı senaryosu)**

`testco.localhost:5173`'te `companyit1`/`Test1234!` ile giriş yap, `/employees`'e git:
1. "Yeni hesap"in yanında "Toplu ekle" butonu görünüyor.
2. Tıkla → modal açılıyor, 1 satır var.
3. "Hesap ekle"ye bas → 2. satır eklendi.
4. 2 satırı da doldur (benzersiz kullanıcı adları, örn. `bulktest1`/`bulktest2`), "Oluştur"a bas.
5. Modal kapandı, liste yenilendi, her iki yeni GM hesabı da `/employees` listesinde görünüyor.

- [ ] **Step 9: Kısmi hata senaryosunu doğrula**

1. "Toplu ekle"yi tekrar aç, 2 satır doldur — 1. satır benzersiz bir kullanıcı adıyla
   (`bulktest3`), 2. satır **Step 8'de zaten oluşturulmuş** `bulktest1` kullanıcı adıyla
   (kasıtlı çakışma).
2. "Oluştur"a bas → 1. satır başarılı (arka planda `201`), 2. satır `409` ile hata veriyor, modal
   açık kalıyor, hata mesajı görünüyor, 1. satır artık salt-okunur (`row.createdId !== null` →
   input'lar disabled) ve "oluşturuldu" etiketi taşıyor.
3. 2. satırın kullanıcı adını `bulktest3b` olarak düzelt, buton metni "Tekrar dene" olmalı, tekrar
   bas → sadece 2. satır tekrar gönderiliyor (1. satır tekrar `POST` edilmiyor — network sekmesinden
   doğrula), bu sefer `201`, modal kapanıyor.

- [ ] **Step 10: Regresyon — diğer rollerde "Toplu ekle" hiç görünmüyor**

`genmgr1`/`branchmgr1`/`regionmgr1` ile sırayla `/employees`'e git — hiçbirinde "Toplu ekle"
butonu görünmemeli, mevcut tekli "Yeni hesap" akışı değişmeden çalışmalı (bir tane normal hesap
oluşturarak regresyon kontrolü yap).

- [ ] **Step 11: Test verisini temizle**

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "
DELETE FROM employees WHERE username IN ('bulktest1','bulktest2','bulktest3','bulktest3b');
"
```

- [ ] **Step 12: Konsolun hatasız olduğunu doğrula, commit**

```bash
git add frontend/src/pages/EmployeeManagementPage.tsx frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: add bulk general_manager creation modal for company_it (UC-19)"
```

---

## Self-review notu (plan yazarı için, referans)

- **Spec kapsaması:** Spec'in 10 kararının hepsi task'lara bağlanıyor — panel/UC-19 birleşimi
  (tüm plan), kilit açma/zorunlu değiştirme/yetki devri kapsam dışı (hiçbir task'ta kodlanmadı),
  şifre sıfırlama akışı (Task 2/4), şirket geneli kapsam (Task 1), ayrı sayfa (Task 4/5), toplu
  oluşturmanın GM'e sınırlı olması + tekrarlanabilir satır deseni + kısmi başarı + mevcut
  `/employees` sayfasına eklenmesi (hepsi Task 6). Ayrıca kullanıcıyla review sırasında (2026-08-14)
  bilinçli kapsam dışı bırakılan 2 madde (audit/log, kendi şifresini sıfırlama engeli) hiçbir task'ta
  kodlanmadı — `TR dosyalar/PROCESS.md`'de kayıtlı.
- **Tip tutarlılığı:** `PasswordResetPayload.new_password` (frontend) ↔ `PasswordReset.new_password`
  (backend) birebir eşleşiyor. `BulkUserDraft` alanları `createEmployee`'ye gönderilen
  `EmployeeCreatePayload` alan adlarıyla (`first_name`/`last_name`/`age`/`address`/`username`/
  `password`) birebir aynı isimlendirmede.
- **Route çakışması yok:** `GET /api/employees/company-wide` ile mevcut `GET /api/employees`
  (path parametresiz) arasında, ya da `POST /api/employees/{id}/reset-password` ile mevcut
  `PATCH /api/employees/{id}` arasında (farklı HTTP metodu) bir FastAPI route-ordering sorunu yok —
  Excel-import'taki `GET /api/products/import/template` vs `GET /{product_id}` sorununun benzeri
  burada geçerli değil, çünkü `employees.py`'de hiç `GET /{employee_id}` route'u yok.
- **`company_id NOT NULL` garantisi:** `backend/app/models/staff.py`'deki
  `ck_employees_vendor_manager_scope` CHECK constraint'i `vendor_manager` dışındaki her rolün
  `company_id`'sinin dolu olmasını garanti ediyor — `GET /company-wide`'ın basit
  `Employee.company_id == claims["company_id"]` filtresi bu yüzden güvenli, ayrı bir NULL kontrolü
  gerekmiyor.
