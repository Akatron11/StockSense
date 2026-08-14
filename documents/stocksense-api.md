# StockSense — API Documentation

This file is added to as the backend API's (FastAPI) design is discussed and decided module by module.
General conventions were decided first, then each module (matching the Component Table in
`stocksense-architecture.md` and the Use Cases in `stocksense-srs.md`) is detailed separately.

> **Verified against source (2026-08-13):** the "Modules" section below was regenerated directly from
> `backend/app/routers/*.py` and `backend/app/schemas/*.py` — every field name, status code, and JSON
> example reflects the actual running code, not the original design-time plan. A few endpoints from the
> original design were never built this way (separate `GET /api/reports/top-products` and
> `GET /api/reports/profit-margin` endpoints, bulk `POST /api/shifts/bulk`) — see the "Known Design vs.
> Implementation Differences" note at the end of this file for what replaced them and why.

---

## General Conventions

### URL structure

- Prefix: **`/api`**, no version number (not `/api/v1`).
- Rationale: the clients (web + mobile) are also within this project's scope, there is no third-party
  consumer — the problem versioning solves ("release a new version without breaking old clients") is not
  a real need in this project. If genuinely needed later, `v2` can be added while `v1` is kept; not
  adding it now doesn't forfeit that flexibility.
- Resources use plural names: `/api/products`, `/api/sales`.
- The tenant/branch ID is never carried in the path for **scope narrowing** purposes (see the
  "Tenant/branch scope" item below) — implicit scope plus a query param when needed. Individual resource
  IDs (`/api/products/{product_id}`, `/api/employees/{employee_id}`, `/api/companies/{company_id}/...`)
  are standard REST addressing and are unrelated to this rule.

### Field naming (JSON casing)

- **`snake_case`**, end to end (request and response).
- Rationale: the backend (SQLAlchemy models) is already `snake_case`; the Pydantic response model maps
  one-to-one, no extra alias/conversion layer is needed. Goes against the `camelCase` habit on the
  frontend (JS/TS) but carries no functional disadvantage — not adding an extra layer was preferred while
  still learning.

### Response shape

- **Bare data** — no envelope/wrapper. A single resource → a bare object, a list resource → a bare array.
- Pagination is not imposed on every endpoint as a blanket rule; only lists that can genuinely grow large
  get an endpoint-specific pagination shape — `GET /api/products` is the one endpoint that ended up
  needing it (`{"items": [...], "total": N}`, `page`/`limit`/`q`/`sort_by`/`sort_dir` query params),
  decided once real product catalogs (700+ SKUs) made loading everything at once impractical.

### Error format

- FastAPI's default shape: `{"detail": "..."}`. No custom error schema was invented — validation errors
  (422) already use this same format in FastAPI, so it stays consistent. Two deliberate exceptions return
  a richer body instead of a plain string `detail` (see "Notable cross-cutting patterns" at the end):
  insufficient-stock `409`s (`POST /api/sales`, `POST /api/returns/{id}/complete`) and bulk-import
  validation `422`s (`POST /api/products/import`).

### Auth

- JWT, stateless — **access token only, no refresh token**. Lifetime is set close to a shift length; once
  it expires, the user logs in again.
- Rationale: the problem a refresh token solves ("the session lasts longer without the user noticing")
  is not a real need in the POS/shift scenario; adding refresh + revocation would create tension with the
  architecture's "stateless, no separate session store" decision (item 8).
- Login resolves `company_id` from the subdomain — normally the `Host` header (web), but a mobile client
  cannot reliably set a custom `Host`, so `POST /api/auth/login` also accepts an optional `subdomain`
  field directly in the request body as a fallback (added for the mobile companion app, Sprint 6). The
  JWT embeds `user_id`, `role`, `company_id`, `branch_id`, `region_id` (architecture items 8, 16).
- Every protected endpoint returns **401** for a missing/invalid/expired token — not repeated per
  endpoint below unless there's a nuance worth calling out.

### Tenant/branch scope

- **Implicit by default**: if no parameter is given, the user's own scope in the token (branch/region/
  company) is used. This is enough for single-scope roles (Cashier, Stock Manager, etc.).
