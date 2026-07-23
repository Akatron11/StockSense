# StockSense — Architecture

This file is updated as the project's architecture, scalable to general businesses, is discussed and decided step by step.

> Related historical documents (for reference only):
> - `stocksense-todo-small-scale-draft.md` — the initial scope draft, written under the small-scale assumption.
> - `stocksense-mimari-kararlar.md` — earlier architectural decisions made under the small-scale assumption (kept for reference/lessons-learned; superseded by this file).

---

## Scope Change — Why This File Exists

Instructor's directive: the project will not be designed for a single small-scale store, but as a product **scalable to general businesses** (chain supermarkets, branch-based retail chains, small family-owned markets) — scaled according to the requesting business.

The `topic.pdf` brief frames the project as "small retail stores"; this was expanded by the instructor's verbal directive. Design principle: **the data model and role model are built around the general (large) scenario, but the implementation starts from the smallest concrete example (a single branch) and expands from there.** This way, the small-business scenario becomes a natural subset of the larger model; doing the reverse (designing small and trying to scale up) would require rewriting the schema/roles — which is exactly the problem encountered in the first round.

Reference scenario: a chain supermarket like DIMA (TRNC, Kyrenia) — a structure with branches such as Karaoğlanoğlu, Kyrenia Center, Lapta, Alsancak, Özanköy, with a regional layer and likely a head-office layer.

---

## 1. Organizational Hierarchy

**3 levels: Branch (Store) → Region → Company/Headquarters.**

A small family market is represented as the simplest case of this model — "1 branch, no region, directly attached to company-level" — no separate data model is needed.

## 2. Role Hierarchy

```
Cashier, [staff without login: butcher, greengrocer, shelf-stocking staff, cleaner, etc.]
  ↓ (authority/POS axis)                    ↓ (shift axis)
{Stock Manager, Seller Manager} ←── parallel, no permission inheritance ──→ Operations Chief
  ↓                                                                    ↓ (organizational, not authority)
Branch Manager ←──────────────────────────────────────────────────────────┘
  ↓
Region Manager                      ← responsible for all branches in their region
  ↓
General Manager                       ← responsible for the whole company (business authority)

Company IT (a company's own in-house technical team — OUTSIDE the business hierarchy, a parallel technical role; above/below no one, including the General Manager)
Vendor Manager (outside/above ALL customers — the platform role of the vendor/project owner; not tied to a single company)
```

The Cashier has two separate connections: through the **authority/POS axis**, they are part of the permission-inheritance chain of the Stock Manager/Seller Manager (and thus the Branch Manager) (see the item under "Permission inheritance"); through the **shift axis**, they report to the Operations Chief (see item 13). These two axes are independent of each other.

### Role definitions
- **Cashier:** Makes sales through the POS.
- **Stock Manager:** Responsible for the branch's stock (adding/editing, low-stock threshold).
- **Seller Manager:** Responsible for the planogram/shelf design — the **natural owner and user** of the layout recommendation feature (co-occurrence/Apriori-based) mentioned in lines 8-10 of the brief.
- **Operations Chief:** Responsible for in-store operations and for shift tracking of all branch staff (whether they have a login or not, excluding managers and their deputies) (see item 13). Has POS authority (see "Switch to Register"). **Parallel/at the same level** as Stock Manager/Seller Manager — there is no permission inheritance between them; cannot make manager-level business decisions such as stock or layout.
- **Branch Manager:** Responsible for all operations of that branch; sees all branch-level reports/permissions.
- **Region Manager:** Can view/compare all branches in their own region.
- **General Manager:** Full business visibility and decision authority across the company — sees all regions/branches.
- **Company IT:** A company's own technical/IT team. Within their own company, handles account recovery (password reset, unlocking — for anyone's account, including the General Manager), intervening on corrupted system data, and creating the topmost account (a new General Manager) that has no superior. **Cannot make business decisions, is not part of the business hierarchy** — neither above nor below the General Manager, a fully parallel/separate technical authority domain.
- **Vendor Manager:** The platform role of the vendor/project owner — above the tenant level, outside all customers. New customer onboarding (Day-0 setup), per-customer feature/role configuration, and visual identity (branding) belong to this role. Not tied to a single company (no `company_id`). (The old single "Admin" role was split into Vendor Manager + Company IT because it actually combined two different responsibilities.)

