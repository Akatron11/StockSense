from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import Branch, LayoutZone, NotificationRead, Product, Region, Stock
from ..schemas.stock import BranchStockOut, StockOut, StockUpdate

router = APIRouter(prefix="/api/stock", tags=["stock"])

# stocksense-api-tr.md — "Şube Stok Durumu": her rol sadece kendi alanını değiştirebilir.
# branch_manager/region_manager/general_manager, mimari madde 2'deki yetki kalıtımı ilkesi gereği
# Stock Manager + Seller Manager'ın TÜM alanlarını kapsar (2026-08-07, kullanıcı kararı).
# zone_id (UC-15 SHOULD, 2026-08-07) seller_manager'ın yetkisi — kalıtım zinciriyle üst rollere de geçer.
_INHERITED_FIELDS = {"quantity", "low_stock_threshold", "price_override", "zone_id"}
ROLE_ALLOWED_FIELDS = {
    "seller_manager": {"price_override", "zone_id"},
    "stock_manager": {"quantity", "low_stock_threshold"},
    "branch_manager": _INHERITED_FIELDS,
    "region_manager": _INHERITED_FIELDS,
    "general_manager": _INHERITED_FIELDS,
}


def _resolve_target_branch(claims: dict, branch_id: int | None, db: Session) -> Branch:
    """Hangi şubenin stok/fiyat verisiyle çalışılacağını rol bazında çözer.

    region_manager/general_manager'ın kendi branch_id'si yok (bkz. madde 9 — employees tek tablo, 3
    nullable FK) — bu yüzden hedef şube reports.py'deki _resolve_scope ile aynı desende, açık bir
    branch_id query param'ıyla seçiliyor. branch_manager (ve stock_manager/seller_manager gibi şube
    seviyesindeki diğer roller) için hedef zaten kendi branch_id'leri — branch_id param'ı sadece kendi
    şubeleriyle eşleşiyorsa kabul edilir, farklıysa 404.
    """
    role = claims["role"]
    company_id = claims["company_id"]

    if role == "region_manager":
        if branch_id is None:
            raise HTTPException(status_code=422, detail="branch_id gerekli")
        branch = db.scalar(select(Branch).where(Branch.id == branch_id, Branch.region_id == claims["region_id"]))
        if branch is None:
            raise HTTPException(status_code=404, detail="Branch not found in your region")
        return branch

    if role == "general_manager":
        if branch_id is None:
            raise HTTPException(status_code=422, detail="branch_id gerekli")
        branch = db.scalar(
            select(Branch)
            .join(Region, Branch.region_id == Region.id)
            .where(Branch.id == branch_id, Region.company_id == company_id)
        )
        if branch is None:
            raise HTTPException(status_code=404, detail="Branch not found")
        return branch

    own_branch_id = claims.get("branch_id")
    if own_branch_id is None:
        raise HTTPException(status_code=403, detail="Bu işleme erişim yetkiniz yok")
    if branch_id is not None and branch_id != own_branch_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch = db.get(Branch, own_branch_id)
    return branch


def _to_stock_out(stock: Stock, product: Product) -> StockOut:
    return StockOut(
        product_id=stock.product_id,
        branch_id=stock.branch_id,
        quantity=stock.quantity,
        low_stock_threshold=stock.low_stock_threshold,
        price_override=stock.price_override,
        zone_id=stock.zone_id,
        product_name=product.name,
        sku=product.sku,
        best_before_date=product.best_before_date,
        effective_price=stock.price_override if stock.price_override is not None else product.default_price,
    )


# PROCESS.md Faz 3 "quantity takibi" (2026-08-11) — sadece bu üç rol, kullanıcının isteğiyle sınırlı
# (stock_manager zaten tek şubeli, bu view'a ihtiyacı yok; seller_manager /stock sayfasını hiç kullanmıyor).
QUANTITY_TRACKING_ROLES = {"branch_manager", "region_manager", "general_manager"}


def _scope_branch_ids(claims: dict, db: Session) -> list[int]:
    """reports.py::_resolve_scope ile aynı hiyerarşi mantığı — drill-down parametresi yok, çağıranın
    tüm yetki alanı (kendi şube/bölge/şirket) döner."""
    role = claims["role"]
    if role == "branch_manager":
        return [claims["branch_id"]]
    if role == "region_manager":
        return list(db.scalars(select(Branch.id).where(Branch.region_id == claims["region_id"])).all())
    return list(
        db.scalars(
            select(Branch.id)
            .join(Region, Branch.region_id == Region.id)
            .where(Region.company_id == claims["company_id"])
        ).all()
    )


