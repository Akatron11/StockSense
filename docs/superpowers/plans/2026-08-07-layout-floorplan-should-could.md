# Layout Floor-Plan (SHOULD) + Simülasyon (COULD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UC-15'e, Seller Manager'ın kendi şubesi için serbestçe kurduğu bir zone tabanlı floor-plan
görselleştirmesi (SHOULD) ve zone'ları sürükleyerek denenebilen bir "simülasyon modu" + 0-100
yerleşim skoru (COULD) eklemek.

**Architecture:** Yeni `layout_zones` tablosu + `stock.zone_id` (bir ürün bir şubede en fazla bir
zone'a ait). Backend'de mevcut `stock.py`/`layout_suggestion.py` konvansiyonlarıyla tutarlı yeni bir
CRUD router. Frontend'de üç yeni izole birim — saf `computeLayoutScore()` fonksiyonu, kontrollü
(controlled) bir `StorePlanCanvas` sürükle-bırak bileşeni, ve bir `ZoneEditorForm` — mevcut
`LayoutSuggestionPage.tsx`'e (MUST kısmı hiç değişmeden) entegre edilir.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend, mevcut), React + TypeScript, düz SVG/CSS
(yeni grafik kütüphanesi yok — projenin `SalesTrendChart` konvansiyonuyla tutarlı).

## Global Constraints

- Sadece `seller_manager`, kendi şubesi (mevcut UC-15 sınırı, `_resolve_target_branch`/
  `claims["branch_id"]` deseniyle tutarlı) — bkz. spec, madde 8.
- Bir ürün bir şubede en fazla bir zone'a ait, many-to-many değil — bkz. spec, karar #3.
- Zone editörü: sadece konum (`x, y`) sürüklenir, boyut (`width, height`) formla girilir, resize
  yok (MVP) — bkz. spec, karar #4.
- Ürün atama: aranabilir/filtrelenebilir seçici, checklist değil — bkz. spec, karar #5.
- Bu projede otomatik test altyapısı (pytest/vitest) yok — tüm doğrulama, `PROCESS.md`'deki mevcut
  konvansiyona uygun şekilde **manuel** (curl + tarayıcı) yapılır. Bu, "TDD" adımlarının bu planda
  "yaz → curl/tsc ile doğrula → commit" şeklinde uygulanmasının nedenidir; yeni bir test framework'ü
  kurmak bu planın kapsamı dışında (ayrı bir karar gerektirir).
- Migration revision id'leri Alembic tarafından rastgele üretilir — planda yalnızca `down_revision`
  (`c48f21a9b3d7`, mevcut head) sabit, dosya adı komut çalıştırıldığında ortaya çıkar.

---

## Task 1: Veri modeli — `LayoutZone` + `Stock.zone_id`

**Files:**
- Modify: `backend/app/models/layout.py`
- Modify: `backend/app/models/catalog.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/<auto>_add_layout_zones_and_stock_zone_id.py`

**Interfaces:**
- Produces: `LayoutZone` model (`id, branch_id, name, x, y, width, height, created_at, updated_at`),
  `Stock.zone_id` (nullable FK, `ON DELETE SET NULL`).

- [ ] **Step 1: `LayoutZone` modelini ekle**

`backend/app/models/layout.py` dosyasının tamamı (mevcut `LayoutRecommendationApplication`
korunuyor, altına ekleniyor):

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UpdatedAtMixin


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


class LayoutZone(Base, TimestampMixin, UpdatedAtMixin):
    """UC-15 SHOULD — Seller Manager'ın kendi şubesi için serbestçe oluşturduğu, floor-plan
    üzerinde konumlandırılan isimli alan (raf/reyon bölgesi). Gerçek fiziksel ölçü değil,
    görsel/göreli bir temsil. Bkz.
    docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
    """

    __tablename__ = "layout_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    branch: Mapped["Branch"] = relationship()
```

- [ ] **Step 2: `Stock`'a `zone_id` ekle**

`backend/app/models/catalog.py` içindeki `Stock` sınıfını şu şekilde güncelle (dosyanın geri kalanı
değişmiyor, sadece `Stock` sınıfının gövdesi):

```python
class Stock(Base, TimestampMixin, UpdatedAtMixin):
    """Madde 3 (Stok Yönetimi) — bridge table resolving the products<->branches many-to-many."""

    __tablename__ = "stock"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price_override: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("layout_zones.id", ondelete="SET NULL"), nullable=True
    )

    product: Mapped["Product"] = relationship(back_populates="stock")
    branch: Mapped["Branch"] = relationship(back_populates="stock")
    zone: Mapped["LayoutZone | None"] = relationship()
