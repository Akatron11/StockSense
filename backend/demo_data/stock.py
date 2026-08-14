"""Per-branch product/stock assignment (spec Karar 2 — small branches stock ~40% of the catalog;
normal branches ~95%; some rows are deliberately left under threshold for the low-stock scenario)."""

import random

SMALL_BRANCH_CATALOG_RATIO = 0.4
NORMAL_BRANCH_CATALOG_RATIO = 0.95
LOW_STOCK_PROBABILITY = 0.08


def assign_products_and_stock(db, products: list, branches: list[tuple]) -> dict[int, list]:
    stocked_by_branch: dict[int, list] = {}

    for branch, is_small in branches:
        ratio = SMALL_BRANCH_CATALOG_RATIO if is_small else NORMAL_BRANCH_CATALOG_RATIO
        count = max(1, round(len(products) * ratio))
        branch_products = random.sample(products, k=min(count, len(products)))

        from app.models import Stock  # local import avoids a hard dependency at module load time

        for product in branch_products:
            threshold = random.randint(5, 15)
            if is_small:
                quantity = random.randint(5, 20)
            else:
                quantity = random.randint(20, 80)
            if random.random() < LOW_STOCK_PROBABILITY:
                quantity = random.randint(0, max(threshold - 1, 0))
            db.add(Stock(
                product_id=product.id, branch_id=branch.id,
                quantity=quantity, low_stock_threshold=threshold,
            ))

        stocked_by_branch[branch.id] = branch_products
        db.flush()

    return stocked_by_branch
