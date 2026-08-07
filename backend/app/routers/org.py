from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Branch, Region
from ..schemas.org import BranchOut, RegionOut

router = APIRouter(prefix="/api", tags=["org"])


@router.get("/regions", response_model=list[RegionOut])
def list_regions(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-18 — general_manager'ın 'Yeni hesap' formunda hedef bölge seçmesi için."""
    require_role(claims, "general_manager")
    return db.scalars(select(Region).where(Region.company_id == claims["company_id"])).all()


@router.get("/branches", response_model=list[BranchOut])
def list_branches(
    region_id: int | None = Query(default=None),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """region_manager için UC-18 (hedef şube seçimi); general_manager için Stok/Fiyat yetki kalıtımı
    (2026-08-07) — hangi şubede çalışacağını seçmesi için. region_id, general_manager'ın sonucu kendi
    şirketindeki bir bölgeyle daraltması içindir (reports.py'deki scope deseniyle tutarlı)."""
    role = claims["role"]
    if role == "region_manager":
        return db.scalars(select(Branch).where(Branch.region_id == claims["region_id"])).all()
    if role == "general_manager":
        query = select(Branch).join(Region, Branch.region_id == Region.id).where(
            Region.company_id == claims["company_id"]
        )
        if region_id is not None:
            query = query.where(Branch.region_id == region_id)
        return db.scalars(query).all()
    raise HTTPException(status_code=403, detail="Bu işleme erişim yetkiniz yok")
