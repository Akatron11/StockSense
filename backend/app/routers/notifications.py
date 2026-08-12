from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import NotificationRead, Product, Stock
from ..schemas.notification import ExpiringItem, LowStockItem, NotificationReadIn, NotificationsOut
from ..services.notification_targets import target_branches

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# stocksense-api-tr.md'de gün sayısı belirtilmemişti — implementasyon sırasında karar verildi
# (2026-07-27): SKT'ye 7 gün ya da daha az kalan ürünler "yaklaşan" sayılır.
EXPIRING_WITHIN_DAYS = 7


KIND_TO_PRIMARY_ROLE = {"low_stock": "stock_manager", "expiring": "seller_manager"}


def _verify_notification_target(db: Session, claims: dict, kind: str, product_id: int, branch_id: int) -> None:
    allowed_branches = target_branches(db, claims, KIND_TO_PRIMARY_ROLE[kind])
    if branch_id not in allowed_branches:
        raise HTTPException(status_code=404, detail="Notification not found")
    exists = db.scalar(
        select(Stock.product_id).where(Stock.product_id == product_id, Stock.branch_id == branch_id)
    )
    if exists is None:
        raise HTTPException(status_code=404, detail="Notification not found")


def _read_keys(db: Session, employee_id: int, kind: str) -> set[tuple[int, int]]:
    rows = db.execute(
        select(NotificationRead.product_id, NotificationRead.branch_id).where(
            NotificationRead.employee_id == employee_id, NotificationRead.kind == kind
        )
    ).all()
    return {(product_id, branch_id) for product_id, branch_id in rows}


@router.get("", response_model=NotificationsOut)
def get_notifications(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    low_stock_branches = target_branches(db, claims, "stock_manager")
    expiring_branches = target_branches(db, claims, "seller_manager")
    employee_id = claims["user_id"]

    low_stock = []
    if low_stock_branches:
        read_keys = _read_keys(db, employee_id, "low_stock")
        rows = db.execute(
            select(Stock, Product.name)
            .join(Product, Product.id == Stock.product_id)
            .where(
                Stock.branch_id.in_(low_stock_branches),
                Stock.quantity <= Stock.low_stock_threshold,
                Product.is_active.is_(True),
            )
        ).all()
        low_stock = [
            LowStockItem(
                product_id=stock.product_id,
                product_name=name,
                branch_id=stock.branch_id,
                quantity=stock.quantity,
                threshold=stock.low_stock_threshold,
                is_read=(stock.product_id, stock.branch_id) in read_keys,
            )
            for stock, name in rows
        ]

    expiring = []
    if expiring_branches:
        read_keys = _read_keys(db, employee_id, "expiring")
        cutoff = date.today() + timedelta(days=EXPIRING_WITHIN_DAYS)
        rows = db.execute(
            select(Stock, Product.name, Product.best_before_date)
            .join(Product, Product.id == Stock.product_id)
            .where(
                Stock.branch_id.in_(expiring_branches),
                Stock.quantity > 0,
                Product.is_active.is_(True),
                Product.best_before_date.is_not(None),
                Product.best_before_date >= date.today(),
                Product.best_before_date <= cutoff,
            )
        ).all()
        expiring = [
            ExpiringItem(
                product_id=stock.product_id,
                product_name=name,
                branch_id=stock.branch_id,
                best_before_date=bbd,
                is_read=(stock.product_id, stock.branch_id) in read_keys,
            )
            for stock, name, bbd in rows
        ]

    return NotificationsOut(low_stock=low_stock, expiring=expiring)


@router.post("/read", status_code=204)
def mark_notification_read(
    payload: NotificationReadIn,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    _verify_notification_target(db, claims, payload.kind, payload.product_id, payload.branch_id)
    employee_id = claims["user_id"]
    existing = db.scalar(
        select(NotificationRead).where(
            NotificationRead.employee_id == employee_id,
            NotificationRead.kind == payload.kind,
            NotificationRead.product_id == payload.product_id,
            NotificationRead.branch_id == payload.branch_id,
        )
    )
    if existing is None:
        db.add(
            NotificationRead(
                employee_id=employee_id,
                kind=payload.kind,
                product_id=payload.product_id,
                branch_id=payload.branch_id,
            )
        )
        db.commit()
