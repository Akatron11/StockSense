from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product
from ..schemas.product import ProductCreate, ProductRead, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
def list_products(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    return db.scalars(
        select(Product).where(Product.company_id == claims["company_id"], Product.is_active.is_(True))
    ).all()


@router.get("/search", response_model=list[ProductRead])
def search_products(q: str, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-01 — barkod/SKU tam eşleşme, yoksa isimde kısmi eşleşme. Çıktı her zaman array."""
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
            Product.name.ilike(f"%{q}%"),
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
