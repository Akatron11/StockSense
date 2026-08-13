# Excel Ürün İçe Aktarma (Import) Modülü Implementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `general_manager` rolündeki kullanıcıların, önceden tanımlı bir `.xlsx` template'ine göre
hazırlanmış bir Excel dosyasından toplu ürün ekleyebilmesini sağlamak (sadece ilk kurulum/bulk-seed
senaryosu — var olan ürünleri güncellemez).

**Architecture:** Yeni `POST /api/products/import` (senkron, hepsi-ya-da-hiçbiri) ve
`GET /api/products/import/template` endpoint'leri; parse/validate mantığı router'dan ayrı bir
`services/product_import.py` modülünde. Frontend'de `ProductCatalogPage.tsx`'e iki yeni buton +
hata listesini gösteren yeni `ImportErrorsModal` bileşeni.

**Tech Stack:** FastAPI, SQLAlchemy, `openpyxl` (yeni bağımlılık), React 19 + TypeScript, react-i18next.

## Global Constraints

- Sadece `.xlsx` dosyaları kabul edilir (CSV yok).
- Sadece `general_manager` rolü erişebilir (mevcut `require_role(claims, "general_manager")` deseni).
- Üst sınır: 2000 satır / 5MB dosya boyutu.
- Hata davranışı hepsi-ya-da-hiçbiri: herhangi bir satırda hata varsa hiçbir ürün eklenmez.
- Import sadece **yeni ürün oluşturur**, var olan SKU'yu güncellemez (var olan SKU = satır hatası).
- Template alanları `ProductCreate` şemasıyla birebir aynı: `name, sku, category, default_price,
  cost_price, best_before_date`.