```

- [ ] **Step 3: `models/__init__.py`'a `LayoutZone`'u ekle**

```python
from .base import Base
from .catalog import Product, Stock, StockRequest
from .layout import LayoutRecommendationApplication, LayoutZone
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
    "LayoutZone",
]
```

- [ ] **Step 4: Migration dosyasını oluştur**

`backend/` dizininden çalıştır:

```bash
cd backend
python -m alembic revision -m "add_layout_zones_and_stock_zone_id"
```

Beklenen çıktı: `Generating .../alembic/versions/<hex>_add_layout_zones_and_stock_zone_id.py ...  done`

- [ ] **Step 5: Migration içeriğini yaz**

Oluşan dosyayı bul (`ls backend/alembic/versions | grep add_layout_zones`) ve `upgrade()`/
`downgrade()` fonksiyonlarını doldur — `revision`/`down_revision` alanlarına dokunma (Alembic zaten
`down_revision = 'c48f21a9b3d7'` olarak otomatik doldurmuş olmalı, çünkü o an tek head budur):

```python
def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'layout_zones',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('branch_id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('width', sa.Integer(), nullable=False),
        sa.Column('height', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('stock', sa.Column('zone_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_stock_zone_id_layout_zones', 'stock', 'layout_zones', ['zone_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_stock_zone_id_layout_zones', 'stock', type_='foreignkey')
    op.drop_column('stock', 'zone_id')
    op.drop_table('layout_zones')
```

- [ ] **Step 6: Migration'ı çalıştır ve doğrula**

```bash
cd backend
python -m alembic upgrade head
python -m alembic current
```

Beklenen: `current` çıktısı yeni migration'ın revision id'sini gösterir (head). Sonra:

```bash
docker exec summer-db-1 psql -U stocksense -d stocksense -c "\d layout_zones"
docker exec summer-db-1 psql -U stocksense -d stocksense -c "\d stock" | grep zone_id
```

Beklenen: `layout_zones` tablosu 9 kolonla listelenir, `stock` çıktısında `zone_id | bigint` satırı
görünür.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/layout.py backend/app/models/catalog.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: add layout_zones table and stock.zone_id column"
```

---

## Task 2: Backend — `layout_zones` CRUD router

**Files:**
- Create: `backend/app/schemas/layout_zone.py`
- Create: `backend/app/routers/layout_zones.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `LayoutZone`, `Product`, `Stock` modelleri (Task 1), `get_current_claims`/`require_role`
  (`deps.py`, mevcut).
- Produces: `GET/POST/PATCH/DELETE /api/layout-zones[/{id}]`, `LayoutZoneOut{id, name, x, y, width,
  height, products: [{id, name}]}`.

- [ ] **Step 1: Şemaları yaz**

`backend/app/schemas/layout_zone.py` (yeni dosya):

```python
from pydantic import BaseModel


class LayoutZoneProduct(BaseModel):
    id: int
    name: str


class LayoutZoneCreate(BaseModel):
    name: str
    width: int
    height: int


class LayoutZoneUpdate(BaseModel):
    name: str | None = None
    width: int | None = None
    height: int | None = None
    x: int | None = None
    y: int | None = None


class LayoutZoneOut(BaseModel):
    id: int
    name: str
    x: int
    y: int
    width: int
    height: int
    products: list[LayoutZoneProduct]
```

- [ ] **Step 2: Router'ı yaz**

`backend/app/routers/layout_zones.py` (yeni dosya):

```python
"""UC-15 SHOULD — Seller Manager'ın kendi şubesi için zone (raf/reyon bölgesi) yönetimi.
Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import LayoutZone, Product, Stock
from ..schemas.layout_zone import LayoutZoneCreate, LayoutZoneOut, LayoutZoneProduct, LayoutZoneUpdate

router = APIRouter(prefix="/api/layout-zones", tags=["layout-zones"])


def _to_out(db: Session, zone: LayoutZone) -> LayoutZoneOut:
    rows = db.execute(
        select(Product.id, Product.name)
        .join(Stock, Stock.product_id == Product.id)
        .where(Stock.branch_id == zone.branch_id, Stock.zone_id == zone.id)
    ).all()
    return LayoutZoneOut(
        id=zone.id,
        name=zone.name,
        x=zone.x,
        y=zone.y,
        width=zone.width,
        height=zone.height,
        products=[LayoutZoneProduct(id=pid, name=pname) for pid, pname in rows],
    )


def _get_own_zone(db: Session, claims: dict, zone_id: int) -> LayoutZone:
    zone = db.scalar(
        select(LayoutZone).where(LayoutZone.id == zone_id, LayoutZone.branch_id == claims["branch_id"])
    )
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.get("", response_model=list[LayoutZoneOut])
def list_layout_zones(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    require_role(claims, "seller_manager")
    zones = db.scalars(select(LayoutZone).where(LayoutZone.branch_id == claims["branch_id"])).all()
    return [_to_out(db, z) for z in zones]


@router.post("", response_model=LayoutZoneOut, status_code=201)
def create_layout_zone(
    payload: LayoutZoneCreate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "seller_manager")
    zone = LayoutZone(
        branch_id=claims["branch_id"], name=payload.name, width=payload.width, height=payload.height, x=0, y=0
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _to_out(db, zone)


@router.patch("/{zone_id}", response_model=LayoutZoneOut)
def update_layout_zone(
    zone_id: int,
    payload: LayoutZoneUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "seller_manager")
    zone = _get_own_zone(db, claims, zone_id)
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Güncellenecek alan gönderilmedi")
    for field, value in fields.items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return _to_out(db, zone)


@router.delete("/{zone_id}", status_code=204)
def delete_layout_zone(
    zone_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    require_role(claims, "seller_manager")
    zone = _get_own_zone(db, claims, zone_id)
    db.delete(zone)
    db.commit()
```

- [ ] **Step 3: Router'ı `main.py`'a kaydet**

`backend/app/main.py`'daki import ve `include_router` bloklarını güncelle:

```python
from .routers import (
    auth,
    companies,
    employees,
    layout_suggestion,
    layout_zones,
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
app.include_router(layout_suggestion.router)
app.include_router(layout_zones.router)
```
(`layout_zones.router` satırını `layout_suggestion.router`'ın hemen altına ekle.)

- [ ] **Step 4: Backend'i başlat/reload olduğunu doğrula, curl ile test et**

Backend zaten `--reload` ile çalışıyorsa otomatik yeniden başlar (bkz. `preview_logs`). Test için
önce `sellermgr1` ile giriş yapıp token al, sonra:

```bash
TOKEN="<sellermgr1 token>"
curl -s -X POST http://testco.localhost:8000/api/layout-zones \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"name":"Süt Ürünleri","width":100,"height":60}'
curl -s http://testco.localhost:8000/api/layout-zones -H "authorization: Bearer $TOKEN"
```

Beklenen: `POST` `201` + `{"id": ..., "name": "Süt Ürünleri", "x": 0, "y": 0, "width": 100, "height": 60, "products": []}`; `GET` bu zone'u listede döner. Yetkisiz rol (örn. `stockmgr1` token'ıyla aynı istek) → `403`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/layout_zone.py backend/app/routers/layout_zones.py backend/app/main.py
git commit -m "feat: add layout-zones CRUD endpoints"
```

---

## Task 3: Backend — `zone_id`'yi `PATCH /api/stock` üzerinden atanabilir yap

**Files:**
- Modify: `backend/app/schemas/stock.py`
- Modify: `backend/app/routers/stock.py`

**Interfaces:**
- Consumes: `LayoutZone` (Task 1).
- Produces: `StockUpdate.zone_id`, `StockOut.zone_id` — `PATCH /api/stock/{id}` artık `zone_id`
  alanını kabul ediyor (sadece `seller_manager` + tam-kalıtım rolleri, 2026-08-07'de eklenen
  `branch_manager`/`region_manager`/`general_manager`).

- [ ] **Step 1: Şemaya `zone_id` ekle**

`backend/app/schemas/stock.py` (tam dosya):

```python
from datetime import date

from pydantic import BaseModel, ConfigDict


class StockUpdate(BaseModel):
    quantity: int | None = None
    low_stock_threshold: int | None = None
    price_override: float | None = None
    zone_id: int | None = None


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    branch_id: int
    quantity: int
    low_stock_threshold: int
    price_override: float | None = None
    zone_id: int | None = None
    product_name: str
    sku: str
    best_before_date: date | None = None
    effective_price: float
```

- [ ] **Step 2: `stock.py`'de `ROLE_ALLOWED_FIELDS`'ı genişlet + `zone_id` doğrulaması ekle**

`backend/app/routers/stock.py`'nin başındaki import ve sabitleri güncelle:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Branch, LayoutZone, Product, Region, Stock
from ..schemas.stock import StockOut, StockUpdate

router = APIRouter(prefix="/api/stock", tags=["stock"])

# stocksense-api-tr.md — "Şube Stok Durumu": her rol sadece kendi alanını değiştirebilir.
# branch_manager/region_manager/general_manager, mimari madde 2'deki yetki kalıtımı ilkesi gereği
# Stock Manager + Seller Manager'ın TÜM alanlarını kapsar (2026-08-07, kullanıcı kararı).
# zone_id (UC-15 SHOULD, 2026-08-07) seller_manager'ın yetkisi — kalıtım zinciriyle üst rollere de geçer.
_INHERITED_FIELDS = {"quantity", "low_stock_threshold", "price_override", "zone_id"}
ROLE_ALLOWED_FIELDS = {
    "seller_manager": {"price_override", "zone_id"},
    "stock_manager": {"quantity", "low_stock_threshold"},
    "branch_manager": _INHERITED_FIELDS,
    "region_manager": _INHERITED_FIELDS,
    "general_manager": _INHERITED_FIELDS,
}
```

`_to_stock_out`'u güncelle (`zone_id` eklenir):

```python
def _to_stock_out(stock: Stock, product: Product) -> StockOut:
    return StockOut(
        product_id=stock.product_id,
        branch_id=stock.branch_id,
        quantity=stock.quantity,
        low_stock_threshold=stock.low_stock_threshold,
        price_override=stock.price_override,
        zone_id=stock.zone_id,
        product_name=product.name,
        sku=product.sku,
        best_before_date=product.best_before_date,
        effective_price=stock.price_override if stock.price_override is not None else product.default_price,
    )
```

`update_stock` fonksiyonuna, `branch = _resolve_target_branch(...)` satırından hemen sonra
`zone_id` doğrulaması ekle (zone başka bir şubeye ait olamaz):

```python
    branch = _resolve_target_branch(claims, branch_id, db)

    if "zone_id" in fields and fields["zone_id"] is not None:
        zone = db.scalar(
            select(LayoutZone).where(LayoutZone.id == fields["zone_id"], LayoutZone.branch_id == branch.id)
        )
        if zone is None:
            raise HTTPException(status_code=404, detail="Zone not found")

    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"])
    )
```

- [ ] **Step 3: Curl ile doğrula**

```bash
TOKEN="<sellermgr1 token>"
ZONE_ID="<Task 2'de oluşturulan zone id>"
curl -s -X PATCH http://testco.localhost:8000/api/stock/<product_id> \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "{\"zone_id\": $ZONE_ID}"
curl -s -X PATCH http://testco.localhost:8000/api/stock/<product_id> \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"zone_id": 999999}'
```

Beklenen: ilk istek `200` + `zone_id` doğru döner; ikinci istek (var olmayan zone) `404`. Ayrıca
`stockmgr1` token'ıyla `{"zone_id": ...}` göndermeyi dene → `403` (`ROLE_ALLOWED_FIELDS`'te yok).

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/stock.py backend/app/routers/stock.py
git commit -m "feat: allow zone_id assignment via PATCH /api/stock"
```

---

## Task 4: Backend — öneri listesine zone bilgisi ekle (SHOULD overlay verisi)

**Files:**
- Modify: `backend/app/schemas/layout_suggestion.py`
- Modify: `backend/app/routers/layout_suggestion.py`

**Interfaces:**
- Produces: `LayoutSuggestionItem.product_a_zone_id`/`product_b_zone_id` (nullable) —
  `GET /api/reports/layout-suggestion` artık her önerilen ürünün hangi zone'da olduğunu döner.

- [ ] **Step 1: Şemaya zone alanlarını ekle**

`backend/app/schemas/layout_suggestion.py`'deki `LayoutSuggestionItem`'ı güncelle:

```python
class LayoutSuggestionItem(BaseModel):
    product_a_id: int
    product_a_name: str
    product_a_zone_id: int | None = None
    product_b_id: int
    product_b_name: str
    product_b_zone_id: int | None = None
    score: float
    applied: bool
    applied_at: datetime | None = None
    applied_by: int | None = None
```

(Dosyanın geri kalanı — `LayoutSuggestionOut`, `LayoutSuggestionApplyIn`, `LayoutSuggestionApplyOut`
— değişmiyor.)

- [ ] **Step 2: Router'da zone lookup ekle**

`backend/app/routers/layout_suggestion.py`'deki import satırını güncelle:

```python
from ..models import LayoutRecommendationApplication, Product, Stock
```

`get_layout_suggestion` fonksiyonunu güncelle (`applications` sözlüğünün hemen altına zone lookup
eklenir, `suggestions.append(...)` çağrısına iki yeni alan eklenir):

```python
@router.get("/layout-suggestion", response_model=LayoutSuggestionOut)
def get_layout_suggestion(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    require_role(claims, "seller_manager")

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

    product_ids = {pid for s in result["suggestions"] for pid in (s["product_a_id"], s["product_b_id"])}
    zone_by_product: dict[int, int | None] = {}
    if product_ids:
        zone_by_product = dict(
            db.execute(
                select(Stock.product_id, Stock.zone_id).where(
                    Stock.branch_id == branch_id, Stock.product_id.in_(product_ids)
                )
            ).all()
        )

    suggestions = []
    for s in result["suggestions"]:
        key = _normalize_pair(s["product_a_id"], s["product_b_id"])
        applied_row = applications.get(key)
        suggestions.append(
            LayoutSuggestionItem(
                product_a_id=s["product_a_id"],
                product_a_name=s["product_a_name"],
                product_a_zone_id=zone_by_product.get(s["product_a_id"]),
                product_b_id=s["product_b_id"],
                product_b_name=s["product_b_name"],
                product_b_zone_id=zone_by_product.get(s["product_b_id"]),
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
```

(`apply_layout_suggestion` fonksiyonu değişmiyor.)

- [ ] **Step 3: Curl ile doğrula**

```bash
TOKEN="<sellermgr1 token>"
curl -s http://testco.localhost:8000/api/reports/layout-suggestion -H "authorization: Bearer $TOKEN"
```

Beklenen: her `suggestions[]` öğesinde `product_a_zone_id`/`product_b_zone_id` alanları var — Task 3'te
zone'a atanan ürün için gerçek zone id, atanmamış ürünler için `null`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/layout_suggestion.py backend/app/routers/layout_suggestion.py
git commit -m "feat: include zone_id per product in layout suggestion response"
```

---

## Task 5: Frontend — tipler ve API istemcileri

**Files:**
- Create: `frontend/src/types/layoutZone.ts`
- Create: `frontend/src/api/layoutZones.ts`
- Modify: `frontend/src/types/stock.ts`
- Modify: `frontend/src/types/layoutSuggestion.ts`
- Modify: `frontend/src/api/stock.ts` (zaten `branchId` desteği var, sadece tip güncellenir — kod
  değişikliği gerekmiyor, `StockUpdatePayload` tipinin genişlemesi yeterli)

**Interfaces:**
- Produces: `LayoutZoneOut`, `LayoutZoneProduct`, `LayoutZoneCreatePayload`,
  `LayoutZoneUpdatePayload`, `listLayoutZones`, `createLayoutZone`, `updateLayoutZone`,
  `deleteLayoutZone`.

- [ ] **Step 1: `types/layoutZone.ts` oluştur**

```ts
// backend/app/schemas/layout_zone.py ile birebir eşleşir.
export interface LayoutZoneProduct {
  id: number;
  name: string;
}

export interface LayoutZoneOut {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  products: LayoutZoneProduct[];
}

export interface LayoutZoneCreatePayload {
  name: string;
  width: number;
  height: number;
}

export interface LayoutZoneUpdatePayload {
  name?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}
```

- [ ] **Step 2: `api/layoutZones.ts` oluştur**

```ts
import { authFetch } from "./client";
import type { LayoutZoneCreatePayload, LayoutZoneOut, LayoutZoneUpdatePayload } from "../types/layoutZone";

export function listLayoutZones(token: string): Promise<LayoutZoneOut[]> {
  return authFetch<LayoutZoneOut[]>(token, "/api/layout-zones");
}

export function createLayoutZone(token: string, payload: LayoutZoneCreatePayload): Promise<LayoutZoneOut> {
  return authFetch<LayoutZoneOut>(token, "/api/layout-zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLayoutZone(
  token: string,
  zoneId: number,
  payload: LayoutZoneUpdatePayload,
): Promise<LayoutZoneOut> {
  return authFetch<LayoutZoneOut>(token, `/api/layout-zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteLayoutZone(token: string, zoneId: number): Promise<void> {
  return authFetch<void>(token, `/api/layout-zones/${zoneId}`, { method: "DELETE" });
}
```

- [ ] **Step 3: `types/stock.ts`'e `zone_id` ekle**

```ts
// backend/app/schemas/stock.py::StockOut ile birebir eşleşir.
export interface StockItem {
  product_id: number;
  branch_id: number;
  quantity: number;
  low_stock_threshold: number;
  price_override: number | null;
  zone_id: number | null;
  product_name: string;
  sku: string;
  best_before_date: string | null;
  effective_price: number;
}

export interface StockUpdatePayload {
  quantity?: number;
  low_stock_threshold?: number;
  price_override?: number | null;
  zone_id?: number | null;
}
```

- [ ] **Step 4: `types/layoutSuggestion.ts`'e zone alanlarını ekle**

```ts
// backend/app/schemas/layout_suggestion.py ile birebir eşleşir.
export interface LayoutSuggestionItem {
  product_a_id: number;
  product_a_name: string;
  product_a_zone_id: number | null;
  product_b_id: number;
  product_b_name: string;
  product_b_zone_id: number | null;
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

- [ ] **Step 5: Tip kontrolü**

```bash
cd frontend
npx tsc -b --noEmit
```

Beklenen: hatasız (yeni dosyalar henüz hiçbir yerde kullanılmıyor, sadece tip/export tutarlılığı
kontrol edilir).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/layoutZone.ts frontend/src/api/layoutZones.ts frontend/src/types/stock.ts frontend/src/types/layoutSuggestion.ts
git commit -m "feat: add layout zone types and API client"
```

---

## Task 6: Frontend — `computeLayoutScore` (saf fonksiyon) + canvas CSS

**Files:**
- Create: `frontend/src/utils/layoutScore.ts`
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Produces: `ZoneRect{id,x,y,width,height}`, `ScorePair{score,zoneAId,zoneBId}`,
  `computeLayoutScore(zones: ZoneRect[], pairs: ScorePair[]): number | null`.

- [ ] **Step 1: `utils/layoutScore.ts` yaz**

```ts
export interface ZoneRect {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScorePair {
  score: number; // 0..1
  zoneAId: number | null;
  zoneBId: number | null;
}

interface Point {
  cx: number;
  cy: number;
}

function centerOf(zone: ZoneRect): Point {
  return { cx: zone.x + zone.width / 2, cy: zone.y + zone.height / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function boundingBoxDiagonal(zones: ZoneRect[]): number {
  if (zones.length === 0) return 0;
  const minX = Math.min(...zones.map((z) => z.x));
  const minY = Math.min(...zones.map((z) => z.y));
  const maxX = Math.max(...zones.map((z) => z.x + z.width));
  const maxY = Math.max(...zones.map((z) => z.y + z.height));
  return Math.hypot(maxX - minX, maxY - minY);
}

// Spec: docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md — COULD bölümü,
// "Yerleşim skoru formülü". Aynı zone'daki ya da zone'suz ürün içeren çiftler hesaba katılmaz.
// Hiçbir çift hesaplanamıyorsa null döner (çağıran taraf "zone'lara ürün atayın" notunu gösterir).
export function computeLayoutScore(zones: ZoneRect[], pairs: ScorePair[]): number | null {
  const byId = new Map(zones.map((z) => [z.id, z]));
  let weightedDistanceSum = 0;
  let weightSum = 0;

  for (const pair of pairs) {
    if (pair.zoneAId === null || pair.zoneBId === null || pair.zoneAId === pair.zoneBId) continue;
    const zoneA = byId.get(pair.zoneAId);
    const zoneB = byId.get(pair.zoneBId);
    if (!zoneA || !zoneB) continue;
    const d = distance(centerOf(zoneA), centerOf(zoneB));
    weightedDistanceSum += pair.score * d;
    weightSum += pair.score;
  }

  if (weightSum === 0) return null;

  const avgDistance = weightedDistanceSum / weightSum;
  const maxDistance = boundingBoxDiagonal(zones);
  if (maxDistance === 0) return 100;

  return Math.round(100 * Math.max(0, 1 - avgDistance / maxDistance));
}
```

- [ ] **Step 2: Sanity-check betiği ile doğrula**

Geçici bir dosya oluştur, çalıştır, sonra sil:

```bash
cat > frontend/src/utils/__layoutScore.sanity.ts <<'EOF'
import { computeLayoutScore } from "./layoutScore";

// İki zone çok uzak, tek çift — skor düşük olmalı.
console.log("far:", computeLayoutScore(
  [{ id: 1, x: 0, y: 0, width: 10, height: 10 }, { id: 2, x: 500, y: 500, width: 10, height: 10 }],
  [{ score: 1, zoneAId: 1, zoneBId: 2 }],
));

// Aynı zone — yüksek skor (mesafe ~0).
console.log("same-zone-neighbors:", computeLayoutScore(
  [{ id: 1, x: 0, y: 0, width: 10, height: 10 }, { id: 2, x: 5, y: 5, width: 10, height: 10 }],
  [{ score: 1, zoneAId: 1, zoneBId: 2 }],
));

// Hesaba katılabilecek çift yok — null.
console.log("no-pairs:", computeLayoutScore(
  [{ id: 1, x: 0, y: 0, width: 10, height: 10 }],
  [{ score: 1, zoneAId: null, zoneBId: null }],
));
EOF
cd frontend
npx tsx src/utils/__layoutScore.sanity.ts
rm src/utils/__layoutScore.sanity.ts
```

Beklenen: `far` düşük bir sayı (örn. `0`-`20` aralığında), `same-zone-neighbors` yükseğe yakın
(örn. `90`+), `no-pairs` → `null`. (`npx tsx` yoksa `npm install -D tsx` ile bir kereliğine kurulur
— proje bağımlılığı olarak kalıcı eklenmez, sadece bu doğrulama için kullanılır.)

- [ ] **Step 3: Canvas CSS sınıflarını ekle**

`frontend/src/styles/app.css`'in sonuna ekle:

```css
.zone-canvas{position:relative;border:1px dashed var(--line);border-radius:var(--radius);
  background:var(--panel);overflow:hidden;touch-action:none;}
.zone-canvas-overlay{position:absolute;left:0;top:0;pointer-events:none;}
.zone-box{position:absolute;display:flex;align-items:center;justify-content:center;
  background:#ececec;border:1px solid var(--line);border-radius:6px;font-size:12px;
  color:var(--ink);cursor:grab;user-select:none;text-align:center;padding:4px;}
.zone-box:active{cursor:grabbing;}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/layoutScore.ts frontend/src/styles/app.css
git commit -m "feat: add layout score calculation and zone canvas styles"
```

---

## Task 7: Frontend — `StorePlanCanvas` bileşeni

**Files:**
- Create: `frontend/src/components/StorePlanCanvas.tsx`

**Interfaces:**
- Consumes: `computeLayoutScore`, `ZoneRect`, `ScorePair` (Task 6).
- Produces: `StorePlanCanvas` React bileşeni — kontrollü (`positions` parent'ta tutulur), `CanvasZone`,
  `OverlayLine`, `ZonePosition` tipleri.

- [ ] **Step 1: Bileşeni yaz**

`frontend/src/components/StorePlanCanvas.tsx` (yeni dosya):

```tsx
import { useEffect, useRef } from "react";
import { computeLayoutScore, type ScorePair, type ZoneRect } from "../utils/layoutScore";

export interface CanvasZone {
  id: number;
  name: string;
  width: number;
  height: number;
}

export interface OverlayLine extends ScorePair {
  key: string;
  productAName: string;
  productBName: string;
}

export interface ZonePosition {
  x: number;
  y: number;
}

interface StorePlanCanvasProps {
  zones: CanvasZone[];
  positions: Record<number, ZonePosition>;
  onPositionsChange: (next: Record<number, ZonePosition>) => void;
  onDragEnd: (zoneId: number, x: number, y: number) => void;
  overlayLines: OverlayLine[];
  onScoreChange: (score: number | null) => void;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Mağaza planı canvas'ı — zone dikdörtgenlerini çizer, sadece konum (x/y) sürüklenebilir
// (boyut sabit — zone editörü B seçeneği). Öneri çiftleri arasına bağlantı çizgisi çizer (SHOULD)
// ve yerleşim skorunu her pozisyon/öneri değişiminde parent'a bildirir (COULD).
// Kontrollü bileşen: pozisyonlar parent'ta tutulur (simülasyon modunda kaydetmeden değiştirilebilsin
// diye), bu bileşen sadece sürükleme etkileşimini + çizimi yönetir.
// Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
export function StorePlanCanvas({
  zones,
  positions,
  onPositionsChange,
  onDragEnd,
  overlayLines,
  onScoreChange,
}: StorePlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragZoneId = useRef<number | null>(null);
  const dragOffset = useRef<ZonePosition>({ x: 0, y: 0 });

  const rects: ZoneRect[] = zones.map((z) => {
    const pos = positions[z.id] ?? { x: 0, y: 0 };
    return { id: z.id, x: pos.x, y: pos.y, width: z.width, height: z.height };
  });

  useEffect(() => {
    onScoreChange(computeLayoutScore(rects, overlayLines));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, overlayLines]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, zoneId: number) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const pos = positions[zoneId];
    if (!containerRect || !pos) return;
    dragZoneId.current = zoneId;
    dragOffset.current = {
      x: e.clientX - containerRect.left - pos.x,
      y: e.clientY - containerRect.top - pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const zoneId = dragZoneId.current;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const zone = zones.find((z) => z.id === zoneId);
    if (zoneId === null || !containerRect || !zone) return;
    const nextX = clamp(e.clientX - containerRect.left - dragOffset.current.x, 0, CANVAS_WIDTH - zone.width);
    const nextY = clamp(e.clientY - containerRect.top - dragOffset.current.y, 0, CANVAS_HEIGHT - zone.height);
    onPositionsChange({ ...positions, [zoneId]: { x: nextX, y: nextY } });
  }

  function handlePointerUp() {
    const zoneId = dragZoneId.current;
    dragZoneId.current = null;
    if (zoneId === null) return;
    const pos = positions[zoneId];
    if (pos) onDragEnd(zoneId, pos.x, pos.y);
  }

  function centerOf(zoneId: number): ZonePosition | null {
    const zone = zones.find((z) => z.id === zoneId);
    const pos = positions[zoneId];
    if (!zone || !pos) return null;
    return { x: pos.x + zone.width / 2, y: pos.y + zone.height / 2 };
  }

  return (
    <div
      ref={containerRef}
      className="zone-canvas"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg className="zone-canvas-overlay" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        {overlayLines.map((line) => {
          const a = line.zoneAId !== null ? centerOf(line.zoneAId) : null;
          const b = line.zoneBId !== null ? centerOf(line.zoneBId) : null;
          if (!a || !b || line.zoneAId === line.zoneBId) return null;
          return (
            <g key={line.key}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c0392b" strokeWidth={2} strokeDasharray="4" />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fill="#c0392b" fontSize={11}>
                {Math.round(line.score * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      {zones.map((zone) => {
        const pos = positions[zone.id] ?? { x: 0, y: 0 };
        return (
          <div
            key={zone.id}
            className="zone-box"
            style={{ left: pos.x, top: pos.y, width: zone.width, height: zone.height }}
            onPointerDown={(e) => handlePointerDown(e, zone.id)}
          >
            {zone.name}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

```bash
cd frontend
npx tsc -b --noEmit
```

Beklenen: hatasız (bileşen henüz hiçbir sayfada kullanılmıyor, sadece kendi içinde tip-tutarlı).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StorePlanCanvas.tsx
git commit -m "feat: add StorePlanCanvas drag-and-drop component"
```

---

## Task 8: Frontend — `ZoneEditorForm` bileşeni

**Files:**
- Create: `frontend/src/components/ZoneEditorForm.tsx`

**Interfaces:**
- Consumes: `LayoutZoneOut` (Task 5), `searchProducts` (`api/products.ts`, mevcut), `updateStock`
  (`api/stock.ts`, mevcut), `createLayoutZone`/`updateLayoutZone`/`deleteLayoutZone` (Task 5).
- Produces: `ZoneEditorForm` React bileşeni — `{zone: LayoutZoneOut | null, onSaved: () => void,
  onCancel: () => void}` props.

- [ ] **Step 1: Bileşeni yaz**

`frontend/src/components/ZoneEditorForm.tsx` (yeni dosya):

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { searchProducts } from "../api/products";
import { updateStock } from "../api/stock";
import { createLayoutZone, deleteLayoutZone, updateLayoutZone } from "../api/layoutZones";
import { ApiError } from "../api/client";
import type { LayoutZoneOut, LayoutZoneProduct } from "../types/layoutZone";

interface ZoneEditorFormProps {
  zone: LayoutZoneOut | null; // null = yeni zone oluşturuluyor
  onSaved: () => void;
  onCancel: () => void;
}

// Zone kurma/düzenleme formu (zone editörü B seçeneği — sadece ad/boyut form ile girilir, konum
// StorePlanCanvas'ta sürüklenir). Ürün atama aranabilir/filtrelenebilir seçiciyle yapılır (checklist
// değil — büyük kataloglarda kullanılamaz, bkz. spec karar #5).
// Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
export function ZoneEditorForm({ zone, onSaved, onCancel }: ZoneEditorFormProps) {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [name, setName] = useState(zone?.name ?? "");
  const [width, setWidth] = useState(String(zone?.width ?? 100));
  const [height, setHeight] = useState(String(zone?.height ?? 60));
  const [assigned, setAssigned] = useState<LayoutZoneProduct[]>(zone?.products ?? []);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LayoutZoneProduct[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSearch() {
    if (!token || !query.trim()) return;
    setSearchError(null);
    try {
      const results = await searchProducts(token, query.trim());
      setSearchResults(results.map((p) => ({ id: p.id, name: p.name })));
    } catch {
      setSearchError(t("layoutZone.searchError"));
    }
  }

  function addProduct(product: LayoutZoneProduct) {
    if (assigned.some((p) => p.id === product.id)) return;
    setAssigned([...assigned, product]);
  }

  function removeProduct(productId: number) {
    setAssigned(assigned.filter((p) => p.id !== productId));
  }

  async function handleSubmit() {
    if (!token) return;
    const widthNum = Number(width);
    const heightNum = Number(height);
    if (!name.trim() || !widthNum || !heightNum) {
      setSaveError(t("layoutZone.invalidForm"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const savedZone = zone
        ? await updateLayoutZone(token, zone.id, { name, width: widthNum, height: heightNum })
        : await createLayoutZone(token, { name, width: widthNum, height: heightNum });

      const previousIds = zone?.products.map((p) => p.id) ?? [];
      const currentIds = assigned.map((p) => p.id);
      const removedIds = previousIds.filter((id) => !currentIds.includes(id));
      const addedIds = currentIds.filter((id) => !previousIds.includes(id));

      await Promise.all([
        ...removedIds.map((id) => updateStock(token, id, { zone_id: null })),
        ...addedIds.map((id) => updateStock(token, id, { zone_id: savedZone.id })),
      ]);

      onSaved();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? t("common.saveFailedWithStatus", { status: err.status }) : t("common.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !zone) return;
    setSaving(true);
    setSaveError(null);
    try {
      await deleteLayoutZone(token, zone.id);
      onSaved();
    } catch {
      setSaveError(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // Bu bileşen her zaman LayoutSuggestionPage'deki `.overlay > .modal` sarmalayıcısının içinde
  // render edilir (bkz. Task 9) — bu yüzden `.panel` değil `.modal-head`/`.modal-body`/`.modal-foot`
  // kullanıyor (StockManagerDashboard'daki mevcut modal deseniyle tutarlı, iç içe kutu görünümü
  // olmasın diye).
  return (
    <>
      <div className="modal-head">{zone ? t("layoutZone.editTitle") : t("layoutZone.createTitle")}</div>
      <div className="modal-body">
        <div className="field">
          <label>{t("layoutZone.nameLabel")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t("layoutZone.widthLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t("layoutZone.heightLabel")}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{t("layoutZone.productsLabel")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              placeholder={t("layoutZone.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="btn ghost sm" type="button" onClick={handleSearch}>
              {t("pos.search")}
            </button>
          </div>
          {searchError && <div className="error-text">{searchError}</div>}
          {searchResults.map((p) => (
            <div className="trow" style={{ gridTemplateColumns: "2fr 1fr" }} key={p.id}>
              <span>{p.name}</span>
              <button className="btn ghost sm" type="button" onClick={() => addProduct(p)}>
                {t("layoutZone.addProduct")}
              </button>
            </div>
          ))}
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{t("layoutZone.assignedProducts")}</label>
          {assigned.length === 0 && <div className="muted-small">{t("layoutZone.noProductsYet")}</div>}
          {assigned.map((p) => (
            <div className="trow" style={{ gridTemplateColumns: "2fr 1fr" }} key={p.id}>
              <span>{p.name}</span>
              <button className="btn ghost sm" type="button" onClick={() => removeProduct(p.id)}>
                {t("common.remove")}
              </button>
            </div>
          ))}
        </div>

        {saveError && <div className="error-text">{saveError}</div>}
      </div>
      <div className="modal-foot">
        {zone && (
          <button className="btn ghost" type="button" disabled={saving} onClick={handleDelete}>
            {t("common.delete")}
          </button>
        )}
        <button className="btn ghost" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" type="button" disabled={saving} onClick={handleSubmit}>
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

```bash
cd frontend
npx tsc -b --noEmit
```

Beklenen: `layoutZone.*`/`common.remove`/`common.delete` i18n key'leri henüz eklenmediği için
derleme hatası **vermez** (i18next `t()` fonksiyonu tip seviyesinde serbest string kabul eder) —
ama Task 10'da eklenmezse runtime'da ham key görünür. Sadece TypeScript hatası olmadığını doğrula.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ZoneEditorForm.tsx
git commit -m "feat: add ZoneEditorForm component"
```

---

## Task 9: Frontend — `LayoutSuggestionPage`'e entegrasyon (SHOULD + COULD)

**Files:**
- Modify: `frontend/src/pages/LayoutSuggestionPage.tsx`

**Interfaces:**
- Consumes: `StorePlanCanvas` (Task 7), `ZoneEditorForm` (Task 8), `listLayoutZones`/
  `updateLayoutZone` (Task 5), `computeLayoutScore` (Task 6, dolaylı — `StorePlanCanvas` üzerinden).

- [ ] **Step 1: Sayfayı güncelle**

`frontend/src/pages/LayoutSuggestionPage.tsx`'in tamamını şu şekilde değiştir (MUST kısmı — mevcut
çift/skor listesi ve "Uygula" — aynı kalıyor, üstüne "Mağaza planı" bölümü ekleniyor):

```tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { homeLabelForRole } from "../components/navConfig";
import { getLayoutSuggestion, applyLayoutSuggestion } from "../api/layoutSuggestion";
import { listLayoutZones, updateLayoutZone } from "../api/layoutZones";
import { StorePlanCanvas, type OverlayLine, type ZonePosition } from "../components/StorePlanCanvas";
import { ZoneEditorForm } from "../components/ZoneEditorForm";
import { ApiError } from "../api/client";
import type { LayoutSuggestionOut } from "../types/layoutSuggestion";
import type { LayoutZoneOut } from "../types/layoutZone";

// prototype/layout-onerisi.html'in React karşılığı — wireframe'deki "raf 1..raf 12" grid'i
// kullanılmıyor (DB'de gerçek bir raf/planogram kavramı yoktu, kullanıcı kararı 2026-08-05).
// 2026-08-07'de SHOULD (floor-plan/zone görselleştirme) + COULD (simülasyon) eklendi — bkz.
// docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md. MUST (çift/skor
// listesi + "Uygula") değişmedi, plan bölümü onun üzerine eklendi.
export function LayoutSuggestionPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const pageTitle = user ? t(homeLabelForRole(user.role)) : "";

  const [data, setData] = useState<LayoutSuggestionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [zones, setZones] = useState<LayoutZoneOut[]>([]);
  const [positions, setPositions] = useState<Record<number, ZonePosition>>({});
  const [editingZone, setEditingZone] = useState<LayoutZoneOut | "new" | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [baselineScore, setBaselineScore] = useState<number | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [suggestion, zoneList] = await Promise.all([getLayoutSuggestion(token), listLayoutZones(token)]);
      setData(suggestion);
      setZones(zoneList);
      setPositions(Object.fromEntries(zoneList.map((z) => [z.id, { x: z.x, y: z.y }])));
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

  const canvasZones = useMemo(() => zones.map((z) => ({ id: z.id, name: z.name, width: z.width, height: z.height })), [zones]);

  const overlayLines: OverlayLine[] = useMemo(
    () =>
      (data?.suggestions ?? [])
        .filter(
          (s) =>
            s.product_a_zone_id !== null &&
            s.product_b_zone_id !== null &&
            s.product_a_zone_id !== s.product_b_zone_id,
        )
        .map((s) => ({
          key: `${s.product_a_id}-${s.product_b_id}`,
          zoneAId: s.product_a_zone_id,
          zoneBId: s.product_b_zone_id,
          score: s.score,
          productAName: s.product_a_name,
          productBName: s.product_b_name,
        })),
    [data],
  );

  async function handleDragEnd(zoneId: number, x: number, y: number) {
    if (simulating || !token) return;
    try {
      await updateLayoutZone(token, zoneId, { x, y });
    } catch {
      setZoneError(t("layoutZone.saveFailed"));
      await load();
    }
  }

  function handleToggleSimulation() {
    if (!simulating) {
      setBaselineScore(liveScore);
      setSimulating(true);
    } else {
      setPositions(Object.fromEntries(zones.map((z) => [z.id, { x: z.x, y: z.y }])));
      setSimulating(false);
      setBaselineScore(null);
    }
  }

  async function handleSaveSimulation() {
    if (!token) return;
    const changed = zones.filter((z) => {
      const pos = positions[z.id];
      return pos && (pos.x !== z.x || pos.y !== z.y);
    });
    setZoneError(null);
    try {
      await Promise.all(changed.map((z) => updateLayoutZone(token, z.id, { x: positions[z.id].x, y: positions[z.id].y })));
      setSimulating(false);
      setBaselineScore(null);
      await load();
    } catch {
      setZoneError(t("layoutZone.saveFailed"));
    }
  }

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

  const scoreDelta = baselineScore !== null && liveScore !== null ? liveScore - baselineScore : null;

  return (
    <AppShell pageTitle={pageTitle}>
      <div className="scope">{t("layoutSuggestion.scopeDesc")}</div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          {t("layoutZone.planTitle")}
          {liveScore !== null && (
            <span className="hint">
              {simulating && baselineScore !== null
                ? t("layoutZone.scoreSimulating", { baseline: baselineScore, live: liveScore, delta: scoreDelta })
                : t("layoutZone.scoreLabel", { score: liveScore })}
            </span>
          )}
        </div>
        <div className="panel-body">
          {zoneError && <div className="error-text">{zoneError}</div>}
          {loading ? (
            <div className="muted-small">{t("common.loading")}</div>
          ) : zones.length === 0 ? (
            <>
              <div className="muted-small" style={{ padding: "12px 0" }}>
                {t("layoutZone.emptyState")}
              </div>
              <button className="btn primary sm" onClick={() => setEditingZone("new")}>
                {t("layoutZone.addZone")}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn ghost sm" onClick={() => setEditingZone("new")}>
                  {t("layoutZone.addZone")}
                </button>
                <button className="btn ghost sm" onClick={handleToggleSimulation}>
                  {simulating ? t("layoutZone.exitSimulation") : t("layoutZone.startSimulation")}
                </button>
                {simulating && (
                  <button className="btn primary sm" onClick={handleSaveSimulation}>
                    {t("common.save")}
                  </button>
                )}
              </div>

              <StorePlanCanvas
                zones={canvasZones}
                positions={positions}
                onPositionsChange={setPositions}
                onDragEnd={handleDragEnd}
                overlayLines={overlayLines}
                onScoreChange={setLiveScore}
              />

              <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr", marginTop: 12 }}>
                <span>{t("layoutZone.colName")}</span>
                <span>{t("layoutZone.colProductCount")}</span>
                <span>{t("layoutZone.colAction")}</span>
              </div>
              {zones.map((z) => (
                <div className="trow" style={{ gridTemplateColumns: "2fr 1fr 1fr" }} key={z.id}>
                  <span>{z.name}</span>
                  <span>{z.products.length}</span>
                  <button className="btn sm ghost" onClick={() => setEditingZone(z)}>
                    {t("common.edit")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

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

      <div className={`overlay${editingZone ? " open" : ""}`}>
        {editingZone && (
          <div className="modal">
            <ZoneEditorForm
              zone={editingZone === "new" ? null : editingZone}
              onCancel={() => setEditingZone(null)}
              onSaved={() => {
                setEditingZone(null);
                load();
              }}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Tip kontrolü**

```bash
cd frontend
npx tsc -b --noEmit
```

Beklenen: hatasız.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LayoutSuggestionPage.tsx
git commit -m "feat: integrate store plan canvas and simulation into layout suggestion page"
```

---

## Task 10: i18n anahtarları

**Files:**
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Produces: `common.remove`, `common.delete`, `layoutZone.*` namespace'i (her iki dilde).

- [ ] **Step 1: `tr.json`'a ekle**

`common` bloğuna (`"address": "Adres"` satırından sonra) ekle:

```json
    "remove": "Çıkar",
    "delete": "Sil"
```

`layoutSuggestion` bloğunun hemen altına yeni bir `layoutZone` bloğu ekle:

```json
  "layoutZone": {
    "planTitle": "Mağaza planı",
    "scoreLabel": "Yerleşim skoru: {{score}}",
    "scoreSimulating": "Mevcut: {{baseline}} → Simülasyon: {{live}} ({{delta}})",
    "emptyState": "Henüz bir mağaza planı oluşturmadınız.",
    "addZone": "Zone ekle",
    "startSimulation": "Simülasyon modu",
    "exitSimulation": "Simülasyonu kapat",
    "colName": "Zone adı",
    "colProductCount": "Ürün sayısı",
    "colAction": "İşlem",
    "createTitle": "Yeni zone",
    "editTitle": "Zone düzenle",
    "nameLabel": "Zone adı",
    "widthLabel": "Genişlik",
    "heightLabel": "Yükseklik",
    "productsLabel": "Ürün ara ve ekle",
    "searchPlaceholder": "Ürün ara: isim / SKU",
    "searchError": "Arama sırasında hata oluştu.",
    "addProduct": "Ekle",
    "assignedProducts": "Bu zone'daki ürünler",
    "noProductsYet": "Henüz ürün eklenmedi.",
    "invalidForm": "Zone adı ve boyutları geçerli olmalı.",
    "saveFailed": "Kaydedilemedi."
  },
```

- [ ] **Step 2: `en.json`'a ekle**

`common` bloğuna aynı yere:

```json
    "remove": "Remove",
    "delete": "Delete"
```

`layoutSuggestion` bloğunun altına:

```json
  "layoutZone": {
    "planTitle": "Store plan",
    "scoreLabel": "Layout score: {{score}}",
    "scoreSimulating": "Current: {{baseline}} → Simulation: {{live}} ({{delta}})",
    "emptyState": "You haven't created a store plan yet.",
    "addZone": "Add zone",
    "startSimulation": "Simulation mode",
    "exitSimulation": "Exit simulation",
    "colName": "Zone name",
    "colProductCount": "Product count",
    "colAction": "Action",
    "createTitle": "New zone",
    "editTitle": "Edit zone",
    "nameLabel": "Zone name",
    "widthLabel": "Width",
    "heightLabel": "Height",
    "productsLabel": "Search and add products",
    "searchPlaceholder": "Search product: name / SKU",
    "searchError": "An error occurred while searching.",
    "addProduct": "Add",
    "assignedProducts": "Products in this zone",
    "noProductsYet": "No products added yet.",
    "invalidForm": "Zone name and dimensions must be valid.",
    "saveFailed": "Could not be saved."
  },
```

- [ ] **Step 3: Key tutarlılığını doğrula**

```bash
cd frontend
npx tsc -b --noEmit
```

Sonra tarayıcıda `/layout` sayfasını aç (bkz. Task 11), TR ve EN arasında geçiş yapıp hiçbir yerde
ham `layoutZone.xxx` key'inin görünmediğini doğrula.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: add i18n keys for store plan zone editor"
```

---

## Task 11: Uçtan uca doğrulama + doküman kapanışı

**Files:**
- Modify: `TR dosyalar/PROCESS.md`

**Interfaces:** Yok (sadece doğrulama + doküman güncellemesi).

- [ ] **Step 1: Backend/frontend'in ayakta olduğunu doğrula**

Bkz. `.claude/launch.json` — `backend` (`:8000`) ve `frontend` (`:5173`) preview server'ları zaten
çalışıyor olmalı (bu oturumda daha önce başlatıldı). Değilse, Claude Browser `preview_start` ile
`backend` ve `frontend` konfigürasyonlarını başlat.

- [ ] **Step 2: `sellermgr1` ile zone oluşturma + ürün atama**

Tarayıcıda `http://testco.localhost:5173/login` → `sellermgr1` / `Test1234!` → `/layout`.
- "Zone ekle" → ad: "Süt Ürünleri", genişlik 100, yükseklik 60 → ürün ara ("Süt") → ekle → kaydet.
- İkinci zone: "Fırın", 100, 60 → ürün ara ("Ekmek") → ekle → kaydet.
- Beklenen: iki zone canvas'ta görünür (varsayılan `0,0`'da üst üste olabilir), zone listesinde
  "Süt Ürünleri — 1 ürün", "Fırın — 1 ürün" satırları var.

- [ ] **Step 3: Sürükleme + SHOULD overlay doğrulaması**

Her iki zone'u da canvas üzerinde birbirinden uzağa sürükle, bırak. `preview_logs` ile
`PATCH /api/layout-zones/{id}` isteklerinin `200` döndüğünü doğrula. Sayfayı yenile (`F5`) —
zone'ların son bırakıldıkları konumda kaldığını doğrula (kalıcılık).

Eğer Süt↔Ekmek çifti mevcut öneri listesinde varsa (co-occurrence/Apriori sonucuna bağlı — seed
veriye göre değişebilir), iki zone arasında kesikli kırmızı çizgi + yüzde etiketinin göründüğünü
doğrula. Yoksa, ürün atamalarını mevcut önerideki gerçek bir çifte göre ayarla ve tekrar dene.

- [ ] **Step 4: COULD simülasyon doğrulaması**

"Simülasyon modu"na tıkla → "Mevcut: X" skorunun göründüğünü doğrula. Bir zone'u sürükle — skorun
canlı değiştiğini ("Mevcut: X → Simülasyon: Y (±Z)") ve `preview_logs`'ta **hiçbir**
`PATCH /api/layout-zones` isteği gitmediğini doğrula (network sekmesinde de kontrol edilebilir).
"Kaydet"e tıkla — bu sefer `PATCH` isteklerinin gittiğini, sayfa yenilenince yeni konumun kalıcı
olduğunu doğrula. Tekrar simülasyona gir, bu kez "Simülasyonu kapat" ile vazgeç — zone'ların
kaydedilmiş son konuma döndüğünü (sürüklenen ama kaydedilmeyen değişikliğin atıldığını) doğrula.

- [ ] **Step 5: Yetki/regresyon kontrolleri**

- `stockmgr1` ile giriş yap, `/layout`'a git — nav'da hiç link olmadığını (mevcut davranış) doğrula;
  doğrudan URL'e gidilirse boş/403 durumunun kırılmadığını doğrula.
- `sellermgr2` (Beşiktaş, henüz hiç zone kurmamış) ile giriş yap, `/layout`'a git — boş-durum
  mesajının ("Henüz bir mağaza planı oluşturmadınız") göründüğünü, MUST listesinin (çift/skor) hâlâ
  normal çalıştığını doğrula (regresyon yok).
- Konsolda (`read_console_messages`) hiçbir oturumda hata olmadığını doğrula.
- `npx tsc -b --noEmit` son bir kez temiz olduğunu doğrula.

- [ ] **Step 6: Test verisini temizle**

`sellermgr1`/`sellermgr2` ile oluşturulan test zone'larını "Sil" ile kaldır (ya da bilinçli olarak
demo verisi olarak bırakılacaksa, bu adımı atla ve kullanıcıya haber ver).

- [ ] **Step 7: `PROCESS.md`'yi güncelle**

`TR dosyalar/PROCESS.md`'deki "Layout önerisi — SHOULD + COULD yapılacak" maddesini `[x]` yap, kısa
bir özet ekle (backend/frontend dosya listesi, test sonucu, "vakit kalırsa A seçeneğine dönülebilir"
notunun hâlâ açık stretch-goal olduğunu belirt).

- [ ] **Step 8: Commit**

```bash
git add "TR dosyalar/PROCESS.md"
git commit -m "docs: close layout floor-plan SHOULD+COULD open item"
```
