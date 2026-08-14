# Day-0 Vendor Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `vendor_manager` a step-by-step wizard (`/day0-setup`) that creates a brand-new
tenant company (org structure + full role hierarchy) in one sitting, reusing extended general-CRUD
backend endpoints rather than a dedicated setup endpoint.

**Architecture:** Three new `POST` endpoints (`/api/companies`, `/api/regions`, `/api/branches`,
all `vendor_manager`-only) plus an extension of the existing `POST /api/employees`
(`CREATABLE_ROLES["vendor_manager"]` gets every role; `general_manager` also gains `company_it`).
The frontend wizard makes these calls sequentially, tracking each created row's ID in local state
so a mid-wizard failure can be retried without re-creating already-succeeded rows.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19 + TypeScript, react-i18next.

## Global Constraints

- Yeni endpoint'lerin hepsi (`POST /api/companies`, `/regions`, `/branches`) sadece `vendor_manager`.
- `subdomain`: küçük harfe çevrilir + trim edilir, sadece `[a-z0-9-]` (maks. 63 karakter), `"admin"`
  (`deps.py::VENDOR_ADMIN_SUBDOMAIN`) rezerve, reddedilir.
- Day-0'da en az 1 `general_manager` zorunlu, diğer roller (`company_it` dahil) opsiyonel.
- `general_manager` artık `company_it` de oluşturabilir (çift yönlü, `company_it → general_manager`
  zaten vardı).
- Kısmi hata kurtarma: her adım ayrı bir API çağrısı, başarıyla oluşturulan her satırın `id`'si
  wizard state'inde tutulur, "tekrar dene" sadece `id`'si olmayan (henüz oluşturulmamış) satırları
  tekrar gönderir.
- Kod tabanında otomatik test altyapısı yok — mevcut konvansiyon curl/tarayıcı ile uçtan uca
  doğrulama.
