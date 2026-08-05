# Sprint 5 — Layout Önerisi (Co-occurrence/Apriori) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UC-15'i (Layout Önerisi Görüntüleme) uçtan uca çalışır hale getirmek — şube satış verisinden pandas/mlxtend ile ürün çifti önerisi üreten backend, "uygulandı" kaydı, ve Seller Manager'ın kullanacağı frontend ekranı.

**Architecture:** Yeni bir `services/layout_recommendation.py` servis fonksiyonu şube hacmine göre co-occurrence (pandas) veya Apriori (mlxtend) hesabı yapar; yeni bir router (`routers/layout_suggestion.py`, `/api/reports` prefix'i altında) bunu `GET`/`POST` olarak dışarı verir; yeni bir `layout_recommendation_applications` tablosu "uygulandı" denetim kaydını tutar. Katalog Sprint 5 demo'su için 3 üründen 50 ürüne, satış verisi de iki şubeyi farklı hacimde gösterecek şekilde genişletilir (ayrı seed script).

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pandas, mlxtend, React 19 + TypeScript, react-i18next.

**Kaynak spec:** `docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md`

## Global Constraints

- Bu projede otomatik test suite yok (pytest kurulu değil, hiçbir `test_*.py` dosyası yok) — doğrulama her zaman elle: `python -m uvicorn` ile çalışan backend'e karşı `curl`/Swagger UI, ve tarayıcıda uçtan uca. Aşağıdaki her task'ın "doğrulama" adımı buna göre yazıldı (pytest değil).
- Tüm yeni backend kodu, `claims["role"]`/`claims["branch_id"]`/`claims["user_id"]` (JWT payload, `backend/app/routers/auth.py:51-58`) üzerinden çalışır — `require_role`/`get_current_claims` mevcut `deps.py` konvansiyonuna uyulur.
- `id`/FK alanları `BigInteger` (`models/base.py::Base.type_annotation_map`), her yeni tabloda `created_at` (`TimestampMixin`).
- Skor alanı her zaman 0-1 arası ondalık (`score`), yüzdeye çevirme işi frontend'de (`× 100`).
- Komutlar bu repo kökünden (`C:\Users\Akatron\Desktop\summer`) çalıştırılacak şekilde yazıldı; `backend/`'e `cd` gerektiren adımlar açıkça belirtildi.

---

### Task 1: Python bağımlılıkları — pandas + mlxtend

**Files:**
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: `pandas`, `mlxtend` paketleri sonraki task'larda import edilebilir olacak.

- [ ] **Step 1: requirements.txt'e ekle**

`backend/requirements.txt` sonuna ekle:

```
pandas
mlxtend
```

- [ ] **Step 2: Kur ve doğrula**

```bash
cd backend && pip install -r requirements.txt
```

```bash
python -c "import pandas, mlxtend; from mlxtend.frequent_patterns import apriori, association_rules; from mlxtend.preprocessing import TransactionEncoder; print('ok')"
```

Beklenen: `ok` yazdırılır, hata yok.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add pandas/mlxtend for layout recommendation analytics"
```

---

### Task 2: DB modeli + migration — `layout_recommendation_applications`

**Files:**
- Create: `backend/app/models/layout.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/c48f21a9b3d7_add_layout_recommendation_applications.py`

**Interfaces:**
- Produces: `LayoutRecommendationApplication` (SQLAlchemy model) — `backend/app/models/__init__.py`'den import edilebilir, alanlar: `id, branch_id, product_a_id, product_b_id, applied_by, applied_at, created_at`.

- [ ] **Step 1: Model dosyasını yaz**

`backend/app/models/layout.py`:

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class LayoutRecommendationApplication(Base, TimestampMixin):
    """UC-15 — Seller Manager'ın bir layout önerisini 'uyguladım' olarak işaretlemesinin denetim
    kaydı. Fiziksel raf değişikliği sistem dışında gerçekleşir; bu sadece kabul/uygulama kaydı.
    Bkz. docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md — karar
    değişikliği notu (stocksense-api-tr.md'deki eski 'kayıt tutulmayacak' kararının yerini aldı).
    """

    __tablename__ = "layout_recommendation_applications"
    __table_args__ = (
        UniqueConstraint(
            "branch_id", "product_a_id", "product_b_id",
            name="uq_layout_application_branch_pair",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    product_a_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    product_b_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    applied_by: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    branch: Mapped["Branch"] = relationship()
    product_a: Mapped["Product"] = relationship(foreign_keys=[product_a_id])
    product_b: Mapped["Product"] = relationship(foreign_keys=[product_b_id])
    applied_by_employee: Mapped["Employee"] = relationship(foreign_keys=[applied_by])
```

- [ ] **Step 2: `__init__.py`'e ekle**

`backend/app/models/__init__.py` — mevcut içeriği şu hale getir:

```python
from .base import Base
from .catalog import Product, Stock, StockRequest
from .layout import LayoutRecommendationApplication
from .sales import Return, ReturnItem, Sale, SaleItem
from .staff import Employee, Shift
from .tenancy import Branch, Company, CompanyBranding, CompanyFeature, Region

__all__ = [
    "Base",
    "Company",
    "Region",
    "Branch",
    "CompanyFeature",
    "CompanyBranding",
    "Product",
    "Stock",
    "StockRequest",
    "Employee",
    "Shift",
    "Sale",
    "SaleItem",
    "Return",
    "ReturnItem",
    "LayoutRecommendationApplication",
]
```

- [ ] **Step 3: Mevcut alembic head'i doğrula**

```bash
cd backend && python -m alembic heads
```

Beklenen: `3a7c165fd5c4 (head)`.

- [ ] **Step 4: Migration dosyasını yaz**

`backend/alembic/versions/c48f21a9b3d7_add_layout_recommendation_applications.py`:

```python
"""add layout_recommendation_applications table

Revision ID: c48f21a9b3d7
Revises: 3a7c165fd5c4
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c48f21a9b3d7'
down_revision: Union[str, Sequence[str], None] = '3a7c165fd5c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('layout_recommendation_applications',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('branch_id', sa.BigInteger(), nullable=False),
    sa.Column('product_a_id', sa.BigInteger(), nullable=False),
    sa.Column('product_b_id', sa.BigInteger(), nullable=False),
    sa.Column('applied_by', sa.BigInteger(), nullable=False),
    sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
    sa.ForeignKeyConstraint(['product_a_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['product_b_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['applied_by'], ['employees.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('branch_id', 'product_a_id', 'product_b_id', name='uq_layout_application_branch_pair'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('layout_recommendation_applications')
```

- [ ] **Step 5: Migration'ı uygula ve doğrula**

```bash
cd backend && python -m alembic upgrade head
```

```bash
python -m alembic heads
```

Beklenen: `c48f21a9b3d7 (head)`, hata yok.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/layout.py backend/app/models/__init__.py backend/alembic/versions/c48f21a9b3d7_add_layout_recommendation_applications.py
git commit -m "feat: add layout_recommendation_applications table"
```

---

### Task 3: Servis katmanı — `services/layout_recommendation.py`

**Files:**
- Create: `backend/app/services/layout_recommendation.py`

**Interfaces:**
- Consumes: `Sale`, `SaleItem`, `Product` (models), `sqlalchemy.orm.Session`.
- Produces: `compute_recommendation(db: Session, branch_id: int) -> dict` — dönüş şekli:
  `{"method": "co_occurrence" | "apriori", "branch_sales_count": int, "suggestions": [{"product_a_id": int, "product_a_name": str, "product_b_id": int, "product_b_name": str, "score": float}]}`
  (`suggestions` zaten skora göre büyükten küçüğe sıralı, en fazla `TOP_N_SUGGESTIONS` eleman).

- [ ] **Step 1: Servis dosyasını yaz**

`backend/app/services/layout_recommendation.py`:

```python
"""UC-15 — Layout önerisi hesaplama motoru (mimari madde 7).

Şube hacmine göre otomatik yöntem geçişi: düşük hacimde basit co-occurrence sayımı (pandas),
yüksek hacimde Apriori/association-rule mining (mlxtend). Live-query — cache/materialized tablo
yok (mimari madde 5, "Hesaplama vs Görüntüleme Ayrımı"). Detay:
docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md.
"""

from collections import defaultdict
from itertools import combinations

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Product, Sale, SaleItem

# Kadıköy (~30-50 satış, co_occurrence) ile Beşiktaş (~300-500 satış, apriori) demo verisinin
# ortasına kalibre edildi (bkz. spec — Seed Veri bölümü). Şirket bazında yapılandırılabilir değil
# (kullanıcı kararı, 2026-08-05).
LAYOUT_METHOD_THRESHOLD_SALES = 150
TOP_N_SUGGESTIONS = 5
APRIORI_MIN_SUPPORT = 0.02


def compute_recommendation(db: Session, branch_id: int) -> dict:
    sale_ids = db.scalars(select(Sale.id).where(Sale.branch_id == branch_id)).all()
    branch_sales_count = len(sale_ids)

    if branch_sales_count == 0:
        return {"method": "co_occurrence", "branch_sales_count": 0, "suggestions": []}

    rows = db.execute(
        select(SaleItem.sale_id, SaleItem.product_id, Product.name)
        .join(Product, Product.id == SaleItem.product_id)
        .where(SaleItem.sale_id.in_(sale_ids))
    ).all()

    product_names: dict[int, str] = {}
    baskets_by_sale: dict[int, set[int]] = defaultdict(set)
    for sale_id, product_id, product_name in rows:
        baskets_by_sale[sale_id].add(product_id)
        product_names[product_id] = product_name

    basket_list = [sorted(items) for items in baskets_by_sale.values() if len(items) >= 2]

    method = "co_occurrence" if branch_sales_count < LAYOUT_METHOD_THRESHOLD_SALES else "apriori"

    if method == "co_occurrence":
        suggestions = _compute_co_occurrence(basket_list, branch_sales_count, product_names)
    else:
        suggestions = _compute_apriori(basket_list, product_names)
        if not suggestions:
            # Apriori min_support eşiğini karşılayan çift yoksa co_occurrence'a düş — Seller
            # Manager'ı elinde hiçbir öneri olmadan bırakmamak için (method alanı yine "apriori"
            # kalır, çünkü hacme göre o yöntem seçildi — sadece çıktı üretme stratejisi düşüyor).
            suggestions = _compute_co_occurrence(basket_list, branch_sales_count, product_names)

    return {
        "method": method,
        "branch_sales_count": branch_sales_count,
        "suggestions": suggestions[:TOP_N_SUGGESTIONS],
    }


def _compute_co_occurrence(
    basket_list: list[list[int]], branch_sales_count: int, product_names: dict[int, str]
) -> list[dict]:
    pair_counts: dict[tuple[int, int], int] = defaultdict(int)
    for basket in basket_list:
        for a, b in combinations(basket, 2):
            pair_counts[(a, b)] += 1

    results = [
        {
            "product_a_id": a,
            "product_a_name": product_names[a],
            "product_b_id": b,
            "product_b_name": product_names[b],
            "score": round(count / branch_sales_count, 4),
        }
        for (a, b), count in pair_counts.items()
    ]
    results.sort(key=lambda r: r["score"], reverse=True)
    return results


def _compute_apriori(basket_list: list[list[int]], product_names: dict[int, str]) -> list[dict]:
    if not basket_list:
        return []

    encoder = TransactionEncoder()
    encoded = encoder.fit(basket_list).transform(basket_list)
    df = pd.DataFrame(encoded, columns=encoder.columns_)

    frequent = apriori(df, min_support=APRIORI_MIN_SUPPORT, use_colnames=True)
    if frequent.empty:
        return []

    rules = association_rules(frequent, metric="lift", min_threshold=1.0)
    pair_rules = rules[
        (rules["antecedents"].apply(len) == 1) & (rules["consequents"].apply(len) == 1)
    ]
    if pair_rules.empty:
        return []

    best_by_pair: dict[tuple[int, int], float] = {}
    for _, rule in pair_rules.iterrows():
        a = next(iter(rule["antecedents"]))
        b = next(iter(rule["consequents"]))
        key = (a, b) if a < b else (b, a)
        best_by_pair[key] = max(best_by_pair.get(key, 0.0), float(rule["confidence"]))

    results = [
        {
            "product_a_id": a,
            "product_a_name": product_names[a],
            "product_b_id": b,
            "product_b_name": product_names[b],
            "score": round(score, 4),
        }
        for (a, b), score in best_by_pair.items()
    ]
    results.sort(key=lambda r: r["score"], reverse=True)
    return results
```

- [ ] **Step 2: Python konsolunda hızlı doğrulama (gerçek DB olmadan, saf mantık)**

```bash
cd backend && python -c "
from app.services.layout_recommendation import _compute_co_occurrence
baskets = [[1, 2], [1, 2], [1, 3], [2, 3], [1, 2]]
names = {1: 'Ekmek', 2: 'Süt', 3: 'Deterjan'}
result = _compute_co_occurrence(baskets, 5, names)
print(result)
assert result[0]['product_a_id'] == 1 and result[0]['product_b_id'] == 2
assert result[0]['score'] == 0.6
print('ok')
"
```

Beklenen: `ok` yazdırılır (5 satıştan 3'ünde ürün 1-2 çifti var → 0.6).

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/layout_recommendation.py
git commit -m "feat: add layout recommendation service (co-occurrence + apriori)"
```

---

### Task 4: Şema + router — `GET`/`POST /api/reports/layout-suggestion`

**Files:**
- Create: `backend/app/schemas/layout_suggestion.py`
- Create: `backend/app/routers/layout_suggestion.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `compute_recommendation` (Task 3), `LayoutRecommendationApplication` (Task 2), `get_current_claims`/`get_db` (mevcut `deps.py`/`database.py`).
- Produces: `GET /api/reports/layout-suggestion` → `LayoutSuggestionOut`; `POST /api/reports/layout-suggestion/apply` → `LayoutSuggestionApplyOut`.

- [ ] **Step 1: Şema dosyasını yaz**

`backend/app/schemas/layout_suggestion.py`:

```python
from datetime import datetime

from pydantic import BaseModel


class LayoutSuggestionItem(BaseModel):
    product_a_id: int
    product_a_name: str
    product_b_id: int
    product_b_name: str
    score: float
    applied: bool
    applied_at: datetime | None = None
    applied_by: int | None = None


class LayoutSuggestionOut(BaseModel):
    method: str  # "co_occurrence" | "apriori"
    branch_sales_count: int
    suggestions: list[LayoutSuggestionItem]


class LayoutSuggestionApplyIn(BaseModel):
    product_a_id: int
    product_b_id: int


class LayoutSuggestionApplyOut(BaseModel):
    product_a_id: int
    product_b_id: int
    applied: bool
    applied_at: datetime
    applied_by: int
```

- [ ] **Step 2: Router dosyasını yaz**

`backend/app/routers/layout_suggestion.py`:

```python
"""UC-15 — Layout Önerisi Görüntüleme. Sadece seller_manager, kendi şubesi (JWT'den implicit)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import LayoutRecommendationApplication
from ..schemas.layout_suggestion import (
    LayoutSuggestionApplyIn,
    LayoutSuggestionApplyOut,
    LayoutSuggestionItem,
    LayoutSuggestionOut,
)
from ..services.layout_recommendation import compute_recommendation

router = APIRouter(prefix="/api/reports", tags=["layout-suggestion"])


def _normalize_pair(product_a_id: int, product_b_id: int) -> tuple[int, int]:
    return (product_a_id, product_b_id) if product_a_id < product_b_id else (product_b_id, product_a_id)


@router.get("/layout-suggestion", response_model=LayoutSuggestionOut)
def get_layout_suggestion(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    if claims["role"] != "seller_manager":
        raise HTTPException(status_code=403, detail="Bu rapora erişim yetkiniz yok")

    branch_id = claims["branch_id"]
    result = compute_recommendation(db, branch_id)

    applications = {
        (a.product_a_id, a.product_b_id): a
        for a in db.scalars(
            select(LayoutRecommendationApplication).where(
                LayoutRecommendationApplication.branch_id == branch_id
            )
        )
    }

    suggestions = []
    for s in result["suggestions"]:
        key = _normalize_pair(s["product_a_id"], s["product_b_id"])
        applied_row = applications.get(key)
        suggestions.append(
            LayoutSuggestionItem(
                product_a_id=s["product_a_id"],
                product_a_name=s["product_a_name"],
                product_b_id=s["product_b_id"],
                product_b_name=s["product_b_name"],
                score=s["score"],
                applied=applied_row is not None,
                applied_at=applied_row.applied_at if applied_row else None,
                applied_by=applied_row.applied_by if applied_row else None,
            )
        )

    return LayoutSuggestionOut(
        method=result["method"],
        branch_sales_count=result["branch_sales_count"],
        suggestions=suggestions,
    )


@router.post("/layout-suggestion/apply", response_model=LayoutSuggestionApplyOut)
def apply_layout_suggestion(
    payload: LayoutSuggestionApplyIn,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    if claims["role"] != "seller_manager":
        raise HTTPException(status_code=403, detail="Bu işlem için yetkili değilsiniz")

    branch_id = claims["branch_id"]
    a_id, b_id = _normalize_pair(payload.product_a_id, payload.product_b_id)

    row = db.scalar(
        select(LayoutRecommendationApplication).where(
            LayoutRecommendationApplication.branch_id == branch_id,
            LayoutRecommendationApplication.product_a_id == a_id,
            LayoutRecommendationApplication.product_b_id == b_id,
        )
    )
    now = datetime.now(timezone.utc)
    if row is None:
        row = LayoutRecommendationApplication(
            branch_id=branch_id,
            product_a_id=a_id,
            product_b_id=b_id,
            applied_by=claims["user_id"],
            applied_at=now,
        )
        db.add(row)
    else:
        row.applied_by = claims["user_id"]
        row.applied_at = now
    db.commit()
    db.refresh(row)

    return LayoutSuggestionApplyOut(
        product_a_id=row.product_a_id,
        product_b_id=row.product_b_id,
        applied=True,
        applied_at=row.applied_at,
        applied_by=row.applied_by,
    )
```

- [ ] **Step 3: `main.py`'ye router'ı ekle**

`backend/app/main.py` — import listesine `layout_suggestion` ekle ve `app.include_router` çağrısını ekle:

```python
from .routers import (
    auth,
    companies,
    employees,
    layout_suggestion,
    notifications,
    org,
    products,
    reports,
    returns,
    sales,
    shifts,
    stock,
    stock_requests,
)
```

```python
app.include_router(reports.router)
app.include_router(layout_suggestion.router)
```

(`reports.router` satırının hemen altına ekle.)

- [ ] **Step 4: Backend'i başlat ve Swagger'da endpoint'lerin göründüğünü doğrula**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

Tarayıcıda `http://testco.localhost:8000/docs` aç — `GET /api/reports/layout-suggestion` ve `POST /api/reports/layout-suggestion/apply` listede görünmeli.

- [ ] **Step 5: `sellermgr1` ile curl doğrulaması**

```bash
TOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"sellermgr1","password":"Test1234!"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://testco.localhost:8000/api/reports/layout-suggestion -H "Authorization: Bearer $TOKEN"
```

Beklenen: `200`, `{"method": "co_occurrence", "branch_sales_count": 0, "suggestions": []}` (henüz satış verisi yok — Task 8'de üretilecek).

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://testco.localhost:8000/api/reports/layout-suggestion -H "Authorization: Bearer $(curl -s -X POST http://testco.localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"cashier1","password":"Test1234!"}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
```

Beklenen: `403` (cashier yetkisiz).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/layout_suggestion.py backend/app/routers/layout_suggestion.py backend/app/main.py
git commit -m "feat: add GET/POST /api/reports/layout-suggestion endpoints"
```

---

### Task 5: Ürün katalogu genişletmesi — `seed_test_data.py`

**Files:**
- Modify: `backend/seed_test_data.py`

**Interfaces:**
- Produces: testco şirketinde 50 ürün (7 kategori), `sellermgr2` (branch2, seller_manager), branch1/branch2 için genişletilmiş `Stock` satırları.

- [ ] **Step 1: `employees` listesine `sellermgr2` ekle**

`backend/seed_test_data.py` — `Employee(first_name="Ayla", last_name="StokYoneticisi2", ...)` satırının hemen altına ekle:

```python
            Employee(
                first_name="Elif", last_name="SatisYoneticisi2", username="sellermgr2",
                password_hash=pwd_hash, role="seller_manager", branch_id=branch2.id,
                company_id=company.id, age=29, address="Test Adres 15",
                manager_pin=pin_hash,
            ),
```

- [ ] **Step 2: `products` listesini 50 ürüne çıkar**

Mevcut `products = [...]` listesindeki 3 ürünü (Süt 1L, Ekmek, Deterjan 3kg) aynen bırak, hemen altına yeni bir liste ekle ve birleştir:

```python
        new_products = [
            # Süt Ürünleri
            Product(company_id=company.id, name="Yoğurt 500g", sku="SKU-YOGURT-500G", category="Süt Ürünleri", default_price=28.90, cost_price=19.00, best_before_date=date.today() + timedelta(days=6)),
            Product(company_id=company.id, name="Ayran 250ml", sku="SKU-AYRAN-250ML", category="Süt Ürünleri", default_price=9.90, cost_price=6.00, best_before_date=date.today() + timedelta(days=10)),
            Product(company_id=company.id, name="Kaşar Peyniri 400g", sku="SKU-KASAR-400G", category="Süt Ürünleri", default_price=89.90, cost_price=62.00, best_before_date=date.today() + timedelta(days=20)),
            Product(company_id=company.id, name="Beyaz Peynir 500g", sku="SKU-BEYAZPEYNIR-500G", category="Süt Ürünleri", default_price=79.90, cost_price=55.00, best_before_date=date.today() + timedelta(days=25)),
            Product(company_id=company.id, name="Tereyağı 250g", sku="SKU-TEREYAG-250G", category="Süt Ürünleri", default_price=69.90, cost_price=48.00, best_before_date=date.today() + timedelta(days=30)),
            Product(company_id=company.id, name="Krema 200ml", sku="SKU-KREMA-200ML", category="Süt Ürünleri", default_price=34.90, cost_price=24.00, best_before_date=date.today() + timedelta(days=15)),
            # Fırın
            Product(company_id=company.id, name="Tam Buğday Ekmeği", sku="SKU-TBEKMEK-01", category="Fırın", default_price=15.90, cost_price=9.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Simit", sku="SKU-SIMIT-01", category="Fırın", default_price=8.50, cost_price=4.50, best_before_date=date.today() + timedelta(days=1)),
            Product(company_id=company.id, name="Poğaça", sku="SKU-POGACA-01", category="Fırın", default_price=12.90, cost_price=7.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Kruvasan", sku="SKU-KRUVASAN-01", category="Fırın", default_price=22.90, cost_price=14.00, best_before_date=date.today() + timedelta(days=3)),
            Product(company_id=company.id, name="Baget Ekmek", sku="SKU-BAGET-01", category="Fırın", default_price=18.90, cost_price=11.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Yufka", sku="SKU-YUFKA-01", category="Fırın", default_price=24.90, cost_price=16.00, best_before_date=date.today() + timedelta(days=7)),
            # Temizlik
            Product(company_id=company.id, name="Bulaşık Deterjanı 750ml", sku="SKU-BULASIK-750ML", category="Temizlik", default_price=64.90, cost_price=45.00, best_before_date=None),
            Product(company_id=company.id, name="Çamaşır Suyu 1L", sku="SKU-CAMASIRSUYU-1L", category="Temizlik", default_price=39.90, cost_price=26.00, best_before_date=None),
            Product(company_id=company.id, name="Yüzey Temizleyici 500ml", sku="SKU-YUZEYTEMIZ-500ML", category="Temizlik", default_price=49.90, cost_price=33.00, best_before_date=None),
            Product(company_id=company.id, name="Tuvalet Kağıdı 8'li", sku="SKU-TUVALETKAGIDI-8", category="Temizlik", default_price=89.90, cost_price=62.00, best_before_date=None),
            Product(company_id=company.id, name="Kağıt Havlu", sku="SKU-KAGITHAVLU-01", category="Temizlik", default_price=44.90, cost_price=30.00, best_before_date=None),
            Product(company_id=company.id, name="Sıvı Sabun 400ml", sku="SKU-SIVISABUN-400ML", category="Temizlik", default_price=34.90, cost_price=22.00, best_before_date=None),
            # Atıştırmalık
            Product(company_id=company.id, name="Cips 150g", sku="SKU-CIPS-150G", category="Atıştırmalık", default_price=44.90, cost_price=29.00, best_before_date=None),
            Product(company_id=company.id, name="Kraker 200g", sku="SKU-KRAKER-200G", category="Atıştırmalık", default_price=32.90, cost_price=21.00, best_before_date=None),
            Product(company_id=company.id, name="Bisküvi 300g", sku="SKU-BISKUVI-300G", category="Atıştırmalık", default_price=27.90, cost_price=18.00, best_before_date=None),
            Product(company_id=company.id, name="Çikolata 100g", sku="SKU-CIKOLATA-100G", category="Atıştırmalık", default_price=39.90, cost_price=26.00, best_before_date=None),
            Product(company_id=company.id, name="Gofret 45g", sku="SKU-GOFRET-45G", category="Atıştırmalık", default_price=12.90, cost_price=8.00, best_before_date=None),
            Product(company_id=company.id, name="Fıstık 200g", sku="SKU-FISTIK-200G", category="Atıştırmalık", default_price=99.90, cost_price=70.00, best_before_date=None),
            Product(company_id=company.id, name="Kuru Üzüm 200g", sku="SKU-KURUUZUM-200G", category="Atıştırmalık", default_price=34.90, cost_price=23.00, best_before_date=None),
            # İçecek
            Product(company_id=company.id, name="Kola 1L", sku="SKU-KOLA-1L", category="İçecek", default_price=34.90, cost_price=22.00, best_before_date=None),
            Product(company_id=company.id, name="Gazoz 1L", sku="SKU-GAZOZ-1L", category="İçecek", default_price=29.90, cost_price=19.00, best_before_date=None),
            Product(company_id=company.id, name="Meyve Suyu 1L", sku="SKU-MEYVESUYU-1L", category="İçecek", default_price=44.90, cost_price=30.00, best_before_date=None),
            Product(company_id=company.id, name="Maden Suyu 500ml", sku="SKU-MADENSUYU-500ML", category="İçecek", default_price=12.90, cost_price=7.50, best_before_date=None),
            Product(company_id=company.id, name="Su 1.5L", sku="SKU-SU-1_5L", category="İçecek", default_price=9.90, cost_price=5.50, best_before_date=None),
            Product(company_id=company.id, name="Buzlu Çay 500ml", sku="SKU-BUZLUCAY-500ML", category="İçecek", default_price=24.90, cost_price=16.00, best_before_date=None),
            Product(company_id=company.id, name="Enerji İçeceği 250ml", sku="SKU-ENERJI-250ML", category="İçecek", default_price=39.90, cost_price=27.00, best_before_date=None),
            # Şarküteri
            Product(company_id=company.id, name="Zeytin 500g", sku="SKU-ZEYTIN-500G", category="Şarküteri", default_price=74.90, cost_price=52.00, best_before_date=date.today() + timedelta(days=60)),
            Product(company_id=company.id, name="Salam 200g", sku="SKU-SALAM-200G", category="Şarküteri", default_price=54.90, cost_price=38.00, best_before_date=date.today() + timedelta(days=15)),
            Product(company_id=company.id, name="Sucuk 250g", sku="SKU-SUCUK-250G", category="Şarküteri", default_price=89.90, cost_price=63.00, best_before_date=date.today() + timedelta(days=20)),
            Product(company_id=company.id, name="Sosis 300g", sku="SKU-SOSIS-300G", category="Şarküteri", default_price=64.90, cost_price=45.00, best_before_date=date.today() + timedelta(days=15)),
            Product(company_id=company.id, name="Lor Peyniri 250g", sku="SKU-LORPEYNIR-250G", category="Şarküteri", default_price=49.90, cost_price=34.00, best_before_date=date.today() + timedelta(days=12)),
            Product(company_id=company.id, name="Tulum Peyniri 300g", sku="SKU-TULUMPEYNIR-300G", category="Şarküteri", default_price=109.90, cost_price=78.00, best_before_date=date.today() + timedelta(days=30)),
            Product(company_id=company.id, name="Pastırma 150g", sku="SKU-PASTIRMA-150G", category="Şarküteri", default_price=129.90, cost_price=92.00, best_before_date=date.today() + timedelta(days=25)),
            # Kahvaltılık
            Product(company_id=company.id, name="Reçel 350g", sku="SKU-RECEL-350G", category="Kahvaltılık", default_price=44.90, cost_price=29.00, best_before_date=None),
            Product(company_id=company.id, name="Bal 450g", sku="SKU-BAL-450G", category="Kahvaltılık", default_price=149.90, cost_price=105.00, best_before_date=None),
            Product(company_id=company.id, name="Tahin 300g", sku="SKU-TAHIN-300G", category="Kahvaltılık", default_price=79.90, cost_price=55.00, best_before_date=None),
            Product(company_id=company.id, name="Pekmez 400g", sku="SKU-PEKMEZ-400G", category="Kahvaltılık", default_price=69.90, cost_price=47.00, best_before_date=None),
            Product(company_id=company.id, name="Çay 500g", sku="SKU-CAY-500G", category="Kahvaltılık", default_price=89.90, cost_price=60.00, best_before_date=None),
            Product(company_id=company.id, name="Şeker 1kg", sku="SKU-SEKER-1KG", category="Kahvaltılık", default_price=34.90, cost_price=23.00, best_before_date=None),
            Product(company_id=company.id, name="Makarna 500g", sku="SKU-MAKARNA-500G", category="Kahvaltılık", default_price=19.90, cost_price=12.00, best_before_date=None),
            Product(company_id=company.id, name="Salça 700g", sku="SKU-SALCA-700G", category="Kahvaltılık", default_price=54.90, cost_price=36.00, best_before_date=None),
        ]
        products.extend(new_products)
        db.add_all(new_products)
        db.flush()
```

Bu bloğu, mevcut `db.add_all(products)` / `db.flush()` satırlarının **hemen altına** ekle (yani `products` listesi önce eski 3 ürünle flush edilir, `id`'ler atanır, sonra 47 yeni ürün eklenip tekrar flush edilir — sıralama önemli değil ama iki flush da olsun, id çakışması riski taşımaz).

- [ ] **Step 3: `stock_rows` listesini genişlet**

Mevcut `stock_rows = [...]` bloğunun **sonuna**, `db.add_all(stock_rows)` çağrısından **önce** ekle:

```python
        products_by_sku = {p.sku: p for p in products}
        branch1_stocked_ids = {row.product_id for row in stock_rows if row.branch_id == branch1.id}
        for product in products:
            if product.id not in branch1_stocked_ids:
                stock_rows.append(
                    Stock(product_id=product.id, branch_id=branch1.id, quantity=30, low_stock_threshold=10)
                )

        branch2_skus = {
            "SKU-BREAD-01", "SKU-MILK-1L", "SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G",
            "SKU-MAKARNA-500G", "SKU-SALCA-700G",
            "SKU-CIPS-150G", "SKU-KRAKER-200G", "SKU-BISKUVI-300G", "SKU-CIKOLATA-100G",
            "SKU-GOFRET-45G", "SKU-FISTIK-200G", "SKU-KURUUZUM-200G",
            "SKU-KOLA-1L", "SKU-GAZOZ-1L", "SKU-MEYVESUYU-1L", "SKU-MADENSUYU-500ML",
            "SKU-SU-1_5L", "SKU-BUZLUCAY-500ML", "SKU-ENERJI-250ML",
        }
        branch2_stocked_ids = {row.product_id for row in stock_rows if row.branch_id == branch2.id}
        for sku in branch2_skus:
            product = products_by_sku[sku]
            if product.id not in branch2_stocked_ids:
                stock_rows.append(
                    Stock(product_id=product.id, branch_id=branch2.id, quantity=25, low_stock_threshold=8)
                )
```

- [ ] **Step 4: Script'i çalıştır ve doğrula**

```bash
cd backend && python seed_test_data.py
```

Beklenen: `Test verisi oluşturuldu.` mesajı, hata yok, kullanıcı adları listesinde `sellermgr2` de görünüyor.

```bash
python -c "
from app.database import SessionLocal
from app.models import Product, Stock, Branch, Company
db = SessionLocal()
company = db.query(Company).filter(Company.subdomain == 'testco').one()
print('ürün sayısı:', db.query(Product).filter(Product.company_id == company.id).count())
branch1 = db.query(Branch).filter(Branch.name == 'Kadıköy Şube').one()
branch2 = db.query(Branch).filter(Branch.name == 'Beşiktaş Şube').one()
print('branch1 stok satırı:', db.query(Stock).filter(Stock.branch_id == branch1.id).count())
print('branch2 stok satırı:', db.query(Stock).filter(Stock.branch_id == branch2.id).count())
db.close()
"
```

Beklenen: `ürün sayısı: 50`, `branch1 stok satırı: 50`, `branch2 stok satırı: 20`.

- [ ] **Step 5: Commit**

```bash
git add backend/seed_test_data.py
git commit -m "feat: expand seed catalog to 50 products across 7 categories, add sellermgr2"
```

---

### Task 6: Satış verisi üretimi — `seed_sales_data.py` (yeni script)

**Files:**
- Create: `backend/seed_sales_data.py`

**Interfaces:**
- Consumes: Task 5'te genişletilen katalog (`Product`, `Stock`), mevcut `Branch`/`Employee` (testco).
- Produces: Kadıköy'de ~40, Beşiktaş'ta ~400 `Sale`/`SaleItem` kaydı — 4 desenli çift ağırlıklı, gürültüyle karışık.

- [ ] **Step 1: Script'i yaz**

`backend/seed_sales_data.py`:

```python
"""Analitik demo verisi — layout önerisi (co-occurrence/Apriori) için satış üretir.

Sprint 5 kickoff tasarımı: docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md.
`seed_test_data.py`'dan SONRA çalıştırılır (testco şirketinin ürün/şube/çalışan verisine ihtiyaç
duyar). Tek seferlik script: `python seed_sales_data.py`. Var olan testco sale/sale_item verisini
temizleyip yeniden üretir (idempotent).
"""

import random
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Branch, Company, Employee, Product, Sale, SaleItem

SUBDOMAIN = "testco"

# Desenli çekirdek (mimari madde 7, "Seed/Demo Veri Stratejisi").
PATTERN_PAIRS: list[tuple[str, str]] = [
    ("SKU-BREAD-01", "SKU-MILK-1L"),
    ("SKU-CIPS-150G", "SKU-KOLA-1L"),
    ("SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G"),
    ("SKU-MAKARNA-500G", "SKU-SALCA-700G"),
]

BRANCH1_SALES_COUNT = 40
BRANCH2_SALES_COUNT = 400
PATTERN_BASKET_PROBABILITY = 0.4
EXTRA_ITEM_PROBABILITY = 0.3
DAYS_SPAN = 30


def _random_sale_datetime() -> datetime:
    days_ago = random.randint(0, DAYS_SPAN - 1)
    hour = random.randint(9, 21)
    minute = random.randint(0, 59)
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _build_basket(pattern_pairs: list[tuple[str, str]], available: list[Product]) -> list[Product]:
    by_sku = {p.sku: p for p in available}
    if random.random() < PATTERN_BASKET_PROBABILITY:
        a_sku, b_sku = random.choice(pattern_pairs)
        if a_sku in by_sku and b_sku in by_sku:
            basket = [by_sku[a_sku], by_sku[b_sku]]
            if random.random() < EXTRA_ITEM_PROBABILITY:
                basket.append(random.choice(available))
            return basket
    basket_size = random.randint(1, 3)
    return random.sample(available, k=min(basket_size, len(available)))


def _generate_sales(db, branch: Branch, employee: Employee, count: int, available: list[Product]) -> None:
    for _ in range(count):
        basket = _build_basket(PATTERN_PAIRS, available)
        sale = Sale(
            sale_date=_random_sale_datetime(),
            branch_id=branch.id,
            employee_id=employee.id,
            payment_method=random.choice(["cash", "card"]),
        )
        db.add(sale)
        db.flush()
        for product in basket:
            quantity = random.randint(1, 2)
            db.add(
                SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=quantity,
                    line_total=round(float(product.default_price) * quantity, 2),
                )
            )


def main() -> None:
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.subdomain == SUBDOMAIN).one_or_none()
        if company is None:
            raise SystemExit(f"'{SUBDOMAIN}' şirketi bulunamadı — önce `python seed_test_data.py` çalıştırın.")

        branch1 = db.query(Branch).filter(Branch.name == "Kadıköy Şube").one()
        branch2 = db.query(Branch).filter(Branch.name == "Beşiktaş Şube").one()
        cashier1 = db.query(Employee).filter(Employee.username == "cashier1").one()
        cashier2 = db.query(Employee).filter(Employee.username == "cashier2").one()

        existing_sale_ids = db.query(Sale.id).filter(Sale.branch_id.in_([branch1.id, branch2.id]))
        db.query(SaleItem).filter(SaleItem.sale_id.in_(existing_sale_ids)).delete(synchronize_session=False)
        db.query(Sale).filter(Sale.id.in_(existing_sale_ids)).delete(synchronize_session=False)
        db.commit()

        all_products = db.query(Product).filter(Product.company_id == company.id).all()
        branch1_products = all_products  # Kadıköy tüm katalogda stoklu (bkz. seed_test_data.py)

        branch2_skus = {
            "SKU-BREAD-01", "SKU-MILK-1L", "SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G",
            "SKU-MAKARNA-500G", "SKU-SALCA-700G",
            "SKU-CIPS-150G", "SKU-KRAKER-200G", "SKU-BISKUVI-300G", "SKU-CIKOLATA-100G",
            "SKU-GOFRET-45G", "SKU-FISTIK-200G", "SKU-KURUUZUM-200G",
            "SKU-KOLA-1L", "SKU-GAZOZ-1L", "SKU-MEYVESUYU-1L", "SKU-MADENSUYU-500ML",
            "SKU-SU-1_5L", "SKU-BUZLUCAY-500ML", "SKU-ENERJI-250ML",
        }
        branch2_products = [p for p in all_products if p.sku in branch2_skus]

        _generate_sales(db, branch1, cashier1, BRANCH1_SALES_COUNT, branch1_products)
        _generate_sales(db, branch2, cashier2, BRANCH2_SALES_COUNT, branch2_products)
        db.commit()

        print(f"Kadıköy: {BRANCH1_SALES_COUNT} satış üretildi.")
        print(f"Beşiktaş: {BRANCH2_SALES_COUNT} satış üretildi.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Çalıştır ve doğrula**

```bash
cd backend && python seed_sales_data.py
```

Beklenen: `Kadıköy: 40 satış üretildi.` / `Beşiktaş: 400 satış üretildi.`, hata yok.

```bash
python -c "
from app.database import SessionLocal
from app.models import Sale, Branch
db = SessionLocal()
branch1 = db.query(Branch).filter(Branch.name == 'Kadıköy Şube').one()
branch2 = db.query(Branch).filter(Branch.name == 'Beşiktaş Şube').one()
print('branch1:', db.query(Sale).filter(Sale.branch_id == branch1.id).count())
print('branch2:', db.query(Sale).filter(Sale.branch_id == branch2.id).count())
db.close()
"
```

Beklenen: `branch1: 40`, `branch2: 400`.

- [ ] **Step 3: Commit**

```bash
git add backend/seed_sales_data.py
git commit -m "feat: add sales seed script for layout recommendation demo data"
```

---

### Task 7: Backend uçtan uca doğrulama — eşik kalibrasyonu

**Files:** (kod değişikliği yok, sadece doğrulama — gerekirse Task 3'teki `LAYOUT_METHOD_THRESHOLD_SALES` ayarlanır)

**Interfaces:**
- Consumes: Task 4 (endpoint), Task 6 (seed veri).

- [ ] **Step 1: Backend'i (yeniden) başlat**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

- [ ] **Step 2: `sellermgr1` (Kadıköy, düşük hacim) ile doğrula**

```bash
TOKEN1=$(curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"sellermgr1","password":"Test1234!"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://testco.localhost:8000/api/reports/layout-suggestion -H "Authorization: Bearer $TOKEN1"
```

Beklenen: `"method": "co_occurrence"`, `"branch_sales_count": 40`, `suggestions` içinde Ekmek↔Süt 1L üst sıralarda.

- [ ] **Step 3: `sellermgr2` (Beşiktaş, yüksek hacim) ile doğrula**

```bash
TOKEN2=$(curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"sellermgr2","password":"Test1234!"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://testco.localhost:8000/api/reports/layout-suggestion -H "Authorization: Bearer $TOKEN2"
```

Beklenen: `"method": "apriori"`, `"branch_sales_count": 400`, `suggestions` dolu.

- [ ] **Step 4: Eşik yanlışsa düzelt**

Eğer Step 2'de `method: "apriori"` çıkarsa ya da Step 3'te `method: "co_occurrence"` çıkarsa, `backend/app/services/layout_recommendation.py`'deki `LAYOUT_METHOD_THRESHOLD_SALES` sabitini 40 ile 400 arasında bir değere ayarla (örn. tekrar dene: 100, 200), backend'i yeniden başlat, Step 2-3'ü tekrarla.

- [ ] **Step 5: `apply` akışını doğrula**

```bash
curl -s -X POST http://testco.localhost:8000/api/reports/layout-suggestion/apply -H "Authorization: Bearer $TOKEN1" -H "Content-Type: application/json" -d '{"product_a_id": 2, "product_b_id": 1}'
curl -s http://testco.localhost:8000/api/reports/layout-suggestion -H "Authorization: Bearer $TOKEN1"
```

(`product_a_id`/`product_b_id` değerlerini bir önceki `GET` yanıtındaki gerçek Ekmek/Süt `product_id`'leriyle değiştir.) Beklenen: `apply` `200` döner, sonraki `GET`'te ilgili çiftin `applied: true` olduğu görülür.

- [ ] **Step 6: Eşik değiştiyse commit et**

```bash
git add backend/app/services/layout_recommendation.py
git commit -m "chore: calibrate layout method threshold against seed data" --allow-empty
```

(Değişiklik yoksa bu adımı atla.)

---

### Task 8: Frontend — types + API client

**Files:**
- Create: `frontend/src/types/layoutSuggestion.ts`
- Create: `frontend/src/api/layoutSuggestion.ts`

**Interfaces:**
- Consumes: `authFetch` (`frontend/src/api/client.ts`).
- Produces: `getLayoutSuggestion(token)`, `applyLayoutSuggestion(token, productAId, productBId)`.

- [ ] **Step 1: Types dosyasını yaz**

`frontend/src/types/layoutSuggestion.ts`:

```typescript
// backend/app/schemas/layout_suggestion.py ile birebir eşleşir.
export interface LayoutSuggestionItem {
  product_a_id: number;
  product_a_name: string;
  product_b_id: number;
  product_b_name: string;
  score: number;
  applied: boolean;
  applied_at: string | null;
  applied_by: number | null;
}

export interface LayoutSuggestionOut {
  method: "co_occurrence" | "apriori";
  branch_sales_count: number;
  suggestions: LayoutSuggestionItem[];
}

export interface LayoutSuggestionApplyOut {
  product_a_id: number;
  product_b_id: number;
  applied: boolean;
  applied_at: string;
  applied_by: number;
}
```

- [ ] **Step 2: API client dosyasını yaz**

`frontend/src/api/layoutSuggestion.ts`:

```typescript
import { authFetch } from "./client";
import type { LayoutSuggestionApplyOut, LayoutSuggestionOut } from "../types/layoutSuggestion";

export function getLayoutSuggestion(token: string): Promise<LayoutSuggestionOut> {
  return authFetch<LayoutSuggestionOut>(token, "/api/reports/layout-suggestion");
}

export function applyLayoutSuggestion(
  token: string,
  productAId: number,
  productBId: number,
): Promise<LayoutSuggestionApplyOut> {
  return authFetch<LayoutSuggestionApplyOut>(token, "/api/reports/layout-suggestion/apply", {
    method: "POST",
    body: JSON.stringify({ product_a_id: productAId, product_b_id: productBId }),
  });
}
```

- [ ] **Step 3: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

Beklenen: hata yok (yeni dosyalar henüz hiçbir yerden import edilmiyor, sadece syntax/tip hatası olmadığı doğrulanıyor).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/layoutSuggestion.ts frontend/src/api/layoutSuggestion.ts
git commit -m "feat: add layout suggestion types and API client"
```

---

### Task 9: Frontend — i18n çevirileri

**Files:**
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Produces: `layoutSuggestion.*` çeviri anahtarları (Task 10'daki sayfa bunları kullanacak).

- [ ] **Step 1: `tr.json`'a ekle**

`frontend/src/i18n/locales/tr.json` — `"stockRequest": { ... }` bloğunun kapanışından (satır 228, `},`) hemen sonra ekle:

```json
  "layoutSuggestion": {
    "scopeDesc": "Kapsam: kendi şubesi · yöntem satış hacmine göre otomatik (co-occurrence / Apriori)",
    "loadError": "Öneri listesi alınamadı.",
    "methodCoOccurrence": "Yöntem: co-occurrence sayımı",
    "methodApriori": "Yöntem: Apriori (association-rule mining)",
    "salesCount": "{{count}} satış üzerinden hesaplandı",
    "colPair": "Ürün çifti",
    "colScore": "Güç",
    "colAction": "Aksiyon",
    "noSuggestionsYet": "Henüz yeterli satış verisi yok.",
    "apply": "Uygula",
    "applied": "Uygulandı",
    "applyFailed": "Uygulanamadı.",
    "applyFailedWithStatus": "Uygulanamadı ({{status}})."
  },
```

- [ ] **Step 2: `en.json`'a ekle**

`frontend/src/i18n/locales/en.json` — aynı konuma (`stockRequest` bloğunun bitişinden hemen sonra) ekle:

```json
  "layoutSuggestion": {
    "scopeDesc": "Scope: your branch · method auto-selected by sales volume (co-occurrence / Apriori)",
    "loadError": "Could not load the suggestion list.",
    "methodCoOccurrence": "Method: co-occurrence counting",
    "methodApriori": "Method: Apriori (association-rule mining)",
    "salesCount": "Computed from {{count}} sales",
    "colPair": "Product pair",
    "colScore": "Strength",
    "colAction": "Action",
    "noSuggestionsYet": "Not enough sales data yet.",
    "apply": "Apply",
    "applied": "Applied",
    "applyFailed": "Could not apply.",
    "applyFailedWithStatus": "Could not apply ({{status}})."
  },
```

- [ ] **Step 3: JSON geçerliliğini doğrula**

```bash
cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"
```

Beklenen: `ok`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: add layout suggestion i18n translations"
```

---

### Task 10: Frontend — `LayoutSuggestionPage` + route + nav

**Files:**
- Create: `frontend/src/pages/LayoutSuggestionPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/navConfig.ts`

**Interfaces:**
- Consumes: `getLayoutSuggestion`, `applyLayoutSuggestion` (Task 8), `layoutSuggestion.*` i18n key'leri (Task 9), `AppShell` (mevcut `components/AppShell.tsx`), `homeLabelForRole` (mevcut `navConfig.ts`).

- [ ] **Step 1: Sayfa bileşenini yaz**

`frontend/src/pages/LayoutSuggestionPage.tsx`:

```typescript
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
          {data
            ? t(
                data.method === "apriori"
                  ? "layoutSuggestion.methodApriori"
                  : "layoutSuggestion.methodCoOccurrence",
              )
            : ""}
          {data && (
            <span className="hint">{t("layoutSuggestion.salesCount", { count: data.branch_sales_count })}</span>
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
```

- [ ] **Step 2: Route ekle**

`frontend/src/App.tsx` — import listesine ekle:

```typescript
import { LayoutSuggestionPage } from "./pages/LayoutSuggestionPage";
```

`<Route path="/stock-request" ...>` bloğunun hemen altına ekle:

```typescript
          <Route
            path="/layout"
            element={
              <ProtectedRoute>
                <LayoutSuggestionPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Nav'a path ekle**

`frontend/src/components/navConfig.ts` — `seller_manager` bloğundaki `{ label: "nav.layoutSuggestion" }` satırını değiştir:

```typescript
        { label: "nav.layoutSuggestion", path: "/layout" },
```

(`seller_manager: [{ items: [...] }]` içindeki dördüncü öğe — mevcut halinde `path` yok, sadece bunu ekliyoruz.)

- [ ] **Step 4: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

Beklenen: hata yok.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LayoutSuggestionPage.tsx frontend/src/App.tsx frontend/src/components/navConfig.ts
git commit -m "feat: add LayoutSuggestionPage, wire /layout route and seller_manager nav"
```

---

### Task 11: Uçtan uca tarayıcı doğrulaması

**Files:** (kod değişikliği yok)

**Interfaces:**
- Consumes: Task 1-10'daki her şey.

- [ ] **Step 1: Backend + frontend'i başlat**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: `sellermgr1` ile giriş, nav'dan "Layout önerisi"**

Tarayıcıda `http://testco.localhost:5173/login` → `sellermgr1` / `Test1234!` ile giriş → sol nav'da "Layout önerisi" tıklanabilir olmalı → `/layout` sayfası açılmalı.

Beklenen: "Yöntem: co-occurrence sayımı", "40 satış üzerinden hesaplandı", liste dolu, Ekmek ↔ Süt 1L üst sırada, her satırda "Uygula" butonu.

- [ ] **Step 3: Bir öneriyi uygula**

Bir satırda "Uygula"ya tıkla → satır "Uygulandı" etiketine dönmeli, konsol hatasız.

- [ ] **Step 4: Sayfayı yenile, kalıcılığı doğrula**

Sayfayı yenile (`F5`) — az önce uygulanan çiftin hâlâ "Uygulandı" gösterdiğini doğrula (backend'den geldiği için kalıcı).

- [ ] **Step 5: `sellermgr2` ile Apriori tarafını doğrula**

Çıkış yap, `sellermgr2` / `Test1234!` ile giriş → `/layout` → "Yöntem: Apriori (association-rule mining)", "400 satış üzerinden hesaplandı".

- [ ] **Step 6: Yetkisiz rol regresyonu**

`cashier1` ile giriş yapıp nav'da "Layout önerisi" öğesinin hiç görünmediğini (seller_manager dışı roller için nav'da yok) doğrula — regresyon: diğer sayfalar (`/`, `/pos` vb.) hâlâ çalışıyor.

- [ ] **Step 7: Konsol/network kontrolü**

Tarayıcı konsolunda hata olmadığını, `/api/reports/layout-suggestion` isteklerinin `200` döndüğünü doğrula.

- [ ] **Step 8: PROCESS.md'ye tamamlanma notu ekle**

`TR dosyalar/PROCESS.md`'ye, mevcut "Sprint 4" tamamlanma maddesine benzer şekilde bir "Sprint 5 — Layout Önerisi tamamlandı" maddesi ekle (tarih, ne test edildiği, hangi kararların netleştiği — bu plan + spec dosyasına referansla). Bu adımı **kullanıcıyla birlikte** yaz (CLAUDE.md — dokümantasyon güncellemeleri kullanıcı onayı gerektirir).

- [ ] **Step 9: Commit** (yalnızca Step 8'deki PROCESS.md değişikliği için, kullanıcı onayından sonra)

```bash
git add "TR dosyalar/PROCESS.md"
git commit -m "docs: mark Sprint 5 layout recommendation as complete"
```

---

## Self-Review Notları (plan yazarı tarafından yapıldı)

- **Spec kapsaması:** Mimari (Task 2-3), veri modeli/karar değişikliği (Task 2, 4), API (Task 4), seed katalog (Task 5), seed satış (Task 6), frontend (Task 8-10), test planı (Task 7, 11) — spec'in tüm bölümleri bir task'a karşılık geliyor. SHOULD/COULD (floor-plan, simülasyon) bilinçli olarak bu plana dahil edilmedi (spec'te de kapsam dışı).
- **Placeholder taraması:** Tüm kod blokları çalışır durumda yazıldı, "TODO"/"benzer şekilde" yok. 47 yeni ürünün tam SKU/fiyat listesi Task 5'te satır satır verildi.
- **Tip tutarlılığı:** `LayoutSuggestionItem`/`LayoutSuggestionOut`/`LayoutSuggestionApplyOut` alan adları backend şeması (Task 4) ile frontend tipi (Task 8) arasında birebir aynı; `product_a_id`/`product_b_id` normalize sırası (`_normalize_pair`) hem `GET` hem `POST` tarafında tutarlı kullanılıyor.
