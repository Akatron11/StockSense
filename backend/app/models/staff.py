from datetime import date, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin

# Madde 9 "Şema Detaylandırma" — mevcut karara bağlanmış 10 rol (manager yardımcı rolleri, örn. Seller
# Manager Yardımcısı, henüz netleşmedi — bkz. TR dosyalar/PROCESS.md). "staff": madde 13 — login'siz
# personel (manav, kasap, raf düzenleyici vb.); iş unvanları sistem için önemli değil, hepsi tek bir
# genel role sahip (kullanıcı kararı, 2026-07-31).
VALID_ROLES = (
    "cashier",
    "branch_manager",
    "region_manager",
    "general_manager",
    "stock_manager",
    "seller_manager",
    "operations_chief",
    "company_it",
    "vendor_manager",
    "staff",
)


class Employee(Base, SoftDeleteMixin, TimestampMixin, UpdatedAtMixin):
    """Madde 2 (Rol Hiyerarşisi), madde 9 (tek tablo, 3 nullable FK), madde 13 (login'siz personel)."""

    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("company_id", "username", name="uq_employees_company_username"),
        Index("ix_employees_role", "role"),
        # company_id IS NULL only for Vendor Manager (madde 10) — composite UNIQUE above
        # doesn't constrain NULL company_id rows against each other, so a separate partial
        # index enforces username uniqueness among Vendor Manager accounts specifically.
        Index(
            "uq_employees_vendor_username",
            "username",
            unique=True,
            postgresql_where=text("company_id IS NULL"),
        ),
        CheckConstraint(f"role IN {VALID_ROLES}", name="ck_employees_role_valid"),
        # Madde 10 — Satıcı Yöneticisi tenant-üstüdür (branch/region/company hepsi NULL);
        # diğer tüm roller bir şirkete bağlı olmak zorundadır (company_id NOT NULL).
        CheckConstraint(
            "(role = 'vendor_manager' AND branch_id IS NULL AND region_id IS NULL AND company_id IS NULL) "
            "OR (role != 'vendor_manager' AND company_id IS NOT NULL)",
            name="ck_employees_vendor_manager_scope",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"), nullable=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    age: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    manager_pin: Mapped[str | None] = mapped_column(String(255), nullable=True)

    branch: Mapped["Branch | None"] = relationship(back_populates="employees")
    region: Mapped["Region | None"] = relationship(back_populates="employees")
    company: Mapped["Company | None"] = relationship(back_populates="employees")
    sales: Mapped[list["Sale"]] = relationship(back_populates="employee")
    shifts: Mapped[list["Shift"]] = relationship(back_populates="employee")


class Shift(Base, TimestampMixin):
    """Madde 13 (Shift/Vardiya Yönetimi) — planlanan program, clock-in/out kapsam dışı."""

    __tablename__ = "shifts"
    __table_args__ = (Index("ix_shifts_employee_date", "employee_id", "shift_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_day_off: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    employee: Mapped["Employee"] = relationship(back_populates="shifts")