- **Optional query param for multi-scope roles**: e.g. `GET /api/reports/sales?branch_id=5`. The backend
  checks whether the given ID is within the token's authorized scope (the token is always the ceiling,
  the query param only narrows within that ceiling).

### Date/time format

- **ISO 8601, UTC** (e.g. `"2026-07-24T14:30:00Z"`). Converting to local time zone is left to the
  frontend.

### Manager PIN approval

- The PIN is sent **as a field in the same request**, rather than through a separate verification
  endpoint (`manager_pin` in the body of `POST /api/returns/{id}/complete`). Verification and completion
  happen in a single request, in a single DB transaction — this endpoint has no role check at all;
  authorization is branch membership plus the PIN matching an eligible approver in that branch.

### Deletion

- **Soft delete**: a `DELETE` endpoint never actually removes the row, it flags `is_active=false`. It
  disappears from lists, but historical sales/report records stay intact. `Shift` rows are the one
  exception — they're a plain event record with no soft-delete mixin, so `PUT /api/shifts/{employee_id}`
  can genuinely overwrite/replace a row.

---

## Modules

### 1. Auth (`auth.py`)

#### `GET /api/auth/branding`
Public, no token required — resolves the company from the `Host` header subdomain and returns the
login screen's tenant branding (logo/color/name) so unauthenticated users see the customer's branding
before login. The `admin` subdomain (Vendor Manager) gets generic "StockSense" branding.
```json
{ "logo_url": "data:image/png;base64,...", "primary_color": "#1E40AF", "display_name": "Acme Retail" }
```
- **200** always (falls back to defaults if no `CompanyBranding` row exists). **400** — missing `Host`. **404** — unknown subdomain.

#### `POST /api/auth/login`
Public. Company resolved from `subdomain` in the request body if present (mobile), otherwise from `Host` (web); no company / `admin` subdomain → tenant-less `vendor_manager` login.
```json
// request
{ "username": "jdoe", "password": "secret123", "subdomain": "acme" }
// response
{ "access_token": "eyJhbGciOi...", "user": { "id": 12, "full_name": "Jane Doe", "role": "cashier" } }
```
- **200**. **404** — unknown subdomain, or Host-based resolution failure. **401** — unknown username, no password set, or wrong password.

#### `GET /api/auth/me`
Any authenticated employee — returns the caller's own identity from the JWT claims.
```json
{ "id": 12, "full_name": "Jane Doe", "role": "cashier" }
```
- **200**. **404** — employee id in token no longer exists.

### 2. POS / Sales (`sales.py`, `returns.py`)

#### `GET /api/sales`
Role: `cashier`, `operations_chief`. Last 20 sales for the caller's branch, newest first — lets a cashier pick a sale to start a return without typing a sale number.
```json
[{ "id": 501, "sale_date": "2026-08-13T10:15:00Z", "total": 87.40, "payment_method": "cash" }]
```
- **200**, **403**.

#### `GET /api/sales/{sale_id}`
Role: `cashier`, `operations_chief`. Full sale detail with per-item `returnable_quantity` (sold minus already-completed returns) — pre-fills the return form.
```json
{
  "id": 501, "sale_date": "2026-08-13T10:15:00Z", "branch_id": 3, "total": 87.40, "payment_method": "cash",
  "items": [{ "product_id": 9, "product_name": "Süt 1L", "quantity": 2, "unit_price": 45.90, "returnable_quantity": 2 }]
}
```
- **200**. **404** — sale doesn't exist or belongs to a different branch.

#### `POST /api/sales`
Role: `cashier`, `operations_chief`. Stock is decremented atomically per item with a single `UPDATE ... WHERE quantity >= requested` (no check-then-act race); if **any** item is insufficient, the whole sale rolls back — all or nothing.
```json
// request
{ "items": [{ "product_id": 9, "quantity": 2 }], "payment_method": "cash" }
// response (201)
{
  "id": 501, "branch_id": 3, "items": [{ "product_id": 9, "quantity": 2, "unit_price": 45.90 }],
  "total": 91.80, "payment_method": "cash", "status": "completed", "created_at": "2026-08-13T10:15:00Z"
}
```
- **201**. **422** — empty cart. **404** — a `product_id` not found/inactive/wrong company. **409** — insufficient stock, non-standard body:
  ```json
  { "detail": "Yetersiz stok", "insufficient_items": [{ "product_id": 9, "requested": 5, "available": 2 }] }
  ```