- Kod tabanında otomatik test altyapısı (pytest vb.) yok — mevcut konvansiyon her endpoint'i `curl` ile
  ve/veya tarayıcıda uçtan uca doğrulamak (bkz. `TR dosyalar/PROCESS.md`'deki tüm geçmiş maddeler). Bu
  plandaki "test" adımları da bu konvansiyona uyar.
- Spec: `docs/superpowers/specs/2026-08-13-excel-product-import-design.md`.

---

## Task 1: Backend bağımlılıkları

**Files:**
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: `openpyxl` ve `python-multipart` paketlerinin projede kurulu/deklare edilmiş olması (Task 2/3
  bunlara bağımlı).

- [ ] **Step 1: Kurulu olduklarını doğrula**

Run: `cd backend && pip show openpyxl python-multipart`
Expected: İkisi de `Name:`/`Version:` satırlarıyla listelenir (zaten transitive bağımlılık olarak kurulu
— `httpx`'in currency modülüne eklenirken izlenen presedansın aynısı, bkz. PROCESS.md 2026-08-11).

- [ ] **Step 2: `requirements.txt`'e doğrudan bağımlılık olarak ekle**

`backend/requirements.txt`'in mevcut içeriği:

```
fastapi
uvicorn[standard]
sqlalchemy>=2.0
psycopg2-binary
alembic
python-dotenv
bcrypt
python-jose[cryptography]
pandas
mlxtend>=0.25
httpx
```

Sona iki satır ekle:

```
openpyxl
python-multipart
```

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: declare openpyxl and python-multipart as direct dependencies"
```

---

## Task 2: Backend — parse/validate servis modülü

**Files:**
- Create: `backend/app/services/product_import.py`

**Interfaces:**
- Consumes: `backend.app.models.Product` (sadece `Product.sku`, `Product.company_id` alanları
  sorgulanıyor — insert Task 3'te router'da yapılıyor, bu modül DB'ye yazmıyor).
- Produces:
  - `EXPECTED_HEADERS: list[str]`
  - `MAX_ROWS: int = 2000`
  - `MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024`
  - `@dataclass ParsedRow(name: str, sku: str, category: str | None, default_price: float,
    cost_price: float | None, best_before_date: date | None)`
  - `@dataclass ImportRowError(row: int | None, message: str)`
  - `def parse_and_validate(file_bytes: bytes, company_id: int, db: Session) -> tuple[list[ParsedRow],
    list[ImportRowError]]` — dosya/format hatası varsa `([], [ImportRowError(row=None, ...)])` döner,
    satır hataları varsa `([], [ImportRowError(row=N, ...), ...])` döner, hepsi geçerliyse
    `([ParsedRow, ...], [])` döner. **DB'ye hiçbir yazma yapmaz.**

- [ ] **Step 1: Modülü yaz**

```python
"""Excel ürün içe aktarma — parse + validate. DB'ye yazma yapmaz, sadece SKU çakışma kontrolü için okur.

PROCESS.md Faz 4 "Excel import modülü" (2026-08-13 brainstorming ile netleşti) — sadece ilk kurulum/
bulk-seed senaryosu, var olan ürünleri güncellemez. Detay: docs/superpowers/specs/2026-08-13-excel-
product-import-design.md
"""

from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Product

EXPECTED_HEADERS = ["name", "sku", "category", "default_price", "cost_price", "best_before_date"]
MAX_ROWS = 2000
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


@dataclass
class ParsedRow:
    name: str
    sku: str
    category: str | None
    default_price: float
    cost_price: float | None
    best_before_date: date | None


@dataclass
class ImportRowError:
    row: int | None
    message: str


def _cell_str(value: object) -> str:
    return str(value).strip() if value is not None else ""


def _is_blank_row(raw: tuple) -> bool:
    return all(cell is None or str(cell).strip() == "" for cell in raw)


def _parse_price(value: object, field_label: str, row_num: int, errors: list[str]) -> float | None:
    text = _cell_str(value)
    if not text:
        errors.append(f"{field_label} zorunlu")
        return None
    try:
        return float(text)
    except ValueError:
        errors.append(f"{field_label} geçerli bir sayı değil")
        return None


def _parse_optional_price(value: object, field_label: str, errors: list[str]) -> float | None:
    text = _cell_str(value)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        errors.append(f"{field_label} geçerli bir sayı değil")
        return None


def _parse_optional_date(value: object, errors: list[str]) -> date | None:
    if value is None or _cell_str(value) == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _cell_str(value)
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        errors.append("best_before_date geçerli bir tarih değil (YYYY-MM-DD)")
        return None


def parse_and_validate(
    file_bytes: bytes, company_id: int, db: Session
) -> tuple[list[ParsedRow], list[ImportRowError]]:
    try:
        workbook = load_workbook(BytesIO(file_bytes), data_only=True)
    except Exception:
        return [], [ImportRowError(row=None, message="Dosya okunamadı, geçerli bir .xlsx dosyası olduğundan emin olun")]

    sheet = workbook.active
    header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
    normalized_header = [_cell_str(cell) for cell in (header_row or ())]
    if normalized_header[: len(EXPECTED_HEADERS)] != EXPECTED_HEADERS:
        return [], [
            ImportRowError(
                row=None,
                message="Sütun başlıkları template ile uyuşmuyor, lütfen template'i indirip tekrar deneyin",
            )
        ]

    total_data_rows = max(sheet.max_row - 1, 0)
    if total_data_rows > MAX_ROWS:
        return [], [ImportRowError(row=None, message=f"Dosya çok büyük (maks. {MAX_ROWS} satır)")]

    existing_skus = set(db.scalars(select(Product.sku).where(Product.company_id == company_id)))

    rows: list[ParsedRow] = []
    errors: list[ImportRowError] = []
    seen_skus: dict[str, int] = {}

    row_num = 1
    for raw in sheet.iter_rows(min_row=2, values_only=True):
        row_num += 1
        if not raw or _is_blank_row(raw):
            continue

        padded = (list(raw) + [None] * 6)[:6]
        name_val, sku_val, category_val, price_val, cost_val, bbd_val = padded

        row_errors: list[str] = []

        name = _cell_str(name_val)
        if not name:
            row_errors.append("name zorunlu")

        sku = _cell_str(sku_val)
        if not sku:
            row_errors.append("sku zorunlu")

        category = _cell_str(category_val) or None

        default_price = _parse_price(price_val, "default_price", row_num, row_errors)
        cost_price = _parse_optional_price(cost_val, "cost_price", row_errors)
        best_before_date = _parse_optional_date(bbd_val, row_errors)

        if sku:
            if sku in existing_skus:
                row_errors.append(f"SKU zaten kayıtlı ({sku})")
            elif sku in seen_skus:
                row_errors.append(f"SKU tekrarlı ({sku}, satır {seen_skus[sku]} ile çakışıyor)")
            else:
                seen_skus[sku] = row_num

        if row_errors:
            for message in row_errors:
                errors.append(ImportRowError(row=row_num, message=f"Satır {row_num}: {message}"))
            continue

        rows.append(
            ParsedRow(
                name=name,
                sku=sku,
                category=category,
                default_price=default_price,  # type: ignore[arg-type]
                cost_price=cost_price,
                best_before_date=best_before_date,
            )
        )

    if errors:
        return [], errors
    return rows, []
```

**Not:** `default_price` hatalıysa (`row_errors` doluysa) zaten `continue` ile satır `rows`'a hiç
eklenmiyor, bu yüzden `ParsedRow.default_price` alanına `None` sızmıyor — `# type: ignore` sadece
statik analizör için, çalışma zamanında güvenli.

- [ ] **Step 2: Modülün import edilebildiğini doğrula**

Run: `cd backend && python -c "from app.services.product_import import parse_and_validate, EXPECTED_HEADERS, MAX_ROWS, MAX_FILE_SIZE_BYTES; print(EXPECTED_HEADERS, MAX_ROWS, MAX_FILE_SIZE_BYTES)"`
Expected: `['name', 'sku', 'category', 'default_price', 'cost_price', 'best_before_date'] 2000 5242880`
hatasız basılır.

- [ ] **Step 3: Saf mantığı gerçek DB'ye dokunmadan hızlıca doğrula (geçici script, DB'siz kısmı)**

Bu adım sadece header/satır parse mantığını (DB sorgusu olmayan kısmı) gözle kontrol eder — tam uçtan
uca doğrulama Task 3'te gerçek endpoint üzerinden `curl` ile yapılacak.

Run:
```bash
cd backend && python -c "
from openpyxl import Workbook
from io import BytesIO
wb = Workbook()
ws = wb.active
ws.append(['name','sku','category','default_price','cost_price','best_before_date'])
ws.append(['Süt 1L','SKU-MILK-TEST','İçecek',45.90,30.0,'2026-12-31'])
ws.append(['','','','','',''])
buf = BytesIO()
wb.save(buf)
print('workbook built ok, size:', len(buf.getvalue()))
"
```
Expected: `workbook built ok, size: <bir sayı>` — hatasız çalışır (bu, Task 3'teki `curl` testinde
kullanılacak örnek dosyanın da nasıl üretileceğini gösteriyor).

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/product_import.py
git commit -m "feat: add product import parse/validate service"
```

---

## Task 3: Backend — import ve template endpoint'leri

**Files:**
- Create: `backend/app/schemas/product_import.py`
- Modify: `backend/app/routers/products.py`

**Interfaces:**
- Consumes: Task 2'nin `parse_and_validate`, `EXPECTED_HEADERS`, `MAX_FILE_SIZE_BYTES`.
- Produces:
  - `POST /api/products/import` — `general_manager`, multipart `file` alanı, başarı `201` +
    `{"created": int}`, hata `422` + `{"detail": {"errors": [{"row": int | null, "message": str}, ...]}}`.
  - `GET /api/products/import/template` — `general_manager`, `200` + `.xlsx` dosyası (`Content-
    Disposition: attachment; filename=urun_import_template.xlsx`).

- [ ] **Step 1: Yeni response şemalarını yaz**

`backend/app/schemas/product_import.py` (yeni dosya):

```python
from pydantic import BaseModel


class ImportRowErrorOut(BaseModel):
    row: int | None
    message: str


class ImportErrorsOut(BaseModel):
    errors: list[ImportRowErrorOut]


class ImportResultOut(BaseModel):
    created: int
```

- [ ] **Step 2: Endpoint'lerden önce mevcut davranışı doğrula (henüz yok, 404 bekleniyor)**

Backend zaten çalışıyor olmalı (`cd backend && uvicorn app.main:app --reload` — proje konvansiyonuna
göre `--reload` olmadan da çalıştırılabilir, PROCESS.md'deki Windows notuna bakınız). `testco` seed
verisiyle `genmgr1`/`Test1234!` token'ı al:

```bash
TOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"genmgr1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" http://testco.localhost:8000/api/products/import/template \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `404` (endpoint henüz yok).

- [ ] **Step 3: `products.py`'ye import'ları ve yeni endpoint'leri ekle**

`backend/app/routers/products.py` başındaki import bloğunu güncelle:

```python
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product
from ..schemas.product import ProductCreate, ProductListOut, ProductRead, ProductUpdate
from ..schemas.product_import import ImportResultOut
from ..services.product_import import EXPECTED_HEADERS, MAX_FILE_SIZE_BYTES, parse_and_validate
```

Dosyanın sonuna (mevcut `deactivate_product` fonksiyonundan sonra) ekle:

```python
@router.post("/import", response_model=ImportResultOut, status_code=201)
def import_products(
    file: UploadFile = File(...),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """PROCESS.md Faz 4 "Excel import modülü" — sadece ilk kurulum/bulk-seed, hepsi-ya-da-hiçbiri.
    Detay: docs/superpowers/specs/2026-08-13-excel-product-import-design.md"""
    require_role(claims, "general_manager")

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="Sadece .xlsx dosyaları kabul edilir")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=422, detail="Dosya çok büyük (maks. 5MB)")

    rows, errors = parse_and_validate(file_bytes, claims["company_id"], db)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"errors": [{"row": e.row, "message": e.message} for e in errors]},
        )

    products = [
        Product(
            company_id=claims["company_id"],
            name=r.name,
            sku=r.sku,
            category=r.category,
            default_price=r.default_price,
            cost_price=r.cost_price,
            best_before_date=r.best_before_date,
        )
        for r in rows
    ]
    db.add_all(products)
    db.commit()
    return ImportResultOut(created=len(products))


@router.get("/import/template")
def download_import_template(claims: dict = Depends(get_current_claims)):
    require_role(claims, "general_manager")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Products"
    sheet.append(EXPECTED_HEADERS)
    sheet.append(["Süt 1L", "SKU-MILK-01", "İçecek", 45.90, 30.00, "2026-12-31"])
    sheet.append(["Ekmek", "SKU-BREAD-01", "Fırın", 12.50, "", ""])

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=urun_import_template.xlsx"},
    )
```

**Önemli — route sırası:** `@router.get("/import/template")`, mevcut `@router.get("/{product_id}")`'den
**önce** tanımlanmamışsa FastAPI `"import"`'u bir `product_id` olarak yakalamaya çalışır (`int` parse
hatasıyla `422` döner). Yukarıdaki blok mevcut `deactivate_product`'tan sonra (dosyanın en sonuna)
eklendiği için `GET /{product_id}` (satır 80 civarı) zaten önce tanımlı kalıyor — bu bir çakışma
oluşturur. **Bunu önlemek için** `download_import_template` fonksiyonunu, dosyada `get_product`
fonksiyonundan (satır 80-85) **önce** eklemek gerekir; `import_products` (`POST /import`) için böyle bir
çakışma yok (POST `/{product_id}` diye bir route yok), o dosyanın sonunda kalabilir.

