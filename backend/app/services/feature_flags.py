from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CompanyFeature


def get_enabled_features(db: Session, company_id: int) -> set[str]:
    """Bir şirket için açık olan feature'ların adlarını döner."""
    rows = db.scalars(
        select(CompanyFeature.feature_name).where(
            CompanyFeature.company_id == company_id, CompanyFeature.enabled.is_(True)
        )
    )
    return set(rows)


def require_feature(db: Session, company_id: int, feature_name: str) -> None:
    """Feature kapalıysa 403 fırlatır. Endpoint'in en başında, require_role'den hemen sonra çağrılır."""
    if feature_name not in get_enabled_features(db, company_id):
        raise HTTPException(status_code=403, detail=f"Bu özellik şirketiniz için kapalı: {feature_name}")
