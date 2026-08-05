"""UC-15 — Layout Önerisi Görüntüleme. Sadece seller_manager, kendi şubesi (JWT'den implicit)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import LayoutRecommendationApplication
from ..schemas.layout_suggestion import (
    LayoutSuggestionApplyIn,
    LayoutSuggestionApplyOut,
    LayoutSuggestionItem,
    LayoutSuggestionOut,
)
from ..services.layout_recommendation import compute_recommendation

router = APIRouter(prefix="/api/reports", tags=["layout-suggestion"])


def _normalize_pair(product_a_id: int, product_b_id: int) -> tuple[int, int]:
    return (product_a_id, product_b_id) if product_a_id < product_b_id else (product_b_id, product_a_id)


@router.get("/layout-suggestion", response_model=LayoutSuggestionOut)
def get_layout_suggestion(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    if claims["role"] != "seller_manager":
        raise HTTPException(status_code=403, detail="Bu rapora erişim yetkiniz yok")

    branch_id = claims["branch_id"]
    result = compute_recommendation(db, branch_id)

    applications = {
        (a.product_a_id, a.product_b_id): a
        for a in db.scalars(
            select(LayoutRecommendationApplication).where(
                LayoutRecommendationApplication.branch_id == branch_id
            )
        )
    }

    suggestions = []
    for s in result["suggestions"]:
        key = _normalize_pair(s["product_a_id"], s["product_b_id"])
        applied_row = applications.get(key)
        suggestions.append(
            LayoutSuggestionItem(
                product_a_id=s["product_a_id"],
                product_a_name=s["product_a_name"],
                product_b_id=s["product_b_id"],
                product_b_name=s["product_b_name"],
                score=s["score"],
                applied=applied_row is not None,
                applied_at=applied_row.applied_at if applied_row else None,
                applied_by=applied_row.applied_by if applied_row else None,
            )
        )

    return LayoutSuggestionOut(
        method=result["method"],
        branch_sales_count=result["branch_sales_count"],
        suggestions=suggestions,
    )


@router.post("/layout-suggestion/apply", response_model=LayoutSuggestionApplyOut)
def apply_layout_suggestion(
    payload: LayoutSuggestionApplyIn,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    if claims["role"] != "seller_manager":
        raise HTTPException(status_code=403, detail="Bu işlem için yetkili değilsiniz")

    branch_id = claims["branch_id"]
    a_id, b_id = _normalize_pair(payload.product_a_id, payload.product_b_id)

    row = db.scalar(
        select(LayoutRecommendationApplication).where(
            LayoutRecommendationApplication.branch_id == branch_id,
            LayoutRecommendationApplication.product_a_id == a_id,
            LayoutRecommendationApplication.product_b_id == b_id,
        )
    )
    now = datetime.now(timezone.utc)
    if row is None:
        row = LayoutRecommendationApplication(
            branch_id=branch_id,
            product_a_id=a_id,
            product_b_id=b_id,
            applied_by=claims["user_id"],
            applied_at=now,
        )
        db.add(row)
    else:
        row.applied_by = claims["user_id"]
        row.applied_at = now
    db.commit()
    db.refresh(row)

    return LayoutSuggestionApplyOut(
        product_a_id=row.product_a_id,
        product_b_id=row.product_b_id,
        applied=True,
        applied_at=row.applied_at,
        applied_by=row.applied_by,
    )
