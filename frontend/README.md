# StockSense — Frontend

React 19 + TypeScript + Vite web app covering every role except the mobile-only manager views
(see [`../mobile`](../mobile)). For project-wide setup (database, backend, seed data, demo
credentials, subdomain routing) see the [root README](../README.md).

## Commands

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint       # oxlint
npm run preview   # preview a production build locally
```

## Notes

- **Subdomain-scoped API calls:** the API base URL is derived from `window.location.hostname`
  (`api/client.ts`) — the app must be opened via `<subdomain>.localhost:5173`, not plain
  `localhost:5173` (see root README, "Multi-tenant access").
- **i18n:** TR/EN strings live in `src/i18n/locales/{tr,en}.json`, loaded via `react-i18next`.
  Product/category names and other business data are intentionally not translated.
- **Source layout:** `pages/` (one per route/dashboard), `components/` (shared UI incl.
  `navConfig.ts` for the role-based sidebar), `api/` (one file per backend router), `types/`,
  `auth/` (JWT context, role labels), `theme/` (per-tenant brand color injection), `styles/`.
