from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product
from ..schemas.product import ProductCreate, ProductListOut, ProductRead, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


SORTABLE_COLUMNS = {
    "name": Product.name,
    "sku": Product.sku,
    "default_price": Product.default_price,
    "cost_price": Product.cost_price,
}


@router.get("", response_model=ProductListOut)
def list_products(
    q: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "name",
    sort_dir: str = "asc",
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """Sayfa başı max `limit` ürün döner (varsayılan 50) — 700-1000 ürünlük büyük kataloglarda
    tek seferde tüm listeyi indirmemek için (bkz. PROCESS.md, 2026-08-10). `q` verilirse isim/SKU'da
    kısmi eşleşme uygulanır (arama da server-side, aksi halde büyük katalogda arama sadece o anki
    sayfayla sınırlı kalırdı). `sort_by`/`sort_dir` — ürün listesinde alanlara göre sıralama (PROCESS.md,
    Faz 2), sayfalama server-side olduğu için sıralama da server-side yapılmalı (aksi halde sadece o anki
    sayfa içinde sıralanmış görünürdü)."""
    if page < 1:
        raise HTTPException(status_code=422, detail="page 1 veya üzeri olmalı")
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="limit 1-200 aralığında olmalı")
    if sort_by not in SORTABLE_COLUMNS:
        raise HTTPException(status_code=422, detail=f"sort_by şu değerlerden biri olmalı: {sorted(SORTABLE_COLUMNS)}")
    if sort_dir not in ("asc", "desc"):
        raise HTTPException(status_code=422, detail="sort_dir 'asc' ya da 'desc' olmalı")

    filters = [Product.company_id == claims["company_id"], Product.is_active.is_(True)]
    if q:
        filters.append(or_(Product.name.ilike(f"%{q}%"), Product.sku.ilike(f"%{q}%")))

    column = SORTABLE_COLUMNS[sort_by]
    order = column.asc() if sort_dir == "asc" else column.desc()

    total = db.scalar(select(func.count()).select_from(Product).where(*filters))
    items = db.scalars(
        select(Product).where(*filters).order_by(order).offset((page - 1) * limit).limit(limit)
    ).all()
    return ProductListOut(items=items, total=total or 0)


@router.get("/search", response_model=list[ProductRead])
def search_products(q: str, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-01 — SKU tam eşleşme, yoksa SKU'da veya isimde kısmi eşleşme. Çıktı her zaman array."""
    exact_match = db.scalar(
        select(Product).where(
            Product.company_id == claims["company_id"], Product.sku == q, Product.is_active.is_(True)
        )
    )
    if exact_match is not None:
        return [exact_match]

    return db.scalars(
        select(Product).where(
            Product.company_id == claims["company_id"],
            Product.is_active.is_(True),
            or_(Product.name.ilike(f"%{q}%"), Product.sku.ilike(f"%{q}%")),
        )
    ).all()


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"]))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductRead, status_code=201)
def create_product(
    payload: ProductCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    """UC-06 — sadece Genel Müdür company-level kataloğu yönetir."""
    require_role(claims, "general_manager")
    product = Product(**payload.model_dump(), company_id=claims["company_id"])
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "general_manager")
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"]))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def deactivate_product(
    product_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    require_role(claims, "general_manager")
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"]))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()
