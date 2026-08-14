# MegaMarket/Şen Market Demo Veri Seti + Day-0 Import Şablonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate two realistic, database-seeded demo companies (MegaMarket, Şen Market) plus a
standalone 100-product Excel import template, for a university-project presentation — per
`docs/superpowers/specs/2026-08-14-demo-dataset-and-import-template-design.md`.

**Architecture:** A small `backend/demo_data/` package holds pure/reusable generation logic
(product catalog from a Mockaroo-sourced CSV, org/employee structure, stock assignment,
sales/returns/stock-request/shift generation). Two flat entry scripts at `backend/` root
(`generate_demo_dataset.py`, `generate_demo_import_template.py`) orchestrate that package against
a real DB session, following the existing `seed_test_data.py` idempotent-delete-and-recreate
pattern.

**Tech Stack:** Python 3.14, SQLAlchemy 2.0 ORM (existing `app.models`/`app.database`), `openpyxl`
for Excel I/O, stdlib `csv`/`random`/`datetime`. No new dependencies — `pandas`/`openpyxl` already
in `backend/requirements.txt`.

## Global Constraints

- **Spec of record:** `docs/superpowers/specs/2026-08-14-demo-dataset-and-import-template-design.md`
  — every task below implements one or more of its numbered decisions (referenced inline).
- **No pytest in this project.** There is no test framework anywhere in `backend/` — verification
  is manual (run the script/snippet, inspect printed output and/or query the DB directly), matching
  the existing convention (`seed_test_data.py`, and the "curl, proje konvansiyonu" test plan in
  `docs/superpowers/specs/2026-08-13-day0-vendor-setup-design.md`). Every step below that would
  normally be a pytest test is instead "write a short verification snippet, run it, confirm the
  printed output matches what's expected."
- **Working directory:** every command below is run from `backend/` (matches how `seed_test_data.py`
  is already invoked — `app` and the new `demo_data` package are both importable from there without
  path hacks).
- **Database:** Postgres is already running on `localhost:5432` (container `summer-db-1`, shared
  across worktrees via `docker-compose.yml`) with migrations applied — confirmed reachable via
  `python -c "from app.database import SessionLocal; SessionLocal()"` before this plan was written.
  No setup step needed; if it's ever down, `docker-compose up -d db` from the repo root brings it
  back.
- **Language rule (spec Karar 0):** every generated string follows the "proper nouns stay Turkish,
  everything else is English" rule — this is baked directly into the constants/data below (Turkish
  first names + real Turkish place names vs. English category/role/product/address text). Don't
  deviate when adding new constants.
- **Idempotency:** both entry scripts must be safely re-runnable — delete-then-recreate by
  `subdomain`, exactly like `seed_test_data.py`.
- **Expected runtime:** the full `generate_demo_dataset.py` run generates on the order of tens of
  thousands of sales (90 days × 10 branches at 25-120 sales/day for MegaMarket, 6 branches at
  14-60/day for Şen Market) — expect it to take a few minutes, not seconds. This is normal, not a
  bug.

---

## File Structure

```
backend/
  seed_data/
    megamarket_products.sample.csv   # small dev/test fixture (Task 1, committed)
    megamarket_products.csv          # real ~800-row Mockaroo export (user supplies later, Task 1 documents the contract; NOT created by this plan)
  demo_data/
    __init__.py
    catalog.py       # Task 1 — categories, CSV loader, SKU/cost_price/best_before_date generators
    org.py            # Task 2 — company/region/branch/employee specs + builder
    stock.py          # Task 3 — per-branch product/stock assignment
    transactions.py   # Task 4/5 — sales, returns, stock_requests, shifts
  generate_demo_dataset.py           # Task 6 — orchestrator entry point
  generate_demo_import_template.py   # Task 8 — day-0 100-product .xlsx generator
```

---

### Task 1: Product catalog module — CSV contract, sample fixture, SKU/price/date generation

**Files:**
- Create: `backend/demo_data/__init__.py`
- Create: `backend/demo_data/catalog.py`
- Create: `backend/seed_data/megamarket_products.sample.csv`

**Interfaces:**
- Produces (used by Tasks 4, 6, 8):
  - `CATEGORY_INFO: dict[str, CategoryInfo]` — keyed by category name exactly as it appears in the
    CSV `category` column (e.g. `"Dairy"`)
  - `@dataclass CategoryInfo(code: str, margin: float, perishable: bool)`
  - `@dataclass RawProduct(name: str, category: str, default_price: float)`
  - `load_products_csv(path: str) -> list[RawProduct]`
  - `generate_sku(category: str, seq: int, prefix: str = "SKU") -> str`
  - `generate_cost_price(default_price: float, category: str) -> float`
  - `generate_best_before_date(category: str, today: date) -> date`

- [ ] **Step 1: Create the package init**

`backend/demo_data/__init__.py`:
```python
```
(empty file — just makes `demo_data` a package)

