from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Product, Return, ReturnItem, Sale, SaleItem, Stock
from ..schemas.return_ import ReturnComplete, ReturnCreate, ReturnItemOut, ReturnOut
from ..services.manager_pin import find_pin_approver

router = APIRouter(prefix="/api", tags=["returns"])


def _to_out(return_: Return, items: list[ReturnItem]) -> ReturnOut:
    returned = [ReturnItemOut(product_id=i.product_id, quantity=i.quantity, unit_price=float(i.unit_price)) for i in items if i.direction == "returned"]
    new = [ReturnItemOut(product_id=i.product_id, quantity=i.quantity, unit_price=float(i.unit_price)) for i in items if i.direction == "new"]
    return ReturnOut(
        id=return_.id,
        sale_id=return_.sale_id,
        returned_items=returned,
        new_items=new,
        net_amount=float(return_.net_amount),
        status=return_.status,
        created_at=return_.created_at,
        completed_by=return_.completed_by,
        completed_at=return_.completed_at,
    )


@router.post("/sales/{sale_id}/returns", response_model=ReturnOut, status_code=201)
def initiate_return(
    sale_id: int,
    payload: ReturnCreate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """UC-03 — Kasiyer başlatır, PIN onayı beklemede (status: pending)."""
    require_role(claims, "cashier", "operations_chief")
    if not payload.returned_items:
        raise HTTPException(status_code=422, detail="returned_items boş olamaz")

    sale = db.get(Sale, sale_id)
    if sale is None or sale.branch_id != claims["branch_id"]:
        raise HTTPException(status_code=404, detail="Sale not found")

    sale_items = {si.product_id: si for si in db.scalars(select(SaleItem).where(SaleItem.sale_id == sale_id))}

    already_returned: dict[int, int] = defaultdict(int)
    completed_returns = db.scalars(
        select(ReturnItem)
        .join(Return, Return.id == ReturnItem.return_id)
        .where(Return.sale_id == sale_id, Return.status == "completed", ReturnItem.direction == "returned")
    )
    for ri in completed_returns:
        already_returned[ri.product_id] += ri.quantity

    return_items_to_create = []
    total_returned_amount = 0.0
    for item in payload.returned_items:
        sale_item = sale_items.get(item.product_id)
        if sale_item is None:
            raise HTTPException(status_code=404, detail=f"Ürün bu satışta yok: {item.product_id}")
        if item.quantity + already_returned[item.product_id] > sale_item.quantity:
            raise HTTPException(
                status_code=422,
                detail=f"İade miktarı satılan miktarı aşıyor: product_id={item.product_id}",
            )
        unit_price = round(float(sale_item.line_total) / sale_item.quantity, 2)
        total_returned_amount += unit_price * item.quantity
        return_items_to_create.append(("returned", item.product_id, item.quantity, unit_price))

    total_new_amount = 0.0
    if payload.new_items:
        product_ids = [item.product_id for item in payload.new_items]
        products = {
            p.id: p
            for p in db.scalars(
                select(Product).where(
                    Product.id.in_(product_ids),
                    Product.company_id == claims["company_id"],
                    Product.is_active.is_(True),
                )
            )
        }
        missing = [pid for pid in product_ids if pid not in products]
        if missing:
            raise HTTPException(status_code=404, detail=f"Ürün bulunamadı: {missing}")

        for item in payload.new_items:
            stock_row = db.scalar(
                select(Stock).where(Stock.product_id == item.product_id, Stock.branch_id == claims["branch_id"])
            )
            price = stock_row.price_override if stock_row and stock_row.price_override is not None else products[item.product_id].default_price
            unit_price = float(price)
            total_new_amount += unit_price * item.quantity
            return_items_to_create.append(("new", item.product_id, item.quantity, unit_price))

    net_amount = round(total_new_amount - total_returned_amount, 2)

    return_ = Return(sale_id=sale_id, initiated_by=claims["user_id"], status="pending", net_amount=net_amount)
    db.add(return_)
    db.flush()

    items = []
    for direction, product_id, quantity, unit_price in return_items_to_create:
        ri = ReturnItem(return_id=return_.id, product_id=product_id, quantity=quantity, unit_price=unit_price, direction=direction)
        db.add(ri)
        items.append(ri)

    db.commit()
    db.refresh(return_)
    return _to_out(return_, items)


@router.post("/returns/{return_id}/complete", response_model=ReturnOut)
def complete_return(
    return_id: int,
    payload: ReturnComplete,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """UC-04 — Onay yetkilisi PIN ile tamamlar; stok değişimleri burada, atomik olarak uygulanır."""
    return_ = db.get(Return, return_id)
    if return_ is None:
        raise HTTPException(status_code=404, detail="Return not found")
    if return_.status != "pending":
        raise HTTPException(status_code=409, detail="Bu işlem zaten tamamlanmış")

    sale = db.get(Sale, return_.sale_id)
    branch_id = sale.branch_id
    if claims["branch_id"] != branch_id:
        raise HTTPException(status_code=403, detail="Bu işlem başka bir şubeye ait")

    approver = find_pin_approver(db, branch_id, payload.manager_pin)
    if approver is None:
        raise HTTPException(status_code=401, detail="Geçersiz PIN")

    items = db.scalars(select(ReturnItem).where(ReturnItem.return_id == return_id)).all()
    new_items = [i for i in items if i.direction == "new"]
    returned_items = [i for i in items if i.direction == "returned"]

    # Madde 3 — aynı DB-atomic yaklaşım: yeni ürünler için stok yetersizse hepsi geri alınır.
    insufficient_items = []
    for ri in new_items:
        result = db.execute(
            update(Stock)
            .where(Stock.product_id == ri.product_id, Stock.branch_id == branch_id, Stock.quantity >= ri.quantity)
            .values(quantity=Stock.quantity - ri.quantity)
        )
        if result.rowcount == 0:
            available = db.scalar(
                select(Stock.quantity).where(Stock.product_id == ri.product_id, Stock.branch_id == branch_id)
            ) or 0
            insufficient_items.append({"product_id": ri.product_id, "requested": ri.quantity, "available": available})

    if insufficient_items:
        db.rollback()
        return JSONResponse(
            status_code=409,
            content={"detail": "Yetersiz stok", "insufficient_items": insufficient_items},
        )

    for ri in returned_items:
        db.execute(
            update(Stock)
            .where(Stock.product_id == ri.product_id, Stock.branch_id == branch_id)
            .values(quantity=Stock.quantity + ri.quantity)
        )

    return_.status = "completed"
    return_.completed_by = approver.id
    return_.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(return_)
    return _to_out(return_, items)
