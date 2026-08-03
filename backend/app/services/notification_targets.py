from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Branch, Employee, Region

# Madde 14 — Bildirim Hedefi Prensibi: sabit bir hesaba değil, o an ilgili yetkiyi fiilen elinde
# bulunduran en spesifik/en alt aktif role gider. "Rol aktif mi" burada VARLIKLA çıkarılıyor
# (kullanıcıyla netleştirildi, 2026-07-27): o rolde en az bir aktif çalışan varsa rol aktiftir,
# yoksa kalıtım zincirinde bir üst role düşülür (Şube Müdürü → Bölge Müdürü → Genel Müdür).
ESCALATION_CHAIN = ("branch_manager", "region_manager", "general_manager")


def _role_exists_in_branch(db: Session, branch_id: int, role: str) -> bool:
    return (
        db.scalar(
            select(Employee.id).where(
                Employee.branch_id == branch_id, Employee.role == role, Employee.is_active.is_(True)
            )
        )
        is not None
    )


def target_branches(db: Session, claims: dict, primary_role: str) -> list[int]:
    """primary_role: 'stock_manager' (düşük stok) ya da 'seller_manager' (SKT)."""
    role = claims["role"]

    if role == primary_role:
        return [claims["branch_id"]]

    if role == "branch_manager":
        branch_id = claims["branch_id"]
        if _role_exists_in_branch(db, branch_id, primary_role):
            return []
        return [branch_id]

    if role == "region_manager":
        branch_ids = db.scalars(select(Branch.id).where(Branch.region_id == claims["region_id"])).all()
        return [
            b
            for b in branch_ids
            if not _role_exists_in_branch(db, b, primary_role) and not _role_exists_in_branch(db, b, "branch_manager")
        ]

    if role == "general_manager":
        branch_ids = db.scalars(
            select(Branch.id).join(Region, Branch.region_id == Region.id).where(Region.company_id == claims["company_id"])
        ).all()
        return [
            b
            for b in branch_ids
            if not _role_exists_in_branch(db, b, primary_role)
            and not _role_exists_in_branch(db, b, "branch_manager")
            and not _role_exists_in_branch(db, b, "region_manager")
        ]

    # Kasiyer, Operasyon Şefi (madde 14 — kalıtım zincirinin dışında, hedef olamaz),
    # Şirket IT, Satıcı Yöneticisi, diğer principal rol (örn. seller_manager düşük stok için): hedef değil.
    return []
