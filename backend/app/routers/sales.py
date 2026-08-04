from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product, Return, ReturnItem, Sale, SaleItem, Stock
from ..schemas.sale import SaleCreate, SaleDetail, SaleDetailItem, SaleItemOut, SaleListItem, SaleOut

router = APIRouter(prefix="/api/sales", tags=["sales"])

RECENT_SALES_LIMIT = 20


@router.get("", response_model=list[SaleListItem])
def list_sales(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """İade/değişim başlatırken kasiyerin satış no aramadan seçebileceği son satışlar listesi."""
    require_role(claims, "cashier", "operations_chief")
    rows = db.scalars(
        select(Sale)
        .where(Sale.branch_id == claims["branch_id"])
        .order_by(desc(Sale.sale_date))
        .limit(RECENT_SALES_LIMIT)
    ).all()
    return [
        SaleListItem(
            id=sale.id,
            sale_date=sale.sale_date,
            total=round(sum(float(item.line_total) for item in sale.items), 2),
            payment_method=sale.payment_method,
        )
        for sale in rows
    ]


@router.get("/{sale_id}", response_model=SaleDetail)
def get_sale(sale_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """İade formunu otomatik doldurmak için satış kalemleri + hâlâ iade edilebilir miktar."""
    require_role(claims, "cashier", "operations_chief")
    sale = db.get(Sale, sale_id)
    if sale is None or sale.branch_id != claims["branch_id"]:
        raise HTTPException(status_code=404, detail="Sale not found")

    already_returned: dict[int, int] = defaultdict(int)
    completed_return_items = db.scalars(
        select(ReturnItem)
        .join(Return, Return.id == ReturnItem.return_id)
        .where(Return.sale_id == sale_id, Return.status == "completed", ReturnItem.direction == "returned")
    )
    for ri in completed_return_items:
        already_returned[ri.product_id] += ri.quantity

    sale_items = db.scalars(select(SaleItem).where(SaleItem.sale_id == sale_id)).all()
    items = [
        SaleDetailItem(
            product_id=si.product_id,
            product_name=si.product.name,
            quantity=si.quantity,
            unit_price=round(float(si.line_total) / si.quantity, 2),
            returnable_quantity=si.quantity - already_returned[si.product_id],
        )
        for si in sale_items
    ]
    return SaleDetail(
        id=sale.id,
        sale_date=sale.sale_date,
        branch_id=sale.branch_id,
        total=round(sum(float(si.line_total) for si in sale_items), 2),
        payment_method=sale.payment_method,
        items=items,
    )


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