- [ ] **Step 4: Template endpoint'ini doğrula**

```bash
curl -s -o /tmp/template.xlsx -w "%{http_code}\n" http://testco.localhost:8000/api/products/import/template \
  -H "Authorization: Bearer $TOKEN"

python -c "
from openpyxl import load_workbook
wb = load_workbook('/tmp/template.xlsx')
ws = wb.active
print([c.value for c in ws[1]])
print([c.value for c in ws[2]])
"
```
Expected: ilk komut `200` basar; ikinci komut
`['name', 'sku', 'category', 'default_price', 'cost_price', 'best_before_date']` ve
`['Süt 1L', 'SKU-MILK-01', 'İçecek', 45.9, 30.0, '2026-12-31']` basar.

- [ ] **Step 5: Yetkisiz rolle template isteği 403 döndüğünü doğrula**

```bash
CASHIER_TOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"cashier1","password":"Test1234!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /dev/null -w "%{http_code}\n" http://testco.localhost:8000/api/products/import/template \
  -H "Authorization: Bearer $CASHIER_TOKEN"
```
Expected: `403`

- [ ] **Step 6: Geçerli bir import dosyasıyla başarılı akışı doğrula**

```bash
python -c "
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.append(['name','sku','category','default_price','cost_price','best_before_date'])
ws.append(['Test Ürün A','SKU-IMPORT-TEST-A','Test',10.5,7.0,'2026-12-31'])
ws.append(['Test Ürün B','SKU-IMPORT-TEST-B','Test',20.0,'',''])
wb.save('/tmp/valid_import.xlsx')
"

curl -s -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/valid_import.xlsx"
```
Expected: `{"created":2}`