- [ ] **Step 2: Write `catalog.py`**

`backend/demo_data/catalog.py`:
```python
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
```

- [ ] **Step 3: Verify the pure functions with a quick snippet**

Run from `backend/`:
```bash
python -c "
from demo_data.catalog import CATEGORY_INFO, generate_sku, generate_cost_price, generate_best_before_date
from datetime import date

assert len(CATEGORY_INFO) == 16
print(generate_sku('Dairy', 14))
print(generate_sku('Coffee & Tea', 3, prefix='SKU-DEMO'))
print(generate_cost_price(100.0, 'Produce'))
print(generate_cost_price(100.0, 'Personal Care'))
print(generate_best_before_date('Dairy', date.today()))
print(generate_best_before_date('Cleaning Supplies', date.today()))
"
```
Expected:
```
SKU-DAIRY-014
SKU-DEMO-COFFEE-003
75.0
55.00000000000001
<a date within about -10 to +60 days of today>
<a date about 1-2 years in the future>
```
(The `55.00...1` float artifact is fine — `Product.cost_price` is `Numeric(10,2)` so Postgres
stores/returns it rounded; this is only a Python `float` display quirk, not a bug. `round(..., 2)`
in `generate_cost_price` already limits precision for storage purposes.)

- [ ] **Step 4: Create the sample CSV fixture**

`backend/seed_data/megamarket_products.sample.csv` — 48 rows (3 per category), matches the CSV
contract documented in `catalog.py`'s docstring. This is what Tasks 6-8 run against until the real
Mockaroo export exists; the real file replaces/supplements it without any code change.

```csv
product_name,category,default_price
Whole Milk 1L,Dairy,45.90
Greek Yogurt 500g,Dairy,38.50
Cheddar Cheese 400g,Dairy,89.90
White Bread Loaf,Bakery,15.90
Croissant,Bakery,22.50
Sourdough Baguette,Bakery,18.90
Sliced Turkey Breast 200g,Deli,64.90
Salami 150g,Deli,54.90
Green Olives 400g,Deli,74.90
Frozen Pizza,Frozen Food,89.90
Frozen Peas 500g,Frozen Food,34.90
Vanilla Ice Cream 1L,Frozen Food,79.90
Ground Beef 500g,Meat,159.90
Chicken Breast 1kg,Meat,189.90
Lamb Chops 500g,Meat,249.90
Bananas 1kg,Produce,29.90
Tomatoes 1kg,Produce,24.90
Red Apples 1kg,Produce,27.90
Potato Chips 150g,Snacks,44.90
Milk Chocolate Bar 100g,Snacks,39.90
Mixed Nuts 200g,Snacks,99.90
Cola 1.5L,Beverages,34.90
Orange Juice 1L,Beverages,44.90
Sparkling Water 500ml,Beverages,12.90
Corn Flakes 500g,Breakfast & Pantry,64.90
Honey 450g,Breakfast & Pantry,149.90
Spaghetti 500g,Breakfast & Pantry,19.90
Canned Tomatoes 400g,Canned Goods & Legumes,24.90
Canned Chickpeas 400g,Canned Goods & Legumes,22.90
Canned Tuna 150g,Canned Goods & Legumes,39.90
Baby Diapers Pack,Baby Products,159.90
Baby Formula 800g,Baby Products,349.90
Baby Wipes Pack,Baby Products,49.90
Shampoo 400ml,Personal Care,89.90
Toothpaste 100ml,Personal Care,54.90
Body Wash 500ml,Personal Care,74.90
Paper Towels 4-Pack,Household Supplies,79.90
Toilet Paper 8-Pack,Household Supplies,89.90
Trash Bags 30ct,Household Supplies,64.90
Ground Coffee 250g,Coffee & Tea,129.90
Black Tea Box 100ct,Coffee & Tea,89.90
Instant Coffee 200g,Coffee & Tea,149.90
Dry Dog Food 2kg,Pet Supplies,199.90
Cat Litter 5kg,Pet Supplies,149.90
Cat Food Cans 6-Pack,Pet Supplies,89.90
Dish Soap 750ml,Cleaning Supplies,49.90
Laundry Detergent 1.5L,Cleaning Supplies,159.90
Multi-Surface Cleaner 500ml,Cleaning Supplies,44.90
```

- [ ] **Step 5: Verify the CSV loads cleanly**

```bash
python -c "
from demo_data.catalog import load_products_csv
products = load_products_csv('seed_data/megamarket_products.sample.csv')
print(len(products))
print(products[0])
categories = {p.category for p in products}
print(sorted(categories))
"
```
Expected: `48`, a `RawProduct(name='Whole Milk 1L', category='Dairy', default_price=45.9)` line, and
a sorted list of all 16 category names.

- [ ] **Step 6: Commit**

