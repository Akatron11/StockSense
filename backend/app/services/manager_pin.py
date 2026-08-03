from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Employee
from ..security import verify_password

# Madde "İade/Değişim — Manager PIN Onayı": o an şubede bulunan herhangi bir onay yetkilisi
# onaylayabilir (Şube Müdürü bu havuzda değildir). Yardımcı roller henüz netleşmedi.
PIN_APPROVER_ROLES = ("stock_manager", "seller_manager", "operations_chief")


def find_pin_approver(db: Session, branch_id: int, pin: str) -> Employee | None:
    """PIN'i, verilen şubedeki onay yetkisi olan aktif çalışanlardan biriyle eşleştirmeye çalışır.

    stocksense-api-tr.md'deki karar gereği ayrı bir doğrulama endpoint'i yok — bu fonksiyon,
    Sprint 3'teki `POST /api/returns/{return_id}/complete` (UC-04) endpoint'i tarafından
    aynı istek/transaction içinde çağrılmak üzere hazırlandı.
    """
    candidates = db.scalars(
        select(Employee).where(
            Employee.branch_id == branch_id,
            Employee.role.in_(PIN_APPROVER_ROLES),
            Employee.is_active.is_(True),
            Employee.manager_pin.is_not(None),
        )
    )
    for candidate in candidates:
        if verify_password(pin, candidate.manager_pin):
            return candidate
    return None