#### `POST /api/sales/{sale_id}/returns`
Role: `cashier`, `operations_chief`. Initiates a return/exchange (`status: "pending"`) — no stock touched yet, requires PIN completion via the next endpoint. `new_items` optional (exchange).
```json
// request
{ "returned_items": [{ "product_id": 9, "quantity": 1 }], "new_items": [{ "product_id": 14, "quantity": 1 }] }
// response (201)
{
  "id": 77, "sale_id": 501,
  "returned_items": [{ "product_id": 9, "quantity": 1, "unit_price": 45.90 }],
  "new_items": [{ "product_id": 14, "quantity": 1, "unit_price": 30.00 }],
  "net_amount": -15.90, "status": "pending", "created_at": "2026-08-13T11:00:00Z",
  "completed_by": null, "completed_at": null
}
```
- **201**. **422** — empty `returned_items`, or quantity exceeds what's still returnable. **404** — sale/branch/product mismatch.

#### `POST /api/returns/{return_id}/complete`
No role check — authorization is branch match + PIN belonging to an eligible approver (`stock_manager`, `seller_manager`, `operations_chief`) in that branch, verified in the same request as completion. Applies stock changes atomically only once the PIN is valid.
```json
{ "manager_pin": "4821" }
```
Response: same shape as above with `status: "completed"`, `completed_by`/`completed_at` filled in.
- **200**. **404** — return not found. **409** — already completed, or insufficient stock for exchange items. **403** — caller's branch ≠ sale's branch. **401** — PIN doesn't match any eligible approver.

### 3. Stock Management

**`products.py`**

| Endpoint | Role | Notes |
|---|---|---|
| `GET /api/products?q=&page=&limit=&sort_by=&sort_dir=` | any authenticated employee | paginated (default 50, max 200), searchable, sortable catalog — `{"items": [...], "total": N}` |
| `GET /api/products/search?q=` | any authenticated employee | exact SKU match short-circuits, else partial name/SKU match; always returns an array |
| `GET /api/products/import/template` | `general_manager` | downloads a blank `.xlsx` template (binary `StreamingResponse`) |
| `GET /api/products/{id}` | any authenticated employee | 404 if not found/wrong company |
| `POST /api/products` | `general_manager` | 201; company-level catalog is centrally managed |
| `PATCH /api/products/{id}` | `general_manager` | partial update; clears stale expiry-notification "read" marks if `best_before_date` moves out of the expiring window |
| `DELETE /api/products/{id}` | `general_manager` | soft delete (`is_active=false`), 204 |
| `POST /api/products/import` | `general_manager` | bulk `.xlsx` import, all-or-nothing, max 5 MB / 2000 rows |

`ProductCreate`/`ProductRead` example:
```json
{ "name": "Süt 1L", "sku": "SKU-MILK-01", "category": "İçecek", "default_price": 45.90, "cost_price": 30.00, "best_before_date": "2026-12-31", "is_active": true }
```
`POST /api/products/import` request is `multipart/form-data` (field `file`); response `{"created": 240}` (201). Row-level or file-level validation failures return **422** with:
```json
{ "errors": [{ "row": 4, "message": "SKU zaten kullanımda" }] }
```

**`companies.py` / `org.py`** — Day-0 vendor onboarding (UC-17, implemented 2026-08-14). Three new
`vendor_manager`-only endpoints let the Vendor Manager bootstrap a brand-new tenant from scratch;
the parent scope cannot be resolved implicitly for this role (no `company_id` on its own JWT, item
10), so it is always sent **explicitly in the body**:

| Endpoint | Role | Notes |
|---|---|---|
| `POST /api/companies` | `vendor_manager` | `{"name", "subdomain"}` → 201 |
| `POST /api/regions` | `vendor_manager` | `{"company_id", "name"}` → 201; 404 if `company_id` doesn't exist |
| `POST /api/branches` | `vendor_manager` | `{"region_id", "name"}` → 201; 404 if `region_id` doesn't exist |