- Kapsam dışı (bu planda kodlanmıyor): steady-state bölge/şube ekleme (Genel Müdür'e açılması),
  şirket/bölge/şube düzenleme-silme ekranı, branding sihirbaza dahil değil.
- Spec: `docs/superpowers/specs/2026-08-13-day0-vendor-setup-design.md`.

---

## Task 1: Backend — `POST /api/companies`

**Files:**
- Modify: `backend/app/schemas/company.py`
- Modify: `backend/app/routers/companies.py`

**Interfaces:**
- Produces: `CompanyCreate(name: str, subdomain: str)` — `subdomain` validator normalize eder
  (lowercase+trim) ve reddeder (format/rezerve).
  `POST /api/companies` — `vendor_manager`, `201` + `CompanyOut`, `409` (subdomain çakışması),
  `422` (format/rezerve).

- [ ] **Step 1: `CompanyCreate` şemasını ekle**

`backend/app/schemas/company.py`'nin başındaki import satırını güncelle:

```python
import re

from pydantic import BaseModel, ConfigDict, field_validator
```

`CompanyOut` sınıfından hemen önce ekle:

```python
SUBDOMAIN_PATTERN = re.compile(r"^[a-z0-9-]{1,63}$")
RESERVED_SUBDOMAINS = {"admin"}  # deps.py::VENDOR_ADMIN_SUBDOMAIN ile tutarlı


class CompanyCreate(BaseModel):
    name: str
    subdomain: str

    @field_validator("subdomain")
    @classmethod
    def validate_subdomain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not SUBDOMAIN_PATTERN.match(normalized):
            raise ValueError("subdomain sadece küçük harf, rakam ve tire içerebilir (maks. 63 karakter)")
        if normalized in RESERVED_SUBDOMAINS:
            raise ValueError(f"'{normalized}' rezerve bir subdomain, kullanılamaz")
        return normalized
```

- [ ] **Step 2: Endpoint'ten önce mevcut davranışı doğrula (henüz yok, 404 bekleniyor)**

Backend çalışıyor olmalı (`cd backend && python -m uvicorn app.main:app --app-dir . --host 0.0.0.0
--port 8000`). Vendor token al (`admin` subdomain, `vendormgr1`/`Test1234!`):

```bash
VTOKEN=$(curl -s -X POST http://admin.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendormgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Market","subdomain":"day0test"}'
```
Expected: `404` (endpoint henüz yok).

- [ ] **Step 3: `POST /api/companies` endpoint'ini ekle**

`backend/app/routers/companies.py` başındaki import satırlarını güncelle:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Company, CompanyBranding, CompanyFeature
from ..schemas.company import BrandingOut, BrandingUpdate, CompanyCreate, CompanyOut, FeatureOut, FeatureUpdate
```

`list_companies` fonksiyonundan hemen sonra ekle:

```python
@router.post("", response_model=CompanyOut, status_code=201)
def create_company(
    payload: CompanyCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    """Day-0 (UC-17) — Satıcı Yöneticisi yeni bir müşteri şirketi kurar.
    Detay: docs/superpowers/specs/2026-08-13-day0-vendor-setup-design.md"""
    require_role(claims, "vendor_manager")
    company = Company(name=payload.name, subdomain=payload.subdomain)
    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Bu subdomain zaten kullanımda")
    db.refresh(company)
    return company
```

- [ ] **Step 4: Başarılı oluşturmayı doğrula**

```bash
curl -s -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Market","subdomain":"Day0Test"}'
```
Expected: `201`, gövdede `"subdomain":"day0test"` (küçük harfe çevrildi), `"is_active":true`.

- [ ] **Step 5: Format/rezerve/çakışma hatalarını doğrula**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"X","subdomain":"admin"}'
```
Expected: `422` (rezerve subdomain).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"X","subdomain":"has spaces"}'
```
Expected: `422` (geçersiz format).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"X","subdomain":"day0test"}'
```
Expected: `409` (Step 4'te zaten oluşturuldu).

- [ ] **Step 6: Yetkisiz rol reddini doğrula**

```bash
GTOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"genmgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $GTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"X","subdomain":"shouldfail"}'
```
Expected: `403`.

- [ ] **Step 7: Test verisini temizle**

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "DELETE FROM companies WHERE subdomain = 'day0test';"
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/company.py backend/app/routers/companies.py
git commit -m "feat: add POST /api/companies for Day-0 vendor setup"
```

---

## Task 2: Backend — `POST /api/regions` + `POST /api/branches`

**Files:**
- Modify: `backend/app/schemas/org.py`
- Modify: `backend/app/routers/org.py`

**Interfaces:**
- Consumes: Task 1'in `Company` modeli (var mı kontrolü için).
- Produces: `RegionCreate(company_id: int, name: str)`, `BranchCreate(region_id: int, name: str)`.
  `POST /api/regions` — `vendor_manager`, `201` + `RegionOut`, `404` (company yok).
  `POST /api/branches` — `vendor_manager`, `201` + `BranchOut`, `404` (region yok).

- [ ] **Step 1: Şemaları ekle**

`backend/app/schemas/org.py`'nin sonuna ekle:

```python
class RegionCreate(BaseModel):
    company_id: int
    name: str


class BranchCreate(BaseModel):
    region_id: int
    name: str
```

- [ ] **Step 2: Endpoint'lerden önce mevcut davranışı doğrula (henüz yok, 404 bekleniyor)**

```bash
VTOKEN=$(curl -s -X POST http://admin.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendormgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/regions \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"company_id":1,"name":"Test Bölge"}'
```
Expected: `405` (route yok — `/api/regions` `GET` olarak zaten tanımlı, `POST` henüz yok, FastAPI
`405 Method Not Allowed` döner, `404` değil).

- [ ] **Step 3: Endpoint'leri ekle**

`backend/app/routers/org.py` başındaki import satırlarını güncelle:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Branch, Company, Region
from ..schemas.org import BranchCreate, BranchOut, RegionCreate, RegionOut
```

Dosyanın sonuna ekle:

```python
@router.post("/regions", response_model=RegionOut, status_code=201)
def create_region(
    payload: RegionCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    """Day-0 (UC-17) — sadece vendor_manager. Steady-state'te general_manager'a da açılması
    kavramsal olarak kararlaştırıldı, bu round'da kodlanmıyor (bkz. spec)."""
    require_role(claims, "vendor_manager")
    company = db.get(Company, payload.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    region = Region(company_id=payload.company_id, name=payload.name)
    db.add(region)
    db.commit()
    db.refresh(region)
    return region


@router.post("/branches", response_model=BranchOut, status_code=201)
def create_branch(
    payload: BranchCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    """Day-0 (UC-17) — sadece vendor_manager. Aynı not create_region'daki gibi geçerli."""
    require_role(claims, "vendor_manager")
    region = db.get(Region, payload.region_id)
    if region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    branch = Branch(region_id=payload.region_id, name=payload.name)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch
```

- [ ] **Step 4: Başarılı oluşturmayı ve 404'leri doğrula**

```bash
curl -s -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Day0 Region Test Co","subdomain":"day0regiontest"}'
```
Yanıttaki `id`'yi not al (örn. `42`), aşağıda `<COMPANY_ID>` yerine kullan:

```bash
curl -s -X POST http://admin.localhost:8000/api/regions \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"company_id":<COMPANY_ID>,"name":"Test Bölge"}'
```
Expected: `201` + `{"id":..., "name":"Test Bölge"}`. Yanıttaki `id`'yi not al (`<REGION_ID>`).

```bash
curl -s -X POST http://admin.localhost:8000/api/branches \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"region_id":<REGION_ID>,"name":"Test Şube"}'
```
Expected: `201` + `{"id":..., "name":"Test Şube"}`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/regions \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"company_id":999999,"name":"X"}'
```
Expected: `404`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/branches \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"region_id":999999,"name":"X"}'
```
Expected: `404`.

- [ ] **Step 5: Yetkisiz rol reddini doğrula**

```bash
GTOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"genmgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/regions \
  -H "Authorization: Bearer $GTOKEN" -H "Content-Type: application/json" \
  -d '{"company_id":1,"name":"X"}'
```
Expected: `403`.

- [ ] **Step 6: Test verisini temizle**

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "DELETE FROM companies WHERE subdomain = 'day0regiontest';"
```
(FK `ON DELETE` mevcut davranışı — bağlı bölge/şube varsa şirket silinemeyebilir; öyleyse önce
`DELETE FROM branches WHERE region_id = <REGION_ID>; DELETE FROM regions WHERE id = <REGION_ID>;`
sonra şirketi sil.)

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/org.py backend/app/routers/org.py
git commit -m "feat: add POST /api/regions and POST /api/branches for Day-0 vendor setup"
```

---

## Task 3: Backend — Vendor'ın tam rol hiyerarşisi oluşturabilmesi + GM↔company_it çift yön

**Files:**
- Modify: `backend/app/schemas/employee.py`
- Modify: `backend/app/routers/employees.py`

**Interfaces:**
- Consumes: Task 1/2'nin `Company`/`Region`/`Branch` modelleri.
- Produces: `EmployeeCreate.company_id: int | None = None` (sadece `vendor_manager` kullanır).
  `CREATABLE_ROLES["vendor_manager"]` = tüm roller. `CREATABLE_ROLES["general_manager"]` artık
  `company_it`'i de içeriyor.

- [ ] **Step 1: `EmployeeCreate`'e `company_id` ekle**

`backend/app/schemas/employee.py`'deki `EmployeeCreate` sınıfını güncelle:

```python
class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    role: str
    age: int
    address: str
    username: str | None = None
    password: str | None = None
    branch_id: int | None = None  # region_manager → branch_manager / vendor_manager → şube-scoped roller
    region_id: int | None = None  # general_manager → region_manager / vendor_manager → region_manager
    company_id: int | None = None  # sadece vendor_manager — hedef şirket (kendi company_id'si yok)
    manager_pin: str | None = None  # sadece PIN_APPROVER_ROLES (stock/seller_manager, operations_chief)
```

- [ ] **Step 2: Mevcut davranışı doğrula (vendor henüz hiçbir hesap oluşturamıyor)**

```bash
VTOKEN=$(curl -s -X POST http://admin.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vendormgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"GM","role":"general_manager","age":30,"address":"X","username":"day0gm","password":"Test1234!","company_id":1}'
```
Expected: `403` (`vendor_manager` henüz `CREATABLE_ROLES`'te yok).

- [ ] **Step 3: `CREATABLE_ROLES`'ü güncelle ve vendor'ın hedef-çözme dalını ekle**

`backend/app/routers/employees.py` başındaki import satırını güncelle:

```python
from ..models import Branch, Company, Employee, Region
```

`CREATABLE_ROLES` sözlüğünü değiştir:

```python
# Madde 6 (Operasyonel Akışlar — Hesap Oluşturma): steady-state'te üst seviye bir alt seviyeyi
# oluşturur. Day-0/İlk Kurulum (UC-17) artık vendor_manager'ın tüm rolleri oluşturabildiği bir
# akışla destekleniyor (2026-08-13, bkz. spec) — Şirket IT override (UC-19) hâlâ bu kapsamda değil.
CREATABLE_ROLES: dict[str, set[str]] = {
    "branch_manager": {"cashier", "stock_manager", "seller_manager"},
    "region_manager": {"branch_manager"},
    "general_manager": {"region_manager", "company_it"},
    "company_it": {"general_manager"},
    "operations_chief": {"staff"},
    "vendor_manager": {
        "general_manager", "company_it", "region_manager", "branch_manager",
        "cashier", "stock_manager", "seller_manager", "operations_chief", "staff",
    },
}

# vendor_manager hedef rolüne göre hangi ek scope alanının (branch/region) gerektiğini belirler —
# create_employee'deki vendor dalında kullanılır.
_VENDOR_BRANCH_SCOPED_ROLES = {"branch_manager", "cashier", "stock_manager", "seller_manager", "operations_chief", "staff"}
```

`create_employee` fonksiyonundaki hedef-çözme zincirine (`elif creator_role == "company_it": pass`
satırından sonra, `elif creator_role == "operations_chief":` satırından önce) yeni bir dal ekle:

```python
    elif creator_role == "vendor_manager":
        if payload.company_id is None:
            raise HTTPException(status_code=422, detail="company_id gerekli")
        target_company = db.get(Company, payload.company_id)
        if target_company is None:
            raise HTTPException(status_code=404, detail="Company not found")
        company_id = target_company.id

        if payload.role == "region_manager":
            if payload.region_id is None:
                raise HTTPException(status_code=422, detail="region_id gerekli")
            region = db.scalar(
                select(Region).where(Region.id == payload.region_id, Region.company_id == company_id)
            )
            if region is None:
                raise HTTPException(status_code=404, detail="Bölge bulunamadı (bu şirkete ait değil)")
            region_id = region.id
        elif payload.role in _VENDOR_BRANCH_SCOPED_ROLES:
            if payload.branch_id is None:
                raise HTTPException(status_code=422, detail="branch_id gerekli")
            branch = db.scalar(
                select(Branch)
                .join(Region, Branch.region_id == Region.id)
                .where(Branch.id == payload.branch_id, Region.company_id == company_id)
            )
            if branch is None:
                raise HTTPException(status_code=404, detail="Şube bulunamadı (bu şirkete ait değil)")
            branch_id = branch.id
        # general_manager / company_it için ek bir alan gerekmiyor — sadece company_id yeterli.
```

Tam güncellenmiş `create_employee` gövdesi (satır satır konum netliği için — `elif creator_role ==
"vendor_manager":` bloğu **`elif creator_role == "company_it": pass` satırından hemen sonra, `elif
creator_role == "operations_chief":` satırından hemen önce** eklenmelidir):

```python
    if creator_role == "branch_manager":
        branch_id = claims["branch_id"]
    elif creator_role == "region_manager":
        if payload.branch_id is None:
            raise HTTPException(status_code=422, detail="branch_id gerekli")
        branch = db.scalar(select(Branch).where(Branch.id == payload.branch_id, Branch.region_id == claims["region_id"]))
        if branch is None:
            raise HTTPException(status_code=404, detail="Şube bulunamadı (kendi bölgenizde değil)")
        branch_id = branch.id
    elif creator_role == "general_manager":
        if payload.role == "region_manager":
            if payload.region_id is None:
                raise HTTPException(status_code=422, detail="region_id gerekli")
            region = db.scalar(select(Region).where(Region.id == payload.region_id, Region.company_id == claims["company_id"]))
            if region is None:
                raise HTTPException(status_code=404, detail="Bölge bulunamadı (kendi şirketinizde değil)")
            region_id = region.id
        # company_it için ek bir alan gerekmiyor (branch/region bağlanmaz, general_manager'a
        # branch/region bağlanmadığı gibi) — mevcut "region_id zorunlu" kontrolü artık sadece
        # payload.role == "region_manager" olduğunda uygulanıyor (önceden koşulsuzdu, çünkü
        # general_manager tek hedef role sahipti; artık iki hedefi var).
    elif creator_role == "company_it":
        pass  # company_id yeterli, general_manager'a branch/region bağlanmaz
    elif creator_role == "vendor_manager":
        if payload.company_id is None:
            raise HTTPException(status_code=422, detail="company_id gerekli")
        target_company = db.get(Company, payload.company_id)
        if target_company is None:
            raise HTTPException(status_code=404, detail="Company not found")
        company_id = target_company.id

        if payload.role == "region_manager":
            if payload.region_id is None:
                raise HTTPException(status_code=422, detail="region_id gerekli")
            region = db.scalar(
                select(Region).where(Region.id == payload.region_id, Region.company_id == company_id)
            )
            if region is None:
                raise HTTPException(status_code=404, detail="Bölge bulunamadı (bu şirkete ait değil)")
            region_id = region.id
        elif payload.role in _VENDOR_BRANCH_SCOPED_ROLES:
            if payload.branch_id is None:
                raise HTTPException(status_code=422, detail="branch_id gerekli")
            branch = db.scalar(
                select(Branch)
                .join(Region, Branch.region_id == Region.id)
                .where(Branch.id == payload.branch_id, Region.company_id == company_id)
            )
            if branch is None:
                raise HTTPException(status_code=404, detail="Şube bulunamadı (bu şirkete ait değil)")
            branch_id = branch.id
    elif creator_role == "operations_chief":
        branch_id = claims["branch_id"]
```

**Önemli değişiklik notu:** `general_manager` dalındaki `if payload.region_id is None: raise ...`
kontrolü artık **`if payload.role == "region_manager":`** bloğunun içine taşındı — önceden
`general_manager`'ın tek hedef rolü `region_manager` olduğu için koşulsuzdu, artık `company_it`
hedefi region_id istemediği için role-bağımlı hale getirildi.

- [ ] **Step 4: Vendor'ın her hedef rol için oluşturabildiğini doğrula**

Task 2'de oluşturulan test şirketi/bölge/şube'yi tekrar kur (temizlenmiş olabilir):

```bash
CID=$(curl -s -X POST http://admin.localhost:8000/api/companies \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Day0 Emp Test Co","subdomain":"day0emptest"}' | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

RID=$(curl -s -X POST http://admin.localhost:8000/api/regions \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"company_id\":$CID,\"name\":\"Test Bölge\"}" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

BID=$(curl -s -X POST http://admin.localhost:8000/api/branches \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"region_id\":$RID,\"name\":\"Test Şube\"}" | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "CID=$CID RID=$RID BID=$BID"

curl -s -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Test\",\"last_name\":\"GM\",\"role\":\"general_manager\",\"age\":30,\"address\":\"X\",\"username\":\"day0gm\",\"password\":\"Test1234!\",\"company_id\":$CID}"
```
Expected: `201`.

```bash
curl -s -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Test\",\"last_name\":\"IT\",\"role\":\"company_it\",\"age\":30,\"address\":\"X\",\"username\":\"day0it\",\"password\":\"Test1234!\",\"company_id\":$CID}"
```
Expected: `201`.

```bash
curl -s -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Test\",\"last_name\":\"Cashier\",\"role\":\"cashier\",\"age\":25,\"address\":\"X\",\"username\":\"day0cashier\",\"password\":\"Test1234!\",\"company_id\":$CID,\"branch_id\":$BID}"
```
Expected: `201`.

```bash
curl -s -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"first_name\":\"Test\",\"last_name\":\"StockMgr\",\"role\":\"stock_manager\",\"age\":28,\"address\":\"X\",\"username\":\"day0stockmgr\",\"password\":\"Test1234!\",\"company_id\":$CID,\"branch_id\":$BID,\"manager_pin\":\"1234\"}"
```
Expected: `201` (PIN'li).

Yanlış şirkete ait `branch_id`/`region_id`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d "{\"first_name\":\"X\",\"last_name\":\"Y\",\"role\":\"cashier\",\"age\":25,\"address\":\"X\",\"username\":\"day0badbranch\",\"password\":\"Test1234!\",\"company_id\":$CID,\"branch_id\":999999}"
```
Expected: `404`.

`company_id` eksik:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://admin.localhost:8000/api/employees \
  -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" \
  -d '{"first_name":"X","last_name":"Y","role":"general_manager","age":30,"address":"X","username":"day0nocompany","password":"Test1234!"}'
```
Expected: `422`.

- [ ] **Step 5: `general_manager`'ın artık `company_it` oluşturabildiğini doğrula**

```bash
GID2TOKEN=$(curl -s -X POST http://day0emptest.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"day0gm","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST http://day0emptest.localhost:8000/api/employees \
  -H "Authorization: Bearer $GID2TOKEN" -H "Content-Type: application/json" \
  -d '{"first_name":"Ikinci","last_name":"IT","role":"company_it","age":30,"address":"X","username":"day0it2","password":"Test1234!"}'
```
Expected: `201` (`region_id`/`branch_id` istenmedi, sadece `company_id` — GM'in kendi claim'inden
otomatik geliyor).

- [ ] **Step 6: Test verisini temizle**

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "
DELETE FROM employees WHERE username IN ('day0gm','day0it','day0cashier','day0stockmgr','day0it2');
DELETE FROM branches WHERE id = $BID;
DELETE FROM regions WHERE id = $RID;
DELETE FROM companies WHERE id = $CID;
"
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/employee.py backend/app/routers/employees.py
git commit -m "feat: let vendor_manager create any role and general_manager create company_it"
```

---

## Task 4: Frontend — tipler ve API istemcisi

**Files:**
- Modify: `frontend/src/types/company.ts`
- Modify: `frontend/src/api/companies.ts`
- Modify: `frontend/src/types/org.ts`
- Modify: `frontend/src/api/org.ts`
- Modify: `frontend/src/types/employee.ts`

**Interfaces:**
- Produces:
  - `CompanyCreatePayload { name: string; subdomain: string }`, `createCompany(token, payload):
    Promise<CompanyOut>`.
  - `RegionCreatePayload { company_id: number; name: string }`, `createRegion(token, payload):
    Promise<RegionOut>`.
  - `BranchCreatePayload { region_id: number; name: string }`, `createBranch(token, payload):
    Promise<BranchOut>`.
  - `EmployeeCreatePayload.company_id?: number | null` eklenir.

- [ ] **Step 1: `types/company.ts`'e ekle**

`frontend/src/types/company.ts`'in sonuna ekle:

```typescript
export interface CompanyCreatePayload {
  name: string;
  subdomain: string;
}
```

- [ ] **Step 2: `api/companies.ts`'e ekle**

`frontend/src/api/companies.ts`'in import satırını güncelle:

```typescript
import type { BrandingOut, BrandingUpdatePayload, CompanyCreatePayload, CompanyOut, FeatureOut } from "../types/company";
```

Dosyanın sonuna ekle:

```typescript
export function createCompany(token: string, payload: CompanyCreatePayload): Promise<CompanyOut> {
  return authFetch<CompanyOut>(token, "/api/companies", { method: "POST", body: JSON.stringify(payload) });
}
```

- [ ] **Step 3: `types/org.ts`'e ekle**

`frontend/src/types/org.ts`'in sonuna ekle:

```typescript
export interface RegionCreatePayload {
  company_id: number;
  name: string;
}

export interface BranchCreatePayload {
  region_id: number;
  name: string;
}
```

- [ ] **Step 4: `api/org.ts`'e ekle**

`frontend/src/api/org.ts`'in import satırını güncelle:

```typescript
import type { BranchCreatePayload, BranchOut, RegionCreatePayload, RegionOut } from "../types/org";
```

Dosyanın sonuna ekle:

```typescript
export function createRegion(token: string, payload: RegionCreatePayload): Promise<RegionOut> {
  return authFetch<RegionOut>(token, "/api/regions", { method: "POST", body: JSON.stringify(payload) });
}

export function createBranch(token: string, payload: BranchCreatePayload): Promise<BranchOut> {
  return authFetch<BranchOut>(token, "/api/branches", { method: "POST", body: JSON.stringify(payload) });
}
```

- [ ] **Step 5: `types/employee.ts`'i güncelle**

`frontend/src/types/employee.ts`'teki `EmployeeCreatePayload`'a ekle:

```typescript
export interface EmployeeCreatePayload {
  first_name: string;
  last_name: string;
  role: string;
  age: number;
  address: string;
  username?: string | null;
  password?: string | null;
  branch_id?: number | null; // region_manager → branch_manager / vendor_manager → şube-scoped roller
  region_id?: number | null; // general_manager → region_manager / vendor_manager → region_manager
  company_id?: number | null; // sadece vendor_manager — hedef şirket
  manager_pin?: string | null; // sadece PIN_APPROVER_ROLES
}
```

- [ ] **Step 6: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/company.ts frontend/src/api/companies.ts frontend/src/types/org.ts frontend/src/api/org.ts frontend/src/types/employee.ts
git commit -m "feat: add company/region/branch creation API client functions"
```

---

## Task 5: Frontend — `EmployeeManagementPage.tsx`'i GM↔company_it için düzelt

**Files:**
- Modify: `frontend/src/pages/EmployeeManagementPage.tsx`

**Interfaces:**
- Consumes: Task 3'ün backend `CREATABLE_ROLES["general_manager"]` değişikliği.

**Neden gerekli:** Bu sayfadaki frontend-side `CREATABLE_ROLES` haritası backend'i mirror ediyor.
`general_manager`'a `company_it` eklenince, sayfa iki hedef rolden birini seçtirmeye başlayacak
(`showRoleSelect = targetRoles.length > 1`) — ama mevcut "hedef bölge seçici" `creatorRole ===
"general_manager"` koşuluna bağlı, yani **seçilen rol `company_it` olsa bile** (region gerektirmeyen
bir rol) region seçici gösterilmeye devam ederdi. Bu task, koşulu seçilen role (`form.role`) göre
düzeltir.

- [ ] **Step 1: Frontend `CREATABLE_ROLES` haritasını güncelle**

`frontend/src/pages/EmployeeManagementPage.tsx`'teki `CREATABLE_ROLES` sabitini güncelle:

```typescript
// backend/app/routers/employees.py::CREATABLE_ROLES ile birebir eşleşir (vendor_manager hariç —
// vendor_manager bu sayfayı kullanmıyor, kendi Day0SetupPage'i var).
const CREATABLE_ROLES: Record<string, string[]> = {
  branch_manager: ["cashier", "stock_manager", "seller_manager"],
  region_manager: ["branch_manager"],
  general_manager: ["region_manager", "company_it"],
  company_it: ["general_manager"],
};
```

- [ ] **Step 2: Bölge seçici koşulunu `form.role`'e bağla**

`{!editing && creatorRole === "general_manager" && (` satırını bul, `creatorRole ===
"general_manager"` yerine `form.role === "region_manager"` kullan:

```tsx
            {!editing && form.role === "region_manager" && (
              <div className="field">
                <label>{t("employees.targetRegion")}</label>
                <select className="input" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
```

- [ ] **Step 3: `handleSave`'deki `region_id` gönderimini de `form.role`'e bağla**

`createEmployee` çağrısındaki şu satırı:

```typescript
          region_id: creatorRole === "general_manager" ? Number(form.region_id) : undefined,
```

şuna değiştir:

```typescript
          region_id: form.role === "region_manager" ? Number(form.region_id) : undefined,
```

- [ ] **Step 4: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 5: Tarayıcıda uçtan uca doğrula**

`genmgr1` ile giriş yap, `/employees`'e git, "Yeni hesap" → rol dropdown'ında artık iki seçenek
olmalı ("Bölge Müdürü" / "Şirket IT"):
1. "Şirket Müdürü" (Bölge Müdürü) seçince bölge seçici görünmeli (mevcut davranış, regresyon yok).
2. "Şirket IT" seçince bölge seçici **kaybolmalı**, sadece ad/soyad/kullanıcı adı/şifre kalmalı.
3. "Şirket IT" ile bir hesap oluştur → `201`, listede görünsün.

Test verisini temizle (`docker exec summer-db-1 psql ...` ile yeni oluşturulan `company_it`
kullanıcısını sil).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/EmployeeManagementPage.tsx
git commit -m "fix: scope EmployeeManagementPage's region selector to the selected target role"
```

---

## Task 6: Frontend — `Day0SetupPage.tsx` sihirbazı

**Files:**
- Create: `frontend/src/pages/Day0SetupPage.tsx`

**Interfaces:**
- Consumes: Task 4'ün `createCompany`/`createRegion`/`createBranch`, `../api/employees::createEmployee`,
  `../api/client::apiErrorMessage`, `../auth/roleLabels::roleLabel`.
- Produces: `Day0SetupPage` React bileşeni (default export yok, named export, projedeki desenle
  tutarlı).

**Mimari:** Tek bileşen, 5 adım (`step: number`, 1-5), her adımın taslak verisi ayrı bir state
dizisinde tutulur (`regions`, `branches`, `users`), her taslak satırın `createdId: number | null`
alanı var — `null` = henüz backend'e gönderilmedi. `handleSubmit`, her diziyi sırayla dolaşıp
`createdId` hâlâ `null` olan satırları API'ye gönderir, başarılı olanın `id`'sini state'e yazar.
Bir adımda hata olursa `catch` bloğu döngüyü durdurur, önceki satırlar `createdId` ile işaretli
kaldığı için "tekrar dene" (`handleSubmit`'i tekrar çağırmak) onları atlar.

- [ ] **Step 1: Bileşeni yaz**

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { AppShell } from "../components/AppShell";
import { createCompany } from "../api/companies";
import { createRegion, createBranch } from "../api/org";
import { createEmployee } from "../api/employees";
import { apiErrorMessage } from "../api/client";

// backend/app/routers/employees.py::CREATABLE_ROLES["vendor_manager"] ile birebir eşleşir.
const ALL_ROLES = [
  "general_manager",
  "company_it",
  "region_manager",
  "branch_manager",
  "cashier",
  "stock_manager",
  "seller_manager",
  "operations_chief",
  "staff",
];

// backend/app/routers/employees.py::_VENDOR_BRANCH_SCOPED_ROLES ile birebir eşleşir.
const BRANCH_SCOPED_ROLES = new Set([
  "branch_manager",
  "cashier",
  "stock_manager",
  "seller_manager",
  "operations_chief",
  "staff",
]);

// backend/app/services/manager_pin.py::PIN_APPROVER_ROLES ile birebir eşleşir.
const PIN_APPROVER_ROLES = new Set(["stock_manager", "seller_manager", "operations_chief"]);

let nextDraftId = 1;
function newDraftId(): string {
  return String(nextDraftId++);
}

interface RegionDraft {
  draftId: string;
  name: string;
  createdId: number | null;
}

interface BranchDraft {
  draftId: string;
  regionDraftId: string;
  name: string;
  createdId: number | null;
}

interface UserDraft {
  draftId: string;
  role: string;
  first_name: string;
  last_name: string;
  age: string;
  address: string;
  username: string;
  password: string;
  manager_pin: string;
  targetRegionDraftId: string;
  targetBranchDraftId: string;
  createdId: number | null;
}

function emptyUserDraft(): UserDraft {
  return {
    draftId: newDraftId(),
    role: "general_manager",
    first_name: "",
    last_name: "",
    age: "",
    address: "",
    username: "",
    password: "",
    manager_pin: "",
    targetRegionDraftId: "",
    targetBranchDraftId: "",
    createdId: null,
  };
}

// PROCESS.md Faz "Day-0 (UC-17)" — Satıcı Yöneticisi'nin yeni bir müşteriyi (şirket+bölge+şube+tam
// org şeması) tek bir sihirbazda kurabilmesi. Detay: docs/superpowers/specs/2026-08-13-day0-vendor-
// setup-design.md. Steady-state bölge/şube ekleme (general_manager'a açılması) bu sayfanın kapsamı
// dışında, kavramsal karar verildi ama implement edilmedi.
export function Day0SetupPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [createdCompanyId, setCreatedCompanyId] = useState<number | null>(null);

  const [regions, setRegions] = useState<RegionDraft[]>([{ draftId: newDraftId(), name: "", createdId: null }]);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [users, setUsers] = useState<UserDraft[]>([emptyUserDraft()]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addRegion() {
    setRegions((prev) => [...prev, { draftId: newDraftId(), name: "", createdId: null }]);
  }

  function updateRegionName(draftId: string, name: string) {
    setRegions((prev) => prev.map((r) => (r.draftId === draftId ? { ...r, name } : r)));
  }

  function addBranch(regionDraftId: string) {
    setBranches((prev) => [...prev, { draftId: newDraftId(), regionDraftId, name: "", createdId: null }]);
  }

  function updateBranchName(draftId: string, name: string) {
    setBranches((prev) => prev.map((b) => (b.draftId === draftId ? { ...b, name } : b)));
  }

  function addUser() {
    setUsers((prev) => [...prev, emptyUserDraft()]);
  }

  function updateUser(draftId: string, patch: Partial<UserDraft>) {
    setUsers((prev) => prev.map((u) => (u.draftId === draftId ? { ...u, ...patch } : u)));
  }

  const hasGeneralManager = users.some((u) => u.role === "general_manager" && u.first_name.trim());
  const canProceedFromStep1 = companyName.trim().length > 0 && subdomain.trim().length > 0;
  const canProceedFromStep2 = regions.some((r) => r.name.trim());
  const canProceedFromStep3 = branches.some((b) => b.name.trim());
  const canProceedFromStep4 = hasGeneralManager;

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let companyId = createdCompanyId;
      if (companyId === null) {
        const company = await createCompany(token, { name: companyName.trim(), subdomain: subdomain.trim() });
        companyId = company.id;
        setCreatedCompanyId(companyId);
      }

      const nextRegions = [...regions];
      for (let i = 0; i < nextRegions.length; i++) {
        if (nextRegions[i].createdId === null && nextRegions[i].name.trim()) {
          const created = await createRegion(token, { company_id: companyId, name: nextRegions[i].name.trim() });
          nextRegions[i] = { ...nextRegions[i], createdId: created.id };
          setRegions([...nextRegions]);
        }
      }

      const nextBranches = [...branches];
      for (let i = 0; i < nextBranches.length; i++) {
        if (nextBranches[i].createdId === null && nextBranches[i].name.trim()) {
          const regionDraft = nextRegions.find((r) => r.draftId === nextBranches[i].regionDraftId);
          if (!regionDraft?.createdId) continue;
          const created = await createBranch(token, { region_id: regionDraft.createdId, name: nextBranches[i].name.trim() });
          nextBranches[i] = { ...nextBranches[i], createdId: created.id };
          setBranches([...nextBranches]);
        }
      }

      const nextUsers = [...users];
      for (let i = 0; i < nextUsers.length; i++) {
        const u = nextUsers[i];
        if (u.createdId !== null || !u.first_name.trim()) continue;
        const targetRegion = nextRegions.find((r) => r.draftId === u.targetRegionDraftId);
        const targetBranch = nextBranches.find((b) => b.draftId === u.targetBranchDraftId);
        const created = await createEmployee(token, {
          first_name: u.first_name.trim(),
          last_name: u.last_name.trim(),
          role: u.role,
          age: Number(u.age),
          address: u.address.trim(),
          username: u.username.trim(),
          password: u.password,
          company_id: companyId,
          region_id: u.role === "region_manager" ? targetRegion?.createdId ?? undefined : undefined,
          branch_id: BRANCH_SCOPED_ROLES.has(u.role) ? targetBranch?.createdId ?? undefined : undefined,
          manager_pin: PIN_APPROVER_ROLES.has(u.role) && u.manager_pin ? u.manager_pin : undefined,
        });
        nextUsers[i] = { ...nextUsers[i], createdId: created.id };
        setUsers([...nextUsers]);
      }

      setDone(true);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, t("day0.submitFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AppShell pageTitle={t("nav.day0Setup")}>
        <div className="panel">
          <div className="panel-body">
            <div className="hintbox">{t("day0.doneMessage", { name: companyName })}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle={t("nav.day0Setup")}>
      <div className="scope">{t("day0.stepIndicator", { step, total: 5 })}</div>

      <div className="panel">
        <div className="panel-body">
          {step === 1 && (
            <>
              <div className="field">
                <label>{t("day0.companyName")}</label>
                <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("day0.subdomain")}</label>
                <input className="input" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {regions.map((r) => (
                <div className="field" key={r.draftId}>
                  <label>{t("day0.regionName")}</label>
                  <input className="input" value={r.name} onChange={(e) => updateRegionName(r.draftId, e.target.value)} />
                </div>
              ))}
              <button className="btn sm ghost" onClick={addRegion}>{t("day0.addRegion")}</button>
            </>
          )}

          {step === 3 && (
            <>
              {regions.filter((r) => r.name.trim()).map((r) => (
                <div key={r.draftId} className="field">
                  <label>{t("day0.branchesForRegion", { region: r.name })}</label>
                  {branches.filter((b) => b.regionDraftId === r.draftId).map((b) => (
                    <input
                      key={b.draftId}
                      className="input"
                      style={{ marginBottom: 6 }}
                      value={b.name}
                      onChange={(e) => updateBranchName(b.draftId, e.target.value)}
                    />
                  ))}
                  <button className="btn sm ghost" onClick={() => addBranch(r.draftId)}>{t("day0.addBranch")}</button>
                </div>
              ))}
            </>
          )}

          {step === 4 && (
            <>
              {users.map((u) => (
                <div key={u.draftId} className="panel" style={{ marginBottom: 12 }}>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("day0.userRole")}</label>
                        <select
                          className="input"
                          value={u.role}
                          onChange={(e) => updateUser(u.draftId, { role: e.target.value, targetRegionDraftId: "", targetBranchDraftId: "" })}
                        >
                          {ALL_ROLES.map((role) => (
                            <option key={role} value={role}>{roleLabel(t, role)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>{t("common.firstName")}</label>
                        <input className="input" value={u.first_name} onChange={(e) => updateUser(u.draftId, { first_name: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("common.lastName")}</label>
                        <input className="input" value={u.last_name} onChange={(e) => updateUser(u.draftId, { last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("common.age")}</label>
                        <input className="input" type="number" min={0} value={u.age} onChange={(e) => updateUser(u.draftId, { age: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("common.address")}</label>
                        <input className="input" value={u.address} onChange={(e) => updateUser(u.draftId, { address: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>{t("employees.username")}</label>
                        <input className="input" value={u.username} onChange={(e) => updateUser(u.draftId, { username: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>{t("employees.tempPassword")}</label>
                        <input className="input" type="password" value={u.password} onChange={(e) => updateUser(u.draftId, { password: e.target.value })} />
                      </div>
                    </div>

                    {u.role === "region_manager" && (
                      <div className="field">
                        <label>{t("employees.targetRegion")}</label>
                        <select className="input" value={u.targetRegionDraftId} onChange={(e) => updateUser(u.draftId, { targetRegionDraftId: e.target.value })}>
                          <option value="">{t("common.selectPlaceholder")}</option>
                          {regions.filter((r) => r.name.trim()).map((r) => (
                            <option key={r.draftId} value={r.draftId}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {BRANCH_SCOPED_ROLES.has(u.role) && (
                      <div className="field">
                        <label>{t("employees.targetBranch")}</label>
                        <select className="input" value={u.targetBranchDraftId} onChange={(e) => updateUser(u.draftId, { targetBranchDraftId: e.target.value })}>
                          <option value="">{t("common.selectPlaceholder")}</option>
                          {branches.filter((b) => b.name.trim()).map((b) => (
                            <option key={b.draftId} value={b.draftId}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {PIN_APPROVER_ROLES.has(u.role) && (
                      <div className="field">
                        <label>{t("employees.managerPinCreate")}</label>
                        <input className="input" value={u.manager_pin} onChange={(e) => updateUser(u.draftId, { manager_pin: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn sm ghost" onClick={addUser}>{t("day0.addUser")}</button>
              {!hasGeneralManager && <div className="error-text">{t("day0.needGeneralManager")}</div>}
            </>
          )}

          {step === 5 && (
            <>
              <div className="field">
                <label>{t("day0.summaryCompany")}</label>
                <div>{companyName} ({subdomain})</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryRegions")}</label>
                <div>{regions.filter((r) => r.name.trim()).map((r) => r.name).join(", ")}</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryBranches")}</label>
                <div>{branches.filter((b) => b.name.trim()).map((b) => b.name).join(", ")}</div>
              </div>
              <div className="field">
                <label>{t("day0.summaryUsers")}</label>
                <div>
                  {users.filter((u) => u.first_name.trim()).map((u) => (
                    <div key={u.draftId}>
                      {u.first_name} {u.last_name} — {roleLabel(t, u.role)}
                      {u.createdId !== null ? ` (${t("day0.alreadyCreated")})` : ""}
                    </div>
                  ))}
                </div>
              </div>
              {submitError && <div className="error-text">{submitError}</div>}
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          {step > 1 && (
            <button className="btn ghost" disabled={submitting} onClick={() => setStep((s) => s - 1)}>
              {t("day0.back")}
            </button>
          )}
          {step < 5 && (
            <button
              className="btn primary"
              disabled={
                (step === 1 && !canProceedFromStep1) ||
                (step === 2 && !canProceedFromStep2) ||
                (step === 3 && !canProceedFromStep3) ||
                (step === 4 && !canProceedFromStep4)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              {t("day0.next")}
            </button>
          )}
          {step === 5 && (
            <button className="btn primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? t("common.saving") : submitError ? t("day0.retry") : t("day0.complete")}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
```

**Not (self-review, footer stil düzeltmesi):** İlk taslakta `.modal-foot` class'ı kullanılmıştı —
bu sayfa bir `.modal`/`.overlay` içinde değil, düz bir `.panel` içinde render olduğu için
`.modal-foot`'un modal-context'e özel stilleri (örn. flex-shrink davranışı) burada anlamsız/hatalı
olurdu. Düz inline flex stiliyle değiştirildi (`ProductCatalogPage.tsx`'teki pagination satırının
kullandığı desenle aynı).

- [ ] **Step 2: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Day0SetupPage.tsx
git commit -m "feat: add Day-0 vendor setup wizard page"
```

---

## Task 7: Frontend — nav + route + i18n bağlama

**Files:**
- Modify: `frontend/src/components/navConfig.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: Task 6'nın `Day0SetupPage`.

- [ ] **Step 1: `navConfig.ts`'e path ekle**

`frontend/src/components/navConfig.ts`'teki `vendor_manager` bloğunda:

```typescript
        { label: "nav.day0Setup", icon: "setup" },
```

satırını:

```typescript
        { label: "nav.day0Setup", path: "/day0-setup", icon: "setup" },
```

yap.

- [ ] **Step 2: `App.tsx`'e route ekle**

`frontend/src/App.tsx`'teki import satırlarına ekle:

```typescript
import { Day0SetupPage } from "./pages/Day0SetupPage";
```

`/employees` route'undan hemen sonra ekle:

```tsx
          <Route
            path="/day0-setup"
            element={
              <ProtectedRoute>
                <Day0SetupPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: `tr.json`'a `day0` namespace'ini ekle**

`frontend/src/i18n/locales/tr.json`'daki `"vendor"` bloğundan hemen önce (ya da sonra), üst
seviyeye yeni bir namespace ekle:

```json
  "day0": {
    "stepIndicator": "Adım {{step}} / {{total}}",
    "companyName": "Şirket adı",
    "subdomain": "Subdomain",
    "regionName": "Bölge adı",
    "addRegion": "Bölge ekle",
    "branchesForRegion": "{{region}} — şubeler",
    "addBranch": "Şube ekle",
    "userRole": "Rol",
    "addUser": "Kullanıcı ekle",
    "needGeneralManager": "En az bir Genel Müdür eklenmeli.",
    "summaryCompany": "Şirket",
    "summaryRegions": "Bölgeler",
    "summaryBranches": "Şubeler",
    "summaryUsers": "Kullanıcılar",
    "alreadyCreated": "oluşturuldu",
    "back": "Geri",
    "next": "İleri",
    "complete": "Kurulumu Tamamla",
    "retry": "Tekrar dene",
    "submitFailed": "Kurulum sırasında bir hata oluştu.",
    "doneMessage": "{{name}} başarıyla kuruldu."
  },
```

- [ ] **Step 4: `en.json`'a aynı namespace'i ekle**

```json
  "day0": {
    "stepIndicator": "Step {{step}} / {{total}}",
    "companyName": "Company name",
    "subdomain": "Subdomain",
    "regionName": "Region name",
    "addRegion": "Add region",
    "branchesForRegion": "{{region}} — branches",
    "addBranch": "Add branch",
    "userRole": "Role",
    "addUser": "Add user",
    "needGeneralManager": "At least one General Manager must be added.",
    "summaryCompany": "Company",
    "summaryRegions": "Regions",
    "summaryBranches": "Branches",
    "summaryUsers": "Users",
    "alreadyCreated": "created",
    "back": "Back",
    "next": "Next",
    "complete": "Complete Setup",
    "retry": "Retry",
    "submitFailed": "An error occurred during setup.",
    "doneMessage": "{{name}} was set up successfully."
  },
```

- [ ] **Step 5: JSON geçerliliğini doğrula**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/navConfig.ts frontend/src/App.tsx frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: wire up Day-0 setup wizard nav, route, and i18n keys"
```

---

## Task 8: Uçtan uca tarayıcı doğrulaması

**Files:** Yok (sadece doğrulama — kod değişikliği gerekmiyor, önceki task'ların sonucu test edilir).

- [ ] **Step 1: Backend + frontend'i başlat, `vendormgr1` ile giriş yap**

`admin.localhost:5173` üzerinden `vendormgr1`/`Test1234!` ile giriş yap, nav'da artık "Day-0
kurulum" linkinin tıklanabilir olduğunu doğrula.

- [ ] **Step 2: Tam bir şirket kur**

`/day0-setup`'a git:
1. Şirket adı `"Browser Test Market"`, subdomain `"browsertest"`.
2. 2 bölge ekle (`"Kuzey"`, `"Güney"`).
3. Her bölgeye 1'er şube ekle.
4. Kullanıcılar: 1 `general_manager` (zorunlu), 1 `stock_manager` (PIN'li, bir şubeye bağlı).
5. Özet ekranında her şeyin doğru göründüğünü kontrol et, "Kurulumu Tamamla"ya bas.

Expected: Başarı mesajı, `GET /api/companies`'de yeni şirket görünüyor (tarayıcı devtools/network
sekmesinden ya da ayrıca curl ile doğrula).

- [ ] **Step 3: Yeni şirkette gerçekten giriş yapılabildiğini doğrula**

Yeni oluşturulan `general_manager`'ın kullanıcı adı/şifresiyle `browsertest.localhost:5173`'ten
giriş yap — dashboard'un boş veriyle (0 ürün, 0 satış) çökmediğini gözlemle.

- [ ] **Step 4: Kısmi hata kurtarmasını doğrula**

Yeni bir Day-0 denemesi başlat, 1. adımda **zaten var olan** bir subdomain (`"browsertest"`) gir,
sona kadar ilerleyip "Kurulumu Tamamla"ya bas → şirket adımında `409` hatası bekleniyor, hata mesajı
görünmeli. Subdomain'i düzelt (`"browsertest2"`), tekrar "Tekrar dene"ye bas → bu sefer başarılı
olmalı, önceki adımlar (bölge/şube/kullanıcı taslakları) kaybolmamış olmalı.

- [ ] **Step 5: Yetkisiz rol regresyonu**

`genmgr1` ile `/day0-setup`'a direkt URL ile git — sayfa açılıyorsa bile (backend zaten 403
verecektir) "Kurulumu Tamamla" denemesi 403 ile başarısız olmalı, hiçbir şey oluşmamalı.

- [ ] **Step 6: Konsol hatasız olduğunu doğrula, test verisini temizle**

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "
DELETE FROM employees WHERE company_id IN (SELECT id FROM companies WHERE subdomain IN ('browsertest','browsertest2'));
DELETE FROM branches WHERE region_id IN (SELECT id FROM regions WHERE company_id IN (SELECT id FROM companies WHERE subdomain IN ('browsertest','browsertest2')));
DELETE FROM regions WHERE company_id IN (SELECT id FROM companies WHERE subdomain IN ('browsertest','browsertest2'));
DELETE FROM companies WHERE subdomain IN ('browsertest','browsertest2');
"
```

---

## Self-review notu (plan yazarı için, referans)

- **Spec kapsaması:** Spec'teki 9 karar maddesinin hepsi task'lara bağlanıyor — Day-0 kapsamı
  (Task 3/6), vendor'ın sürekli yetkisi (Task 3 — CREATABLE_ROLES statik, "sadece Day-0'da"
  şeklinde bir kısıt kodlanmadı), GM↔company_it (Task 3/5), genel amaçlı bölge/şube endpoint'leri
  (Task 2), sihirbaz UI (Task 6), çoklu bölge/şube (Task 6), PIN sihirbazda (Task 6), kısmi hata
  yönetimi (Task 6 `handleSubmit`), steady-state bölge/şube sahibi (kodlanmadı, sadece spec'te
  kavramsal not — Global Constraints'te açıkça belirtildi).
- **Kritik bug'ı önceden yakaladım:** `general_manager`'ın `region_id` zorunluluğu artık
  `payload.role == "region_manager"` koşuluna bağlı (Task 3) — aksi halde `company_it` hedefi de
  `region_id` isterdi, spec'in "ek alan gerekmiyor" kararıyla çelişirdi. Task 5, aynı sınıf bug'ı
  frontend'de düzeltiyor.
- **Tip tutarlılığı:** `EmployeeCreatePayload.company_id`, backend `EmployeeCreate.company_id` ile
  birebir eşleşiyor; `Day0SetupPage`'in `BRANCH_SCOPED_ROLES`/`PIN_APPROVER_ROLES` sabitleri
  backend'deki karşılıklarıyla (yorum satırlarında referans verilerek) birebir aynı.
