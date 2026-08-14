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
