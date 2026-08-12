// Sidebar nav ikonları — bildirim zili ikonuyla (AppShell.tsx) aynı stil: elle çizilmiş, stroke tabanlı
// inline SVG, dış paket/ikon kütüphanesi eklenmedi (PROCESS.md, Faz 2 kararı).
import type { ReactElement, SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  width: 15,
  height: 15,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export type IconName =
  | "home"
  | "reports"
  | "accounts"
  | "stock"
  | "stockRequest"
  | "price"
  | "layout"
  | "catalog"
  | "calendar"
  | "goToRegister"
  | "override"
  | "newAccount"
  | "setup"
  | "featureConfig"
  | "branding"
  | "logout"
  | "language"
  | "currency";

const PATHS: Record<IconName, ReactElement> = {
  home: (
    <svg {...base}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  reports: (
    <svg {...base}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </svg>
  ),
  accounts: (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5c1.7.3 3 1.8 3 3.5s-1.3 3.2-3 3.5" />
      <path d="M18 14c2 .5 3.5 2.4 3.5 4.6" />
    </svg>
  ),
  stock: (
    <svg {...base}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  ),
  stockRequest: (
    <svg {...base}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
      <path d="M18 2v5" />
      <path d="M15.5 4.5h5" />
    </svg>
  ),
  price: (
    <svg {...base}>
      <path d="M20 12l-8 8-9-9V3h8l9 9z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  layout: (
    <svg {...base}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  catalog: (
    <svg {...base}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
      <circle cx="4" cy="5" r="0" />
    </svg>
  ),
  calendar: (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  ),
  goToRegister: (
    <svg {...base}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  ),
  override: (
    <svg {...base}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M17 6l3 3" />
      <path d="M14 9l2 2" />
    </svg>
  ),
  newAccount: (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6" />
      <path d="M15 11h6" />
    </svg>
  ),
  setup: (
    <svg {...base}>
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4z" />
    </svg>
  ),
  featureConfig: (
    <svg {...base}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="18" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  branding: (
    <svg {...base}>
      <path d="M12 22c4-3 7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 3 8 7 11z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  ),
  logout: (
    <svg {...base}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  language: (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  currency: (
    <svg {...base}>
      <path d="M4 8h13" />
      <path d="M13 4l4 4-4 4" />
      <path d="M20 16H7" />
      <path d="M11 12l-4 4 4 4" />
    </svg>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return PATHS[name];
}
