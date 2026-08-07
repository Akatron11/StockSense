from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class LayoutSuggestionItem(BaseModel):
    product_a_id: int
    product_a_name: str
    product_a_zone_id: int | None = None
    product_b_id: int
    product_b_name: str
    product_b_zone_id: int | None = None
    score: float
    applied: bool
    applied_at: datetime | None = None
    applied_by: int | None = None


class LayoutSuggestionOut(BaseModel):
    method: Literal["co_occurrence", "apriori"]
    branch_sales_count: int
    suggestions: list[LayoutSuggestionItem]


class LayoutSuggestionApplyIn(BaseModel):
    product_a_id: int
    product_b_id: int


class LayoutSuggestionApplyOut(BaseModel):
    product_a_id: int
    product_b_id: int
    applied: bool
    applied_at: datetime
    applied_by: int
