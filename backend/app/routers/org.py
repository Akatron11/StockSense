from fastapi import APIRouter, Depends
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
def list_branches(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-18 — region_manager'ın 'Yeni hesap' formunda hedef şube seçmesi için."""
    require_role(claims, "region_manager")
    return db.scalars(select(Branch).where(Branch.region_id == claims["region_id"])).all()
