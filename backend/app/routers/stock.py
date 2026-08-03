from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Product, Stock
from ..schemas.stock import StockOut, StockUpdate

router = APIRouter(prefix="/api/stock", tags=["stock"])

# stocksense-api-tr.md — "Şube Stok Durumu": her rol sadece kendi alanını değiştirebilir.
ROLE_ALLOWED_FIELDS = {
    "seller_manager": {"price_override"},
    "stock_manager": {"quantity", "low_stock_threshold"},
}


def _to_stock_out(stock: Stock, product: Product) -> StockOut:
    return StockOut(
        product_id=stock.product_id,
        branch_id=stock.branch_id,
        quantity=stock.quantity,
        low_stock_threshold=stock.low_stock_threshold,
        price_override=stock.price_override,
        product_name=product.name,
        sku=product.sku,
        best_before_date=product.best_before_date,
        effective_price=stock.price_override if stock.price_override is not None else product.default_price,
    )


@router.get("", response_model=list[StockOut])
def list_stock(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Stock, Product)
        .join(Product, Stock.product_id == Product.id)
        .where(Stock.branch_id == claims["branch_id"])
    ).all()
    return [_to_stock_out(stock, product) for stock, product in rows]


@router.patch("/{product_id}", response_model=StockOut)
def update_stock(
    product_id: int,
    payload: StockUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Güncellenecek alan gönderilmedi")

    allowed = ROLE_ALLOWED_FIELDS.get(claims["role"], set())
    unauthorized = set(fields) - allowed
    if unauthorized:
        raise HTTPException(status_code=403, detail=f"Bu role izinli olmayan alanlar: {sorted(unauthorized)}")

    branch_id = claims["branch_id"]
    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"])
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    stock_row = db.scalar(select(Stock).where(Stock.product_id == product_id, Stock.branch_id == branch_id))
    if stock_row is None:
        stock_row = Stock(product_id=product_id, branch_id=branch_id, quantity=0, low_stock_threshold=0)
        db.add(stock_row)

    for field, value in fields.items():
        setattr(stock_row, field, value)

    db.commit()
    db.refresh(stock_row)
    return _to_stock_out(stock_row, product)
