# StockSense — Database Schema Reference

This file is a technical reference reflecting the **actual** PostgreSQL schema created via
`backend/app/models/` (SQLAlchemy) and applied through Alembic (`backend/alembic/versions/`).
It is generated from the running database, not hand-written — if a migration changes the
schema, this file should be regenerated/updated to match.

> Design rationale, discussion, and decisions live in `documents/stocksense-architecture.md`
> (item 9 — base schema, item 9 "Schema Refinement" — pre-implementation decisions, item 10 —
> multi-tenant tables). This file is the concrete result; that file is the "why."

- **Engine:** PostgreSQL 16 (`backend/docker-compose.yml`)
- **ORM:** SQLAlchemy 2.0 (`backend/app/models/`)
- **Migrations:** Alembic (`backend/alembic/`)
- **PK strategy:** BIGSERIAL / BIGINT on all tables (except `age`, which is `SMALLINT`, and
  quantity-type integer columns, which are plain `INTEGER`)
- **Soft delete:** `is_active` (default `true`) on `companies`, `regions`, `branches`,
  `employees`, `products` — see rationale in the architecture doc
- **Timestamps:** `created_at` on every table; `updated_at` additionally on updatable tables
  (everything except `sales`, `sale_items`, `shifts`)

**Verified (2026-07-21):** `alembic check` confirms no drift between the SQLAlchemy models and
the running database. The following constraints were additionally exercised against the live
Postgres instance (insert/delete attempts inside a transaction, rolled back afterwards — no
data persisted):
- `products (company_id, sku)` composite UNIQUE — duplicate `sku` within the same company rejected;
  same `sku` across *different* companies accepted (fixed 2026-07-27, was a single-column UNIQUE
  that allowed cross-tenant SKU visibility — see `documents/stocksense-architecture.md`).
- `employees (company_id, username)` composite UNIQUE — duplicate within the same company
  rejected; same username across *different* companies accepted.
- `uq_employees_vendor_username` partial index — duplicate username among `company_id IS NULL`
  (Vendor Manager) rows rejected; multiple login-less staff with `username IS NULL` in the same
  company accepted (NULLs are distinct under UNIQUE).
- `stock` composite PK (`product_id`, `branch_id`) — duplicate pair rejected.
- FK `ON DELETE` (default RESTRICT) — deleting a `region`/`branch` that still has dependent
  rows (`branches`/`stock`) rejected; deleting an unreferenced `branch` succeeded.
- `sale_items` CHECK constraints (`quantity > 0`, `line_total >= 0`) — negative quantity
  rejected.

---

## Table of Contents