### Permission inheritance principle
Every superior role in the business hierarchy automatically covers the permissions of all roles below it (Branch Manager ⊇ Stock Manager + Seller Manager + Cashier; Region Manager ⊇ all Branch Manager permissions in their region; General Manager ⊇ all of them). This is modeled as a single rule + role-specific additional permissions, instead of writing a separate permission list for each role — this reduces maintenance burden and lowers the risk of inconsistency.

### "Switch to Register" — Operations Chief Only
- The "Switch to Register" feature (switching from the panel to the POS interface in the same session, without re-login) exists **only for the Operations Chief**. Stock Manager, Seller Manager, Branch Manager and roles above do not have this feature and cannot switch to the POS in any way — this authority is fully concentrated in the Operations Chief.
- Rationale: the responsibility of assisting at the register during busy hours is now clearly part of the Operations Chief's job description; managers focus solely on their own work (stock, layout, branch management).
- The mechanism is not an auth change, just a UI/route change — the session already carries the Operations Chief's identity; if there are multiple terminals, it selects an available one.

## 3. Stock Management — Branch-Based, Supply Chain Out of Scope

- Stock is always kept **per branch** (linked via `branch_id`).
- How stock physically arrives (central warehouse distribution, direct wholesale purchase, or a mix of both) is a **supply chain/logistics** matter — outside the system's scope (automatic ordering to a supplier was already out of scope, consistent with this decision).

### Concurrency — DB-Atomic Approach
- The last-unit race condition (a brief MUST requirement) is resolved not at the application layer, but at the **database level with an atomic operation**.
- ❌ Wrong: "check-then-act" (first read with SELECT, then decide and UPDATE in application code) — a race condition arises in the gap between read and write.
- ✅ Correct: a single atomic query, e.g. `UPDATE stock SET quantity = quantity - 1 WHERE product_id = X AND branch_id = Y AND quantity > 0;` — if the affected row count is 0, the sale is rejected.
- This mechanism does not need to know how many terminals are racing at the same time; it generalizes to N terminals/N branches.

## 4. Product Catalog and Pricing

- The product catalog (name, SKU, category) is defined **centrally/at company level**.
- The price field **can be overridden per branch** (optional) — if empty, the company-level default price applies.
- Rationale: in chains, the wholesale price can vary by branch (an observation of yours); putting this flexibility into the schema from the start means that if a "branch-specific price difference" need arises later, no restructuring is required. In the prototype all branches can use the same price; the architecture already supports both cases.

## 5. Reporting and Layout Recommendation — Calculation vs. Display Separation

- Reports and layout recommendations are calculated from branch-level data (see item 7 — "Calculation scope" — for details and rationale).
- **Viewing authority increases with scope/hierarchy:** Branch Manager sees their own branch, Region Manager sees all branches in their region, General Manager sees/compares across the whole company.
- Seller Manager views their own branch's layout recommendation and puts it into practice (see Role definitions).

### Reporting — Live Query
- Sales reports and best-seller/slow-mover detection are calculated on demand with a live SQL query (no cache/pre-aggregation) — the `sale_items` SUM approach in item 9 is an application of this principle.
- Rationale: at this scale, the performance difference is not noticeable; adding a cache introduces unnecessary complexity (invalidation logic).

## 6. Operational Flows

