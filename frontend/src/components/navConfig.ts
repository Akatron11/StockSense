// prototype/*.html'deki rol-bazlı sidebar menülerinden birebir taşındı.
// Kasiyer burada yok — POS ekranı kasıtlı olarak sidebar'sız (ayrı bir layout, Sprint 4'ün ayrı maddesi).
// `label`/`groupLabel` artık literal metin değil, i18n çeviri key'i (src/i18n/locales/*.json "nav" bloğu) —
// AppShell bunları t() ile çözer (madde 17, react-i18next).
import type { IconName } from "./icons";

export interface NavItemConfig {
  label: string;
  variant?: "go"; // "Kasaya geç" gibi vurgulu/ayrık aksiyon öğeleri için
  path?: string; // henüz ekranı kurulmayan öğelerde yok — o zamana kadar tıklanamaz düz metin kalır
  icon: IconName;
}

export interface NavGroupConfig {
  groupLabel?: string;
  items: NavItemConfig[];
}

export const ROLE_NAV: Record<string, NavGroupConfig[]> = {
  branch_manager: [
    {
      items: [
        { label: "nav.home", path: "/", icon: "home" },
        { label: "nav.salesReportsKpi", path: "/reports", icon: "reports" },
        { label: "nav.accountManagement", path: "/employees", icon: "accounts" },
      ],
    },
    {
      groupLabel: "nav.branchOperations",
      items: [
        { label: "nav.stockList", path: "/stock", icon: "stock" },
        { label: "nav.stockRequest", icon: "stockRequest" },
        { label: "nav.priceManagement", path: "/price", icon: "price" },
      ],
    },
  ],
  // Bölge Müdürü için ayrı bir wireframe yok — Genel Müdür deseni bölge kapsamına ölçeklendirildi (kullanıcı kararı).
  region_manager: [
    {
      items: [
        { label: "nav.home", path: "/", icon: "home" },
        { label: "nav.salesReportsKpi", path: "/reports", icon: "reports" },
        { label: "nav.accountManagement", path: "/employees", icon: "accounts" },
      ],
    },
    {
      groupLabel: "nav.regionDetail",
      items: [
        { label: "nav.stock", path: "/stock", icon: "stock" },
        { label: "nav.price", path: "/price", icon: "price" },
      ],
    },
  ],
  general_manager: [
    {
      items: [
        { label: "nav.home", path: "/", icon: "home" },
        { label: "nav.productCatalog", path: "/catalog", icon: "catalog" },
        { label: "nav.salesReportsKpi", path: "/reports", icon: "reports" },
        { label: "nav.accountManagement", path: "/employees", icon: "accounts" },
      ],
    },
    {
      groupLabel: "nav.branchRegionDetail",
      items: [
        { label: "nav.stock", path: "/stock", icon: "stock" },
        { label: "nav.price", path: "/price", icon: "price" },
      ],
    },
  ],
  stock_manager: [
    {
      items: [
        { label: "nav.stockList", path: "/", icon: "stock" },
        { label: "nav.stockRequest", path: "/stock-request", icon: "stockRequest" },
        { label: "nav.stockAreaLayout", path: "/stock-layout", icon: "layout" },
      ],
    },
  ],
  seller_manager: [
    {
      items: [
        { label: "nav.home", path: "/", icon: "home" },
        { label: "nav.priceManagement", path: "/price", icon: "price" },
        { label: "nav.salesReports", path: "/reports", icon: "reports" },
        { label: "nav.layoutSuggestion", path: "/layout", icon: "layout" },
      ],
    },
  ],
  operations_chief: [
    {
      items: [
        { label: "nav.home", path: "/", icon: "home" },
        { label: "nav.shiftCalendar", path: "/shifts", icon: "calendar" },
        { label: "nav.staffRecords", path: "/staff", icon: "accounts" },
        { label: "nav.goToRegister", path: "/pos", variant: "go", icon: "goToRegister" },
      ],
    },
  ],
  company_it: [
    {
      items: [
        { label: "nav.accountOverride", path: "/account-override", icon: "override" },
        { label: "nav.newTopAccount", path: "/employees", icon: "newAccount" },
      ],
    },
  ],
  // "Feature / rol config" ve "Branding" ayrı ekranlar değil — "Müşteriler" listesindeki "Yönet"
  // modalına gömülü (kullanıcı kararı, 2026-08-03, wireframe'e uygun). Day-0 (UC-17) kapsam dışı.
  vendor_manager: [
    {
      items: [
        { label: "nav.customers", path: "/", icon: "accounts" },
        { label: "nav.day0Setup", path: "/day0-setup", icon: "setup" },
        { label: "nav.featureRoleConfig", icon: "featureConfig" },
        { label: "nav.branding", icon: "branding" },
      ],
    },
  ],
};

export function navForRole(role: string): NavGroupConfig[] {
  return ROLE_NAV[role] ?? [];
}

// Her rolün "ana sayfası" farklı bir nav öğesine karşılık gelir (stock_manager için "Stok listesi",
// company_it için "Hesap override" vb.) — o rolün ilk nav öğesi kabul edilir. Dönen değer bir i18n
// key'idir, çağıran taraf t() ile çözmeli.
export function homeLabelForRole(role: string): string {
  return ROLE_NAV[role]?.[0]?.items[0]?.label ?? "";
}
