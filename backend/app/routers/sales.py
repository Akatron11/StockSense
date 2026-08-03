from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product, Sale, SaleItem, Stock
from ..schemas.sale import SaleCreate, SaleItemOut, SaleOut

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(payload: SaleCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    # UC-02 (Kasiyer) + UC-05 (Kasaya Geç — Operasyon Şefi aynı POS endpoint'lerini kullanır, madde 2)
    require_role(claims, "cashier", "operations_chief")
    if not payload.items:
        raise HTTPException(status_code=422, detail="Sepet boş olamaz")

    branch_id = claims["branch_id"]
    company_id = claims["company_id"]

    # Ürünlerin şirkete ait ve aktif olduğunu doğrula — bu bir concurrency/stok kontrolü değil,
    # stok düşümüne hiç başlamadan önce yapılan bir veri geçerliliği kontrolü.
    product_ids = [item.product_id for item in payload.items]
    products = {
        product.id: product
        for product in db.scalars(
            select(Product).where(
                Product.id.in_(product_ids), Product.company_id == company_id, Product.is_active.is_(True)
            )
        )
    }
    missing = [pid for pid in product_ids if pid not in products]
    if missing:
        raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {missing}")

    # Madde 3 — DB-atomic yaklaşım: her kalem için tek bir UPDATE...WHERE quantity >= istenen
    # sorgusuyla düşülür (check-then-act değil). Herhangi biri yetersizse hepsi geri alınır.
    insufficient_items = []
    prices: dict[int, float] = {}
    for item in payload.items:
        stock_row = db.scalar(
            select(Stock).where(Stock.product_id == item.product_id, Stock.branch_id == branch_id)
        )
        if stock_row is None:
            insufficient_items.append({"product_id": item.product_id, "requested": item.quantity, "available": 0})
            continue

        result = db.execute(
            update(Stock)
            .where(
                Stock.product_id == item.product_id,
                Stock.branch_id == branch_id,
                Stock.quantity >= item.quantity,
            )
            .values(quantity=Stock.quantity - item.quantity)
        )
        if result.rowcount == 0:
            available = db.scalar(
                select(Stock.quantity).where(Stock.product_id == item.product_id, Stock.branch_id == branch_id)
            )
            insufficient_items.append(
                {"product_id": item.product_id, "requested": item.quantity, "available": available}
            )
            continue

        price = stock_row.price_override if stock_row.price_override is not None else products[item.product_id].default_price
        prices[item.product_id] = float(price)

    if insufficient_items:
        db.rollback()
        return JSONResponse(
            status_code=409,
            content={"detail": "Yetersiz stok", "insufficient_items": insufficient_items},
        )

    sale = Sale(
        sale_date=datetime.now(timezone.utc),
        branch_id=branch_id,
        employee_id=claims["user_id"],
        payment_method=payload.payment_method,
    )
    db.add(sale)
    db.flush()

    sale_items_out = []
    total = 0.0
    for item in payload.items:
        unit_price = prices[item.product_id]
        line_total = round(unit_price * item.quantity, 2)
        total += line_total
        db.add(SaleItem(sale_id=sale.id, product_id=item.product_id, quantity=item.quantity, line_total=line_total))
        sale_items_out.append(SaleItemOut(product_id=item.product_id, quantity=item.quantity, unit_price=unit_price))

    db.commit()
    db.refresh(sale)

    return SaleOut(
        id=sale.id,
        branch_id=sale.branch_id,
        items=sale_items_out,
        total=round(total, 2),
        payment_method=sale.payment_method,
        status="completed",
        created_at=sale.created_at,
    )
