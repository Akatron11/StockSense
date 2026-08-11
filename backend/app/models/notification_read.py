from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class NotificationRead(Base, TimestampMixin):
    """Mobil companion app — bildirim okundu/okunmadı takibi (Sprint 6).

    Bildirimler (`GET /api/notifications`) kalıcı bir kayıt değil, anlık bir sorgu sonucu
    (düşük stok / SKT eşiği aşımı) — bu yüzden "hangi bildirim okundu" bilgisi bildirimin
    kendi bir ID'siyle değil, onu üreten satırın doğal anahtarıyla (kind + product_id +
    branch_id) tutuluyor. Bkz. docs/superpowers/specs/2026-08-11-mobile-companion-app-design.md.
    """

    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "kind", "product_id", "branch_id",
            name="uq_notification_read_employee_item",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # "low_stock" | "expiring"
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee: Mapped["Employee"] = relationship()