```bash
curl -s "http://testco.localhost:8000/api/products?q=SKU-IMPORT-TEST" -H "Authorization: Bearer $TOKEN"
```
Expected: `items` dizisinde 2 ürün (`SKU-IMPORT-TEST-A`, `SKU-IMPORT-TEST-B`), doğru `name`/`default_price`/
`cost_price`/`best_before_date` değerleriyle.

- [ ] **Step 7: Hatalı satır içeren dosyada hepsi-ya-da-hiçbiri davranışını doğrula**

```bash
python -c "
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.append(['name','sku','category','default_price','cost_price','best_before_date'])
ws.append(['Geçerli Ürün','SKU-IMPORT-TEST-C',None,15.0,None,None])
ws.append(['','SKU-IMPORT-TEST-D',None,'not-a-number',None,None])
ws.append(['Tekrar SKU','SKU-IMPORT-TEST-C',None,5.0,None,None])
wb.save('/tmp/invalid_import.xlsx')
"

curl -s -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/invalid_import.xlsx"
```
Expected: `422` (curl `-i` ile status koduna bakılabilir) ve gövdede
`detail.errors` içinde en az şu mesajlar: `"Satır 3: name zorunlu"`, `"Satır 3: default_price geçerli bir sayı değil"`,
`"Satır 4: SKU tekrarlı (SKU-IMPORT-TEST-C, satır 2 ile çakışıyor)"`.

