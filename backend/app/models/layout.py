from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


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