```json
POST /api/companies → {"name": "DIMA Market", "subdomain": "dima-market"}
POST /api/regions   → {"company_id": 5, "name": "Kyrenia Region"}
POST /api/branches  → {"region_id": 12, "name": "Karaoğlanoğlu Branch"}
```
- `subdomain` is lowercased + trimmed, must match `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` (DNS-safe
  label — no leading/trailing hyphen, no all-hyphen value), and `"admin"` is rejected (reserved for
  the Vendor Manager's own login gateway, `deps.py::VENDOR_ADMIN_SUBDOMAIN`) — **422** on any
  violation, **409** on a duplicate subdomain.
- `name` on all three (company/region/branch) is validated non-empty (post-trim) and capped at the
  DB column length (150 chars) — **422** if violated, preventing an unhandled `DataError`.
- These endpoints are intentionally general-purpose, not Day-0-specific — the same
  `POST /api/regions`/`/branches` are expected to be reused later for steady-state org growth
  (opening a general_manager to them is a separate, not-yet-implemented decision).

**`employees.py`** — Day-0 also extends account creation: `CREATABLE_ROLES["vendor_manager"]` now
covers every role (`general_manager`, `company_it`, `region_manager`, `branch_manager`, `cashier`,
`stock_manager`, `seller_manager`, `operations_chief`, `staff`), and `general_manager` can now also
create `company_it` (bidirectional with the pre-existing `company_it → general_manager` direction).
For `vendor_manager` as creator, `EmployeeCreate.company_id` (new field) is always required; the
target role determines what else is required — `region_manager` needs `region_id` (validated to
belong to that company), branch-scoped roles need `branch_id` (validated to belong to that company
via its region), `general_manager`/`company_it` need nothing beyond `company_id`. See the
**`Day0SetupPage.tsx`** wizard (`/day0-setup`, frontend) for the end-to-end flow: company → one or
more regions → one or more branches → one or more users (at least one `general_manager` required)
→ submit, each step a separate API call with partial-failure retry (already-succeeded rows are not
recreated on retry — in-session only, does not survive a page reload).

**`stock.py`** — field-level write authorization (`ROLE_ALLOWED_FIELDS`), with role inheritance (branch/region/general manager can write everything below):

| role | writable fields on `PATCH /api/stock/{product_id}` |
|---|---|
| `seller_manager` | `price_override`, `zone_id` |
| `stock_manager` | `quantity`, `low_stock_threshold` |
| `branch_manager` / `region_manager` / `general_manager` | all four |

- **`GET /api/stock/product/{product_id}/branches`** — role `branch_manager`/`region_manager`/`general_manager`; per-branch quantity/threshold/effective-price for one product across the caller's scope, grouped by region for `general_manager`. 200/403/404.
- **`GET /api/stock?branch_id=`** — any authenticated employee; branch resolved per-role (`branch_id` required for region/general manager). 200/422 (missing `branch_id`)/404 (out of scope)/403.
- **`PATCH /api/stock/{product_id}?branch_id=`** — gated by the table above; **upsert** (creates the row at qty 0 if missing); clears stale low-stock "read" marks once quantity clears the threshold. 200/422 (empty body)/403 (disallowed field)/404.

```json
// GET /api/stock item / PATCH response
{ "product_id": 9, "branch_id": 3, "quantity": 40, "low_stock_threshold": 10, "price_override": null, "zone_id": 2, "product_name": "Süt 1L", "sku": "SKU-MILK-01", "best_before_date": "2026-12-31", "effective_price": 45.90 }
```

**`stock_requests.py`** — central warehouse is unlimited, requests are always instantly fulfilled (no approve/reject workflow):
- **`POST /api/stock-requests`** — role `stock_manager`; upsert/increment `Stock.quantity` + audit row, atomic. 201/403/422 (`quantity <= 0`)/404.
  ```json
  // request  { "product_id": 9, "quantity": 20 }
  // response { "id": 55, "product_id": 9, "product_name": "Süt 1L", "branch_id": 3, "quantity": 20, "requested_by": 12, "created_at": "2026-08-13T09:00:00Z" }
  ```
- **`GET /api/stock-requests`** — any authenticated employee, scoped to own branch. 200.

**`layout_zones.py`** (UC-15 SHOULD, Seller Manager's shelf/zone editor, role `seller_manager` on all 4):
- `GET /api/layout-zones` — zones with assigned products. `POST /api/layout-zones` (201, `{"name","width","height"}`, server sets `x=0,y=0`). `PATCH /api/layout-zones/{id}` (partial update). `DELETE /api/layout-zones/{id}` (204).

**`stock_zones.py`** (Stock Manager's independent floor-plan editor, no product assignment, role `stock_manager` on all 4) — identical CRUD shape to `layout_zones.py` but no `products` field on the response.

**`layout_suggestion.py`** (mounted under `/api/reports`, UC-15, role `seller_manager`):
- **`GET /api/reports/layout-suggestion`** — co-occurrence/apriori suggestions for the caller's branch, enriched with each product's current zone + whether the pair was already applied.
  ```json
  {
    "method": "co_occurrence", "branch_sales_count": 340,
    "suggestions": [{ "product_a_id": 9, "product_a_name": "Süt 1L", "product_a_zone_id": 2, "product_b_id": 14, "product_b_name": "Ekmek", "product_b_zone_id": null, "score": 0.42, "applied": false, "applied_at": null, "applied_by": null }]
  }
  ```
- **`POST /api/reports/layout-suggestion/apply`** — upsert on the normalized pair. Request `{"product_a_id": 9, "product_b_id": 14}`. 200/422 (`a==b`)/404.

### 4. Reporting (`reports.py`)

#### `GET /api/reports/product-sales/{product_id}?granularity=&branch_id=&region_id=`
Role: `branch_manager`, `region_manager`, `general_manager`. Per-product sales trend (week/month/year granularity) plus a region/branch breakdown; returns/exchanges netted per-product from `ReturnItem` rows (finer-grained than the sale-level netting below).
```json
{
  "product_id": 9, "product_name": "Süt 1L", "scope": "branch", "scope_label": "Kadıköy", "granularity": "week",
  "trend": [{ "period": "2026-W32", "quantity": 12, "revenue": 550.80 }],
  "breakdown": [{ "id": 3, "label": "Kadıköy", "quantity": 12, "revenue": 550.80 }]
}
```
- **200**. **403** — role not allowed. **422** — invalid `granularity`. **404** — product not found, or drill-down `branch_id`/`region_id` outside caller's scope.

#### `GET /api/reports/sales?days=&branch_id=&region_id=`
Role: `branch_manager`, `seller_manager`, `region_manager`, `general_manager`. Aggregate report — totals, trend, top/least-selling, never-sold, low-stock count, optional region/branch breakdown, over a fixed day window (`7`/`30`/`90`). This single endpoint absorbs what was originally planned as three separate endpoints (see "Known Design vs. Implementation Differences" below). **`seller_manager` never sees profit-margin fields** (forced `null`/`0.0`) — a deliberate business rule enforced here, cross-checked against the SRS during a code review pass.
```json
{
  "scope": "branch", "scope_label": "Kadıköy", "days": 30, "branch_count": 1, "low_stock_count": 3,
  "total_sales": 45210.50, "transaction_count": 812,
  "profit_margin_pct": 22.4, "profit_margin_amount": 10127.10, "cost_data_coverage_pct": 88.0,
  "trend": [{ "day": "2026-07-15", "total_sales": 1500.00 }],
  "top_products": [{ "product_id": 9, "product_name": "Süt 1L", "quantity": 120, "revenue": 5508.00 }],
  "breakdown": [{ "id": 3, "label": "Kadıköy", "total_sales": 45210.50, "profit_margin_pct": 22.4 }],
  "least_selling": [{ "product_id": 30, "product_name": "Su", "quantity": 1, "revenue": 3.50 }],
  "never_sold": [{ "product_id": 41, "product_name": "Kahve 500g" }]
}
```
- **200**. **403** — role not allowed. **422** — `days` not in `{7,30,90}`. **404** — invalid drill-down.

### 5. Notifications (`notifications.py`)

Both endpoints: any authenticated employee — visibility is scoped implicitly per role (own branch for `stock_manager`/`seller_manager`; delegated-down branches for `branch_manager`/`region_manager` when no specialist role exists there; empty for roles like `cashier`).

#### `GET /api/notifications`
Low-stock and expiring-soon items across the caller's target branches, live-queried (not stored), each flagged `is_read` per employee.
```json
{
  "low_stock": [{ "product_id": 9, "product_name": "Süt 1L", "branch_id": 3, "quantity": 2, "threshold": 10, "is_read": false }],
  "expiring": [{ "product_id": 9, "product_name": "Süt 1L", "branch_id": 3, "best_before_date": "2026-08-16", "is_read": false }]
}
```
- **200**.

#### `POST /api/notifications/read`
Marks one notification (kind + product + branch) read for the caller, idempotent. Added for the mobile companion app (Sprint 6), which needed read/unread state since it has no other way to "dismiss" a live-queried notification.
```json
{ "kind": "low_stock", "product_id": 9, "branch_id": 3 }
```
- **204** (no body). **404** — pair isn't a valid notification target for this employee/kind.

### 6. Employee / Org Management

**`employees.py`** — creation role hierarchy (`CREATABLE_ROLES`):

| creator role | can create |
|---|---|
| `branch_manager` | `cashier`, `stock_manager`, `seller_manager` |
| `region_manager` | `branch_manager` |
| `general_manager` | `region_manager`, `company_it` |
| `company_it` | `general_manager` |
| `operations_chief` | `staff` |
| `vendor_manager` | `general_manager`, `company_it`, `region_manager`, `branch_manager`, `cashier`, `stock_manager`, `seller_manager`, `operations_chief`, `staff` |

`general_manager` ↔ `company_it` is bidirectional (Day-0, 2026-08-14) — either can create the
other. `vendor_manager`'s row is the Day-0 (UC-17) extension — see "companies.py / org.py" above
for the accompanying `POST /api/companies`/`/regions`/`/branches` endpoints and required-field
rules per target role.

- **`GET /api/employees`** — caller's manageable subordinate set, scoped by branch/region/company. 200/403.
- **`POST /api/employees`** — gated by the table above; `staff` has no username/password; `manager_pin` only for `PIN_APPROVER_ROLES` (`stock_manager`/`seller_manager`/`operations_chief`). 201/403/422/404 (target branch/region outside creator's scope)/409 (username taken).
- **`PATCH /api/employees/{id}`** — same manageable-set gate; `is_active` can be flipped back to `true` to reactivate. 200/403/404/422.
- **`GET /api/employees/company-wide`** — role `company_it` only; every login-capable employee in the
  caller's company, independent of hierarchy (UC-19, Company IT override). 200/403.
- **`POST /api/employees/{id}/reset-password`** — role `company_it` only; body `{"new_password": str}`
  (`min_length=1`); target must belong to caller's own company (404 otherwise — no
  forced-change-on-next-login flag, no audit log, both explicitly out of scope). 200/403/404/422.
```json
{ "first_name": "Ali", "last_name": "Veli", "role": "cashier", "age": 28, "address": "İstanbul", "username": "aveli", "password": "secret123", "branch_id": null, "region_id": null, "manager_pin": null }
```

**`org.py`**
- **`GET /api/regions`** — role `general_manager`; lists caller's company's regions (for the "target region" picker when creating a `region_manager`). 200/403.
- **`GET /api/branches?region_id=`** — role `region_manager` (own region only) or `general_manager` (whole company, optionally narrowed). 200/403.

**`shifts.py`** — UC-21, role `operations_chief` on all four; `EXCLUDED_ROSTER_ROLES` keeps `branch_manager` and above off the roster:
- `GET /api/shifts?day=` (default today) — that date's schedule for the branch.
- `GET /api/shifts/roster` — eligible-for-shifts employees.
- `GET /api/shifts/week?start_date=` — 7-day window from `start_date`.
- `PUT /api/shifts/{employee_id}` — **upsert** one employee's shift for a date; `is_day_off=true` forces `start_time`/`end_time` to `null` server-side. 200/404/422 (`is_day_off=false` but times missing).
```json
{ "shift_date": "2026-08-14", "start_time": "09:00:00", "end_time": "17:00:00", "is_day_off": false }
```

### 7. Multi-Tenant / Vendor (`companies.py`)

All five endpoints: role `vendor_manager` only (logs in via the `admin` subdomain).

- **`GET /api/companies`** — all tenant companies. `[{ "id": 1, "name": "Acme Retail", "subdomain": "acme", "is_active": true }]`
- **`GET /api/companies/{id}/features`** — the fixed 4-item known-feature set (`layout_onerisi`, `mobil_app`, `merkez_depo_senaryosu`, `kpi_modulu`) with enabled state, defaulting `false` if no row exists.
- **`PUT /api/companies/{id}/features/{feature_name}`** — upsert one flag. Request `{"enabled": true}`. 422 if `feature_name` isn't one of the known four.
- **`GET /api/companies/{id}/branding`** / **`PUT /api/companies/{id}/branding`** — upsert; logo stored as a base64 `data:` URL directly in the DB (no object storage at this scale). `PUT` 422s if `logo_url` doesn't start with `data:image/` or exceeds ~300KB.

All five: 403 for any non-`vendor_manager`; 404 for an unknown `company_id`.

### 8. Currency (`currency.py`)

#### `GET /api/currency/rates`
Role: `branch_manager`, `region_manager`, `general_manager`. TRY→{USD,EUR,GBP} rates from the free Frankfurter (ECB-based) API, 1-hour in-memory cache; falls back to the last cached value if the upstream call fails.
```json
{ "base": "TRY", "date": "2026-08-13", "rates": { "USD": 0.029, "EUR": 0.027, "GBP": 0.023 } }
```
- **200**. **403**. **502** — upstream failed and no cache exists yet.

---

## Notable Cross-Cutting Patterns

- **Atomic stock decrements** — `POST /api/sales` and the stock-consuming half of `POST /api/returns/{id}/complete` both use a single `UPDATE ... WHERE quantity >= requested` per line (never check-then-act), rolling back the whole operation on any shortfall with a `409` carrying an `insufficient_items` array.
- **Upserts, not separate create endpoints** — `PATCH /api/stock/{product_id}`, `POST /api/stock-requests`, `PUT /api/shifts/{employee_id}`, `PUT /api/companies/{id}/features/{feature_name}`, `PUT /api/companies/{id}/branding`, and `POST /api/reports/layout-suggestion/apply` all create-or-update in one call.
- **Stale notification-read cleanup, applied independently in three places** — `PATCH /api/stock`, `POST /api/stock-requests`, and `PATCH /api/products/{id}` each clear stale low-stock/expiring "read" marks when their action resolves the underlying condition (a bug found and fixed during a whole-branch review — a mark could otherwise survive past the condition it was about, hiding a real re-occurrence).
- **`POST /api/returns/{return_id}/complete` deliberately has no role check** — authorization is branch membership + a correct manager PIN, not the caller's own role, matching the architecture's "any eligible approver on the floor, not a single named person" design.
- **No role restriction at all** on several read endpoints (any authenticated employee): `GET /api/products*`, `GET/PATCH /api/stock`, `GET /api/stock-requests`, `GET/POST /api/notifications*`, `GET /api/auth/me`.

---

## Known Design vs. Implementation Differences

The API was originally sketched out before implementation began; a few decisions changed once real
usage patterns and code review findings came in. Documented here rather than silently letting the two
diverge:

- **`GET /api/reports/top-products` and `GET /api/reports/profit-margin`** were planned as two separate
  endpoints (UC-14, UC-16). In practice both were folded into the single `GET /api/reports/sales`
  response (`top_products`, `least_selling`, `never_sold`, `profit_margin_pct`/`profit_margin_amount`
  fields) — one report screen needed all of this data together, and a single query was simpler than
  three near-identical ones hitting the same tables.
- **Shift assignment** was planned as `POST /api/shifts` (single) + `POST /api/shifts/bulk` (weekly).
  The implemented version is `GET /api/shifts/roster` + `GET /api/shifts/week` + `PUT
  /api/shifts/{employee_id}` (upsert, called once per cell edited in the weekly calendar UI) — no bulk
  endpoint exists; the UI simply calls the single upsert endpoint once per change.
- Several endpoints exist now that weren't part of the original design at all: `GET
  /api/reports/product-sales/{id}`, `GET /api/stock/product/{id}/branches`, `GET /api/currency/rates`,
  `POST /api/products/import` + `GET /api/products/import/template`, the whole `layout_zones.py` /
  `stock_zones.py` / `layout_suggestion.py` apply-flow, `GET /api/regions` / `GET /api/branches`, and
  the mobile-driven additions (`subdomain` on login, `POST /api/notifications/read`).
