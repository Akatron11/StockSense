from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Branch, Product, Region, Return, ReturnItem, Sale, SaleItem, Stock
from ..services.feature_flags import get_enabled_features
from ..schemas.report import (
    BreakdownItem,
    NeverSoldItem,
    ProductSalesBreakdownItem,
    ProductSalesOut,
    ProductSalesTrendPoint,
    SalesReportOut,
    SalesTrendPoint,
    TopProductItem,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

ALLOWED_DAYS = {7, 30, 90}
ROLES_WITH_ACCESS = {"branch_manager", "seller_manager", "region_manager", "general_manager"}

# Faz 3 "satış takibi" (PROCESS.md, 2026-08-11) — quantity takibi'yle tutarlı, sadece bu üç rol
# (ProductCatalogPage sadece general_manager'da var; StockManagerDashboard üçünde de paylaşılan sayfa).
PRODUCT_SALES_ROLES = {"branch_manager", "region_manager", "general_manager"}

# Her granularity için kaç periyot gösterilecek + o kadar periyodu garanti kapsayan gün sayısı.
PRODUCT_SALES_GRANULARITY = {
    "week": {"count": 12, "lookback_days": 12 * 7 + 7},
    "month": {"count": 12, "lookback_days": 12 * 31 + 31},
    "year": {"count": 5, "lookback_days": 5 * 366},
}


def _resolve_scope(
    claims: dict, branch_id: int | None, region_id: int | None, db: Session
) -> tuple[str, str, list[int]]:
    role = claims["role"]
    company_id = claims["company_id"]

    if role in ("branch_manager", "seller_manager"):
        branch = db.get(Branch, claims["branch_id"])
        return "branch", branch.name, [branch.id]

    if role == "region_manager":
        if branch_id is not None:
            branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.region_id == claims["region_id"]))
            if branch is None:
                raise HTTPException(status_code=404, detail="Branch not found in your region")
            return "branch", branch.name, [branch.id]
        region = db.get(Region, claims["region_id"])
        branch_ids = db.scalars(select(Branch.id).where(Branch.region_id == claims["region_id"])).all()
        return "region", region.name, list(branch_ids)

    if role == "general_manager":
        if branch_id is not None:
            branch = db.scalar(
                select(Branch).join(Region, Branch.region_id == Region.id).where(
                    Branch.id == branch_id, Region.company_id == company_id
                )
            )
            if branch is None:
                raise HTTPException(status_code=404, detail="Branch not found")
            return "branch", branch.name, [branch.id]
        if region_id is not None:
            region = db.scalar(select(Region).where(Region.id == region_id, Region.company_id == company_id))
            if region is None:
                raise HTTPException(status_code=404, detail="Region not found")
            branch_ids = db.scalars(select(Branch.id).where(Branch.region_id == region_id)).all()
            return "region", region.name, list(branch_ids)
        branch_ids = db.scalars(
            select(Branch.id).join(Region, Branch.region_id == Region.id).where(Region.company_id == company_id)
        ).all()
        return "company", "Şirket geneli", list(branch_ids)

    raise HTTPException(status_code=403, detail="Bu rapora erişim yetkiniz yok")


def _period_label(d: date, granularity: str) -> str:
    if granularity == "week":
        iso_year, iso_week, _ = d.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if granularity == "month":
        return f"{d.year}-{d.month:02d}"
    return str(d.year)


def _generate_periods(granularity: str, count: int) -> list[str]:
    """En eskiden en yeniye (bugünü içeren periyot dahil) `count` adet periyot etiketi üretir."""
    today = date.today()
    if granularity == "week":
        start_of_this_week = today - timedelta(days=today.isoweekday() - 1)
        return [_period_label(start_of_this_week - timedelta(weeks=count - 1 - i), "week") for i in range(count)]
    if granularity == "month":
        labels = []
        for i in range(count - 1, -1, -1):
            month_index = today.month - 1 - i
            year = today.year + month_index // 12
            month = month_index % 12 + 1
            labels.append(f"{year}-{month:02d}")
        return labels
    return [str(today.year - i) for i in range(count - 1, -1, -1)]