### Account Creation
- **Initial Setup (Day-0):** When a business first moves onto the system (e.g., when DIMA purchases the system), there is zero data inside — the company, regions, branches, and the first users (including the first General Manager, first Region Managers, first Branch Managers) must be entered into the system. Since this is new-customer onboarding, it is done by the **Vendor Manager** (the vendor's job).
- **Steady-state (once the system is live), a higher level creates the level below it:**
  - Cashier/Stock Manager/Seller Manager accounts are created by the **Branch Manager** — they know new hires best, and requiring a trip to head office for every account creates unnecessary friction.
  - A new Branch Manager account is created by the **Region Manager**.
  - A new Region Manager account is created by the **General Manager**.
  - The General Manager's own account (e.g., when a new General Manager is appointed) is created by **Company IT** — because the General Manager has no superior in the business hierarchy. (The *first* General Manager at Day-0 is set up by the Vendor Manager; steady-state GM changes are handled by Company IT.)
- **Company IT always has override authority** — within their own company, at any level, for password resets, bulk account creation, or when the relevant manager wants to delegate this task to someone else, Company IT can always do it.
- This positions account creation as an **operational/administrative action, not a business decision** — it does not conflict with the rule that Company IT "cannot make business decisions."

### Return / Exchange — Manager PIN Approval
- A real-world observation: opening a closed register for a return/exchange requires a physical key, requested from a specific person. The digital equivalent: **a second approval step (PIN verification)**.
- **Flow:** The cashier sets up the return/exchange (items to be returned + amount) → when **completing** the transaction, an "Approval Required" modal opens on the same POS terminal (the PIN is requested when *completing* the transaction, not when it's started — the approver reviews and approves the finalized return) → someone with approval authority (Stock Manager, Seller Manager, Operations Chief — or their deputies: Deputy Stock Manager, Deputy Seller Manager; see item 10) enters their own short PIN code (4-6 digits, separate from the main login password) → the system matches the PIN against users with approval authority at that branch → if there is a match, the transaction is completed and the record shows both "processed by: Cashier X" and "approved by: Y". **The Branch Manager (and Deputy Branch Manager) are not part of this approval pool** — floor-level approval responsibility is concentrated in the Stock/Seller Manager and Operations Chief.
- The cashier's session does not change/close at all during this — this is not a role switch (see item 2, "'Switch to Register' — Operations Chief Only") but a one-time approval event.
- Unlike a physical key, the digital approval **is not limited to one person** — any approver present at the branch at that moment (Stock Manager, Seller Manager, Operations Chief, or their deputies) can approve; the Branch Manager is not in this pool. This automatically solves a real problem in the physical world (work stops if the key-holder is on leave).

### Stock Notifications
- When stock is depleted (drops to 0) AND drops below the configurable threshold, a **notification goes to the Stock Manager** (this is not a fixed rule — see item 14, "Notification Target Principle": the notification goes to the most specific active role that actually holds this authority at that moment).
- A concurrency-rejection event (when the sale of the cashier who lost the race for the last unit is rejected) is also connected to the same notification channel — the "last unit of this product was sold, stock is 0" signal reaches the relevant role via the same target-determination principle (item 14).

### Payment — Fully Mocked
- A real payment gateway (Stripe, iyzico, etc.) will not be integrated.
- When "sale completed" is triggered, only a field like `payment_method: cash/card` is written to the database — no real financial transaction is triggered.
- Rationale: for an academic prototype, real payment integration carries unnecessary legal/financial risk; the brief does not require it either.

## 7. Layout Recommendation Method — Automatic Switching by Scale

- Method selection is **automatic and based on sales volume**: low-volume businesses (family-market type, low daily sales count) use **simple co-occurrence counting**, high-volume businesses (chain supermarket branch) use **Apriori/association-rule mining**.
- Rationale: at the high daily sales volume of a chain supermarket, simple co-occurrence counting produces misleading/noisy results (randomly co-purchased products also appear meaningful); in a small business, there may not be enough data volume for Apriori's support/confidence calculations, adding unnecessary complexity.
- **Switching mechanism:** A single threshold value (sales volume/day or a similar metric) is defined; if the branch's/business's volume is below this threshold, co-occurrence is used, and if above, Apriori automatically kicks in. There is no intermediate "hybrid" layer — the switch happens at a clear threshold.
- **The threshold value will be determined during implementation:** Both methods will be tested on real/seed data, observing at which sales-volume range each method produces incorrect/meaningless results, and the threshold will be fixed numerically (the design decision is settled now, the numeric value does not exist yet).
- **Calculation scope:** The recommendation is always calculated **per branch** — company-wide aggregated data is not used. Rationale: the branch-based price override in item 4 already acknowledges that sales behavior can differ between branches; each branch's own co-occurrence/Apriori pattern should reflect its own reality.

### Seed/Demo Data Strategy
- For the "seeded transactions" required by the Definition of Done, a hybrid approach: a **deliberately patterned core** (e.g., a few product pairs with intentionally high co-occurrence, such as Chips-Cola, Bread-Milk) + **programmatic replication** on top of it.
- During replication, not only patterned pairs but also **random/ordinary purchases (noise)** are mixed in — in real life, most purchases consist of a single product or unrelated combinations.
- Rationale: noise-free data would give the co-occurrence/Apriori engine a misleading impression of "finding everything meaningful." The real test is whether the engine can distinguish the real signal within the noise — this is directly the data source for the threshold test in item 7.
- Data generation will be handled during the implementation phase.

## 8. Technology Stack

- **Backend:** Python + FastAPI.
- **Database:** PostgreSQL, accessed via SQLAlchemy (ORM).
- **Web/POS frontend:** React.
- **Mobile (manager companion app):** React Native — since React will already be learned on the web side, the component/state logic carries over to the same ecosystem, without adding the burden of learning a separate language/framework.
- **Analytics:** pandas (co-occurrence) + mlxtend (Apriori) — see item 7.
- **Auth:** JWT (token-based, stateless) — both web and mobile clients use the same token mechanism, no separate session store is needed.
- **Real-time sync:** None — **polling** will be used (already mentioned as optional in the brief). Since concurrency safety is already ensured by the DB-atomic mechanism (item 3 — "Concurrency — DB-Atomic Approach"), WebSocket is not needed. *Note: WebSocket is out of project scope, but can be pursued separately as a personal learning goal if desired.*
- **Mobile API integration:** The mobile app uses **the same backend API endpoints** as the web dashboard — no separate/mobile-specific endpoints are written, only the UI differs.

## 9. Database Schema

Design process: proceeded from small to large (starting with the question "would a single table suffice," then splitting as needs emerged). Field names are in English, table names are plural.

```
products
  id (PK), name, sku, category, default_price, cost_price, best_before_date

stock
  product_id (FK), branch_id (FK), quantity, low_stock_threshold, price_override (nullable)
  [product_id + branch_id together form the PK]

branches
  id (PK), name, region_id (FK)

regions
  id (PK), name, company_id (FK)

companies
  id (PK), name

employees
  id (PK), first_name, last_name, username (nullable), password_hash (nullable), role,
  branch_id (FK, nullable), region_id (FK, nullable), company_id (FK, nullable),
  age, address, manager_pin (nullable)

sales
  id (PK), sale_date, branch_id (FK), employee_id (FK), payment_method

sale_items
  id (PK), sale_id (FK), product_id (FK), quantity, line_total

shifts
  id (PK), employee_id (FK), shift_date, start_time, end_time, is_day_off (boolean)
```

### Rationale for Design Decisions
- **`sku`:** Satisfies the brief's SHOULD requirement for "fast manual SKU/code entry" — the cashier can quickly find a product by this code without barcode hardware. Should not be confused with `best_before_date`; the two are unrelated pieces of information.
- **`products` / `stock` separation:** A product's fixed/identifying information (name, category) lives in the central catalog (`products`); "how many units are at this branch, at what price" is branch-specific, so it lives in a separate table (`stock`). Since the `products`—`branches` relationship is many-to-many (a product exists at multiple branches, a branch carries multiple products), `stock` is the bridge table that resolves this relationship.
- **`price_override` nullable:** If empty, `products.default_price` applies (item 4); if a branch wants different pricing, it fills this field.
- **Hierarchy chain (branches → regions → companies):** Each level carries the FK of the level above it (in one-to-many relationships, the FK goes on the "many" side) — the small-business scenario is represented as the simplest subset where the `region_id`/`company_id` fields point to a single fixed row (item 1).
- **`employees` single table, 3 nullable FKs:** Since roles are tied to different levels (Cashier/Stock Manager/Seller Manager/Operations Chief/login-less "Staff"/Branch Manager/Deputy Branch Manager/Deputy Stock Manager/Deputy Seller Manager → branch; Region Manager/Deputy Region Manager → region; General Manager/Deputy General Manager → company; Company IT → company; Vendor Manager → none, above tenant level), each staff member is tied to only one level, so two of the three FK fields (all three for Vendor Manager) are always left empty. This is a normal design choice — chosen over "polymorphic association" (a single field pointing to different tables depending on the case) because referential integrity is automatically guaranteed at the database level.
- **`manager_pin` nullable:** Only filled for roles with PIN-approval authority — Stock Manager, Seller Manager, Operations Chief and their deputies (item 6 — return/exchange approval flow). Branch Manager and roles above are not in this pool, so this field stays empty for them.
- **`password_hash` / `username` nullable:** Staff without login (butcher, greengrocer, shelf-stocking staff, etc. — see item 13) are also kept in the same `employees` table, but these fields are left empty — they cannot log into the system. This was chosen instead of opening a separate "login-less staff" table because it allows the `shifts` table to reference both logged-in and login-less staff with a single `employee_id` (consistent with the rationale of avoiding polymorphic association).
- **`password_hash`:** Passwords will be stored hashed, not in plain text (implementation note).
- **`cost_price`:** Cost price — added alongside `default_price` (selling price) so net profit margin can be calculated (see item 12).
- **`sales.payment_method`:** Added to comply with the decision in item 6 ("Payment — Fully Mocked") — holds a value like `cash`/`card`, triggers no real financial transaction. It was missing from the schema table in the first draft; noticed and added during the schema-refinement pass.
- **`sales` / `sale_items` separation:** A sale's header information (date, branch, employee) exists once per sale; each product line item inside it (product, quantity, amount) is a separate row. The total amount is not stored in a separate field — it is calculated on demand by `SUM`-ing the `sale_items.line_total` fields when needed (consistent with the "Reporting — Live Query" principle in item 5). `sale_items` is the data source for the co-occurrence/Apriori calculation — rows sharing the same `sale_id` form the set of "products purchased together."

### Schema Refinement (Pre-Implementation Decisions)

The abstract schema in item 9 was refined with the following concrete decisions before moving to implementation:

**Primary key type:** All `id` fields are **BIGSERIAL** (auto-incrementing 64-bit integer). Not UUID — readability and join performance were preferred; the predictability of ids is an acceptable risk at this scale.

**Deletion strategy — Soft Delete:** Entity tables that may be referenced by historical data (sales/sale_items/shifts) via FK are never hard-deleted; they are deactivated via an `is_active` field (BOOLEAN, default `true`). Scope: `companies`, `regions`, `branches`, `employees`, `products`. Rationale: e.g. when an employee leaves or a product is removed from the catalog, past sales/shift records must not break. `stock`, `sales`, `sale_items`, `shifts`, `company_features`, `company_branding` are not in scope — these are event records or 1-1 config, not "entities to be deactivated."

**Timestamp fields:** `created_at` on all tables; additionally `updated_at` on tables that can be updated (`companies`, `regions`, `branches`, `employees`, `products`, `stock`, `company_features`, `company_branding`). Immutable event records (`sales`, `sale_items`, `shifts`) do not get `updated_at`.

**Unique constraint / index plan:**
- `products.sku` → UNIQUE (item 15 — uniqueness for barcode/manual lookup).
- `employees (company_id, username)` → composite UNIQUE, `username` alone is not unique (item 16 — username unique within a company).
- `sale_items.sale_id`, `sale_items.product_id` → index (for reporting/co-occurrence JOIN/GROUP BY).
- `sales (branch_id, sale_date)` → composite index (for date-range + branch-based report queries, item 5).
- `shifts (employee_id, shift_date)` → composite index.
- `employees.role` → index (notification targeting, item 14).
- `stock (product_id, branch_id)` is already a composite PK, no extra index needed.
- `employees.username` partial UNIQUE (`WHERE company_id IS NULL`) — caught during code review: the composite `(company_id, username)` constraint doesn't stop two Vendor Manager accounts (where `company_id` is always NULL) from sharing a username, since NULLs are treated as distinct under UNIQUE. A separate partial index closes this gap.

**Check constraints:** `sale_items.quantity > 0` and `sale_items.line_total >= 0` — negative/zero quantity or a negative amount is rejected at the database level (added during code review).

**Shift scope:** The `shifts` table only holds the **planned** shift schedule (the `start_time`/`end_time` assigned by the Operations Chief). Actual clock-in/clock-out (real attendance tracking) is out of scope — the brief does not require it, and it would be a separate feature.

**Column data types:**

| Category | Fields | Type |
|---|---|---|
| Money | `default_price`, `cost_price`, `price_override`, `line_total` | `NUMERIC(10,2)` |
| Quantity | `quantity`, `low_stock_threshold` | `INTEGER` |
| Date (day only) | `best_before_date`, `shift_date` | `DATE` |
| Date+time | `sale_date`, `created_at`, `updated_at` | `TIMESTAMPTZ` (timezone-aware — corrected from plain `TIMESTAMP` during code review, to avoid UTC/local-time ambiguity) |
| Time | `shifts.start_time`, `shifts.end_time` | `TIME` |
| Boolean | `is_day_off`, `is_active`, `enabled` | `BOOLEAN` |
| Short text | `name`, `sku`, `category`, `role`, `username`, `first_name`, `last_name` | `VARCHAR(n)` (n decided during implementation) |
| Free text | `address`, `logo_url` | `TEXT` |
| Number | `age` | `SMALLINT` |

**`manager_pin` security:** Same approach as `password_hash` — not stored in plain text, **hashed** instead; the entered PIN is hashed and compared during verification. Since the PIN is short, rate-limiting against brute-force will be considered during implementation.

**Migration/creation order (per FK dependency graph):**
`companies` → `regions` → `branches` → `employees` → `products` → `stock` → `sales` → `sale_items` → `shifts` → `company_features` → `company_branding`.

---

## 10. Multi-Tenant Architecture

By the end of the project, the system will be designed not for a single customer, but as a product that can be sold to businesses of different scales (large chains like DIMA, small structures like family businesses). The customer does not configure it themselves — the **Vendor Manager** (the platform role of the vendor/project owner) configures and delivers the system according to the customer's needs.

- **Isolation model:** Instead of separate deployments/databases, a **shared schema** will be used — all customers are in the same database, and the existing `branches → regions → companies` hierarchy already serves as the natural tenant boundary via the `companies` table.
- **Query isolation:** The user's `company_id` (and `branch_id`/`region_id` if applicable) is embedded in the JWT token; all queries pass through a common middleware/dependency layer and are automatically filtered by this scope — writing a separate `company_id` filter in every endpoint individually is not relied upon; it is guaranteed at the infrastructure level.
- **Feature flag system:** A new `company_features` table — tracks which modules (layout recommendation, mobile app, central-warehouse scenario, KPI module, etc.) are active for which customer. The vendor marks this from a panel during new-customer onboarding. **Schema finalized (during the SRS Class Diagram):** one row per feature (`company_id, feature_name, enabled`) — adding a new feature does not require a schema change, only new rows are added.
  > **TODO:** How the mobile companion app will be represented via `company_features` (a single "mobile access" feature, or separate features per mobile screen/report) — will be revisited once mobile scope is finalized (see the mobile TODO note at the top of the SRS `stocksense-srs-tr.md`).
- **Role set:** Stays fixed, only toggled on/off per customer — defining a new role type at runtime is not a feature (it can be developed manually later based on feedback). Fixed set: Cashier, Stock Manager, Seller Manager, Branch Manager, Region Manager, General Manager, Operations Chief, Company IT, Vendor Manager — plus five **deputy** roles: Deputy Seller Manager, Deputy Stock Manager, Deputy Branch Manager, Deputy Region Manager, Deputy General Manager. Deputy roles have **exactly the same authority** as their principal (e.g., Deputy Stock Manager ↔ Stock Manager) — there is no separate "acting/delegated status" tracking in the system, both can perform the same actions at any time. Goal: uninterrupted coverage when the principal is on leave/sick.
- **Visual identity:** A new `company_branding` table (logo url, primary color, business name) — a customer-specific theme.

## 11. Stock Source — Branch Stock and Central Warehouse (Item 3 Update)

The decision in item 3 that "supply chain is out of scope" still holds in the sense that **physical logistics** (wholesaler relationships, shipping, etc.) remain out of scope. However, the following scenario will be added to the system: a branch either **(a) uses its own stock** or **(b) requests it from the central warehouse**. This is not a full supply chain/logistics management feature — it is only the representation, in the system, of the two possible stock sources. Details (central warehouse data model, transfer flow) will be clarified during implementation.

## 12. Financial Tracking — Net Profit Margin (Item 9 Schema Update)

A `cost_price` field was added to the `products` table — the existing `default_price` represents the selling price; together with `cost_price`, net profit margin can be calculated. This forms the basis of the KPI reports that allow the business owner to track their finances.

## 13. Shift Management

The Operations Chief manages the shift hours and days off of **all staff** at the branch (whether they have a login or not — including butcher, greengrocer, shelf-stocking staff, excluding managers and their deputies). This was initially excluded from scope (an old note in item 2), and is now included as a real feature.

- Staff without login are represented in the `employees` table by leaving the `username`/`password_hash` fields NULL (see rationale in item 9) — they cannot log into the system, they only have records for shift purposes.
- The `role` field for these people carries a generic "Staff" value — job titles like butcher/greengrocer/shelf-stocker do not matter to the system, they are all treated the same.
- The new `shifts` table (item 9) holds date, start/end time, and day-off information for each staff member.

## 14. Notification Target Principle and Expiry (Best-Before Date) Notification

**General principle:** Role-based notifications (expiry, low stock, etc.) do not go to a fixed account, but to **the most specific/lowest active role that actually holds this authority at that moment**. Because of the role on/off system in item 10, different roles may be active for each customer — in a large chain this goes directly to the Stock Manager, while in a small business without a Stock Manager account, it goes directly to the Branch Manager/owner due to the permission-inheritance chain (item 2). This principle applies both to the expiry notification and to the low-stock notification in item 6.

**Expiry flow:** When a product's expiry date approaches, the notification reaches the target role via the principle above. The Operations Chief (if active at that business) is **always** included in the process as a fixed step — they work together with whoever received the notification on the discount decision and shelf placement. The Operations Chief is not the first party to receive the notification, since they fall outside the inheritance chain (item 2) and thus cannot be a stock/expiry notification target.

The system does not track a product's physical location (warehouse/shelf) with a separate data field — a single `stock.quantity` is considered sufficient; a separate `shelf_stock` table/"move to shelf" action was considered but dropped as unnecessary complexity (YAGNI).

## 15. Barcode Scanning Flow

When the cashier scans a barcode, the system searches via the `products.sku` field — there is no separate `barcode` field; the barcode hardware corresponds one-to-one with the `sku` code (consistent with the `sku` rationale in item 9). When a match is found, the product name, price, and expiry date are shown on the cashier's screen. A discount/shelf decision for a product with an approaching expiry date is not the cashier's job (see item 14) — it is shown on screen purely as information, no action is expected from the cashier. The barcode scanner hardware works as keyboard emulation, no separate hardware integration is required (implementation note).

## 16. Multi-Tenant Login (Company Resolution via Subdomain)

Item 10 states that queries are filtered by the `company_id` in the JWT, but did not define how this `company_id` is determined **at login time**. Decision:

- Each customer logs in from their own **subdomain** (`dima.stocksense.com`) — the subdomain is read from the incoming request's `Host` header and resolved to a `company_id`. Usernames thus become unique **within a company** (the same username in different chains does not collide).
- The login screen opens with that customer's branding (`company_branding`) based on the subdomain — a branded experience even before login (see item 10, UC-23).
- **Security:** Login verifies that the user actually belongs to the company of that subdomain (subdomain→`company_id` + user-company match). Otherwise, a user of Company A cannot attempt to log in through Company B's door.
- The **Vendor Manager**, being above the tenant level, logs in through a separate management gateway (e.g. `admin.stocksense.com`).
- **Demo/delivery:** A real domain/wildcard DNS is not mandatory — since browsers automatically resolve `*.localhost` to `127.0.0.1` (`dima.localhost`, `bakkal.localhost`), multiple tenants can be demonstrated at no cost. Production requires wildcard DNS + wildcard TLS.

## 17. Localization (i18n)

The interface is **bilingual (TR/EN)**. Language is selected on the Login screen; there is no toggle in the top bar within the system, it can be changed from the user menu. On the implementation side, an i18n library (react-i18next) will be used on React. (The requirement is formalized in the SRS NFRs.)

---

## Open Decisions (Not Yet Finalized)

None — all major decisions at the architecture/planning stage have been finalized. Details (e.g., additional fields, indexes, migration order) will be addressed during the implementation phase.
