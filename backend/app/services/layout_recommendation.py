"""UC-15 — Layout önerisi hesaplama motoru (mimari madde 7).

Şube hacmine göre otomatik yöntem geçişi: düşük hacimde basit co-occurrence sayımı (pandas),
yüksek hacimde Apriori/association-rule mining (mlxtend). Live-query — cache/materialized tablo
yok (mimari madde 5, "Hesaplama vs Görüntüleme Ayrımı"). Detay:
docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md.
"""

from collections import defaultdict
from itertools import combinations

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Product, Sale, SaleItem

# Kadıköy (~30-50 satış, co_occurrence) ile Beşiktaş (~300-500 satış, apriori) demo verisinin
# ortasına kalibre edildi (bkz. spec — Seed Veri bölümü). Şirket bazında yapılandırılabilir değil
# (kullanıcı kararı, 2026-08-05).
LAYOUT_METHOD_THRESHOLD_SALES = 150
TOP_N_SUGGESTIONS = 5
APRIORI_MIN_SUPPORT = 0.02


def compute_recommendation(db: Session, branch_id: int) -> dict:
    sale_ids = db.scalars(select(Sale.id).where(Sale.branch_id == branch_id)).all()
    branch_sales_count = len(sale_ids)

    if branch_sales_count == 0:
        return {"method": "co_occurrence", "branch_sales_count": 0, "suggestions": []}

    rows = db.execute(
        select(SaleItem.sale_id, SaleItem.product_id, Product.name)
        .join(Product, Product.id == SaleItem.product_id)
        .where(SaleItem.sale_id.in_(sale_ids))
    ).all()

    product_names: dict[int, str] = {}
    baskets_by_sale: dict[int, set[int]] = defaultdict(set)
    for sale_id, product_id, product_name in rows:
        baskets_by_sale[sale_id].add(product_id)
        product_names[product_id] = product_name

    basket_list = [sorted(items) for items in baskets_by_sale.values() if len(items) >= 2]

    method = "co_occurrence" if branch_sales_count < LAYOUT_METHOD_THRESHOLD_SALES else "apriori"

    if method == "co_occurrence":
        suggestions = _compute_co_occurrence(basket_list, branch_sales_count, product_names)
    else:
        suggestions = _compute_apriori(basket_list, product_names)
        if not suggestions:
            # Apriori min_support eşiğini karşılayan çift yoksa co_occurrence'a düş — Seller
            # Manager'ı elinde hiçbir öneri olmadan bırakmamak için. method alanı da
            # "co_occurrence" olarak güncellenir, çünkü döndürülen skorlar artık gerçekte o
            # yöntemle hesaplanmış oluyor (hacme göre "apriori" seçilmiş olması önemli değil).
            method = "co_occurrence"
            suggestions = _compute_co_occurrence(basket_list, branch_sales_count, product_names)

    return {
        "method": method,
        "branch_sales_count": branch_sales_count,
        "suggestions": suggestions[:TOP_N_SUGGESTIONS],
    }


def _compute_co_occurrence(
    basket_list: list[list[int]], branch_sales_count: int, product_names: dict[int, str]
) -> list[dict]:
    pair_counts: dict[tuple[int, int], int] = defaultdict(int)
    for basket in basket_list:
        for a, b in combinations(basket, 2):
            pair_counts[(a, b)] += 1

    results = [
        {
            "product_a_id": a,
            "product_a_name": product_names[a],
            "product_b_id": b,
            "product_b_name": product_names[b],
            "score": round(count / branch_sales_count, 4),
        }
        for (a, b), count in pair_counts.items()
    ]
    results.sort(key=lambda r: r["score"], reverse=True)
    return results


def _compute_apriori(basket_list: list[list[int]], product_names: dict[int, str]) -> list[dict]:
    if not basket_list:
        return []

    encoder = TransactionEncoder()
    encoded = encoder.fit(basket_list).transform(basket_list)
    df = pd.DataFrame(encoded, columns=encoder.columns_)

    frequent = apriori(df, min_support=APRIORI_MIN_SUPPORT, use_colnames=True)
    if frequent.empty:
        return []

    rules = association_rules(frequent, metric="lift", min_threshold=1.0)
    pair_rules = rules[
        (rules["antecedents"].apply(len) == 1) & (rules["consequents"].apply(len) == 1)
    ]
    if pair_rules.empty:
        return []

    best_by_pair: dict[tuple[int, int], float] = {}
    for _, rule in pair_rules.iterrows():
        a = next(iter(rule["antecedents"]))
        b = next(iter(rule["consequents"]))
        key = (a, b) if a < b else (b, a)
        best_by_pair[key] = max(best_by_pair.get(key, 0.0), float(rule["confidence"]))

    results = [
        {
            "product_a_id": a,
            "product_a_name": product_names[a],
            "product_b_id": b,
            "product_b_name": product_names[b],
            "score": round(score, 4),
        }
        for (a, b), score in best_by_pair.items()
    ]
    results.sort(key=lambda r: r["score"], reverse=True)
    return results
