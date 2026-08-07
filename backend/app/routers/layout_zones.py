"""UC-15 SHOULD — Seller Manager'ın kendi şubesi için zone (raf/reyon bölgesi) yönetimi.
Bkz. docs/superpowers/specs/2026-08-07-layout-floorplan-should-could-design.md.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import LayoutZone, Product, Stock
from ..schemas.layout_zone import LayoutZoneCreate, LayoutZoneOut, LayoutZoneProduct, LayoutZoneUpdate

router = APIRouter(prefix="/api/layout-zones", tags=["layout-zones"])


def _to_out(db: Session, zone: LayoutZone) -> LayoutZoneOut:
    rows = db.execute(
        select(Product.id, Product.name)
        .join(Stock, Stock.product_id == Product.id)
        .where(Stock.branch_id == zone.branch_id, Stock.zone_id == zone.id)
    ).all()
    return LayoutZoneOut(
        id=zone.id,
        name=zone.name,
        x=zone.x,
        y=zone.y,
        width=zone.width,
        height=zone.height,
        products=[LayoutZoneProduct(id=pid, name=pname) for pid, pname in rows],
    )


def _get_own_zone(db: Session, claims: dict, zone_id: int) -> LayoutZone:
    zone = db.scalar(
        select(LayoutZone).where(LayoutZone.id == zone_id, LayoutZone.branch_id == claims["branch_id"])
    )
    if zone is None:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.get("", response_model=list[LayoutZoneOut])
def list_layout_zones(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    require_role(claims, "seller_manager")
    zones = db.scalars(select(LayoutZone).where(LayoutZone.branch_id == claims["branch_id"])).all()
    return [_to_out(db, z) for z in zones]


@router.post("", response_model=LayoutZoneOut, status_code=201)
def create_layout_zone(
    payload: LayoutZoneCreate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "seller_manager")
    zone = LayoutZone(
        branch_id=claims["branch_id"], name=payload.name, width=payload.width, height=payload.height, x=0, y=0
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _to_out(db, zone)


@router.patch("/{zone_id}", response_model=LayoutZoneOut)
def update_layout_zone(
    zone_id: int,
    payload: LayoutZoneUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "seller_manager")
    zone = _get_own_zone(db, claims, zone_id)
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Güncellenecek alan gönderilmedi")
    for field, value in fields.items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return _to_out(db, zone)


@router.delete("/{zone_id}", status_code=204)
def delete_layout_zone(
    zone_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    require_role(claims, "seller_manager")
    zone = _get_own_zone(db, claims, zone_id)
    db.delete(zone)
    db.commit()