@router.get("/product/{product_id}/branches", response_model=list[BranchStockOut])
def list_stock_by_product(
    product_id: int,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    """Bir ürünün, çağıranın yetki alanındaki her şubedeki miktarı — Stock satırı hiç yoksa 0/0 olarak
    gösterilir (upsert kararıyla tutarlı, bkz. update_stock)."""
    if claims["role"] not in QUANTITY_TRACKING_ROLES:
        raise HTTPException(status_code=403, detail="Bu görünüme erişim yetkiniz yok")

    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"])
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    branch_ids = _scope_branch_ids(claims, db)
    if not branch_ids:
        return []

    branches = db.execute(select(Branch.id, Branch.name).where(Branch.id.in_(branch_ids))).all()
    stock_by_branch = {
        s.branch_id: s
        for s in db.scalars(
            select(Stock).where(Stock.product_id == product_id, Stock.branch_id.in_(branch_ids))
        ).all()
    }

    # Bölge bazlı gruplama (2026-08-12, kullanıcı isteği) — sadece general_manager'ın company scope'unda
    # anlamlı; region_manager zaten tek bölgede, branch_manager tek şubede, ikisi için de None kalır.
    branch_region: dict[int, tuple[int, str]] = {}
    if claims["role"] == "general_manager":
        branch_region = {
            bid: (rid, rname)
            for bid, rid, rname in db.execute(
                select(Branch.id, Region.id, Region.name)
                .join(Region, Branch.region_id == Region.id)
                .where(Branch.id.in_(branch_ids))
            ).all()
        }

    result = []
    for branch_id, branch_name in branches:
        stock = stock_by_branch.get(branch_id)
        region = branch_region.get(branch_id)
        result.append(
            BranchStockOut(
                branch_id=branch_id,
                branch_name=branch_name,
                region_id=region[0] if region else None,
                region_name=region[1] if region else None,
                quantity=stock.quantity if stock else 0,
                low_stock_threshold=stock.low_stock_threshold if stock else 0,
                effective_price=(stock.price_override if stock and stock.price_override is not None else product.default_price),
            )
        )
    result.sort(key=lambda b: (b.region_name or "", b.branch_name))
    return result


@router.get("", response_model=list[StockOut])
def list_stock(
    branch_id: int | None = Query(default=None),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    branch = _resolve_target_branch(claims, branch_id, db)
    rows = db.execute(
        select(Stock, Product).join(Product, Stock.product_id == Product.id).where(Stock.branch_id == branch.id)
    ).all()
    return [_to_stock_out(stock, product) for stock, product in rows]


@router.patch("/{product_id}", response_model=StockOut)
def update_stock(
    product_id: int,
    payload: StockUpdate,
    branch_id: int | None = Query(default=None),
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="Güncellenecek alan gönderilmedi")

    allowed = ROLE_ALLOWED_FIELDS.get(claims["role"], set())
    unauthorized = set(fields) - allowed
    if unauthorized:
        raise HTTPException(status_code=403, detail=f"Bu role izinli olmayan alanlar: {sorted(unauthorized)}")

    branch = _resolve_target_branch(claims, branch_id, db)

    if "zone_id" in fields and fields["zone_id"] is not None:
        zone = db.scalar(
            select(LayoutZone).where(LayoutZone.id == fields["zone_id"], LayoutZone.branch_id == branch.id)
        )
        if zone is None:
            raise HTTPException(status_code=404, detail="Zone not found")

    product = db.scalar(
        select(Product).where(Product.id == product_id, Product.company_id == claims["company_id"])
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    stock_row = db.scalar(select(Stock).where(Stock.product_id == product_id, Stock.branch_id == branch.id))
    if stock_row is None:
        stock_row = Stock(product_id=product_id, branch_id=branch.id, quantity=0, low_stock_threshold=0)
        db.add(stock_row)

    for field, value in fields.items():
        setattr(stock_row, field, value)

    if ("quantity" in fields or "low_stock_threshold" in fields) and stock_row.quantity > stock_row.low_stock_threshold:
        db.execute(
            delete(NotificationRead).where(
                NotificationRead.kind == "low_stock",
                NotificationRead.product_id == product_id,
                NotificationRead.branch_id == branch.id,
            )
        )

    db.commit()
    db.refresh(stock_row)
    return _to_stock_out(stock_row, product)
