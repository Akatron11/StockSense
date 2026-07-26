# StockSense — API Documentation

This file is added to as the backend API's (FastAPI) design is discussed and decided module by module.
General conventions were decided first, then each module (matching the Component Table in
`stocksense-architecture.md` and the Use Cases in `stocksense-srs.md`) is detailed separately.

---

## General Conventions

### URL structure

- Prefix: **`/api`**, no version number (not `/api/v1`).
- Rationale: the clients (web + mobile) are also within this project's scope, there is no third-party
  consumer — the problem versioning solves ("release a new version without breaking old clients") is not
  a real need in this project. If genuinely needed later, `v2` can be added while `v1` is kept; not
  adding it now doesn't forfeit that flexibility.
- Resources use plural names: `/api/products`, `/api/sales`.
- The tenant/branch ID is never carried in the path (see the "Tenant/branch scope" item) — implicit scope
  plus a query param when needed; the same resource never has two different URL shapes depending on role.

### Field naming (JSON casing)

- **`snake_case`**, end to end (request and response).
- Rationale: the backend (SQLAlchemy models) is already `snake_case`; the Pydantic response model maps
  one-to-one, no extra alias/conversion layer is needed. Goes against the `camelCase` habit on the
  frontend (JS/TS) but carries no functional disadvantage — not adding an extra layer was preferred while
  still learning.

### Response shape

- **Bare data** — no envelope/wrapper. A single resource → a bare object, a list resource → a bare array.
- Pagination is not imposed on every endpoint as a blanket rule; only lists that can genuinely grow large
  (e.g. sales history, reports) get an endpoint-specific `?limit=&offset=` plus a count field — decided
  separately when that module is designed.

### Error format

- FastAPI's default shape: `{"detail": "..."}`. No custom error schema was invented — validation errors
  (422) already use this same format in FastAPI, so it stays consistent.

### Auth

- JWT, stateless — **access token only, no refresh token**. Lifetime will be set close to a shift length
  (e.g. 8-12 hours); once it expires, the user logs in again.
- Rationale: the problem a refresh token solves ("the session lasts longer without the user noticing")
  is not a real need in the POS/shift scenario; adding refresh + revocation would create tension with the
  architecture's "stateless, no separate session store" decision (item 8).
- Login resolves `company_id` from the subdomain (`Host` header); the JWT embeds `company_id`,
  `branch_id`, `region_id` (architecture items 8, 16).

### Tenant/branch scope

- **Implicit by default**: if no parameter is given, the user's own scope in the token (branch/region/
  company) is used. This is enough for single-scope roles (Cashier, Stock Manager, etc.).
- **Optional query param for multi-scope roles**: e.g. `GET /api/reports/sales?branch_id=5`. The backend
  checks whether the given ID is within the token's authorized scope (the token is always the ceiling,
  the query param only narrows within that ceiling).
- IDs are never carried in the path (`/branches/{id}/...` is not used) — a single URL shape is kept for
  both the implicit and explicit cases.

### Date/time format

- **ISO 8601, UTC** (e.g. `"2026-07-24T14:30:00Z"`). Converting to local time zone is left to the
  frontend.

### Manager PIN approval

- The PIN is sent **as a field in the same request**, rather than through a separate verification
  endpoint (e.g. `manager_pin` in the body of `POST /api/returns/{id}/complete`). Verification and
  completion happen in a single request, in a single DB transaction.
- Rationale: currently there is only one flow that requires a PIN (UC-04) — building a centralized
  approval mechanism now would be designing for a need that doesn't exist yet. The single-request
  approach also prevents a race condition between PIN verification and completing the transaction —
  consistent with the project's overall "DB-atomic" philosophy (item 3).

### Deletion

- **Soft delete**: a `DELETE` endpoint never actually removes the row, it flags a field like
  `is_active=false`. It disappears from lists, but historical sales/report records (references like
  `sale_items` → `product_id`) stay intact.

---

## Modules

The modules below match the Use Case groups in `stocksense-srs.md` and the Component Table in
`stocksense-architecture.md`. Each is discussed and detailed separately.

### Auth

**`POST /api/auth/login`**
- Input: `username`, `password` (the company is resolved from the subdomain/`Host` header, `company_id`
  is not requested separately).
