from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Branch, Company, Employee, Region
from ..schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from ..security import hash_password
from ..services.manager_pin import PIN_APPROVER_ROLES

router = APIRouter(prefix="/api/employees", tags=["employees"])

# Madde 6 (Operasyonel Akışlar — Hesap Oluşturma): steady-state'te üst seviye bir alt seviyeyi
# oluşturur. Day-0/İlk Kurulum (UC-17) artık vendor_manager'ın tüm rolleri oluşturabildiği bir
# akışla destekleniyor (2026-08-13, bkz. spec) — Şirket IT override (UC-19) hâlâ bu kapsamda değil.
CREATABLE_ROLES: dict[str, set[str]] = {
    "branch_manager": {"cashier", "stock_manager", "seller_manager"},
    "region_manager": {"branch_manager"},
    "general_manager": {"region_manager", "company_it"},
    "company_it": {"general_manager"},
    "operations_chief": {"staff"},
    "vendor_manager": {
        "general_manager", "company_it", "region_manager", "branch_manager",
        "cashier", "stock_manager", "seller_manager", "operations_chief", "staff",
    },
}

# vendor_manager hedef rolüne göre hangi ek scope alanının (branch/region) gerektiğini belirler —
# create_employee'deki vendor dalında kullanılır.
_VENDOR_BRANCH_SCOPED_ROLES = {"branch_manager", "cashier", "stock_manager", "seller_manager", "operations_chief", "staff"}


def _manageable_query(claims: dict, active_only: bool = True):
    """Çağıranın rolüne göre yönetebileceği (listeleyebileceği/düzenleyebileceği) çalışan kümesi.

    `active_only=False` PATCH tarafından kullanılır ki deaktive edilmiş bir çalışan
    `is_active=true` ile yeniden bulunup aktive edilebilsin (EmployeeUpdate.is_active'in amacı).
    """
    role = claims["role"]
    if role == "branch_manager":
        query = select(Employee).where(
            Employee.branch_id == claims["branch_id"], Employee.role.in_(CREATABLE_ROLES["branch_manager"])
        )
    elif role == "region_manager":
        branch_ids = select(Branch.id).where(Branch.region_id == claims["region_id"])
        query = select(Employee).where(Employee.role == "branch_manager", Employee.branch_id.in_(branch_ids))
    elif role == "general_manager":
        region_ids = select(Region.id).where(Region.company_id == claims["company_id"])
        query = select(Employee).where(
            or_(
                and_(Employee.role == "region_manager", Employee.region_id.in_(region_ids)),
                and_(Employee.role == "company_it", Employee.company_id == claims["company_id"]),
            )
        )
    elif role == "company_it":
        query = select(Employee).where(
            Employee.role == "general_manager", Employee.company_id == claims["company_id"]
        )
    elif role == "operations_chief":
        query = select(Employee).where(Employee.role == "staff", Employee.branch_id == claims["branch_id"])
    else:
        return None

    if active_only:
        query = query.where(Employee.is_active.is_(True))
    return query