1. [companies](#companies)
2. [regions](#regions)
3. [branches](#branches)
4. [products](#products)
5. [stock](#stock)
6. [employees](#employees)
7. [sales](#sales)
8. [sale_items](#sale_items)
9. [returns](#returns)
10. [return_items](#return_items)
11. [stock_requests](#stock_requests)
12. [shifts](#shifts)
13. [company_features](#company_features)
14. [company_branding](#company_branding)
15. [notification_reads](#notification_reads)
16. [layout_zones](#layout_zones)
17. [stock_zones](#stock_zones)
18. [layout_recommendation_applications](#layout_recommendation_applications)
19. [Entity-Relationship Overview](#entity-relationship-overview)

> **Updated 2026-08-13:** this file now covers every table in `backend/app/models/`, including
> the ones added after the file's initial creation (`returns`, `return_items`, `stock_requests`,
> `layout_zones`, `stock_zones`, `layout_recommendation_applications`), verified directly against
> the SQLAlchemy model source (`backend/app/models/sales.py`, `catalog.py`, `layout.py`).

---

## companies

Tenant root — item 10 (Multi-Tenant Architecture).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `name` | `varchar(150)` | NOT NULL | | |
| `is_active` | `boolean` | NOT NULL | `true` | soft delete |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `companies_pkey` PK btree (`id`)
**Referenced by:** `regions.company_id`, `employees.company_id`, `company_features.company_id`, `company_branding.company_id`

---

## regions

Item 1 (Organizational Hierarchy).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `name` | `varchar(150)` | NOT NULL | | |
| `company_id` | `bigint` | NOT NULL | | FK → `companies.id` |
| `is_active` | `boolean` | NOT NULL | `true` | soft delete |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `regions_pkey` PK btree (`id`)
**Referenced by:** `branches.region_id`, `employees.region_id`

---

## branches

Item 1 (Organizational Hierarchy).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `name` | `varchar(150)` | NOT NULL | | |
| `region_id` | `bigint` | NOT NULL | | FK → `regions.id` |
| `is_active` | `boolean` | NOT NULL | `true` | soft delete |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `branches_pkey` PK btree (`id`)
**Referenced by:** `employees.branch_id`, `sales.branch_id`, `stock.branch_id`

---

## products

Item 4 (Product Catalog and Pricing) — company-level catalog.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `name` | `varchar(150)` | NOT NULL | | |
| `sku` | `varchar(50)` | NOT NULL | | UNIQUE per company (`uq_products_company_sku`) — item 15 |
| `category` | `varchar(100)` | nullable | | |
| `default_price` | `numeric(10,2)` | NOT NULL | | |
| `cost_price` | `numeric(10,2)` | nullable | | for net profit margin, item 12 |
| `best_before_date` | `date` | nullable | | |
| `is_active` | `boolean` | NOT NULL | `true` | soft delete |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `products_pkey` PK btree (`id`); `uq_products_company_sku` UNIQUE btree (`company_id`, `sku`)
**Referenced by:** `stock.product_id`, `sale_items.product_id`

---

## stock

Item 3 (Stock Management) — bridge table resolving the `products` ↔ `branches` many-to-many.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `product_id` | `bigint` | NOT NULL | | PK (composite), FK → `products.id` |
| `branch_id` | `bigint` | NOT NULL | | PK (composite), FK → `branches.id` |
| `quantity` | `integer` | NOT NULL | | |
| `low_stock_threshold` | `integer` | NOT NULL | | |
| `price_override` | `numeric(10,2)` | nullable | | if null, `products.default_price` applies — item 4 |
| `zone_id` | `bigint` | nullable | | FK → `layout_zones.id`, `ON DELETE SET NULL` — which store zone this product is shelved in, for the layout recommendation overlay |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `stock_pkey` PK btree (`product_id`, `branch_id`)

---

## employees

Item 2 (Role Hierarchy), item 9 (single table, 3 nullable FKs), item 13 (login-less staff).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `first_name` | `varchar(100)` | NOT NULL | | |
| `last_name` | `varchar(100)` | NOT NULL | | |
| `username` | `varchar(100)` | nullable | | NULL for login-less staff |
| `password_hash` | `varchar(255)` | nullable | | NULL for login-less staff |
| `role` | `varchar(50)` | NOT NULL | | indexed for notification targeting, item 14 |
| `branch_id` | `bigint` | nullable | | FK → `branches.id` |
| `region_id` | `bigint` | nullable | | FK → `regions.id` |
| `company_id` | `bigint` | nullable | | FK → `companies.id`; NULL for Vendor Manager |
| `age` | `smallint` | NOT NULL | | |
| `address` | `text` | NOT NULL | | |
| `manager_pin` | `varchar(255)` | nullable | | hashed, not plain text — item 6 |
| `is_active` | `boolean` | NOT NULL | `true` | soft delete |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:**
- `employees_pkey` PK btree (`id`)
- `ix_employees_role` btree (`role`)
- `uq_employees_company_username` UNIQUE btree (`company_id`, `username`) — username unique **within a company**, item 16
- `uq_employees_vendor_username` UNIQUE btree (`username`) WHERE `company_id IS NULL` — the composite constraint above doesn't cover Vendor Manager rows (NULLs are distinct in a UNIQUE constraint), so this partial index separately enforces username uniqueness among Vendor Manager accounts

**Referenced by:** `sales.employee_id`, `shifts.employee_id`

---

## sales

Item 9 — sale header. `payment_method` per item 6 (Payment — Fully Mocked).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `sale_date` | `timestamptz` | NOT NULL | | |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `employee_id` | `bigint` | NOT NULL | | FK → `employees.id` |
| `payment_method` | `varchar(20)` | NOT NULL | | e.g. `cash` / `card`, fully mocked |
| `created_at` | `timestamptz` | NOT NULL | `now()` | no `updated_at` — immutable event record |

**Indexes:** `sales_pkey` PK btree (`id`); `ix_sales_branch_date` btree (`branch_id`, `sale_date`) — item 5 reporting
**Referenced by:** `sale_items.sale_id`

---

## sale_items

Item 9 — sale line item; data source for co-occurrence/Apriori calculation (item 7).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `sale_id` | `bigint` | NOT NULL | | FK → `sales.id` |
| `product_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `quantity` | `integer` | NOT NULL | | |
| `line_total` | `numeric(10,2)` | NOT NULL | | total is not stored on `sales`; summed on demand |
| `created_at` | `timestamptz` | NOT NULL | `now()` | no `updated_at` — immutable event record |

**Indexes:** `sale_items_pkey` PK btree (`id`); `ix_sale_items_sale_id` btree (`sale_id`); `ix_sale_items_product_id` btree (`product_id`)
**Check constraints:** `ck_sale_items_quantity_positive` (`quantity > 0`); `ck_sale_items_line_total_non_negative` (`line_total >= 0`)

---

## returns

Item 6 (Return/Exchange — Manager PIN Approval). A deliberately separate table from `sales` —
unlike a sale, a return has a two-stage lifecycle (`pending` → `completed`, gated by PIN
approval at completion time, not at initiation).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `sale_id` | `bigint` | NOT NULL | | FK → `sales.id` |
| `initiated_by` | `bigint` | NOT NULL | | FK → `employees.id` (cashier who started it) |
| `status` | `varchar(20)` | NOT NULL | `'pending'` | `pending` \| `completed` |
| `net_amount` | `numeric(10,2)` | NOT NULL | | negative = refund to customer, positive = customer owes the difference (exchange) |
| `completed_by` | `bigint` | nullable | | FK → `employees.id` (PIN approver) |
| `completed_at` | `timestamptz` | nullable | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `returns_pkey` PK btree (`id`)
**Referenced by:** `return_items.return_id`

---

## return_items

Item 6 — return line item. The `direction` column distinguishes returned products (`returned`)
from newly given products in an exchange (`new`) within the same table.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `return_id` | `bigint` | NOT NULL | | FK → `returns.id` |
| `product_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `quantity` | `integer` | NOT NULL | | |
| `unit_price` | `numeric(10,2)` | NOT NULL | | price at the time of the original sale (returned) or current price (new) |
| `direction` | `varchar(20)` | NOT NULL | | `returned` \| `new` |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `return_items_pkey` PK btree (`id`)
**Check constraints:** `ck_return_items_quantity_positive` (`quantity > 0`)

---

## stock_requests

Item 11 (Central Warehouse) — the central warehouse is not itself a tracked stock entity, it is
an unlimited/always-available source; requests are always fulfilled instantly (no approval/
rejection workflow). This table exists purely for audit/history.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `product_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `quantity` | `integer` | NOT NULL | | |
| `requested_by` | `bigint` | NOT NULL | | FK → `employees.id` (Stock Manager) |
| `created_at` | `timestamptz` | NOT NULL | `now()` | no `updated_at` — immutable event record |

**Indexes:** `stock_requests_pkey` PK btree (`id`)
**Check constraints:** `ck_stock_requests_quantity_positive` (`quantity > 0`)
**Note:** creating a request atomically increments the matching `stock.quantity` row in the same transaction.

---

## shifts

Item 13 (Shift Management) — **planned** schedule only, no clock-in/clock-out tracking.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `employee_id` | `bigint` | NOT NULL | | FK → `employees.id` |
| `shift_date` | `date` | NOT NULL | | |
| `start_time` | `time` | nullable | | null when `is_day_off` |
| `end_time` | `time` | nullable | | null when `is_day_off` |
| `is_day_off` | `boolean` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | no `updated_at` — immutable event record |

**Indexes:** `shifts_pkey` PK btree (`id`); `ix_shifts_employee_date` btree (`employee_id`, `shift_date`)

---

## company_features

Item 10 — feature flag per tenant. One row per (company, feature); adding a feature never requires a schema change.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `company_id` | `bigint` | NOT NULL | | PK (composite), FK → `companies.id` |
| `feature_name` | `varchar(100)` | NOT NULL | | PK (composite) |
| `enabled` | `boolean` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `company_features_pkey` PK btree (`company_id`, `feature_name`)

---

## company_branding

Item 10 — 1-1 visual identity per tenant.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `company_id` | `bigint` | NOT NULL | | PK, FK → `companies.id` |
| `logo_url` | `text` | nullable | | |
| `primary_color` | `varchar(7)` | nullable | | e.g. `#RRGGBB` |
| `display_name` | `varchar(150)` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `company_branding_pkey` PK btree (`company_id`)

---

## notification_reads

Sprint 6 (mobil companion app) — bildirim okundu/okunmadı takibi. `GET /api/notifications`
kalıcı bir kayıt değil, anlık bir sorgu sonucu (düşük stok / SKT eşiği aşımı) olduğu için
"hangi bildirim okundu" bilgisi bildirimin kendi ID'siyle değil, onu üreten satırın doğal
anahtarıyla (`kind` + `product_id` + `branch_id`) tutuluyor.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `employee_id` | `bigint` | NOT NULL | | FK → `employees.id` |
| `kind` | `varchar(20)` | NOT NULL | | `"low_stock"` \| `"expiring"` |
| `product_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `read_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | no `updated_at` — bir satır sadece oluşturulur/silinir, güncellenmez |

**Indexes:** `notification_reads_pkey` PK btree (`id`); `uq_notification_read_employee_item`
UNIQUE btree (`employee_id`, `kind`, `product_id`, `branch_id`)

**Not:** düşük stok/SKT durumu koşulu artık geçersiz hale geldiğinde (stok eşiğin üzerine
çıkınca, SKT penceresi dışına çıkınca) ilgili satır silinir (`services/notification_reads.py`)
— aksi halde durum tekrar tetiklenince bildirim eski okundu-işaretiyle sessizce görünmez
kalırdı (Sprint 6 review bulgusu, 2026-08-13'te düzeltildi).

---

## layout_zones

UC-15 SHOULD (store floor-plan visualization) — a named area (shelf/aisle zone) that a Seller
Manager freely creates and positions on their branch's floor plan. A visual/relative
representation, not a physical measurement.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `name` | `varchar(100)` | NOT NULL | | |
| `x` | `integer` | NOT NULL | `0` | canvas position |
| `y` | `integer` | NOT NULL | `0` | canvas position |
| `width` | `integer` | NOT NULL | | |
| `height` | `integer` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `layout_zones_pkey` PK btree (`id`)
**Referenced by:** `stock.zone_id` (`ON DELETE SET NULL`)

---

## stock_zones

A Stock Manager's own free-form zone editor for visualizing the physical layout of their
storage/back-of-house area — deliberately independent of `layout_zones` (which belongs to the
Seller Manager's sales-floor/co-occurrence workflow). No product assignment, no recommendation
overlay — just name + position + size.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `name` | `varchar(100)` | NOT NULL | | |
| `x` | `integer` | NOT NULL | `0` | canvas position |
| `y` | `integer` | NOT NULL | `0` | canvas position |
| `width` | `integer` | NOT NULL | | |
| `height` | `integer` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `stock_zones_pkey` PK btree (`id`)

---

## layout_recommendation_applications

UC-15 — audit record of a Seller Manager marking a layout suggestion (a product pair) as
"applied." The physical shelf change happens outside the system; this is only the
acceptance/application record.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval(...)` | PK |
| `branch_id` | `bigint` | NOT NULL | | FK → `branches.id` |
| `product_a_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `product_b_id` | `bigint` | NOT NULL | | FK → `products.id` |
| `applied_by` | `bigint` | NOT NULL | | FK → `employees.id` |
| `applied_at` | `timestamptz` | NOT NULL | | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

**Indexes:** `layout_recommendation_applications_pkey` PK btree (`id`); `uq_layout_application_branch_pair` UNIQUE btree (`branch_id`, `product_a_id`, `product_b_id`) — upsert target, re-applying the same pair updates `applied_at`/`applied_by` instead of erroring

---

## Entity-Relationship Overview

```
companies 1───* regions 1───* branches 1───* stock *───1 products
   │                                │           │
   │                                │           └──0..1─* layout_zones (zone_id)
   │                                │
   │                                ├──1───* sales *───1 employees
   │                                │           │        │
   │                                │           │        └───* returns (initiated_by / completed_by)
   │                                │           └───* sale_items *───1 products
   │                                │
   │                                ├──1───* returns *───1 sale_items-like return_items *───1 products
   │                                ├──1───* stock_requests *───1 employees (requested_by)
   │                                ├──1───* layout_zones
   │                                ├──1───* stock_zones
   │                                ├──1───* layout_recommendation_applications
   │                                └──0..1─* employees (branch_id)
   │
   ├──0..1─* employees (region_id via regions, company_id direct)
   ├──1───* company_features
   └──1───1 company_branding

employees 1───* shifts
employees 1───* notification_reads
returns 1───* return_items
```

For the full conceptual class diagram (PlantUML), see `documents/stocksense-class-diagram.puml`.
