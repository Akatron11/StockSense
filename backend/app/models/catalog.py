from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin


class Product(Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin):
    """Madde 4 (Ürün Kataloğu ve Fiyatlandırma) — company-level catalog."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    default_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    best_before_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    stock: Mapped[list["Stock"]] = relationship(back_populates="product")


class Stock(Base, TimestampMixin, UpdatedAtMixin):
    """Madde 3 (Stok Yönetimi) — bridge table resolving the products<->branches many-to-many."""

    __tablename__ = "stock"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    price_override: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    product: Mapped["Product"] = relationship(back_populates="stock")
    branch: Mapped["Branch"] = relationship(back_populates="stock")
