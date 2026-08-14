"""Generates the MegaMarket + Şen Market demo dataset for the presentation.

Spec: docs/superpowers/specs/2026-08-14-demo-dataset-and-import-template-design.md
Idempotent (testco/seed_test_data.py pattern): re-running deletes and recreates each company by
subdomain, so this is safe to run again before the presentation.

Usage (from backend/):
    python generate_demo_dataset.py [--csv seed_data/megamarket_products.csv]
"""

import argparse
import random
from datetime import date

from app.database import SessionLocal
from app.models import (
    Branch, Company, CompanyFeature, Employee, Product, Region,
    Return, ReturnItem, Sale, SaleItem, Shift, Stock, StockRequest,
)
from demo_data.catalog import generate_best_before_date, generate_cost_price, generate_sku, load_products_csv
from demo_data.org import MEGAMARKET_SPEC, SENMARKET_SPEC, CompanySpec, build_company_org
from demo_data.stock import assign_products_and_stock
from demo_data.transactions import (
    build_pattern_pairs, generate_returns, generate_sales_for_branch,
    generate_shifts, generate_stock_requests,
)

SENMARKET_PRODUCT_TARGET = 300

DAILY_RANGES = {
    "megamarket": {"normal": (80, 120), "small": (25, 40)},
    "senmarket": {"normal": (40, 60), "small": (14, 24)},
}


def _delete_company_if_exists(db, subdomain: str) -> None:
    existing = db.query(Company).filter(Company.subdomain == subdomain).one_or_none()
    if existing is None:
        return
    print(f"Existing '{subdomain}' company found (id={existing.id}), deleting...")
    branch_ids = db.query(Branch.id).join(Region).filter(Region.company_id == existing.id)
    sale_ids = db.query(Sale.id).filter(Sale.branch_id.in_(branch_ids))
    return_ids = db.query(Return.id).filter(Return.sale_id.in_(sale_ids))
    db.query(ReturnItem).filter(ReturnItem.return_id.in_(return_ids)).delete(synchronize_session=False)
    db.query(Return).filter(Return.id.in_(return_ids)).delete(synchronize_session=False)
    db.query(SaleItem).filter(SaleItem.sale_id.in_(sale_ids)).delete(synchronize_session=False)
    db.query(Sale).filter(Sale.id.in_(sale_ids)).delete(synchronize_session=False)
    db.query(StockRequest).filter(StockRequest.branch_id.in_(branch_ids)).delete(synchronize_session=False)
    db.query(Shift).filter(
        Shift.employee_id.in_(db.query(Employee.id).filter(Employee.company_id == existing.id))
    ).delete(synchronize_session=False)
    db.query(Employee).filter(Employee.company_id == existing.id).delete()
    db.query(Stock).filter(Stock.branch_id.in_(branch_ids)).delete(synchronize_session=False)
    db.query(Product).filter(Product.company_id == existing.id).delete()
    db.query(Branch).filter(
        Branch.region_id.in_(db.query(Region.id).filter(Region.company_id == existing.id))
    ).delete(synchronize_session=False)
    db.query(Region).filter(Region.company_id == existing.id).delete()
    db.query(CompanyFeature).filter(CompanyFeature.company_id == existing.id).delete()
    db.delete(existing)
    db.commit()


def _build_products(db, company_id: int, raw_products: list, prefix: str = "SKU") -> list:
    today = date.today()
    seq_by_category: dict[str, int] = {}
    products = []
    for raw in raw_products:
        seq_by_category[raw.category] = seq_by_category.get(raw.category, 0) + 1
        seq = seq_by_category[raw.category]
        product = Product(
            company_id=company_id,
            name=raw.name,
            sku=generate_sku(raw.category, seq, prefix=prefix),
            category=raw.category,
            default_price=raw.default_price,
            cost_price=generate_cost_price(raw.default_price, raw.category),
            best_before_date=generate_best_before_date(raw.category, today),
        )
        db.add(product)
        products.append(product)
    db.flush()
    return products


def _select_senmarket_subset(raw_products: list, target: int = SENMARKET_PRODUCT_TARGET) -> list:
    """Category-balanced subset of MegaMarket's catalog (spec Karar 3 — Şen Market ⊂ MegaMarket)."""
    by_category: dict[str, list] = {}
    for raw in raw_products:
        by_category.setdefault(raw.category, []).append(raw)

    selected: list = []
    for items in by_category.values():
        share = max(1, round(len(items) / len(raw_products) * target))
        selected.extend(random.sample(items, k=min(share, len(items))))

    random.shuffle(selected)
    return selected[:target] if len(selected) > target else selected


def _generate_company(db, spec: CompanySpec, raw_products: list, is_megamarket: bool) -> None:
    _delete_company_if_exists(db, spec.subdomain)

    org = build_company_org(db, spec)

    company_raw_products = raw_products if is_megamarket else _select_senmarket_subset(raw_products)
    products = _build_products(db, org.company.id, company_raw_products)

    stocked_by_branch = assign_products_and_stock(db, products, org.branches)
    pattern_pairs = build_pattern_pairs(products)

    daily_ranges = DAILY_RANGES["megamarket" if is_megamarket else "senmarket"]

    all_sales: list = []
    for branch, is_small in org.branches:
        roster = org.employees_by_branch[branch.id]
        available = stocked_by_branch[branch.id]
        daily_range = daily_ranges["small"] if is_small else daily_ranges["normal"]

        sales = generate_sales_for_branch(db, branch, roster["cashier"], available, pattern_pairs, daily_range)
        all_sales.extend(sales)

        if is_megamarket:
            generate_stock_requests(db, branch, available, roster["stock_manager"][0])

    generate_returns(db, all_sales, org.employees_by_branch)

    # Query all company employees directly rather than flattening employees_by_branch, which only
    # contains branch-scoped roles and omits general_manager/company_it/region_manager (created in
    # build_company_org but not stored in OrgResult). Every employee for this company is already
    # flushed to the DB by this point, so every role gets a shift schedule.
    all_employees = db.query(Employee).filter(Employee.company_id == org.company.id).all()
    generate_shifts(db, all_employees)

    print(f"{spec.name}: {len(org.branches)} branches, {len(products)} products, {len(all_sales)} sales")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="seed_data/megamarket_products.csv")
    args = parser.parse_args()

    raw_products = load_products_csv(args.csv)
    print(f"Loaded {len(raw_products)} products from {args.csv}")

    db = SessionLocal()
    try:
        _generate_company(db, MEGAMARKET_SPEC, raw_products, is_megamarket=True)
        _generate_company(db, SENMARKET_SPEC, raw_products, is_megamarket=False)
    finally:
        db.close()

    print("Done.")


if __name__ == "__main__":
    main()