```bash
curl -s "http://testco.localhost:8000/api/products?q=SKU-IMPORT-TEST-C" -H "Authorization: Bearer $TOKEN"
```
Expected: `items` **boş** — 3. satırdaki tek geçerli satır (`SKU-IMPORT-TEST-C` ilk satırı) bile
eklenmemiş olmalı (hepsi-ya-da-hiçbiri).

- [ ] **Step 8: Zaten var olan SKU ile çakışmayı doğrula**

```bash
python -c "
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.append(['name','sku','category','default_price','cost_price','best_before_date'])
ws.append(['Çakışan','SKU-IMPORT-TEST-A',None,10.0,None,None])
wb.save('/tmp/dup_sku_import.xlsx')
"

curl -s -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/dup_sku_import.xlsx"
```
Expected: `422`, `detail.errors` içinde `"Satır 2: SKU zaten kayıtlı (SKU-IMPORT-TEST-A)"` (Step 6'da
eklenmiş SKU ile çakışıyor).

- [ ] **Step 9: Yanlış sütun başlığında genel hata döndüğünü doğrula**

```bash
python -c "
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.append(['urun_adi','kod','kategori','fiyat','maliyet','skt'])
ws.append(['X','Y','Z',1,1,'2026-01-01'])
wb.save('/tmp/bad_header_import.xlsx')
"

curl -s -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/bad_header_import.xlsx"
```
Expected: `422`, `detail.errors` tek elemanlı, `row: null`,
`"Sütun başlıkları template ile uyuşmuyor, lütfen template'i indirip tekrar deneyin"`.

- [ ] **Step 10: `.xlsx` olmayan dosya ve yetkisiz rol reddini doğrula**

```bash
echo "not an excel file" > /tmp/not_excel.txt
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $TOKEN" -F "file=@/tmp/not_excel.txt"
```
Expected: `422`

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://testco.localhost:8000/api/products/import \
  -H "Authorization: Bearer $CASHIER_TOKEN" -F "file=@/tmp/valid_import.xlsx"
```
Expected: `403`

- [ ] **Step 11: Test verisini temizle**

```bash
psql -h localhost -U postgres -d stocksense -c \
  "DELETE FROM products WHERE sku LIKE 'SKU-IMPORT-TEST%';"
