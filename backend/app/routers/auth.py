from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_company_from_host, get_current_claims, resolve_company_from_host
from ..models import Company, CompanyBranding, Employee
from ..schemas.auth import LoginRequest, TokenResponse, UserOut
from ..schemas.company import BrandingOut
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/branding", response_model=BrandingOut)
def get_login_branding(company: Company | None = Depends(get_company_from_host), db: Session = Depends(get_db)):
    """Madde 16 — Login ekranı, subdomain'e göre müşterinin markasıyla açılır (auth'suz, public)."""
    if company is None:
        # admin subdomain — vendor_manager girişi, müşteri markası yok.
        return BrandingOut(logo_url=None, primary_color=None, display_name="StockSense")
    branding = db.get(CompanyBranding, company.id)
    if branding is None:
        return BrandingOut(logo_url=None, primary_color=None, display_name=company.name)
    return BrandingOut(logo_url=branding.logo_url, primary_color=branding.primary_color, display_name=branding.display_name)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    host: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    # Mobil native client'lar Host header'ını web gibi güvenilir şekilde set edemeyebilir —
    # bu yüzden login body'sinde bir subdomain verildiyse Host header hiç okunmuyor/çözümlenmiyor
    # (company bir FastAPI Depends'i değil, koşullu olarak burada çözülüyor — bu sayede body'deki
    # subdomain her zaman önceliklidir ve Host'un erken-patlama davranışına hiç girilmez).
    # Bkz. docs/superpowers/specs/2026-08-11-mobile-companion-app-design.md.
    if payload.subdomain is not None:
        company = db.scalar(select(Company).where(Company.subdomain == payload.subdomain))
        if company is None:
            raise HTTPException(status_code=404, detail="Unknown company subdomain")
    else:
        company = resolve_company_from_host(host, db)

    if company is None:
        # admin subdomain — tenant-üstü vendor_manager girişi (madde 16).
        employee = db.scalar(
            select(Employee).where(
                Employee.company_id.is_(None),
                Employee.role == "vendor_manager",
                Employee.username == payload.username,
            )
        )
    else:
        employee = db.scalar(
            select(Employee).where(Employee.company_id == company.id, Employee.username == payload.username)
        )
    if employee is None or employee.password_hash is None or not verify_password(
        payload.password, employee.password_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(
        {
            "user_id": employee.id,
            "role": employee.role,
            "company_id": employee.company_id,
            "branch_id": employee.branch_id,
            "region_id": employee.region_id,
        }
    )
    user = UserOut(id=employee.id, full_name=f"{employee.first_name} {employee.last_name}", role=employee.role)
    return TokenResponse(access_token=access_token, user=user)


@router.get("/me", response_model=UserOut)
def me(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    employee = db.get(Employee, claims["user_id"])
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return UserOut(id=employee.id, full_name=f"{employee.first_name} {employee.last_name}", role=employee.role)
