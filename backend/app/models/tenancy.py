from typing import List

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin


class Company(Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin):
    """Tenant root — madde 10 (Multi-Tenant Mimarisi)."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    regions: Mapped[List["Region"]] = relationship(back_populates="company")
    employees: Mapped[List["Employee"]] = relationship(back_populates="company")
    features: Mapped[List["CompanyFeature"]] = relationship(back_populates="company")
    branding: Mapped["CompanyBranding"] = relationship(back_populates="company", uselist=False)


class Region(Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin):
    """Madde 1 (Organizasyon Hiyerarşisi)."""

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    company: Mapped["Company"] = relationship(back_populates="regions")
    branches: Mapped[List["Branch"]] = relationship(back_populates="region")
    employees: Mapped[List["Employee"]] = relationship(back_populates="region")


class Branch(Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin):
    """Madde 1 (Organizasyon Hiyerarşisi)."""

    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    region: Mapped["Region"] = relationship(back_populates="branches")
    employees: Mapped[List["Employee"]] = relationship(back_populates="branch")
    stock: Mapped[List["Stock"]] = relationship(back_populates="branch")
    sales: Mapped[List["Sale"]] = relationship(back_populates="branch")
    stock_requests: Mapped[List["StockRequest"]] = relationship(back_populates="branch")


class CompanyFeature(Base, TimestampMixin, UpdatedAtMixin):
    """Feature flag per tenant — madde 10. One row per (company, feature)."""

    __tablename__ = "company_features"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    feature_name: Mapped[str] = mapped_column(String(100), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    company: Mapped["Company"] = relationship(back_populates="features")


class CompanyBranding(Base, TimestampMixin, UpdatedAtMixin):
    """1-1 visual identity per tenant — madde 10."""

    __tablename__ = "company_branding"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)

    company: Mapped["Company"] = relationship(back_populates="branding")
