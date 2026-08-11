from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Company
from .security import decode_access_token

bearer_scheme = HTTPBearer()

# Madde 16 — "Satıcı Yöneticisi, tenant üstü olduğu için ayrı bir yönetim kapısından girer
# (ör. admin.stocksense.com)". Rezerve subdomain, hiçbir company'ye ait değildir.
VENDOR_ADMIN_SUBDOMAIN = "admin"


def resolve_company_from_host(host: str | None, db: Session) -> Company | None:
    """Host header'daki subdomain'i company_id'ye çözer — get_company_from_host'un ve login'in
    ortak çekirdek mantığı. VENDOR_ADMIN_SUBDOMAIN için None döner."""
    if host is None:
        raise HTTPException(status_code=400, detail="Host header is required")
    subdomain = host.split(".")[0].split(":")[0]
    if subdomain == VENDOR_ADMIN_SUBDOMAIN:
        return None
    company = db.scalar(select(Company).where(Company.subdomain == subdomain))
    if company is None:
        raise HTTPException(status_code=404, detail="Unknown company subdomain")
    return company


def get_company_from_host(host: str | None = Header(default=None), db: Session = Depends(get_db)) -> Company | None:
    """Madde 16 — Host header'daki subdomain'i company_id'ye çözer (`sub.stocksense.com` -> `sub`).

    `VENDOR_ADMIN_SUBDOMAIN` için None döner (tenant-üstü vendor_manager girişi, login bu durumu ayrıca ele alır).
    """
    return resolve_company_from_host(host, db)


def get_current_claims(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    try:
        return decode_access_token(creds.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(claims: dict, *allowed_roles: str) -> None:
    """SRS FR tablosundaki aktör kısıtlarını uygular (örn. UC-06 → sadece Genel Müdür)."""
    if claims["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Bu işlem için yetkili değilsiniz: {allowed_roles}")