```bash
git add demo_data/__init__.py demo_data/catalog.py seed_data/megamarket_products.sample.csv
git commit -m "feat: add demo product catalog module (CSV loader, SKU/cost/date generation)"
```

---

### Task 2: Org module — names, company/region/branch specs, employee builder

**Files:**
- Create: `backend/demo_data/org.py`

**Interfaces:**
- Consumes: nothing from other tasks (only `app.models`, `app.security.hash_password`)
- Produces (used by Tasks 3, 4, 6):
  - `MEGAMARKET_SPEC: CompanySpec`, `SENMARKET_SPEC: CompanySpec`
  - `DEMO_PASSWORD: str`, `DEMO_PIN: str`
  - `@dataclass OrgResult(company: Company, branches: list[tuple[Branch, bool]], employees_by_branch: dict[int, dict[str, list[Employee]]])`
  - `build_company_org(db: Session, spec: CompanySpec) -> OrgResult`

- [ ] **Step 1: Write `org.py`**

`backend/demo_data/org.py`:
```python
"""Demo org structure: Turkish first names + English role titles (spec Karar 0), company/region/
branch layout (spec Karar 2), and the employee roster builder (spec Karar 4)."""

import random
from dataclasses import dataclass

from app.models import Branch, Company, CompanyFeature, Employee, Region
from app.security import hash_password

# Proper nouns stay Turkish (spec Karar 0).
FIRST_NAMES = [
    "Mehmet", "Ayşe", "Ali", "Fatma", "Mustafa", "Emine", "Ahmet", "Hatice", "Hüseyin", "Zeynep",
    "Hasan", "Elif", "İbrahim", "Meryem", "Osman", "Şule", "Yusuf", "Esra", "Murat", "Merve",
    "Kemal", "Derya", "Cem", "Banu", "Selin", "Onur", "Sinan", "İrem", "Deniz", "Ayla",
    "Recep", "Gizem", "Vedat", "Burak", "Ece", "Emre", "Ceren", "Kaan", "Nazlı", "Tolga",
]

# Titles are English (spec Karar 0/4): used as `last_name`, testco's title-as-surname convention.
ROLE_TITLES = {
    "cashier": "Cashier",
    "branch_manager": "BranchManager",
    "region_manager": "RegionManager",
    "general_manager": "GeneralManager",
    "stock_manager": "StockManager",
    "seller_manager": "SellerManager",
    "operations_chief": "OperationsChief",
    "company_it": "CompanyIT",
    "staff": "Staff",
}

STREET_NAMES = ["Main", "Park", "River", "Market", "Center", "Garden", "Hill", "Lake", "Oak", "Pine"]

DEMO_PASSWORD = "Demo1234!"
DEMO_PIN = "1234"

PIN_ROLES = {"stock_manager", "seller_manager", "operations_chief"}


@dataclass(frozen=True)
class BranchSpec:
    name: str
    is_small: bool


@dataclass(frozen=True)
class RegionSpec:
    name: str
    branches: list[BranchSpec]


@dataclass(frozen=True)
class CompanySpec:
    name: str
    subdomain: str
    regions: list[RegionSpec]
    stock_manager_range: tuple[int, int]
    seller_manager_range: tuple[int, int]
    cashier_range: tuple[int, int]
    staff_count: int
    enabled_features: list[str]


MEGAMARKET_SPEC = CompanySpec(
    name="MegaMarket",
    subdomain="megamarket",
    regions=[
        RegionSpec("Marmara Region", [BranchSpec("Istanbul Branch", False), BranchSpec("Bursa Branch", True)]),
        RegionSpec("Ege Region", [BranchSpec("Izmir Branch", False), BranchSpec("Manisa Branch", True)]),
        RegionSpec("Akdeniz Region", [BranchSpec("Antalya Branch", False), BranchSpec("Mersin Branch", True)]),
        RegionSpec("İç Anadolu Region", [BranchSpec("Ankara Branch", False), BranchSpec("Konya Branch", True)]),
        RegionSpec("Karadeniz Region", [BranchSpec("Trabzon Branch", False), BranchSpec("Samsun Branch", True)]),
    ],
    stock_manager_range=(1, 2),
    seller_manager_range=(1, 2),
    cashier_range=(2, 3),
    staff_count=10,
    enabled_features=["layout_onerisi", "mobil_app", "merkez_depo_senaryosu", "kpi_modulu"],
)

SENMARKET_SPEC = CompanySpec(
    name="Şen Market",
    subdomain="senmarket",
    regions=[
        RegionSpec("Marmara Region", [
            BranchSpec("Kocaeli Branch", False),
            BranchSpec("Tekirdağ Branch", False),
            BranchSpec("Sakarya Branch", False),
            BranchSpec("Çanakkale Branch", False),
            BranchSpec("Balıkesir Branch", True),
            BranchSpec("Edirne Branch", True),
        ]),
    ],
    stock_manager_range=(1, 1),
    seller_manager_range=(1, 1),
    cashier_range=(1, 1),
    staff_count=2,
    enabled_features=["layout_onerisi", "mobil_app"],
)


def _city_from_branch_name(branch_name: str) -> str:
    return branch_name.replace(" Branch", "")


def _address_for(city: str) -> str:
    return f"{random.randint(1, 300)} {random.choice(STREET_NAMES)} St, {city}"


def _random_age(role: str) -> int:
    if role in ("general_manager", "region_manager"):
        return random.randint(38, 55)
    if role in ("branch_manager", "stock_manager", "seller_manager", "operations_chief", "company_it"):
        return random.randint(28, 48)
    return random.randint(19, 40)


def _make_employee(
    role: str,
    company_id: int,
    username: str | None,
    password_hash: str | None,
    pin_hash: str | None,
    city: str,
    branch_id: int | None = None,
    region_id: int | None = None,
) -> Employee:
    return Employee(
        first_name=random.choice(FIRST_NAMES),
        last_name=ROLE_TITLES[role],
        username=username,
        password_hash=password_hash,
        role=role,
        branch_id=branch_id,
        region_id=region_id,
        company_id=company_id,
        age=_random_age(role),
        address=_address_for(city),
        manager_pin=pin_hash,
    )


@dataclass
class OrgResult:
    company: Company
    branches: list[tuple[Branch, bool]]
    employees_by_branch: dict[int, dict[str, list[Employee]]]


def build_company_org(db, spec: CompanySpec) -> OrgResult:
    password_hash = hash_password(DEMO_PASSWORD)
    pin_hash = hash_password(DEMO_PIN)

    company = Company(name=spec.name, subdomain=spec.subdomain)
    db.add(company)
    db.flush()

    for feature_name in spec.enabled_features:
        db.add(CompanyFeature(company_id=company.id, feature_name=feature_name, enabled=True))

    username_counters: dict[str, int] = {}

    def next_username(prefix: str) -> str:
        username_counters[prefix] = username_counters.get(prefix, 0) + 1
        return f"{prefix}{username_counters[prefix]}"

    hq_city = _city_from_branch_name(spec.regions[0].branches[0].name)
    db.add_all([
        _make_employee("general_manager", company.id, next_username("genmgr"), password_hash, None, hq_city),
        _make_employee("company_it", company.id, next_username("companyit"), password_hash, None, hq_city),
    ])

    branches: list[tuple[Branch, bool]] = []
    employees_by_branch: dict[int, dict[str, list[Employee]]] = {}

    for region_spec in spec.regions:
        region = Region(name=region_spec.name, company_id=company.id)
        db.add(region)
        db.flush()

        region_city = _city_from_branch_name(region_spec.branches[0].name)
        db.add(_make_employee(
            "region_manager", company.id, next_username("regionmgr"), password_hash, None,
            region_city, region_id=region.id,
        ))

        for branch_spec in region_spec.branches:
            branch = Branch(name=branch_spec.name, region_id=region.id)
            db.add(branch)
            db.flush()
            city = _city_from_branch_name(branch_spec.name)

            roster: dict[str, list[Employee]] = {
                "branch_manager": [_make_employee(
                    "branch_manager", company.id, next_username("branchmgr"), password_hash, None,
                    city, branch_id=branch.id,
                )],
                "stock_manager": [
                    _make_employee(
                        "stock_manager", company.id, next_username("stockmgr"), password_hash, pin_hash,
                        city, branch_id=branch.id,
                    )
                    for _ in range(random.randint(*spec.stock_manager_range))
                ],
                "seller_manager": [
                    _make_employee(
                        "seller_manager", company.id, next_username("sellermgr"), password_hash, pin_hash,
                        city, branch_id=branch.id,
                    )
                    for _ in range(random.randint(*spec.seller_manager_range))
                ],
                "operations_chief": [_make_employee(
                    "operations_chief", company.id, next_username("opschief"), password_hash, pin_hash,
                    city, branch_id=branch.id,
                )],
                "cashier": [
                    _make_employee(
                        "cashier", company.id, next_username("cashier"), password_hash, None,
                        city, branch_id=branch.id,
                    )
                    for _ in range(random.randint(*spec.cashier_range))
                ],
                "staff": [
                    _make_employee("staff", company.id, None, None, None, city, branch_id=branch.id)
                    for _ in range(spec.staff_count)
                ],
            }
            for employees in roster.values():
                db.add_all(employees)

            branches.append((branch, branch_spec.is_small))
            employees_by_branch[branch.id] = roster

    db.flush()
    return OrgResult(company=company, branches=branches, employees_by_branch=employees_by_branch)
```