@router.get("", response_model=list[EmployeeOut])
def list_employees(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    query = _manageable_query(claims)
    if query is None:
        raise HTTPException(status_code=403, detail="Bu role tanımlı bir hesap listesi yok")
    return db.scalars(query).all()


@router.get("/company-wide", response_model=list[EmployeeOut])
def list_employees_company_wide(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-19 (Şirket IT Override) — hiyerarşiden bağımsız, çağıranın company_id'sindeki tüm
    çalışanları döner (_manageable_query'den ayrı, çünkü company_it hiyerarşi zincirinde değil).
    Detay: docs/superpowers/specs/2026-08-14-company-it-account-override-design.md"""
    require_role(claims, "company_it")
    query = select(Employee).where(
        Employee.company_id == claims["company_id"], Employee.is_active.is_(True)
    )
    return db.scalars(query).all()


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(
    payload: EmployeeCreate, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)
):
    creator_role = claims["role"]
    allowed = CREATABLE_ROLES.get(creator_role, set())
    if payload.role not in allowed:
        raise HTTPException(status_code=403, detail=f"Bu role izinli olmayan hesap türü: {payload.role}")

    is_staff = payload.role == "staff"
    if not is_staff and (not payload.username or not payload.password):
        raise HTTPException(status_code=422, detail="username ve password gerekli")

    if payload.manager_pin is not None and payload.role not in PIN_APPROVER_ROLES:
        raise HTTPException(status_code=422, detail=f"manager_pin sadece şu rollere atanabilir: {PIN_APPROVER_ROLES}")

    branch_id: int | None = None
    region_id: int | None = None
    company_id: int | None = claims["company_id"]

    if creator_role == "branch_manager":
        branch_id = claims["branch_id"]
    elif creator_role == "region_manager":
        if payload.branch_id is None:
            raise HTTPException(status_code=422, detail="branch_id gerekli")
        branch = db.scalar(select(Branch).where(Branch.id == payload.branch_id, Branch.region_id == claims["region_id"]))
        if branch is None:
            raise HTTPException(status_code=404, detail="Şube bulunamadı (kendi bölgenizde değil)")
        branch_id = branch.id
    elif creator_role == "general_manager":
        if payload.role == "region_manager":
            if payload.region_id is None:
                raise HTTPException(status_code=422, detail="region_id gerekli")
            region = db.scalar(select(Region).where(Region.id == payload.region_id, Region.company_id == claims["company_id"]))
            if region is None:
                raise HTTPException(status_code=404, detail="Bölge bulunamadı (kendi şirketinizde değil)")
            region_id = region.id
        # company_it için ek bir alan gerekmiyor (branch/region bağlanmaz, general_manager'a
        # branch/region bağlanmadığı gibi) — mevcut "region_id zorunlu" kontrolü artık sadece
        # payload.role == "region_manager" olduğunda uygulanıyor (önceden koşulsuzdu, çünkü
        # general_manager tek hedef role sahipti; artık iki hedefi var).
    elif creator_role == "company_it":
        pass  # company_id yeterli, general_manager'a branch/region bağlanmaz
    elif creator_role == "vendor_manager":
        if payload.company_id is None:
            raise HTTPException(status_code=422, detail="company_id gerekli")
        target_company = db.get(Company, payload.company_id)
        if target_company is None:
            raise HTTPException(status_code=404, detail="Company not found")
        company_id = target_company.id

        if payload.role == "region_manager":
            if payload.region_id is None:
                raise HTTPException(status_code=422, detail="region_id gerekli")
            region = db.scalar(
                select(Region).where(Region.id == payload.region_id, Region.company_id == company_id)
            )
            if region is None:
                raise HTTPException(status_code=404, detail="Bölge bulunamadı (bu şirkete ait değil)")
            region_id = region.id
        elif payload.role in _VENDOR_BRANCH_SCOPED_ROLES:
            if payload.branch_id is None:
                raise HTTPException(status_code=422, detail="branch_id gerekli")
            branch = db.scalar(
                select(Branch)
                .join(Region, Branch.region_id == Region.id)
                .where(Branch.id == payload.branch_id, Region.company_id == company_id)
            )
            if branch is None:
                raise HTTPException(status_code=404, detail="Şube bulunamadı (bu şirkete ait değil)")
            branch_id = branch.id
        # general_manager / company_it için ek bir alan gerekmiyor — sadece company_id yeterli.
    elif creator_role == "operations_chief":
        branch_id = claims["branch_id"]

    employee = Employee(
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        age=payload.age,
        address=payload.address,
        username=None if is_staff else payload.username,
        password_hash=None if is_staff else hash_password(payload.password),
        manager_pin=hash_password(payload.manager_pin) if payload.manager_pin is not None else None,
        branch_id=branch_id,
        region_id=region_id,
        company_id=company_id,
    )
    db.add(employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Kullanıcı adı zaten kullanımda")
    db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    query = _manageable_query(claims, active_only=False)
    if query is None:
        raise HTTPException(status_code=403, detail="Bu role tanımlı bir hesap listesi yok")
    employee = db.scalar(query.where(Employee.id == employee_id))
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    fields = payload.model_dump(exclude_unset=True)
    manager_pin = fields.pop("manager_pin", None)
    if manager_pin is not None:
        if employee.role not in PIN_APPROVER_ROLES:
            raise HTTPException(
                status_code=422, detail=f"manager_pin sadece şu rollere atanabilir: {PIN_APPROVER_ROLES}"
            )
        employee.manager_pin = hash_password(manager_pin)

    for field, value in fields.items():
        setattr(employee, field, value)
    db.commit()
    db.refresh(employee)
    return employee