- Output: `{"access_token": "...", "user": {"id": ..., "full_name": ..., "role": ...}}`.
- JWT contents (payload): authorization claims only — `user_id`, `role`, `company_id`, `branch_id`,
  `region_id`. Human-readable info (`full_name`, etc.) is not embedded in the token, it is only returned
  in the response's `user` object.
- Lifetime: close to a shift length (e.g. 8-12 hours), no refresh token — the user logs in again once it
  expires.

**`GET /api/auth/me`**
- Input: none (the token in the Authorization header is enough).
- Output: same shape as the `user` object from login — used to re-fetch display info like `full_name`/
  `role` after a page reload/app relaunch.

**Logout**
- No separate endpoint — JWT is stateless, an invalidation mechanism (a revocation list) on the backend
  was deliberately not chosen (see General Conventions, Auth). The client discards the token on its own
  side.

### POS / Sales Transactions (UC-01 – UC-05)

**`GET /api/products/search?q=...`** (UC-01)
- `q`: barcode, SKU, or name — all go into the same parameter. The backend first tries an exact match
  (barcode/SKU), then falls back to a partial name match.
- Output: always an **array** (a single-element array even for a single match) — the response type never
  changes. On the frontend, the barcode-scan flow builds its own "auto-add to cart when the array has one
  element and `q` is an exact code match" logic.

**`POST /api/sales`** (UC-02)
- Request: `{"items": [{"product_id": 42, "quantity": 2}], "payment_method": "cash"}`.
  `branch_id` is not sent (implicit from the token). **Price is not sent** — whichever pricing mechanism
  applies (central `default_price`, branch `price_override`, expiry discount) the backend reads it from
  the DB and calculates it; the client's price is never trusted.
- Success (`201`):
  ```json
  {
    "id": 501,
    "branch_id": 3,
    "items": [{"product_id": 42, "quantity": 2, "unit_price": 44.95}],
    "total": 89.90,
    "payment_method": "cash",
    "status": "completed",
    "created_at": "2026-07-24T14:30:00Z"
  }
  ```
- Insufficient stock / losing the concurrency race (item 3) — **all or nothing**: if any item in the
  cart has insufficient stock, the entire sale is rejected, no item's stock is decremented.
  `409 Conflict`:
  ```json
  {
    "detail": "Insufficient stock",
    "insufficient_items": [{"product_id": 42, "requested": 3, "available": 1}]
  }
  ```

**Return/Exchange (UC-03 – UC-04)**

Data model finalized (architecture item 6, 2026-07-24): a separate `returns`/`return_items` table (not
a reuse of the `sales` table) — see the architecture file for the rationale. The API below uses this
schema: `returns.status` (`pending`/`completed`) and `return_items.direction` (`returned`/`new`) are
presented in the response grouped as `returned_items`/`new_items`.

An exchange is modeled in the same single endpoint/single operation as a return (`new_items` optional) —
there is no separate "exchange" endpoint. Rationale: in UC-04 the PIN approval is defined as a single
moment (upon completion); splitting it into two operations would either require two PIN approvals or
risk an intermediate state (return done but exchange not completed) — the same logic as the "all or
nothing" atomicity in sale creation.

**`POST /api/sales/{sale_id}/returns`** — started by the Cashier (UC-03)
- Request:
  ```json
  {
    "returned_items": [{"product_id": 42, "quantity": 1}],
    "new_items": [{"product_id": 50, "quantity": 1}]
  }
  ```
  (`new_items` optional — only sent for an exchange. Prices are not sent from the client here either.)
- Response (`201`, `status: "pending"` — still awaiting PIN approval):
  ```json
  {
    "id": 88,
    "sale_id": 501,
    "returned_items": [{"product_id": 42, "quantity": 1, "unit_price": 44.95}],
    "new_items": [{"product_id": 50, "quantity": 1, "unit_price": 32.45}],
    "net_amount": -12.50,
    "status": "pending",
    "created_at": "2026-07-24T15:00:00Z"
  }
  ```
  (`net_amount`: negative means a refund to the customer, positive means the customer pays the
  difference.)

**`POST /api/returns/{return_id}/complete`** — completed by a manager with a PIN (UC-04)
- Request: `{"manager_pin": "1234"}` (in the same request, no separate verification endpoint — see
  General Conventions, Manager PIN approval).
- Response (`200`, `status: "completed"`):
  ```json
  {
    "id": 88,
    "sale_id": 501,
    "returned_items": [...],
    "new_items": [...],
    "net_amount": -12.50,
    "status": "completed",
    "completed_by": 17,
    "completed_at": "2026-07-24T15:02:00Z"
  }
  ```

