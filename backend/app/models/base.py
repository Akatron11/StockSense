from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # madde 9 "Şema Detaylandırma": tüm id/FK alanları BIGSERIAL/BIGINT olmalı.
    # Explicit bir tip verilmeyen her Mapped[int] kolonu bu haritayı kullanır
    # (age/quantity gibi SMALLINT/INTEGER alanları kendi kolonlarında override eder).
    type_annotation_map = {int: BigInteger}


class TimestampMixin:
    """created_at on every table; updated_at only on tables that can change (mixed in separately via UpdatedAtMixin)."""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UpdatedAtMixin:
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    """Deactivation flag for entity tables referenced by historical data (sales/sale_items/shifts).

    See stocksense-architecture-tr.md, madde 9 "Şema Detaylandırma" — hard delete would break
    historical FK references, so entities are deactivated instead of removed.
    """

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
