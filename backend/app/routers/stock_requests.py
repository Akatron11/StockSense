from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Product, Stock, StockRequest
from ..schemas.stock_request import StockRequestCreate, StockRequestOut

router = APIRouter(prefix="/api/stock-requests", tags=["stock-requests"])


@router.post("", response_model=StockRequestOut, status_code=201)
def create_stock_request(
    payload: StockRequestCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    if claims["role"] != "stock_manager":
        raise HTTPException(status_code=403, detail="Bu işlem sadece Stock Manager tarafından yapılabilir")
    if payload.quantity <= 0:
        raise HTTPException(status_code=422, detail="quantity 0'dan büyük olmalı")

    branch_id = claims["branch_id"]
    product = db.scalar(
        select(Product).where(
            Product.id == payload.product_id, Product.company_id == claims["company_id"], Product.is_active.is_(True)
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Madde 11 — merkez depo sınırsız/her zaman hazır kaynak, onay/red süreci yok: talep her zaman
    # anında karşılanır. stock_requests (audit) + stock.quantity artışı aynı transaction'da, atomik.
    stock_row = db.scalar(select(Stock).where(Stock.product_id == payload.product_id, Stock.branch_id == branch_id))
    if stock_row is None:
        stock_row = Stock(product_id=payload.product_id, branch_id=branch_id, quantity=0, low_stock_threshold=0)
        db.add(stock_row)
        db.flush()

    db.execute(
        update(Stock)
        .where(Stock.product_id == payload.product_id, Stock.branch_id == branch_id)
        .values(quantity=Stock.quantity + payload.quantity)
    )

    stock_request = StockRequest(
        product_id=payload.product_id, branch_id=branch_id, quantity=payload.quantity, requested_by=claims["user_id"]
    )
    db.add(stock_request)
    db.commit()
    db.refresh(stock_request)
    return StockRequestOut(
        id=stock_request.id,
        product_id=stock_request.product_id,
        product_name=product.name,
        branch_id=stock_request.branch_id,
        quantity=stock_request.quantity,
        requested_by=stock_request.requested_by,
        created_at=stock_request.created_at,
    )


@router.get("", response_model=list[StockRequestOut])
def list_stock_requests(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    rows = db.execute(
        select(StockRequest, Product.name)
        .join(Product, StockRequest.product_id == Product.id)
        .where(StockRequest.branch_id == claims["branch_id"])
        .order_by(StockRequest.created_at.desc())
    ).all()
    return [
        StockRequestOut(
            id=req.id,
            product_id=req.product_id,
            product_name=name,
            branch_id=req.branch_id,
            quantity=req.quantity,
            requested_by=req.requested_by,
            created_at=req.created_at,
        )
        for req, name in rows
    ]
