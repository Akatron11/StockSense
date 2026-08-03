from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims, require_role
from ..models import Company, CompanyBranding, CompanyFeature
from ..schemas.company import BrandingOut, BrandingUpdate, CompanyOut, FeatureOut, FeatureUpdate

router = APIRouter(prefix="/api/companies", tags=["companies"])

# UC-22 — madde 10'daki örnek feature listesi (kullanıcı kararı, 2026-08-03: küçük sabit liste,
# serbest metin değil). Yeni bir feature ihtiyacı çıkarsa koddan eklenir.
KNOWN_FEATURES = ("layout_onerisi", "mobil_app", "merkez_depo_senaryosu", "kpi_modulu")


def _get_company_or_404(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("", response_model=list[CompanyOut])
def list_companies(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-22/UC-23 — Satıcı Yöneticisi'nin konfigüre edeceği müşteri seçimi."""
    require_role(claims, "vendor_manager")
    return db.scalars(select(Company)).all()


@router.get("/{company_id}/features", response_model=list[FeatureOut])
def get_features(company_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    """UC-22 — sadece feature flag'leri (rol konfigürasyonu bu turun kapsamı dışı, bkz. PROCESS.md)."""
    require_role(claims, "vendor_manager")
    _get_company_or_404(db, company_id)

    existing = {
        row.feature_name: row.enabled
        for row in db.scalars(select(CompanyFeature).where(CompanyFeature.company_id == company_id))
    }
    return [FeatureOut(feature_name=name, enabled=existing.get(name, False)) for name in KNOWN_FEATURES]


@router.put("/{company_id}/features/{feature_name}", response_model=FeatureOut)
def update_feature(
    company_id: int,
    feature_name: str,
    payload: FeatureUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "vendor_manager")
    _get_company_or_404(db, company_id)
    if feature_name not in KNOWN_FEATURES:
        raise HTTPException(status_code=422, detail=f"Bilinmeyen feature: {feature_name}")

    row = db.scalar(
        select(CompanyFeature).where(
            CompanyFeature.company_id == company_id, CompanyFeature.feature_name == feature_name
        )
    )
    if row is None:
        row = CompanyFeature(company_id=company_id, feature_name=feature_name, enabled=payload.enabled)
        db.add(row)
    else:
        row.enabled = payload.enabled

    db.commit()
    return FeatureOut(feature_name=feature_name, enabled=payload.enabled)


@router.get("/{company_id}/branding", response_model=BrandingOut)
def get_branding(company_id: int, claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    require_role(claims, "vendor_manager")
    company = _get_company_or_404(db, company_id)
    branding = db.get(CompanyBranding, company_id)
    if branding is None:
        return BrandingOut(logo_url=None, primary_color=None, display_name=company.name)
    return BrandingOut(logo_url=branding.logo_url, primary_color=branding.primary_color, display_name=branding.display_name)


@router.put("/{company_id}/branding", response_model=BrandingOut)
def update_branding(
    company_id: int,
    payload: BrandingUpdate,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    require_role(claims, "vendor_manager")
    _get_company_or_404(db, company_id)

    branding = db.get(CompanyBranding, company_id)
    if branding is None:
        branding = CompanyBranding(company_id=company_id)
        db.add(branding)

    branding.logo_url = payload.logo_url
    branding.primary_color = payload.primary_color
    branding.display_name = payload.display_name

    db.commit()
    return BrandingOut(logo_url=branding.logo_url, primary_color=branding.primary_color, display_name=branding.display_name)