@router.get("/product-sales/{product_id}", response_model=ProductSalesOut)
def get_product_sales(
    product_id: int,
    granularity: str = Query("week"),
    branch_id: int | None = Query(default=None),
    region_id: int | None = Query(default=None),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """Faz 3 "satış takibi" (PROCESS.md, 2026-08-11) — bir ürünün adet+tutar satış trendi (haftalık/
    aylık/yıllık) ve çağıranın yetki alanı içinde bölge/şube kırılımı. İade/değişim net etkisi
    return_items üzerinden ürün bazlı doğru şekilde hesaplanır (returned düşer, new eklenir) —
    /reports/sales'teki sale-seviyesi net_amount yaklaşımından farklı, burada ürün granülerliği var.
    branch_id/region_id — /reports/sales'teki gibi company scope'taki bölge kırılımından bir bölgeye
    "drill-down" için (2026-08-12, kullanıcı isteğiyle eklendi — ReportsDetailPage'deki aynı desen)."""
    if claims["role"] not in PRODUCT_SALES_ROLES:
        raise HTTPException(status_code=403, detail="Bu görünüme erişim yetkiniz yok")
    if granularity not in PRODUCT_SALES_GRANULARITY:
        raise HTTPException(
            status_code=422, detail=f"granularity şu değerlerden biri olmalı: {sorted(PRODUCT_SALES_GRANULARITY)}"
        )

    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"])
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    scope, scope_label, branch_ids = _resolve_scope(claims, branch_id, region_id, db)

    cfg = PRODUCT_SALES_GRANULARITY[granularity]
    start_date = date.today() - timedelta(days=cfg["lookback_days"])
    periods = _generate_periods(granularity, cfg["count"])
    period_index = {p: i for i, p in enumerate(periods)}

    trend_quantity = [0] * len(periods)
    trend_revenue = [0.0] * len(periods)
    by_branch_quantity: dict[int, int] = defaultdict(int)
    by_branch_revenue: dict[int, float] = defaultdict(float)

    if branch_ids:
        item_rows = db.execute(
            select(SaleItem.quantity, SaleItem.line_total, Sale.branch_id, Sale.sale_date)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(
                SaleItem.product_id == product_id,
                Sale.branch_id.in_(branch_ids),
                func.date(Sale.sale_date) >= start_date,
            )
        ).all()
        for qty, line_total, branch_id, sale_date in item_rows:
            label = _period_label(sale_date.date(), granularity)
            idx = period_index.get(label)
            if idx is not None:
                trend_quantity[idx] += qty
                trend_revenue[idx] += float(line_total)
            by_branch_quantity[branch_id] += qty
            by_branch_revenue[branch_id] += float(line_total)

        return_rows = db.execute(
            select(ReturnItem.quantity, ReturnItem.unit_price, ReturnItem.direction, Sale.branch_id, Sale.sale_date)
            .join(Return, ReturnItem.return_id == Return.id)
            .join(Sale, Return.sale_id == Sale.id)
            .where(
                ReturnItem.product_id == product_id,
                Sale.branch_id.in_(branch_ids),
                Return.status == "completed",
                func.date(Sale.sale_date) >= start_date,
            )
        ).all()
        for qty, unit_price, direction, branch_id, sale_date in return_rows:
            sign = -1 if direction == "returned" else 1
            amount = float(unit_price) * qty
            label = _period_label(sale_date.date(), granularity)
            idx = period_index.get(label)
            if idx is not None:
                trend_quantity[idx] += sign * qty
                trend_revenue[idx] += sign * amount
            by_branch_quantity[branch_id] += sign * qty
            by_branch_revenue[branch_id] += sign * amount

    trend = [
        ProductSalesTrendPoint(period=p, quantity=trend_quantity[i], revenue=round(trend_revenue[i], 2))
        for i, p in enumerate(periods)
    ]

    breakdown: list[ProductSalesBreakdownItem] = []
    if scope == "region":
        branch_names = dict(db.execute(select(Branch.id, Branch.name).where(Branch.id.in_(branch_ids))).all())
        breakdown = [
            ProductSalesBreakdownItem(
                id=bid,
                label=branch_names[bid],
                quantity=by_branch_quantity.get(bid, 0),
                revenue=round(by_branch_revenue.get(bid, 0.0), 2),
            )
            for bid in branch_ids
        ]
    elif scope == "company":
        branch_region = dict(
            db.execute(
                select(Branch.id, Branch.region_id)
                .join(Region, Branch.region_id == Region.id)
                .where(Branch.id.in_(branch_ids))
            ).all()
        )
        region_names = dict(
            db.execute(select(Region.id, Region.name).where(Region.id.in_(set(branch_region.values())))).all()
        )
        region_quantity: dict[int, int] = defaultdict(int)
        region_revenue: dict[int, float] = defaultdict(float)
        for bid in branch_ids:
            rid = branch_region.get(bid)
            if rid is None:
                continue
            region_quantity[rid] += by_branch_quantity.get(bid, 0)
            region_revenue[rid] += by_branch_revenue.get(bid, 0.0)
        breakdown = [
            ProductSalesBreakdownItem(id=rid, label=region_names[rid], quantity=qty, revenue=round(region_revenue[rid], 2))
            for rid, qty in region_quantity.items()
        ]
    breakdown.sort(key=lambda b: b.revenue, reverse=True)

    return ProductSalesOut(
        product_id=product.id,
        product_name=product.name,
        scope=scope,
        scope_label=scope_label,
        granularity=granularity,
        trend=trend,
        breakdown=breakdown,
    )


@router.get("/sales", response_model=SalesReportOut)
def get_sales_report(
    days: int = Query(30),
    branch_id: int | None = Query(default=None),
    region_id: int | None = Query(default=None),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    if claims["role"] not in ROLES_WITH_ACCESS:
        raise HTTPException(status_code=403, detail="Bu rapora erişim yetkiniz yok")
    if days not in ALLOWED_DAYS:
        raise HTTPException(status_code=422, detail=f"days şu değerlerden biri olmalı: {sorted(ALLOWED_DAYS)}")

    scope, scope_label, branch_ids = _resolve_scope(claims, branch_id, region_id, db)

    end = date.today()
    start = end - timedelta(days=days - 1)

    low_stock_count = (
        db.scalar(
            select(func.count())
            .select_from(Stock)
            .where(Stock.branch_id.in_(branch_ids), Stock.quantity < Stock.low_stock_threshold)
        )
        if branch_ids
        else 0
    )

    if not branch_ids:
        item_rows = []
        return_rows = []
    else:
        item_rows = db.execute(
            select(
                SaleItem.line_total.label("line_total"),
                SaleItem.quantity.label("quantity"),
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Product.cost_price.label("cost_price"),
                Sale.id.label("sale_id"),
                Sale.branch_id.label("branch_id"),
                Sale.sale_date.label("sale_date"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(
                Sale.branch_id.in_(branch_ids),
                func.date(Sale.sale_date) >= start,
                func.date(Sale.sale_date) <= end,
            )
        ).all()

        return_rows = db.execute(
            select(
                Return.net_amount.label("net_amount"),
                Sale.branch_id.label("branch_id"),
                Sale.sale_date.label("sale_date"),
            )
            .join(Sale, Return.sale_id == Sale.id)
            .where(
                Sale.branch_id.in_(branch_ids),
                Return.status == "completed",
                func.date(Sale.sale_date) >= start,
                func.date(Sale.sale_date) <= end,
            )
        ).all()

    gross_sales = sum(float(r.line_total) for r in item_rows)
    returns_total = sum(float(r.net_amount) for r in return_rows)
    total_sales = gross_sales - returns_total
    transaction_count = len({r.sale_id for r in item_rows})

    covered_rows = [r for r in item_rows if r.cost_price is not None]
    covered_revenue = sum(float(r.line_total) for r in covered_rows)
    profit_amount = sum(float(r.line_total) - r.quantity * float(r.cost_price) for r in covered_rows)
    profit_margin_pct = (profit_amount / covered_revenue * 100) if covered_revenue > 0 else None
    profit_margin_amount = profit_amount if covered_rows else None
    cost_data_coverage_pct = (covered_revenue / gross_sales * 100) if gross_sales > 0 else 0.0

    daily_totals: dict[date, float] = defaultdict(float)
    for r in item_rows:
        daily_totals[r.sale_date.date()] += float(r.line_total)
    for r in return_rows:
        daily_totals[r.sale_date.date()] -= float(r.net_amount)
    trend = [
        SalesTrendPoint(day=start + timedelta(days=i), total_sales=daily_totals.get(start + timedelta(days=i), 0.0))
        for i in range(days)
    ]

    product_agg: dict[int, list] = {}
    for r in item_rows:
        agg = product_agg.setdefault(r.product_id, [r.product_name, 0, 0.0])
        agg[1] += r.quantity
        agg[2] += float(r.line_total)
    top_products = sorted(
        (TopProductItem(product_id=pid, product_name=name, quantity=qty, revenue=revenue) for pid, (name, qty, revenue) in product_agg.items()),
        key=lambda p: p.revenue,
        reverse=True,
    )[:5]

    least_selling = sorted(
        (TopProductItem(product_id=pid, product_name=name, quantity=qty, revenue=revenue) for pid, (name, qty, revenue) in product_agg.items()),
        key=lambda p: p.revenue,
    )[:5]

    sold_product_ids = set(product_agg.keys())
    never_sold: list[NeverSoldItem] = []
    if branch_ids:
        never_sold_rows = db.execute(
            select(Product.id, Product.name)
            .join(Stock, Stock.product_id == Product.id)
            .where(
                Stock.branch_id.in_(branch_ids),
                Product.id.notin_(sold_product_ids),
                Product.is_active.is_(True),
                Product.company_id == claims["company_id"],
            )
            .distinct()
        ).all()
        never_sold = [NeverSoldItem(product_id=pid, product_name=name) for pid, name in never_sold_rows]

    breakdown: list[BreakdownItem] = []
    if scope == "region":
        branch_names = dict(db.execute(select(Branch.id, Branch.name).where(Branch.id.in_(branch_ids))).all())
        breakdown = _breakdown_by_key(item_rows, return_rows, key=lambda r: r.branch_id, labels=branch_names)
    elif scope == "company":
        branch_region = dict(
            db.execute(
                select(Branch.id, Branch.region_id).join(Region, Branch.region_id == Region.id).where(
                    Branch.id.in_(branch_ids)
                )
            ).all()
        )
        region_names = dict(
            db.execute(select(Region.id, Region.name).where(Region.id.in_(set(branch_region.values())))).all()
        )
        breakdown = _breakdown_by_key(
            item_rows, return_rows, key=lambda r: branch_region[r.branch_id], labels=region_names
        )

    # UC-16 (net kâr marjı) sadece branch_manager/region_manager/general_manager'a açık — seller_manager
    # UC-13 (satış raporu) için bu endpoint'i kullanıyor ama kâr marjı alanlarını görmemeli (SRS çapraz
    # kontrolünde bulundu, 2026-08-03). Feature flag enforcement (2026-08-14) — ayrıca kpi_modulu açık olmalı.
    can_see_margin = claims["role"] != "seller_manager" and "kpi_modulu" in get_enabled_features(
        db, claims["company_id"]
    )

    return SalesReportOut(
        scope=scope,
        scope_label=scope_label,
        days=days,
        branch_count=len(branch_ids),
        low_stock_count=low_stock_count,
        total_sales=total_sales,
        transaction_count=transaction_count,
        profit_margin_pct=profit_margin_pct if can_see_margin else None,
        profit_margin_amount=profit_margin_amount if can_see_margin else None,
        cost_data_coverage_pct=cost_data_coverage_pct if can_see_margin else 0.0,
        trend=trend,
        top_products=top_products,
        breakdown=breakdown,
        least_selling=least_selling,
        never_sold=never_sold,
    )


def _breakdown_by_key(item_rows, return_rows, key, labels: dict[int, str]) -> list[BreakdownItem]:
    gross_by_key: dict[int, float] = defaultdict(float)
    covered_revenue_by_key: dict[int, float] = defaultdict(float)
    profit_by_key: dict[int, float] = defaultdict(float)
    for r in item_rows:
        k = key(r)
        gross_by_key[k] += float(r.line_total)
        if r.cost_price is not None:
            covered_revenue_by_key[k] += float(r.line_total)
            profit_by_key[k] += float(r.line_total) - r.quantity * float(r.cost_price)
    returns_by_key: dict[int, float] = defaultdict(float)
    for r in return_rows:
        returns_by_key[key(r)] += float(r.net_amount)

    result = []
    for k, label in labels.items():
        total = gross_by_key.get(k, 0.0) - returns_by_key.get(k, 0.0)
        covered = covered_revenue_by_key.get(k, 0.0)
        margin = (profit_by_key.get(k, 0.0) / covered * 100) if covered > 0 else None
        result.append(BreakdownItem(id=k, label=label, total_sales=total, profit_margin_pct=margin))
    result.sort(key=lambda b: b.total_sales, reverse=True)
    return result