```
(Bağlantı bilgileri `docker-compose.yml`'deki gerçek servis adı/portla değiştirilmeli — mevcut projede
`docker exec summer-db-1 psql ...` deseni kullanılıyor, PROCESS.md'deki örneklere bakınız.)

- [ ] **Step 12: Commit**

```bash
git add backend/app/schemas/product_import.py backend/app/routers/products.py
git commit -m "feat: add product Excel import and template download endpoints"
```

---

## Task 4: Frontend — tipler ve API istemcisi

**Files:**
- Modify: `frontend/src/types/product.ts`
- Modify: `frontend/src/api/products.ts`

**Interfaces:**
- Consumes: `frontend/src/api/client.ts::API_BASE_URL`, `ApiError`.
- Produces:
  - `interface ImportRowError { row: number | null; message: string }`
  - `interface ImportResult { created: number }`
  - `async function importProducts(token: string, file: File): Promise<ImportResult>` — `422` durumunda
    `ApiError` fırlatır, `err.body` şekli `{ detail: { errors: ImportRowError[] } } | { detail: string }`.
  - `async function downloadImportTemplate(token: string): Promise<void>` — dosyayı doğrudan tarayıcıya
    indirir (blob + geçici `<a>` linkiyle), bir şey döndürmez.

**Neden `apiFetch`/`authFetch` kullanılmıyor:** `client.ts::apiFetch`, her istekte
`Content-Type: application/json` header'ı ekliyor ve yanıtı her zaman `res.json()` ile parse ediyor.
Multipart dosya yüklemede `Content-Type`'ın tarayıcı tarafından (boundary dahil) otomatik
ayarlanması gerekiyor, dosya indirmede ise yanıt JSON değil binary — bu yüzden bu iki fonksiyon kendi
`fetch` çağrısını yapıyor, `ApiError`/`API_BASE_URL`'i mevcut `client.ts`'ten yeniden kullanıyor.

- [ ] **Step 1: `types/product.ts`'e yeni tipleri ekle**

`frontend/src/types/product.ts`'in sonuna ekle:

```typescript
// backend/app/schemas/product_import.py::ImportRowErrorOut ile birebir eşleşir.
export interface ImportRowError {
  row: number | null;
  message: string;
}

// backend/app/schemas/product_import.py::ImportResultOut ile birebir eşleşir.
export interface ImportResult {
  created: number;
}
```

- [ ] **Step 2: `api/products.ts`'e import fonksiyonlarını ekle**

`frontend/src/api/products.ts`'in başındaki import satırını güncelle:

```typescript
import { authFetch, API_BASE_URL, ApiError } from "./client";
import type {
  ProductCreatePayload,
  ProductListOut,
  ProductRead,
  ProductUpdatePayload,
  ImportResult,
} from "../types/product";
```

Dosyanın sonuna ekle:

```typescript
export async function importProducts(token: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/products/import`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as ImportResult;
}

export async function downloadImportTemplate(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/products/import/template`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json().catch(() => null));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "urun_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

**Not:** `client.ts`'te `API_BASE_URL` ve `ApiError` zaten `export` edilmiş durumda (bkz.
`api/client.ts:6` ve `:8`), yeni bir export eklemeye gerek yok.

- [ ] **Step 3: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter (bu noktada `ImportErrorsModal`/`ProductCatalogPage` henüz bu fonksiyonları
çağırmıyor, sadece yeni fonksiyonların kendi içinde tip hatası olmadığını doğruluyoruz).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/product.ts frontend/src/api/products.ts
git commit -m "feat: add product import API client functions"
```

---

## Task 5: Frontend — `ImportErrorsModal` bileşeni

**Files:**
- Create: `frontend/src/components/ImportErrorsModal.tsx`

**Interfaces:**
- Consumes: `frontend/src/types/product.ts::ImportRowError` (Task 4).
- Produces: `ImportErrorsModal({ errors: ImportRowError[]; onClose: () => void })` — React bileşeni,
  mevcut `.overlay`/`.modal`/`.modal-head`/`.modal-body`/`.modal-foot` CSS sınıflarını kullanır (bkz.
  `ProductSalesModal.tsx`'teki desen).

- [ ] **Step 1: Bileşeni yaz**

```typescript
import { useTranslation } from "react-i18next";
import type { ImportRowError } from "../types/product";

interface ImportErrorsModalProps {
  errors: ImportRowError[];
  onClose: () => void;
}

