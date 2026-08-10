from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UpdatedAtMixin


class LayoutRecommendationApplication(Base, TimestampMixin):
    """UC-15 — Seller Manager'ın bir layout önerisini 'uyguladım' olarak işaretlemesinin denetim
    kaydı. Fiziksel raf değişikliği sistem dışında gerçekleşir; bu sadece kabul/uygulama kaydı.
    Bkz. docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md — karar
    değişikliği notu (stocksense-api-tr.md'deki eski 'kayıt tutulmayacak' kararının yerini aldı).
    """

    __tablename__ = "layout_recommendation_applications"
    __table_args__ = (
        UniqueConstraint(
            "branch_id", "product_a_id", "product_b_id",
            name="uq_layout_application_branch_pair",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    product_a_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    product_b_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    applied_by: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    branch: Mapped["Branch"] = relationship()
    product_a: Mapped["Product"] = relationship(foreign_keys=[product_a_id])
    product_b: Mapped["Product"] = relationship(foreign_keys=[product_b_id])
    applied_by_employee: Mapped["Employee"] = relationship(foreign_keys=[applied_by])


class LayoutZone(Base, TimestampMixin, UpdatedAtMixin):
    """UC-15 SHOULD — Seller Manager'ın kendi şubesi için serbestçe oluşturduğu, floor-plan
    üzerinde konumlandırılan isimli alan (raf/reyon bölgesi). Gerçek fiziksel ölçü değil,
    görsel/göreli bir temsil. Bkz.
    docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
    """

    __tablename__ = "layout_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    branch: Mapped["Branch"] = relationship()


class StockZone(Base, TimestampMixin, UpdatedAtMixin):
    """Stock Manager'ın kendi şubesi için stok alanının fiziksel düzenini görselleştirmek üzere
    oluşturduğu isimli bölge — LayoutZone'dan bilinçli olarak bağımsız (madde/karar: 2026-08-10,
    kullanıcıyla brainstorming). Mağaza reyon/planogram planından (LayoutZone, Seller Manager'ın
    co-occurrence/Apriori önerisiyle ilişkili) tamamen ayrı bir amaç — ürün ataması yok, sadece
    saf zone editörü (ad + konum + boyut)."""

    __tablename__ = "stock_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    branch: Mapped["Branch"] = relationship()
