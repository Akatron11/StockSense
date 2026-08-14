"""Demo product catalog: category reference table, Mockaroo CSV loader, SKU/cost/date generators.

Mockaroo CSV contract (spec: docs/superpowers/specs/2026-08-14-demo-dataset-and-import-template-design.md,
Karar 3) — the CSV handed to `generate_demo_dataset.py --csv <path>` must have a header row with at
least these three columns (extra columns are ignored):
  - product_name   : English product name, e.g. "Nestle Chocolate Bar 70g"
  - category        : one of the 16 CATEGORY_INFO keys below, exact match (case-sensitive)
  - default_price   : positive number

`sku`, `cost_price`, and `best_before_date` are NOT read from the CSV even if present — this module
generates them (spec Karar 3: "Mockaroo'dan istenmez").
"""

import csv
import random
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class CategoryInfo:
    code: str
    margin: float
    perishable: bool


# Spec Karar 3 (category list) + Karar 5 (margin, perishable-date categories).
CATEGORY_INFO: dict[str, CategoryInfo] = {
    "Dairy": CategoryInfo(code="DAIRY", margin=0.32, perishable=True),
    "Bakery": CategoryInfo(code="BAKERY", margin=0.28, perishable=True),
    "Deli": CategoryInfo(code="DELI", margin=0.30, perishable=True),
    "Frozen Food": CategoryInfo(code="FROZEN", margin=0.33, perishable=True),
    "Meat": CategoryInfo(code="MEAT", margin=0.27, perishable=False),
    "Produce": CategoryInfo(code="PRODUCE", margin=0.25, perishable=False),
    "Snacks": CategoryInfo(code="SNACK", margin=0.37, perishable=False),
    "Beverages": CategoryInfo(code="BEV", margin=0.38, perishable=False),
    "Breakfast & Pantry": CategoryInfo(code="PANTRY", margin=0.35, perishable=False),
    "Canned Goods & Legumes": CategoryInfo(code="CANNED", margin=0.35, perishable=False),
    "Baby Products": CategoryInfo(code="BABY", margin=0.40, perishable=False),
    "Personal Care": CategoryInfo(code="PERSCARE", margin=0.45, perishable=False),
    "Household Supplies": CategoryInfo(code="HOUSEHOLD", margin=0.42, perishable=False),
    "Coffee & Tea": CategoryInfo(code="COFFEE", margin=0.40, perishable=False),
    "Pet Supplies": CategoryInfo(code="PET", margin=0.40, perishable=False),
    "Cleaning Supplies": CategoryInfo(code="CLEAN", margin=0.43, perishable=False),
}


@dataclass(frozen=True)
class RawProduct:
    name: str
    category: str
    default_price: float


def load_products_csv(path: str) -> list[RawProduct]:
    products: list[RawProduct] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            category = (row.get("category") or "").strip()
            if category not in CATEGORY_INFO:
                raise ValueError(
                    f"{path}:{row_num}: unknown category '{category}' — must be one of "
                    f"{sorted(CATEGORY_INFO)}"
                )
            name = (row.get("product_name") or "").strip()
            if not name:
                raise ValueError(f"{path}:{row_num}: empty product_name")
            price_text = (row.get("default_price") or "").strip()
            try:
                default_price = float(price_text)
            except ValueError as exc:
                raise ValueError(f"{path}:{row_num}: invalid default_price '{price_text}'") from exc
            products.append(RawProduct(name=name, category=category, default_price=default_price))
    return products


def generate_sku(category: str, seq: int, prefix: str = "SKU") -> str:
    code = CATEGORY_INFO[category].code
    return f"{prefix}-{code}-{seq:03d}"


def generate_cost_price(default_price: float, category: str) -> float:
    margin = CATEGORY_INFO[category].margin
    return round(default_price * (1 - margin), 2)


def generate_best_before_date(category: str, today: date) -> date:
    info = CATEGORY_INFO[category]
    if info.perishable:
        roll = random.random()
        if roll < 0.15:
            days = random.randint(-10, -1)  # already expired — SKT alert scenario
        elif roll < 0.40:
            days = random.randint(1, 7)  # imminent
        else:
            days = random.randint(8, 60)
    else:
        days = random.randint(365, 730)
    return today + timedelta(days=days)
