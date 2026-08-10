"""Stock Manager'ın kendi şubesi için stok alanı planı (saf zone editörü — ürün ataması yok).
LayoutZone/layout_zones.py'den bilinçli olarak bağımsız, bkz. models/layout.py::StockZone.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import StockZone
from ..schemas.stock_zone import StockZoneCreate, StockZoneOut, StockZoneUpdate

router = APIRouter(prefix="/api/stock-zones", tags=["stock-zones"])


def _get_own_zone(db: Session, claims: dict, zone_id: int) -> StockZone:
    zone = db.scalar(
        select(StockZone).where(StockZone.id == zone_id, StockZone.branch_id == claims["branch_id"])
    )
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.get("", response_model=list[StockZoneOut])
def list_stock_zones(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    require_role(claims, "stock_manager")
    return db.scalars(select(StockZone).where(StockZone.branch_id == claims["branch_id"])).all()


@router.post("", response_model=StockZoneOut, status_code=201)
def create_stock_zone(
    payload: StockZoneCreate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "stock_manager")
    zone = StockZone(
        branch_id=claims["branch_id"], name=payload.name, width=payload.width, height=payload.height, x=0, y=0
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.patch("/{zone_id}", response_model=StockZoneOut)
def update_stock_zone(
    zone_id: int,
    payload: StockZoneUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "stock_manager")
    zone = _get_own_zone(db, claims, zone_id)
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Güncellenecek alan gönderilmedi")
    for field, value in fields.items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id}", status_code=204)
def delete_stock_zone(
    zone_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    require_role(claims, "stock_manager")
    zone = _get_own_zone(db, claims, zone_id)
    db.delete(zone)
    db.commit()