// PROCESS.md Faz 4 "Excel import modülü" (2026-08-13) — hepsi-ya-da-hiçbiri validasyon hatasında
// gösterilen satır/mesaj listesi. `row: null` olan hatalar dosya/format düzeyinde (örn. yanlış sütun
// başlığı) — satır numarası olmadan gösteriliyor.
export function ImportErrorsModal({ errors, onClose }: ImportErrorsModalProps) {
  const { t } = useTranslation();

  return (
    <div className="overlay open">
      <div className="modal">
        <div className="modal-head">{t("catalog.importErrorsTitle")}</div>
        <div className="modal-body">
          <div className="error-text">{t("catalog.importErrorsIntro", { count: errors.length })}</div>
          <div className="thead" style={{ gridTemplateColumns: "80px 1fr" }}>
            <span>{t("catalog.importErrorsRow")}</span>
            <span>{t("catalog.importErrorsMessage")}</span>
          </div>
          {errors.map((err, idx) => (
            <div className="trow" style={{ gridTemplateColumns: "80px 1fr" }} key={idx}>
              <span className="muted-small">{err.row ?? "—"}</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImportErrorsModal.tsx
git commit -m "feat: add ImportErrorsModal component"
```

---

## Task 6: Frontend — i18n anahtarları

**Files:**
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Produces: `catalog.importButton`, `catalog.templateButton`, `catalog.importSuccess`,
  `catalog.importErrorsTitle`, `catalog.importErrorsIntro`, `catalog.importErrorsRow`,
  `catalog.importErrorsMessage`, `catalog.importGenericError` — Task 5 ve Task 7 bu anahtarları kullanır.

- [ ] **Step 1: `tr.json`'daki `catalog` bloğuna ekle**

`frontend/src/i18n/locales/tr.json`'da (satır 181-204 civarı) `"bbd": "SKT (best_before_date)"`
satırından sonra (kapanış `}` öncesine) virgülle ekle:

```json
    "bbd": "SKT (best_before_date)",
    "templateButton": "Template indir",
    "importButton": "Excel'den içe aktar",
    "importSuccess": "{{count}} ürün eklendi",
    "importErrorsTitle": "İçe aktarma başarısız",
    "importErrorsIntro": "{{count}} hata bulundu, hiçbir ürün eklenmedi. Dosyayı düzeltip tekrar deneyin.",
    "importErrorsRow": "Satır",
    "importErrorsMessage": "Hata",
    "importGenericError": "İçe aktarma başarısız oldu."
```

- [ ] **Step 2: `en.json`'daki `catalog` bloğuna ekle**

`frontend/src/i18n/locales/en.json`'da aynı konuma (`"bbd": "Best-before date (best_before_date)"`
satırından sonra):

```json
    "bbd": "Best-before date (best_before_date)",
    "templateButton": "Download template",
    "importButton": "Import from Excel",
    "importSuccess": "{{count}} products added",
    "importErrorsTitle": "Import failed",
    "importErrorsIntro": "{{count}} errors found, no products were added. Fix the file and try again.",
    "importErrorsRow": "Row",
    "importErrorsMessage": "Error",
    "importGenericError": "Import failed."
```

- [ ] **Step 3: JSON geçerliliğini doğrula**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: add i18n keys for product import"
```

---

## Task 7: Frontend — `ProductCatalogPage.tsx`'e bağlama

**Files:**
- Modify: `frontend/src/pages/ProductCatalogPage.tsx`

**Interfaces:**
- Consumes: Task 4'ün `importProducts`/`downloadImportTemplate`, Task 5'in `ImportErrorsModal`,
  Task 6'nın i18n anahtarları.

- [ ] **Step 1: Import satırlarını güncelle**

`frontend/src/pages/ProductCatalogPage.tsx` başındaki import bloğunu güncelle:

```typescript
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { listProducts, createProduct, updateProduct, importProducts, downloadImportTemplate } from "../api/products";
import { ApiError } from "../api/client";
import { ProductSalesModal } from "../components/ProductSalesModal";
import { ImportErrorsModal } from "../components/ImportErrorsModal";
import type { ImportRowError, ProductRead } from "../types/product";
import { formatCurrency } from "../utils/currency";
```

(`useRef` yeni eklendi — gizli dosya `<input>`'a erişmek için.)

- [ ] **Step 2: Yeni state ve handler'ları ekle**

`ProductCatalogPage` fonksiyonu içinde, mevcut `const [salesViewFor, setSalesViewFor] = useState<ProductRead | null>(null);`
satırından hemen sonra ekle:

```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportRowError[] | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
```

Mevcut `handleSave` fonksiyonundan sonra, yeni fonksiyonlar ekle:

```typescript
  async function handleTemplateDownload() {
    if (!token) return;
    try {
      await downloadImportTemplate(token);
    } catch {
      setImportMessage(t("catalog.importGenericError"));
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!token || !file) return;

    setImporting(true);
    setImportMessage(null);
    try {
      const result = await importProducts(token, file);
      setImportMessage(t("catalog.importSuccess", { count: result.created }));
      setPage(1);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
        const detail = (err.body as { detail?: unknown }).detail;
        if (typeof detail === "object" && detail !== null && "errors" in detail) {
          setImportErrors((detail as { errors: ImportRowError[] }).errors);
          return;
        }
      }
      setImportMessage(t("catalog.importGenericError"));
    } finally {
      setImporting(false);
    }
  }
```

**Not:** Mevcut dosyada arama formu için zaten `FormEvent` import edilmiş — dosya `<input type=file>`'ın
`onChange` olayı için ayrıca `ChangeEvent` import edildi (React'in standart `onChange` handler tipi,
`e.currentTarget.files` üzerinden dosyaya erişiliyor).

- [ ] **Step 3: Butonları ve gizli dosya input'unu ekle**

Mevcut panel başlığındaki buton grubunu (`<button className="btn sm primary" onClick={openCreate}>`
satırından hemen sonra, `</span>` kapanışından önce) genişlet:

```tsx
            <button className="btn sm primary" onClick={openCreate}>
              {t("catalog.newProduct")}
            </button>
            <button className="btn sm ghost" onClick={handleTemplateDownload}>
              {t("catalog.templateButton")}
            </button>
            <button className="btn sm ghost" disabled={importing} onClick={handleImportClick}>
              {importing ? t("common.saving") : t("catalog.importButton")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
```

`importMessage` başarı/genel hata mesajını, mevcut `loadError` gösterim deseniyle aynı yerde göster —
`{loadError && <div className="error-text">{loadError}</div>}` satırından hemen sonra:

```tsx
          {importMessage && <div className="muted-small">{importMessage}</div>}
```

- [ ] **Step 4: `ImportErrorsModal`'ı render et**

Dosyanın sonundaki `{salesViewFor && (...)}` bloğundan hemen sonra, `</AppShell>` kapanışından önce
ekle:

```tsx
      {importErrors && (
        <ImportErrorsModal errors={importErrors} onClose={() => setImportErrors(null)} />
      )}
```

- [ ] **Step 5: Tip kontrolünü çalıştır**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: Hatasız biter.

- [ ] **Step 6: Tarayıcıda uçtan uca doğrula**

`genmgr1` ile giriş yapıp `/catalog`'a git:
1. "Template indir" tıkla → `urun_import_template.xlsx` indirilir, açılınca doğru sütun başlıkları +
   2 örnek satır görünür.
2. Task 3 Step 6'da kullanılan `/tmp/valid_import.xlsx` (veya benzer, geçerli bir dosya) ile
   "Excel'den içe aktar" → dosya seç → başarı mesajı (`"2 ürün eklendi"`) görünür, liste yenilenir, yeni
   ürünler tabloda görünür.
3. Task 3 Step 7'deki gibi hatalı bir dosya ile içe aktar → `ImportErrorsModal` açılır, satır no + mesaj
   listesi doğru gösterilir, "Kapat" ile kapanır.
4. `branchmgr1` ile giriş yapıp `/catalog`'a git → sayfa zaten `general_manager`'a özel olduğu için bu
   rol `/catalog`'u hiç göremiyor olmalı (regresyon kontrolü — mevcut nav/route kısıtı).
5. Tarayıcı konsolunda hata olmadığını doğrula.
6. Test verisini temizle (Task 3 Step 11'deki gibi, `SKU-IMPORT-TEST%` deseniyle).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ProductCatalogPage.tsx
git commit -m "feat: wire up Excel product import UI in product catalog page"
```

---

## Self-review notu (plan yazarı için, referans)

- **Spec kapsaması:** Spec'teki 9 karar maddesinin hepsi bir task'a bağlanıyor — kullanım amacı/yetki
  (Task 3, `require_role`), template alanları (Task 2 `EXPECTED_HEADERS`), hata davranışı (Task 2+3,
  hepsi-ya-da-hiçbiri), dosya formatı (Task 3 `.xlsx` kontrolü), template sağlama (Task 3
  `download_import_template`, Task 7 buton), hata raporlama (Task 2 `ImportRowError`, Task 5 modal),
  boyut sınırı (Task 2 `MAX_ROWS`/`MAX_FILE_SIZE_BYTES`), senkron yaklaşım (Task 3 — arka plan işi yok).
- **Route sırası uyarısı** Task 3 Step 3'te açıkça belirtildi — `GET /import/template`'in
  `GET /{product_id}`'den önce tanımlanması gerektiği, aksi halde FastAPI `"import"`u `product_id` sanıp
  `422` döner.
- **DB constraint tutarlılığı:** `existing_skus` sorgusu `is_active` filtrelemiyor — DB'deki
  `UniqueConstraint("company_id", "sku")` da `is_active`'ten bağımsız olduğu için (soft-delete edilmiş
  bir ürünün SKU'su da unique kalıyor), bu tutarlı.
