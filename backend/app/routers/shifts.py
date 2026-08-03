from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Employee, Shift
from ..schemas.shift import RosterEmployee, ShiftOut, ShiftUpsert

router = APIRouter(prefix="/api/shifts", tags=["shifts"])

# UC-21 — madde 13: "şubedeki tüm personel (login'li ya da login'siz — managerlar ve yardımcıları
# hariç)". Kullanıcıyla netleştirildi (2026-08-03, çapraz kontrol sırasında): "managerlar" burada
# Şube Müdürü (+ üstü) ve yardımcılarını kapsıyor — Stock/Seller Manager sahada vardiyalı çalıştığı
# için roster'da kalıyor, madde 2'deki "Kasiyer ... paralel ... Stock/Seller Manager" saha/operasyonel
# katmanına ait oldukları okumasıyla tutarlı.
EXCLUDED_ROSTER_ROLES = ("branch_manager",)


# UC-21 — Vardiya Atama Operasyon Şefi'nin işi (madde 13); okuma da şimdilik ona özgü (Ana sayfa panosu
# için). Diğer roller ihtiyaç duyarsa (örn. Vardiya Takvimi ekranı) ayrıca netleştirilip genişletilecek.
@router.get("", response_model=list[ShiftOut])
def list_shifts(
    day: date = Query(default_factory=date.today),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "operations_chief")
    rows = db.execute(
        select(Shift, Employee.first_name, Employee.last_name)
        .join(Employee, Shift.employee_id == Employee.id)
        .where(Employee.branch_id == claims["branch_id"], Shift.shift_date == day)
    ).all()
    return [
        ShiftOut(
            employee_id=shift.employee_id,
            employee_name=f"{first_name} {last_name}",
            shift_date=shift.shift_date,
            start_time=shift.start_time,
            end_time=shift.end_time,
            is_day_off=shift.is_day_off,
        )
        for shift, first_name, last_name in rows
    ]


@router.get("/roster", response_model=list[RosterEmployee])
def list_roster(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-21 — Vardiya Takvimi'nde satırları oluşturan personel listesi (branch_manager hariç)."""
    require_role(claims, "operations_chief")
    return db.scalars(
        select(Employee).where(
            Employee.branch_id == claims["branch_id"],
            Employee.is_active.is_(True),
            Employee.role.not_in(EXCLUDED_ROSTER_ROLES),
        )
    ).all()


@router.get("/week", response_model=list[ShiftOut])
def list_week_shifts(
    start_date: date = Query(),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """UC-21 — Vardiya Takvimi haftalık görünüm (start_date dahil 7 gün)."""
    require_role(claims, "operations_chief")
    end_date = start_date + timedelta(days=6)
    rows = db.execute(
        select(Shift, Employee.first_name, Employee.last_name)
        .join(Employee, Shift.employee_id == Employee.id)
        .where(
            Employee.branch_id == claims["branch_id"],
            Shift.shift_date >= start_date,
            Shift.shift_date <= end_date,
        )
    ).all()
    return [
        ShiftOut(
            employee_id=shift.employee_id,
            employee_name=f"{first_name} {last_name}",
            shift_date=shift.shift_date,
            start_time=shift.start_time,
            end_time=shift.end_time,
            is_day_off=shift.is_day_off,
        )
        for shift, first_name, last_name in rows
    ]


@router.put("/{employee_id}", response_model=ShiftOut)
def assign_shift(
    employee_id: int,
    payload: ShiftUpsert,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """UC-21 — bir personele belirli bir gün için vardiya saati ya da off ataması (upsert)."""
    require_role(claims, "operations_chief")

    employee = db.scalar(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.branch_id == claims["branch_id"],
            Employee.is_active.is_(True),
            Employee.role.not_in(EXCLUDED_ROSTER_ROLES),
        )
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not payload.is_day_off and (payload.start_time is None or payload.end_time is None):
        raise HTTPException(status_code=422, detail="is_day_off=false ise start_time ve end_time gerekli")

    shift = db.scalar(
        select(Shift).where(Shift.employee_id == employee_id, Shift.shift_date == payload.shift_date)
    )
    if shift is None:
        shift = Shift(employee_id=employee_id, shift_date=payload.shift_date)
        db.add(shift)

    shift.is_day_off = payload.is_day_off
    shift.start_time = None if payload.is_day_off else payload.start_time
    shift.end_time = None if payload.is_day_off else payload.end_time

    db.commit()
    db.refresh(shift)
    return ShiftOut(
        employee_id=shift.employee_id,
        employee_name=f"{employee.first_name} {employee.last_name}",
        shift_date=shift.shift_date,
        start_time=shift.start_time,
        end_time=shift.end_time,
        is_day_off=shift.is_day_off,
    )
