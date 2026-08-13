from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product
from ..schemas.product import ProductCreate, ProductListOut, ProductRead, ProductUpdate
from ..schemas.product_import import ImportResultOut
from ..services.notification_reads import clear_expiring_reads, is_expiring
from ..services.product_import import EXPECTED_HEADERS, MAX_FILE_SIZE_BYTES, parse_and_validate

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
    fields = payload.model_dump(exclude_unset=True)
    for field, value in fields.items():
        setattr(product, field, value)

    # Sprint 6 review bulgusu (2026-08-13) — SKT tarihi güncellenip ürün artık "yaklaşan SKT"
    # tanımına girmiyorsa (stock.py'deki low_stock temizliğiyle aynı desen), eski okundu-işareti
    # temizlenir; aksi halde tarih tekrar yaklaştığında bildirim sessizce görünmez kalırdı.
    if "best_before_date" in fields and not is_expiring(product.best_before_date):
        clear_expiring_reads(db, product_id)

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
        raise HTTPException(
            status_code=422,
            detail={"errors": [{"row": None, "message": "Sadece .xlsx dosyaları kabul edilir"}]},
        )

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail={"errors": [{"row": None, "message": "Dosya çok büyük (maks. 5MB)"}]},
        )

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
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail={
                "errors": [
                    {
                        "row": None,
                        "message": "Veritabanına kaydedilirken bir hata oluştu, lütfen dosyayı kontrol edip tekrar deneyin",
                    }
                ]
            },
        )
    return ImportResultOut(created=len(products))
