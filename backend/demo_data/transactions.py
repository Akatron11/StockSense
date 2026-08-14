"""Sales/returns/stock-request/shift generation (spec Karar 5) — testco's `seed_sales_data.py`
basket-building pattern, generalized to work off category pairs instead of fixed SKUs (this
catalog is CSV-driven, so exact SKUs aren't known ahead of time)."""

import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from app.models import Return, ReturnItem, Sale, SaleItem, Shift, StockRequest

DAYS_SPAN = 90
PATTERN_BASKET_PROBABILITY = 0.4
EXTRA_ITEM_PROBABILITY = 0.3
RETURN_RATE = 0.025
RETURN_COMPLETED_RATE = 0.7
STOCK_REQUEST_PRODUCT_RATIO = 0.1

# Spec Karar 5 — category-level co-occurrence pairs (bread+milk-style demo pattern).
CATEGORY_PATTERN_PAIRS = [
    ("Bakery", "Dairy"),
    ("Snacks", "Beverages"),
    ("Meat", "Deli"),
    ("Coffee & Tea", "Breakfast & Pantry"),
]


def build_pattern_pairs(products: list) -> list[tuple]:
    by_category: dict[str, list] = defaultdict(list)
    for product in products:
        by_category[product.category].append(product)

    pairs = []
    for cat_a, cat_b in CATEGORY_PATTERN_PAIRS:
        if by_category.get(cat_a) and by_category.get(cat_b):
            pairs.append((random.choice(by_category[cat_a]), random.choice(by_category[cat_b])))
    return pairs


def _build_basket(pattern_pairs: list[tuple], available: list) -> list:
    if pattern_pairs and random.random() < PATTERN_BASKET_PROBABILITY:
        product_a, product_b = random.choice(pattern_pairs)
        basket = [product_a, product_b]
        if random.random() < EXTRA_ITEM_PROBABILITY:
            basket.append(random.choice(available))
        return basket
    basket_size = random.randint(1, 5)
    return random.sample(available, k=min(basket_size, len(available)))


def generate_sales_for_branch(
    db, branch, cashiers: list, available_products: list, pattern_pairs: list[tuple],
    daily_count_range: tuple[int, int], days_span: int = DAYS_SPAN,
) -> list:
    sales: list = []
    now = datetime.now(timezone.utc)

    for day_offset in range(days_span):
        daily_count = random.randint(*daily_count_range)
        for _ in range(daily_count):
            basket = _build_basket(pattern_pairs, available_products)
            employee = random.choice(cashiers)
            sale_date = (now - timedelta(days=day_offset)).replace(
                hour=random.randint(8, 21), minute=random.randint(0, 59), second=0, microsecond=0,
            )
            sale = Sale(
                sale_date=sale_date,
                branch_id=branch.id,
                employee_id=employee.id,
                payment_method="card" if random.random() < 0.6 else "cash",
            )
            db.add(sale)
            db.flush()
            for product in basket:
                quantity = random.randint(1, 3)
                db.add(SaleItem(
                    sale_id=sale.id,
                    product_id=product.id,
                    quantity=quantity,
                    line_total=round(float(product.default_price) * quantity, 2),
                ))
            sales.append(sale)
        db.commit()  # one commit per simulated day per branch — bounds transaction size

    return sales
