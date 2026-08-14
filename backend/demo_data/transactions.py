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


# Returns/exchanges only these three roles can PIN-approve (app/services/manager_pin.py::PIN_APPROVER_ROLES).
PIN_APPROVER_ROLES = ("stock_manager", "seller_manager", "operations_chief")


def generate_returns(db, sales: list, employees_by_branch: dict) -> None:
    for sale in sales:
        if random.random() >= RETURN_RATE:
            continue
        items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        if not items:
            continue
        item = random.choice(items)

        roster = employees_by_branch.get(sale.branch_id, {})
        approvers = [
            emp for role in PIN_APPROVER_ROLES for emp in roster.get(role, [])
        ]
        is_completed = random.random() < RETURN_COMPLETED_RATE and bool(approvers)

        return_row = Return(
            sale_id=sale.id,
            initiated_by=sale.employee_id,
            status="completed" if is_completed else "pending",
            net_amount=-round(float(item.line_total), 2),
            completed_by=random.choice(approvers).id if is_completed else None,
            completed_at=sale.sale_date + timedelta(days=random.randint(0, 5)) if is_completed else None,
        )
        db.add(return_row)
        db.flush()
        db.add(ReturnItem(
            return_id=return_row.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=round(float(item.line_total) / item.quantity, 2),
            direction="returned",
        ))
    db.commit()


def generate_stock_requests(db, branch, stocked_products: list, requester, days_span: int = DAYS_SPAN) -> None:
    if requester is None or not stocked_products:
        return
    now = datetime.now(timezone.utc)
    sample_size = max(1, round(len(stocked_products) * STOCK_REQUEST_PRODUCT_RATIO))
    for product in random.sample(stocked_products, k=min(sample_size, len(stocked_products))):
        for _ in range(random.randint(1, 3)):
            requested_at = now - timedelta(days=random.randint(0, days_span - 1))
            db.add(StockRequest(
                product_id=product.id,
                branch_id=branch.id,
                quantity=random.randint(10, 50),
                requested_by=requester.id,
                created_at=requested_at,
            ))
    db.commit()


def generate_shifts(db, employees: list) -> None:
    today = date.today()
    for employee in employees:
        for offset in range(7):
            shift_date = today + timedelta(days=offset)
            if random.random() < (2 / 7):
                db.add(Shift(employee_id=employee.id, shift_date=shift_date, is_day_off=True))
            else:
                start_hour = random.choice([8, 9, 10, 14])
                db.add(Shift(
                    employee_id=employee.id,
                    shift_date=shift_date,
                    start_time=time(start_hour, 0),
                    end_time=time(start_hour + 8, 0),
                    is_day_off=False,
                ))
    db.commit()
