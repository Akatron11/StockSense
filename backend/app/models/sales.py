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