- [ ] **Step 2: Verify against the live DB (creates and immediately rolls back — no lasting data)**

Run from `backend/`:
```bash
python -c "
from app.database import SessionLocal
from demo_data.org import SENMARKET_SPEC, build_company_org

db = SessionLocal()
try:
    org = build_company_org(db, SENMARKET_SPEC)
    print('company:', org.company.name, org.company.subdomain)
    print('branches:', len(org.branches))
    for branch, is_small in org.branches:
        roster = org.employees_by_branch[branch.id]
        counts = {role: len(emps) for role, emps in roster.items()}
        print(f'  {branch.name} (small={is_small}):', counts)
finally:
    db.rollback()
    db.close()
"
```
Expected: `company: Şen Market senmarket`, `branches: 6`, then one line per branch showing
`{'branch_manager': 1, 'stock_manager': 1, 'seller_manager': 1, 'operations_chief': 1, 'cashier': 1, 'staff': 2}`
for all six. The explicit `db.rollback()` means none of this is actually persisted — this step is
purely to prove the builder runs against the real schema without constraint errors.

- [ ] **Step 3: Commit**

```bash
git add demo_data/org.py
git commit -m "feat: add demo org module (company/region/branch/employee generation)"
```

---

### Task 3: Stock module — per-branch product/stock assignment

