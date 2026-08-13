from datetime import date, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models import NotificationRead

# stocksense-api-tr.md'de gün sayısı belirtilmemişti — implementasyon sırasında karar verildi
# (2026-07-27): SKT'ye 7 gün ya da daha az kalan ürünler "yaklaşan" sayılır. Tek kaynak burada —
# routers/notifications.py bu değeri buradan içe aktarır (aynı eşik iki yerde tekrarlanmasın diye).
EXPIRING_WITHIN_DAYS = 7

# Sprint 6 review bulgusu (2026-08-13) — bir bildirim "okundu" işaretlendikten sonra durum
# değişip bildirim tekrar tetiklenebilir hale gelirse (stok tekrar düşerse, SKT tekrar
# yaklaşırsa), eski okundu-işareti temizlenmeli, aksi halde bildirim sessizce görünmez kalır.
# Bu iki fonksiyon, ilgili durumu değiştirebilecek HER yazma noktasından çağrılmalı.


def clear_low_stock_reads(db: Session, product_id: int, branch_id: int) -> None:
    db.execute(
        delete(NotificationRead).where(
            NotificationRead.kind == "low_stock",
            NotificationRead.product_id == product_id,
            NotificationRead.branch_id == branch_id,
        )
    )


def is_expiring(best_before_date: date | None) -> bool:
    if best_before_date is None:
        return False
    cutoff = date.today() + timedelta(days=EXPIRING_WITHIN_DAYS)
    return date.today() <= best_before_date <= cutoff


def clear_expiring_reads(db: Session, product_id: int) -> None:
    """best_before_date ürün bazlı (şubeden bağımsız) olduğu için, tarih değiştiğinde ürünün
    tüm şubelerdeki 'expiring' okundu-işaretleri temizlenir."""
    db.execute(
        delete(NotificationRead).where(
            NotificationRead.kind == "expiring",
            NotificationRead.product_id == product_id,
        )
    )
