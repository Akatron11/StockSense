from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Product, Stock
from ..schemas.notification import ExpiringItem, LowStockItem, NotificationsOut
from ..services.notification_targets import target_branches

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# stocksense-api-tr.md'de gün sayısı belirtilmemişti — implementasyon sırasında karar verildi
# (2026-07-27): SKT'ye 7 gün ya da daha az kalan ürünler "yaklaşan" sayılır.
EXPIRING_WITHIN_DAYS = 7


@router.get("", response_model=NotificationsOut)
def get_notifications(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    low_stock_branches = target_branches(db, claims, "stock_manager")
    expiring_branches = target_branches(db, claims, "seller_manager")

    low_stock = []
    if low_stock_branches:
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
            )
            for stock, name in rows
        ]

    expiring = []
    if expiring_branches:
        cutoff = date.today() + timedelta(days=EXPIRING_WITHIN_DAYS)
        rows = db.execute(
            select(Stock, Product.name, Product.best_before_date)
            .join(Product, Product.id == Stock.product_id)
            .where(
                Stock.branch_id.in_(expiring_branches),
                Stock.quantity > 0,
                Product.is_active.is_(True),
                Product.best_before_date.is_not(None),
                Product.best_before_date <= cutoff,
            )
        ).all()
        expiring = [
            ExpiringItem(
                product_id=stock.product_id, product_name=name, branch_id=stock.branch_id, best_before_date=bbd
            )
            for stock, name, bbd in rows
        ]

    return NotificationsOut(low_stock=low_stock, expiring=expiring)