**Files:**
- Create: `backend/demo_data/stock.py`

**Interfaces:**
- Consumes: `app.models.Product`, `app.models.Stock`; `Branch` objects and `is_small` flags as
  produced by `org.build_company_org`'s `OrgResult.branches`
- Produces (used by Task 6):
  - `assign_products_and_stock(db: Session, products: list[Product], branches: list[tuple[Branch, bool]]) -> dict[int, list[Product]]`
    (returns branch_id → the list of `Product` objects actually stocked at that branch — Task 4
    needs this to know what's sellable per branch)

- [ ] **Step 1: Write `stock.py`**

`backend/demo_data/stock.py`:
```python
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
```

- [ ] **Step 2: Verify with a throwaway company (build org + tiny fake product set, roll back)**

Run from `backend/`:
```bash
python -c "
from app.database import SessionLocal
from app.models import Product
from demo_data.org import SENMARKET_SPEC, build_company_org
from demo_data.stock import assign_products_and_stock

db = SessionLocal()
try:
    org = build_company_org(db, SENMARKET_SPEC)
    products = [
        Product(company_id=org.company.id, name=f'Test Product {i}', sku=f'SKU-TEST-{i:03d}',
                category='Snacks', default_price=10.0, cost_price=6.0)
        for i in range(20)
    ]
    db.add_all(products)
    db.flush()

    stocked = assign_products_and_stock(db, products, org.branches)
    for branch, is_small in org.branches:
        print(branch.name, 'small' if is_small else 'normal', '->', len(stocked[branch.id]), 'products stocked')
finally:
    db.rollback()
    db.close()
"
```
Expected: small branches show ~8 products stocked (40% of 20), normal branches show ~19 (95% of
20).

- [ ] **Step 3: Commit**

```bash
git add demo_data/stock.py
git commit -m "feat: add demo stock module (per-branch product/quantity assignment)"
```

---

### Task 4: Transactions module (part 1) — co-occurrence pattern pairs + sales generation

**Files:**
- Create: `backend/demo_data/transactions.py`

**Interfaces:**
- Consumes: `Product` list (from `catalog`/`_build_products` in Task 6), `Branch`, `Employee` list
  (cashiers, from `org.OrgResult.employees_by_branch`)
- Produces (used by Task 5 and Task 6):
  - `DAYS_SPAN = 90`
  - `build_pattern_pairs(products: list[Product]) -> list[tuple[Product, Product]]`
  - `generate_sales_for_branch(db, branch, cashiers: list[Employee], available_products: list[Product], pattern_pairs: list[tuple[Product, Product]], daily_count_range: tuple[int, int], days_span: int = DAYS_SPAN) -> list[Sale]`

- [ ] **Step 1: Write the sales-generation half of `transactions.py`**

`backend/demo_data/transactions.py`:
```python
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
```

- [ ] **Step 2: Verify with a small scoped run (tiny days_span, roll back)**

```bash
python -c "
from app.database import SessionLocal
from app.models import Product
from demo_data.org import SENMARKET_SPEC, build_company_org
from demo_data.transactions import build_pattern_pairs, generate_sales_for_branch

db = SessionLocal()
try:
    org = build_company_org(db, SENMARKET_SPEC)
    products = [
        Product(company_id=org.company.id, name=f'Test {i}', sku=f'SKU-T-{i:03d}',
                category=['Bakery', 'Dairy', 'Snacks', 'Beverages'][i % 4],
                default_price=10.0 + i, cost_price=6.0)
        for i in range(12)
    ]
    db.add_all(products)
    db.flush()

    pairs = build_pattern_pairs(products)
    print('pattern pairs:', [(a.name, b.name) for a, b in pairs])

    branch, is_small = org.branches[0]
    roster = org.employees_by_branch[branch.id]
    sales = generate_sales_for_branch(db, branch, roster['cashier'], products, pairs, (5, 8), days_span=3)
    print('sales generated:', len(sales))
    print('sample sale items:', len(sales[0].items) if hasattr(sales[0], 'items') else 'n/a')
finally:
    db.rollback()
    db.close()
"
```
Expected: a `pattern pairs` list with 2 tuples (only Bakery/Dairy and Snacks/Beverages exist in
this 4-category test set — Meat/Deli and Coffee & Tea/Breakfast & Pantry are absent, so
`build_pattern_pairs` correctly skips them), and `sales generated:` a number between 15 and 24 (3
days × 5-8/day).

- [ ] **Step 3: Commit**

```bash
git add demo_data/transactions.py
git commit -m "feat: add demo sales generation (category-pattern baskets, testco-style)"
```

---

### Task 5: Transactions module (part 2) — returns, stock requests, shifts

**Files:**
- Modify: `backend/demo_data/transactions.py`

**Interfaces:**
- Consumes: `list[Sale]` and `dict[int, dict[str, list[Employee]]]` (branch_id → role → employees,
  from `org.OrgResult.employees_by_branch`) from Task 4's output and Task 2's `OrgResult`
- Produces (used by Task 6):
  - `generate_returns(db, sales: list[Sale], employees_by_branch: dict) -> None`
  - `generate_stock_requests(db, branch, stocked_products: list[Product], requester, days_span: int = DAYS_SPAN) -> None`
  - `generate_shifts(db, employees: list[Employee]) -> None`

- [ ] **Step 1: Append returns/stock-requests/shifts generation to `transactions.py`**

Add to the end of `backend/demo_data/transactions.py` (after `generate_sales_for_branch`):
```python
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
```

- [ ] **Step 2: Verify with the same scoped setup as Task 4, extended**

```bash
python -c "
from app.database import SessionLocal
from app.models import Product
from demo_data.org import SENMARKET_SPEC, build_company_org
from demo_data.transactions import (
    build_pattern_pairs, generate_sales_for_branch, generate_returns,
    generate_stock_requests, generate_shifts,
)

db = SessionLocal()
try:
    org = build_company_org(db, SENMARKET_SPEC)
    products = [
        Product(company_id=org.company.id, name=f'Test {i}', sku=f'SKU-T-{i:03d}',
                category=['Bakery', 'Dairy', 'Snacks', 'Beverages'][i % 4],
                default_price=10.0 + i, cost_price=6.0)
        for i in range(12)
    ]
    db.add_all(products)
    db.flush()

    pairs = build_pattern_pairs(products)
    branch, is_small = org.branches[0]
    roster = org.employees_by_branch[branch.id]
    sales = generate_sales_for_branch(db, branch, roster['cashier'], products, pairs, (20, 25), days_span=10)
    print('sales:', len(sales))

    generate_returns(db, sales, org.employees_by_branch)
    from app.models import Return
    returns_count = db.query(Return).filter(Return.sale_id.in_([s.id for s in sales])).count()
    print('returns:', returns_count)

    generate_stock_requests(db, branch, products, roster['stock_manager'][0])
    from app.models import StockRequest
    print('stock_requests:', db.query(StockRequest).filter(StockRequest.branch_id == branch.id).count())

    all_employees = [e for r in org.employees_by_branch.values() for lst in r.values() for e in lst]
    generate_shifts(db, all_employees)
    from app.models import Shift
    print('shifts:', db.query(Shift).filter(Shift.employee_id.in_([e.id for e in all_employees])).count())
finally:
    db.rollback()
    db.close()
"
```
Expected: `sales:` a number around 200-250 (10 days × 20-25/day), `returns:` a small number
(roughly 2.5% of sales, so ~5-6 — could be 0-15 given randomness, that's fine), `stock_requests:` a
positive number, `shifts:` exactly `7 * len(all_employees)` (one row per employee per day for 7
days).

- [ ] **Step 3: Commit**

```bash
git add demo_data/transactions.py
git commit -m "feat: add demo returns/stock-request/shift generation"
```

---

### Task 6: Orchestrator — `generate_demo_dataset.py`

**Files:**
- Create: `backend/generate_demo_dataset.py`

**Interfaces:**
- Consumes: everything produced by Tasks 1-5 (`demo_data.catalog`, `demo_data.org`,
  `demo_data.stock`, `demo_data.transactions`)
- Produces: a runnable CLI script; no other task depends on its internals.

- [ ] **Step 1: Write `generate_demo_dataset.py`**

`backend/generate_demo_dataset.py`:
```python
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

    all_employees = [e for roster in org.employees_by_branch.values() for lst in roster.values() for e in lst]
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
```

- [ ] **Step 2: Run it against the sample fixture (real run, not rolled back)**

```bash
python generate_demo_dataset.py --csv seed_data/megamarket_products.sample.csv
```
Expected: prints `Loaded 48 products from seed_data/megamarket_products.sample.csv`, then one
summary line per company (`MegaMarket: 10 branches, 48 products, <N> sales` and
`Şen Market: 6 branches, 48 products, <M> sales` — with only 48 rows in the CSV, Şen Market's
"subset" ends up being close to or equal to the same 48 rather than 300, since
`_select_senmarket_subset` can't select more than what exists; that's expected with the fixture and
will produce the real ~300 once the actual Mockaroo CSV is in place), then `Done.`. This will take
a few minutes — expected per Global Constraints.

- [ ] **Step 3: Verify idempotency — run it again**

```bash
python generate_demo_dataset.py --csv seed_data/megamarket_products.sample.csv
```
Expected: same output as Step 2 (not double the sales/products) — confirms the delete-then-recreate
logic works.

- [ ] **Step 4: Spot-check the DB directly**

```bash
python -c "
from app.database import SessionLocal
from app.models import Company, Branch, Employee, Product, Sale, Return, StockRequest, CompanyFeature

db = SessionLocal()
for subdomain in ('megamarket', 'senmarket'):
    company = db.query(Company).filter(Company.subdomain == subdomain).one()
    branches = db.query(Branch).join(Branch.region).filter_by(company_id=company.id).count()
    employees = db.query(Employee).filter(Employee.company_id == company.id).count()
    products = db.query(Product).filter(Product.company_id == company.id).count()
    sales = db.query(Sale).join(Branch).join(Branch.region).filter_by(company_id=company.id).count()
    features = [f.feature_name for f in db.query(CompanyFeature).filter(CompanyFeature.company_id == company.id, CompanyFeature.enabled == True)]
    print(subdomain, 'branches=', branches, 'employees=', employees, 'products=', products, 'sales=', sales, 'features=', sorted(features))
db.close()
"
```
Expected: `megamarket branches= 10 employees=<~170-190> products= 48 sales=<tens of thousands>
features= ['kpi_modulu', 'layout_onerisi', 'merkez_depo_senaryosu', 'mobil_app']` and
`senmarket branches= 6 employees=<~35-45> products=<~48 with the fixture> sales=<thousands>
features= ['layout_onerisi', 'mobil_app']` (senmarket's feature list must NOT include
`merkez_depo_senaryosu` or `kpi_modulu` — this is the concrete check for spec Karar 2's flag split).

- [ ] **Step 5: Commit**

```bash
git add generate_demo_dataset.py
git commit -m "feat: add generate_demo_dataset.py orchestrator (MegaMarket + Şen Market)"
```

---

### Task 7: Swap in real Mockaroo data (manual checkpoint — depends on the user)

This task has no code — it's the point where the plan depends on an artifact only the user can
produce (spec Karar 3: the user builds the Mockaroo schema and exports the CSV).

- [ ] **Step 1: Hand off the CSV contract**

Tell the user: place their ~800-row Mockaroo export at `backend/seed_data/megamarket_products.csv`
with a header row containing at least `product_name`, `category` (must exactly match one of the 16
`CATEGORY_INFO` keys in `demo_data/catalog.py` — case-sensitive), and `default_price`. Extra
columns (e.g. a `best_before_date` Mockaroo also generated) are ignored — `sku`, `cost_price`, and
`best_before_date` always come from `demo_data/catalog.py`'s generators, never from the CSV.

- [ ] **Step 2: Re-run against the real file**

```bash
python generate_demo_dataset.py
```
(no `--csv` flag needed — `seed_data/megamarket_products.csv` is the default path). Expected:
`Loaded ~800 products from seed_data/megamarket_products.csv`, `MegaMarket: 10 branches, ~800
products, ...`, `Şen Market: 6 branches, 300 products, ...`.

- [ ] **Step 3: Commit the real CSV** (spec Karar 7 — committed, not gitignored, for the
  professor's reproducibility)

```bash
git add seed_data/megamarket_products.csv
git commit -m "data: add real Mockaroo product export for demo dataset"
```

---

### Task 8: Day-0 import template — `generate_demo_import_template.py`

**Files:**
- Create: `backend/generate_demo_import_template.py`

**Interfaces:**
- Consumes: `demo_data.catalog` (Task 1)
- Produces: a runnable CLI script; output `.xlsx` matches
  `app/services/product_import.py::EXPECTED_HEADERS` exactly.

- [ ] **Step 1: Write `generate_demo_import_template.py`**

`backend/generate_demo_import_template.py`:
```python
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
```

- [ ] **Step 2: Run it against the sample fixture**

```bash
python generate_demo_import_template.py --csv seed_data/megamarket_products.sample.csv --out seed_data/day0_import_template.sample.xlsx
```
Expected: `Wrote 48 products to seed_data/day0_import_template.sample.xlsx` (capped by the fixture's
48 rows — the real Mockaroo CSV will produce the full 100).

- [ ] **Step 3: Verify the file structurally matches what `product_import.py` expects**

```bash
python -c "
from openpyxl import load_workbook
wb = load_workbook('seed_data/day0_import_template.sample.xlsx')
sheet = wb.active
header = [c.value for c in next(sheet.iter_rows(min_row=1, max_row=1))]
print('header:', header)
print('data rows:', sheet.max_row - 1)

from app.services.product_import import EXPECTED_HEADERS
assert header == EXPECTED_HEADERS, f'header mismatch: {header} != {EXPECTED_HEADERS}'
print('header matches EXPECTED_HEADERS: OK')
"
```
Expected: `header: ['name', 'sku', 'category', 'default_price', 'cost_price', 'best_before_date']`,
`data rows: 48`, `header matches EXPECTED_HEADERS: OK`.

- [ ] **Step 4: Verify it passes the real import validator (no DB writes — `parse_and_validate` only reads)**

```bash
python -c "
from app.database import SessionLocal
from app.services.product_import import parse_and_validate

db = SessionLocal()
with open('seed_data/day0_import_template.sample.xlsx', 'rb') as f:
    file_bytes = f.read()

# Nonexistent company_id — parse_and_validate only checks SKU collisions against that company's
# existing products, so an unused id (999999999) proves the *structural* validation passes cleanly.
rows, errors = parse_and_validate(file_bytes, company_id=999999999, db=db)
print('parsed rows:', len(rows))
print('errors:', errors)
db.close()
"
```
Expected: `parsed rows: 48`, `errors: []` — proves the generated file would import cleanly through
the real endpoint.

- [ ] **Step 5: Re-run against the real CSV once available (post Task 7)**

```bash
python generate_demo_import_template.py
```
Expected: `Wrote 100 products to seed_data/day0_import_template.xlsx`. This is the file actually
handed to the professor during the live Day-0 demo.

- [ ] **Step 6: Commit**

```bash
git add generate_demo_import_template.py seed_data/day0_import_template.sample.xlsx
git commit -m "feat: add day-0 import template generator (100-product demo .xlsx)"
```

---

## Self-Review

**Spec coverage:**
- Karar 0 (language rule) → Tasks 1-2 (`CATEGORY_INFO` English, `FIRST_NAMES` Turkish,
  `ROLE_TITLES` English, region/branch names Turkish place + English suffix, `_address_for`
  English format + Turkish city).
- Karar 1 (isolation from testco) → no task touches `seed_test_data.py`/`seed_sales_data.py`;
  `_delete_company_if_exists` only ever targets `megamarket`/`senmarket` subdomains.
- Karar 2 (companies, feature flags, small-branch definition) → Task 2 (`MEGAMARKET_SPEC`,
  `SENMARKET_SPEC`, `enabled_features`), Task 3 (`SMALL_BRANCH_CATALOG_RATIO`), Task 6
  (`DAILY_RANGES` small/normal split), Task 6 Step 4 (feature-flag verification query).
- Karar 3 (Mockaroo pipeline, SKU/cost_price generation, Şen Market subset) → Task 1
  (`load_products_csv`, `generate_sku`), Task 6 (`_select_senmarket_subset`).
- Karar 4 (personnel, incl. the operations_chief fix) → Task 2 (`build_company_org`'s per-branch
  roster, `PIN_ROLES`).
- Karar 5 (sales/returns/stock-request/shift logic, margins, best_before_date) → Task 1
  (`generate_cost_price`, `generate_best_before_date`), Task 4 (`generate_sales_for_branch`,
  `CATEGORY_PATTERN_PAIRS`), Task 5 (`generate_returns`, `generate_stock_requests`,
  `generate_shifts`).
- Karar 6 (day-0 import template) → Task 8.
- Karar 7 (script/CSV file layout, idempotency, CSV committed) → Task 6 (`_delete_company_if_exists`
  idempotency), Task 7 (CSV commit step).

**Placeholder scan:** none found — every step has runnable code or a concrete verification command
with an expected-output description tied to the code above it.

**Type consistency:** `OrgResult.employees_by_branch: dict[int, dict[str, list[Employee]]]` (Task 2)
is consumed identically in Task 3 (`branches: list[tuple[Branch, bool]]` from `OrgResult.branches`),
Task 4/5 (`roster["cashier"]`, `roster[role]` for `PIN_APPROVER_ROLES`), and Task 6 (same key names:
`branch_manager`, `stock_manager`, `seller_manager`, `operations_chief`, `cashier`, `staff` — all
match `ROLE_TITLES`' keys in Task 2). `assign_products_and_stock`'s return type
(`dict[int, list[Product]]`, Task 3) matches how Task 6 uses `stocked_by_branch[branch.id]` as
`available_products` into `generate_sales_for_branch` (Task 4) and `generate_stock_requests`
(Task 5). `generate_sku`/`generate_cost_price`/`generate_best_before_date` signatures (Task 1) are
called identically in Task 6 (`_build_products`) and Task 8 (`build_workbook`).