**Switch to Register (UC-05)**
- No API needed — purely **frontend routing**. The Operations Chief's JWT is already authorized to use
  the POS endpoints (role-based authorization is defined in the architecture); "switching to the
  register" is just a screen/route change with the same token, no separate request goes to the backend.

### Stock Management (UC-06 – UC-12)

**Product Catalog — `/api/products`** (UC-06, General Manager)
- `GET /api/products?include_inactive=&category=`
  - Default: only `is_active=true` rows. `include_inactive=true` also includes inactive ones (the
    default was kept narrow to preserve soft delete's "auto-hide" benefit).
  - Output: array — `{id, name, sku, category, default_price, cost_price, best_before_date, is_active}`.
- `POST /api/products` → Request: `{name, sku, category, default_price, cost_price, best_before_date}`
  → `201` + the created object.
- `GET /api/products/{id}` → a single object.
- `PATCH /api/products/{id}` → partial update, only the sent fields are updated.
- `DELETE /api/products/{id}` → soft delete (`is_active=false`), `204 No Content` — no hard delete (see
  General Conventions, Deletion).

**Branch Stock State — `/api/stock`** (UC-07 Seller Manager; UC-08, UC-10 Stock Manager)
- The `Stock` row (`quantity`, `low_stock_threshold`, `price_override`) is managed as a single resource
  through a single endpoint — three different roles changing three different fields is resolved with
  field-level authorization in the backend rather than splitting the URL (the resource is already a
  single row, consistent with REST's "resource = URL" principle).
- `GET /api/stock` → a list scoped implicitly to the branch: `{product_id, branch_id, quantity,
  low_stock_threshold, price_override}`.
- `PATCH /api/stock/{product_id}` → updates whichever of `quantity`, `low_stock_threshold`,
  `price_override` is sent in the body. The backend checks, for each field sent, whether the role is
  authorized (Seller Manager → only `price_override`; Stock Manager → `quantity`/
  `low_stock_threshold`); an unauthorized field returns `403`. `branch_id` is implicit (from the token).

**Central Warehouse Stock Request (UC-09)**

Data model finalized (architecture item 11, 2026-07-24): the central warehouse is not an entity with
its own tracked stock level, it is an **unlimited/always-available source** — a request is always
fulfilled instantly, there is no approval/rejection process. A new `stock_requests` table (for
audit/history purposes) was added.

**`POST /api/stock-requests`** — Stock Manager (UC-09, extends UC-08)
- Request: `{"product_id": 42, "quantity": 50}` (`branch_id` implicit, from the token).
- The backend inserts a row into `stock_requests` **and** increments the relevant `stock.quantity`, in
  the same transaction — atomic.
- Response (`201`):
  ```json
  {"id": 12, "product_id": 42, "branch_id": 3, "quantity": 50, "requested_by": 7,
   "created_at": "2026-07-24T16:00:00Z"}
  ```

**`GET /api/stock-requests`**
- Input: none — implicit scope. Lists past requests (for audit purposes; no report/KPI uses this data
  yet).

**Notifications — Low Stock / Expiry (UC-11 – UC-12)**

Per the architecture's decision that "there is no real-time sync, polling will be used" (item 15),
notifications are not pushed — the client periodically asks and finds out. This means a separate
`Notification` table is not needed: low stock is a **live reflection** of
`Stock.quantity <= low_stock_threshold`, expiry is a live reflection of `Product.best_before_date`
approaching — consistent with the "Live-Query, no cache/pre-aggregation" principle (item 5). There is no
stored/dismissable state; once stock is replenished or a product is deactivated, the notification simply
drops out of the list on its own.

**`GET /api/notifications`**
- Input: none — implicit scope. The backend applies the "Notification Target Principle" (item 14 — the
  notification goes to the most specific active role that actually holds this authority at that moment)
  internally and returns the notifications relevant to the calling user; the user doesn't need to know
  the targeting logic.
- Response:
  ```json
  {
    "low_stock": [
      {"product_id": 42, "product_name": "Milk 1L", "branch_id": 3, "quantity": 1, "threshold": 5}
    ],
    "expiring": [
      {"product_id": 50, "product_name": "Yogurt 500g", "branch_id": 3, "best_before_date": "2026-08-01"}
    ]
  }
  ```
- No separate endpoint for the discount decision (UC-12) — the Seller Manager applies the discount via
  `PATCH /api/stock/{product_id}` (`price_override`).

### Reporting / Layout Recommendation (UC-13 – UC-16)

**`GET /api/reports/sales?start_date=&end_date=&group_by=product&branch_id=&region_id=`** (UC-13)
- `start_date`, `end_date`: required, ISO 8601 date.
- `group_by`: `product` (default) or `category`.
- `branch_id`/`region_id`: optional, hierarchical narrowing (see General Conventions, Tenant/branch
  scope) — the token is always the ceiling, the query param only narrows within it.
- Aggregation is done on the backend ("Live-Query", item 5 — no cache/pre-aggregation, the DB's
  `GROUP BY` is more efficient than the frontend writing its own aggregation logic).
- The response shape changes based on `group_by` (separate, explicit naming was preferred over a single
  generic `key`/`label` shape):
  - `group_by=product`: `[{"product_id": 42, "product_name": "Milk 1L", "quantity_sold": 120,
    "total_revenue": 5394.00}]`
  - `group_by=category`: `[{"category": "Dairy", "quantity_sold": 200, "total_revenue": 7990.00}]`

**`GET /api/reports/top-products?start_date=&end_date=&limit=10&branch_id=&region_id=`** (UC-14)
- `limit`: how many products are returned in the top/least-selling lists (default 10). `limit` is not
  applied to the `never_sold` list, all of it is returned.
- Response:
  ```json
  {
    "top_selling": [{"product_id": 42, "product_name": "Milk 1L", "quantity_sold": 120}],
    "least_selling": [{"product_id": 77, "product_name": "Salt 1kg", "quantity_sold": 3}],
    "never_sold": [{"product_id": 90, "product_name": "Olives 500g"}]
  }
  ```

**`GET /api/reports/layout-suggestion`** (UC-15)
- No input — since the Seller Manager can only see their own branch, this is implicit, a `branch_id`
  query param is not needed.
- There is no stored suggestion/applied-status record — per item 5 ("Calculation vs. Display
  Separation") it is calculated from branch data on every request. "Putting it into practice" (UC-15)
  happens entirely in the physical world (shelves are rearranged) — there is no "applied" flag in the
  system, no separate endpoint is needed.
- The response also states which method (item 7 — automatic co-occurrence/Apriori switching based on
  volume) was used:
  ```json
  {
    "method": "apriori",
    "suggestions": [
      {"product_a_id": 10, "product_a_name": "Chips", "product_b_id": 15, "product_b_name": "Cola",
       "score": 0.82}
    ]
  }
  ```

**`GET /api/reports/profit-margin?start_date=&end_date=&group_by=product&branch_id=&region_id=`** (UC-16)
- Same shape as UC-13 (date range, `group_by`, hierarchical `branch_id`/`region_id` narrowing).
- `revenue`/`cost` are calculated on the backend from the price in effect at the time of sale
  (`default_price`/`price_override`) and `cost_price`.
  ```json
  [
    {"product_id": 42, "product_name": "Milk 1L", "revenue": 5394.00, "cost": 3200.00,
     "profit": 2194.00, "margin_pct": 40.7}
  ]
  ```

### Account / Staff Management (UC-17 – UC-21)

**Initial Setup (UC-17, Day-0)** — no dedicated "setup" endpoint. The Vendor Manager calls the following
general CRUD endpoints in sequence (`POST /api/companies` → `POST /api/regions` → `POST /api/branches`
→ `POST /api/employees`). Rationale: these endpoints are already needed separately in every case (e.g.
adding a single branch later), opening two code paths that do the same thing (setup-specific + general
CRUD) would be unnecessary maintenance burden; Day-0 is also not a high-frequency/concurrent flow like
POS, so the need for atomicity is weak.

**`POST /api/companies` / `POST /api/regions` / `POST /api/branches`** (Vendor Manager)
- The Vendor Manager is not tied to a single company (no `company_id`, item 10) — in these three
  endpoints the parent scope cannot be resolved implicitly, it is sent **explicitly in the body**:
  ```
  POST /api/companies → {"name": "DIMA Market"}
  POST /api/regions   → {"company_id": 5, "name": "Kyrenia Region"}
  POST /api/branches  → {"region_id": 12, "name": "Karaoğlanoğlu Branch"}
  ```

**`POST /api/employees`** (UC-18 — Creating a Lower-Level Account; UC-20 — Login-less Staff Record)
- Request:
  ```json
  {
    "first_name": "Ahmet",
    "last_name": "Yılmaz",
    "username": "ahmet.yilmaz",
    "password": "...",
    "role": "cashier",
    "branch_id": 3,
    "age": 25,
    "address": "...",
    "manager_pin": null
  }
  ```
- `username`/`password`: required only for roles with login; login-less staff (UC-20 — butcher,
  greengrocer, shelf-stocking staff, etc.) do not send these.
- `manager_pin`: required only for roles that can give PIN approval (Stock Manager, Seller Manager,
  Operations Chief), `null` for everyone else.
- The password is set directly by the person creating the account — the system does not generate a
  temporary password (there is no email/SMS notification infrastructure in this project's scope,
  delivery already happens physically/verbally; a "change password on first login" mechanism was not
  built).
- `branch_id`/`region_id`/`company_id`: the token is the ceiling, the sent ID must be **within** that
  ceiling (the same principle as the hierarchical narrowing in reports) — which one is required depends
  on the role being created (Region Manager → creating a Branch Manager sends `branch_id` explicitly;
  Company IT → creating a General Manager has `company_id` implicit, etc.). A wrong role/ID combination
  or an out-of-scope ID → `403`.

**`GET /api/employees` / `GET /api/employees/{id}` / `PATCH /api/employees/{id}` /
`DELETE /api/employees/{id}`**
- Standard CRUD, implicit scope. `DELETE` → soft delete (`is_active=false`).

**`POST /api/employees/{id}/reset-password`** (UC-19, Company IT only)
- Request: `{"new_password": "..."}`.
- Company IT can reset the password of an account at any level within their own company (including the
  General Manager) — the normal hierarchy restriction (who can create/normally reset whose password)
  does not apply here ("Company IT always has override authority", architecture item 6).
- No separate bulk endpoint for "bulk account creation" — consistent with the Day-0 decision,
  `POST /api/employees` is called repeatedly.

**Shift Assignment (UC-21)** — the `Shift` table is not soft-delete (no `SoftDeleteMixin`), it is not
referenced by other records — a real `DELETE` causes no issue here.

- `POST /api/shifts` → creates a single shift record (`{employee_id, shift_date, start_time, end_time,
  is_day_off}`) — for individual corrections (e.g. changing a single day afterward).
- `POST /api/shifts/bulk` → for bulk assignments like a weekly schedule. Rationale: unlike Day-0, this is
  a **recurring operational task** — even in a small branch, sending requests one by one (staff count ×
  day count) would be a real usability problem, and since "this week's schedule" is a single logical unit
  in the user's mind, all-or-nothing atomicity (consistent with our sales/return decisions) makes sense
  here.
  ```json
  {
    "shifts": [
      {"employee_id": 12, "shift_date": "2026-07-27", "start_time": "09:00", "end_time": "17:00",
       "is_day_off": false},
      {"employee_id": 12, "shift_date": "2026-07-28", "is_day_off": true}
    ]
  }
  ```
- `GET /api/shifts?employee_id=&start_date=&end_date=` → schedule viewing.
- `PATCH /api/shifts/{id}` / `DELETE /api/shifts/{id}` → individual correction/deletion.

### Multi-Tenant / Vendor Operations (UC-22 – UC-23)

`CompanyFeature`/`CompanyBranding` are tied to a `company_id`, and the Vendor Manager has no implicit
company (as with companies/regions/branches). But the "token = ceiling, narrow with a query param"
situation from reports/account creation doesn't apply here — there is **no implicit scope at all**, just
the question of "which company's sub-resource." That's why a path-based nested resource is used here
(resource addressing like `/api/products/{id}`, not scope narrowing).

**`GET /api/companies/{company_id}/features` / `PATCH /api/companies/{company_id}/features`** (UC-22)
```json
GET   → [{"feature_name": "layout_suggestion", "enabled": true}, {"feature_name": "mobile_app", "enabled": false}]
PATCH → Request: [{"feature_name": "mobile_app", "enabled": true}]  // only the changed ones are sent
```

**`GET /api/companies/{company_id}/branding` / `PATCH /api/companies/{company_id}/branding`** (UC-23)
```json
GET/PATCH → {"logo_url": "...", "primary_color": "#FF0000", "display_name": "DIMA Market"}
```
