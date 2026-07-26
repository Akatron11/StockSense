from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class Sale(Base, TimestampMixin):
    """Madde 9 — satış başlığı. payment_method: madde 6 (Ödeme — Tam Mock)."""

    __tablename__ = "sales"
    __table_args__ = (Index("ix_sales_branch_date", "branch_id", "sale_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)

    branch: Mapped["Branch"] = relationship(back_populates="sales")
    employee: Mapped["Employee"] = relationship(back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale")
    returns: Mapped[list["Return"]] = relationship(back_populates="sale")


class SaleItem(Base, TimestampMixin):
    """Madde 9 — satış kalemi; co-occurrence/Apriori hesaplamasının veri kaynağı (madde 7)."""

    __tablename__ = "sale_items"
    __table_args__ = (
        Index("ix_sale_items_sale_id", "sale_id"),
        Index("ix_sale_items_product_id", "product_id"),
        CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),
        CheckConstraint("line_total >= 0", name="ck_sale_items_line_total_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    sale: Mapped["Sale"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class Return(Base, TimestampMixin):
    """Madde 6 (İade/Değişim — Manager PIN Onayı) — ayrı tablo, `sales`'in yeniden kullanımı değil.

    `Sale`'in aksine iki aşamalı bir yaşam döngüsü var (pending → completed, PIN onayıyla).
    """

    __tablename__ = "returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    initiated_by: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="pending")
    net_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    completed_by: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sale: Mapped["Sale"] = relationship(back_populates="returns")
    initiated_by_employee: Mapped["Employee"] = relationship(foreign_keys=[initiated_by])
    completed_by_employee: Mapped["Employee | None"] = relationship(foreign_keys=[completed_by])
    items: Mapped[list["ReturnItem"]] = relationship(back_populates="return_")


class ReturnItem(Base, TimestampMixin):
    """Madde 6 — iade kalemi; `direction` alanı iade edilen (`returned`) ile değişimde verilen yeni
    (`new`) ürünleri aynı tabloda ayırt eder (sale_items ile aynı ayrım mantığı)."""

    __tablename__ = "return_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_return_items_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("returns.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)

    return_: Mapped["Return"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()
