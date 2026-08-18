"""Generates the 100-product day-0 Excel import demo file (spec Karar 6).

Reads the same Mockaroo CSV as generate_demo_dataset.py, picks a category-balanced 100-row subset,
and writes it in the exact column order app/services/product_import.py::EXPECTED_HEADERS expects.
SKUs are prefixed SKU-DEMO-* — independent from the real MegaMarket/Şen Market SKUs.

Usage (from backend/):
    python generate_demo_import_template.py [--csv seed_data/megamarket_products.csv] [--out seed_data/day0_import_template.xlsx]
"""

import argparse
import random
from datetime import date

from openpyxl import Workbook

from demo_data.catalog import CATEGORY_INFO, generate_best_before_date, generate_cost_price, generate_sku, load_products_csv

EXPECTED_HEADERS = ["name", "sku", "category", "default_price", "cost_price", "best_before_date"]
TARGET_COUNT = 100


def select_balanced_subset(raw_products: list, target: int = TARGET_COUNT) -> list:
    by_category: dict[str, list] = {}
    for raw in raw_products:
        by_category.setdefault(raw.category, []).append(raw)

    per_category = max(1, target // len(CATEGORY_INFO))
    selected: list = []
    for items in by_category.values():
        selected.extend(random.sample(items, k=min(per_category, len(items))))

    random.shuffle(selected)
    return selected[:target]


def build_workbook(raw_products: list) -> Workbook:
    today = date.today()
    seq_by_category: dict[str, int] = {}

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Products"
    sheet.append(EXPECTED_HEADERS)

    for raw in raw_products:
        seq_by_category[raw.category] = seq_by_category.get(raw.category, 0) + 1
        seq = seq_by_category[raw.category]
        sku = generate_sku(raw.category, seq, prefix="SKU-DEMO")
        cost_price = generate_cost_price(raw.default_price, raw.category)
        bbd = generate_best_before_date(raw.category, today)
        sheet.append([raw.name, sku, raw.category, raw.default_price, cost_price, bbd.isoformat()])

    return workbook


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="seed_data/megamarket_products.csv")
    parser.add_argument("--out", default="seed_data/day0_import_template.xlsx")
    args = parser.parse_args()

    raw_products = load_products_csv(args.csv)
    subset = select_balanced_subset(raw_products)
    workbook = build_workbook(subset)
    workbook.save(args.out)
    print(f"Wrote {len(subset)} products to {args.out}")


if __name__ == "__main__":
    main()
