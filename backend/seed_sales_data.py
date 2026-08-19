"""Analitik demo verisi — layout önerisi (co-occurrence/Apriori) için satış üretir.

Sprint 5 kickoff tasarımı: docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md.
`seed_test_data.py`'dan SONRA çalıştırılır (testco şirketinin ürün/şube/çalışan verisine ihtiyaç
duyar). Tek seferlik script: `python seed_sales_data.py`. Var olan testco sale/sale_item verisini
temizleyip yeniden üretir (idempotent).
"""

import random
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import Branch, Company, Employee, Product, Region, Return, ReturnItem, Sale, SaleItem

SUBDOMAIN = "testco"

# Desenli çekirdek (mimari madde 7, "Seed/Demo Veri Stratejisi").
PATTERN_PAIRS: list[tuple[str, str]] = [
    ("SKU-BREAD-01", "SKU-MILK-1L"),
    ("SKU-CIPS-150G", "SKU-KOLA-1L"),
    ("SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G"),
    ("SKU-MAKARNA-500G", "SKU-SALCA-700G"),
]

BRANCH1_SALES_COUNT = 40
BRANCH2_SALES_COUNT = 400
PATTERN_BASKET_PROBABILITY = 0.4
EXTRA_ITEM_PROBABILITY = 0.3
DAYS_SPAN = 30


def _random_sale_datetime() -> datetime:
    days_ago = random.randint(0, DAYS_SPAN - 1)
    hour = random.randint(9, 21)
    minute = random.randint(0, 59)
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _build_basket(pattern_pairs: list[tuple[str, str]], available: list[Product]) -> list[Product]:
    by_sku = {p.sku: p for p in available}
    if random.random() < PATTERN_BASKET_PROBABILITY:
        a_sku, b_sku = random.choice(pattern_pairs)
        if a_sku in by_sku and b_sku in by_sku:
            basket = [by_sku[a_sku], by_sku[b_sku]]
            if random.random() < EXTRA_ITEM_PROBABILITY:
                basket.append(random.choice(available))
            return basket
    basket_size = random.randint(1, 3)
    return random.sample(available, k=min(basket_size, len(available)))


def _generate_sales(db, branch: Branch, employee: Employee, count: int, available: list[Product]) -> None:
    for _ in range(count):
        basket = _build_basket(PATTERN_PAIRS, available)
        sale = Sale(
            sale_date=_random_sale_datetime(),
            branch_id=branch.id,
            employee_id=employee.id,
            payment_method=random.choice(["cash", "card"]),
        )
        db.add(sale)
        db.flush()
        for product in basket:
            quantity = random.randint(1, 2)
            db.add(
                SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=quantity,
                    line_total=round(float(product.default_price) * quantity, 2),
                )
            )


def main() -> None:
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.subdomain == SUBDOMAIN).one_or_none()
        if company is None:
            raise SystemExit(f"'{SUBDOMAIN}' şirketi bulunamadı — önce `python seed_test_data.py` çalıştırın.")

        branch1 = (
            db.query(Branch).join(Region).filter(Region.company_id == company.id, Branch.name == "Kadıköy Şube").one()
        )
        branch2 = (
            db.query(Branch).join(Region).filter(Region.company_id == company.id, Branch.name == "Beşiktaş Şube").one()
        )
        cashier1 = (
            db.query(Employee).filter(Employee.company_id == company.id, Employee.username == "cashier1").one()
        )
        cashier2 = (
            db.query(Employee).filter(Employee.company_id == company.id, Employee.username == "cashier2").one()
        )

        existing_sale_ids = db.query(Sale.id).filter(Sale.branch_id.in_([branch1.id, branch2.id]))
        existing_return_ids = db.query(Return.id).filter(Return.sale_id.in_(existing_sale_ids))
        db.query(ReturnItem).filter(ReturnItem.return_id.in_(existing_return_ids)).delete(synchronize_session=False)
        db.query(Return).filter(Return.id.in_(existing_return_ids)).delete(synchronize_session=False)
        db.query(SaleItem).filter(SaleItem.sale_id.in_(existing_sale_ids)).delete(synchronize_session=False)
        db.query(Sale).filter(Sale.id.in_(existing_sale_ids)).delete(synchronize_session=False)
        db.commit()

        all_products = db.query(Product).filter(Product.company_id == company.id).all()
        branch1_products = all_products  # Kadıköy tüm katalogda stoklu (bkz. seed_test_data.py)

        branch2_skus = {
            "SKU-BREAD-01", "SKU-MILK-1L", "SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G",
            "SKU-MAKARNA-500G", "SKU-SALCA-700G",
            "SKU-CIPS-150G", "SKU-KRAKER-200G", "SKU-BISKUVI-300G", "SKU-CIKOLATA-100G",
            "SKU-GOFRET-45G", "SKU-FISTIK-200G", "SKU-KURUUZUM-200G",
            "SKU-KOLA-1L", "SKU-GAZOZ-1L", "SKU-MEYVESUYU-1L", "SKU-MADENSUYU-500ML",
            "SKU-SU-1_5L", "SKU-BUZLUCAY-500ML", "SKU-ENERJI-250ML",
        }
        branch2_products = [p for p in all_products if p.sku in branch2_skus]

        _generate_sales(db, branch1, cashier1, BRANCH1_SALES_COUNT, branch1_products)
        _generate_sales(db, branch2, cashier2, BRANCH2_SALES_COUNT, branch2_products)
        db.commit()

        print(f"Kadıköy: {BRANCH1_SALES_COUNT} satış üretildi.")
        print(f"Beşiktaş: {BRANCH2_SALES_COUNT} satış üretildi.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
