# StockSense

Multi-tenant stock control POS & store remodeling recommender.

A university course project. The brief (`documents/topic.pdf`) originally scoped a single
small store; the instructor's directive expanded it into a product scalable to general
businesses — multi-tenant (company → region → branch), role-based access, a POS with
sales/returns, low-stock and expiry notifications, a co-occurrence/Apriori shelf-layout
recommender, and a read-only mobile companion app.

## Stack

- **Backend:** FastAPI + PostgreSQL (SQLAlchemy 2.0, Alembic migrations)
- **Frontend:** React 19 + TypeScript + Vite
- **Mobile:** Expo / React Native (read-only companion app for manager roles)

## Documentation

The authoritative, code-verified reference docs live in [`documents/`](documents/):

- [`stocksense-architecture.md`](documents/stocksense-architecture.md) — architectural decisions (multi-tenancy, role hierarchy, data model, feature flags).
- [`stocksense-srs.md`](documents/stocksense-srs.md) — SRS: use cases, functional/non-functional requirements, class/use-case diagrams.
- [`stocksense-api.md`](documents/stocksense-api.md) — API reference, regenerated directly from the router/schema source.
- [`stocksense-market-research-en.md`](documents/stocksense-market-research-en.md) — market research.
- [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — full table-by-table schema reference.

## Setup

### 1. Database

```bash
docker compose up -d
```

Starts Postgres 16 on `localhost:5432` (`stocksense`/`stocksense`/`stocksense` — local dev only).

### 2. Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env   # fill in a real JWT_SECRET_KEY; DATABASE_URL only needed if not using the default above
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

`.env` is loaded automatically (`python-dotenv`) and is gitignored. Without it, both `JWT_SECRET_KEY`
and `DATABASE_URL` fall back to hardcoded local-dev defaults (see `backend/app/security.py`,
`backend/app/database.py`) — fine for local dev, not for anything beyond it.

### 3. Seed data

Run from `backend/`, after the database is migrated:

```bash
python seed_test_data.py        # single-tenant dev/test company ("testco")
python seed_sales_data.py       # adds analytics-friendly sales patterns to testco
python generate_demo_dataset.py # multi-tenant presentation dataset (MegaMarket + Şen Market)
```

Each script is idempotent — re-running it deletes and recreates its own company/data.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` by default.

### 5. Mobile (optional)

```bash
cd mobile
npm install
npx expo start
```

See [`mobile/AGENTS.md`](mobile/AGENTS.md) for Expo SDK version notes.

## Multi-tenant access (subdomain routing)

The tenant is resolved from the subdomain (`Host` header on the backend, `window.location.hostname`
on the frontend) — every company must be reached via `<subdomain>.localhost`, plain `localhost`
resolves to no tenant. For example:

- `http://testco.localhost:5173` — the single-tenant dev/test company
- `http://megamarket.localhost:5173`, `http://senmarket.localhost:5173` — the multi-tenant demo companies
- `http://admin.localhost:5173` — reserved subdomain for the Vendor Manager (platform admin, not tied to a company)

## Demo credentials

**testco** (Turkish dev/test tenant, `seed_test_data.py`) — password `Test1234!`, PIN `1234` for
PIN-approver roles (stock/seller manager, operations chief):

| Role | Username |
|---|---|
| Cashier | `cashier1` / `cashier2` |
| Stock Manager | `stockmgr1` / `stockmgr2` |
| Seller Manager | `sellermgr1` / `sellermgr2` |
| Operations Chief | `opschief1` |
| Branch Manager | `branchmgr1` |
| Region Manager | `regionmgr1` |
| General Manager | `genmgr1` |
| Company IT | `companyit1` |
| Vendor Manager | `vendormgr1` (via `admin` subdomain) |

**MegaMarket / Şen Market** (English presentation tenants, `generate_demo_dataset.py`) — password
`Demo1234!`, PIN `1234`. Usernames follow the same role-prefix convention, numbered per
branch/region (`cashier1`, `branchmgr1`, `stockmgr1`, ...) — see `backend/demo_data/org.py` for
the full generated roster.

## Project structure

```
backend/    FastAPI app, Alembic migrations, seed/demo data scripts
frontend/   React + TypeScript web app (all roles except mobile-only views)
mobile/     Expo/React Native companion app (read-only, manager roles)
documents/  Repo-tracked, code-verified reference docs (English)
prototype/  Static HTML wireframes used during design
```
