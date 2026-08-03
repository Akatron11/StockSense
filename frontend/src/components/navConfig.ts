// prototype/*.html'deki rol-bazlı sidebar menülerinden birebir taşındı.
// Kasiyer burada yok — POS ekranı kasıtlı olarak sidebar'sız (ayrı bir layout, Sprint 4'ün ayrı maddesi).
// `label`/`groupLabel` artık literal metin değil, i18n çeviri key'i (src/i18n/locales/*.json "nav" bloğu) —
// AppShell bunları t() ile çözer (madde 17, react-i18next).
export interface NavItemConfig {
  label: string;
  variant?: "go"; // "Kasaya geç" gibi vurgulu/ayrık aksiyon öğeleri için
  path?: string; // henüz ekranı kurulmayan öğelerde yok — o zamana kadar tıklanamaz düz metin kalır
}

export interface NavGroupConfig {
  groupLabel?: string;
  items: NavItemConfig[];
}

export const ROLE_NAV: Record<string, NavGroupConfig[]> = {
  branch_manager: [
    {
      items: [
        { label: "nav.home", path: "/" },
        { label: "nav.salesReports" },
        { label: "nav.profitKpi" },
        { label: "nav.accountManagement", path: "/employees" },
      ],
    },
    {
      groupLabel: "nav.branchOperations",
      items: [
        { label: "nav.stockList" },
        { label: "nav.stockRequest" },
        { label: "nav.priceManagement" },
        { label: "nav.layoutSuggestion" },
      ],
    },
  ],
  // Bölge Müdürü için ayrı bir wireframe yok — Genel Müdür deseni bölge kapsamına ölçeklendirildi (kullanıcı kararı).
  region_manager: [
    {
      items: [
        { label: "nav.home", path: "/" },
        { label: "nav.salesReports" },
        { label: "nav.profitKpi" },
        { label: "nav.accountManagement", path: "/employees" },
      ],
    },
    { groupLabel: "nav.regionDetail", items: [{ label: "nav.stock" }, { label: "nav.price" }, { label: "nav.layout" }] },
  ],
  general_manager: [
    {
      items: [
        { label: "nav.home", path: "/" },
        { label: "nav.productCatalog", path: "/catalog" },
        { label: "nav.salesReports" },
        { label: "nav.profitKpi" },
        { label: "nav.accountManagement", path: "/employees" },
      ],
    },
    {
      groupLabel: "nav.branchRegionDetail",
      items: [{ label: "nav.stock" }, { label: "nav.price" }, { label: "nav.layout" }],
    },
  ],
  stock_manager: [{ items: [{ label: "nav.stockList", path: "/" }, { label: "nav.stockRequest", path: "/stock-request" }] }],
  seller_manager: [
    {
      items: [
        { label: "nav.home", path: "/" },
        { label: "nav.priceManagement", path: "/price" },
        { label: "nav.salesReports" },
        { label: "nav.layoutSuggestion" },
      ],
    },
  ],
  operations_chief: [
    {
      items: [
        { label: "nav.home", path: "/" },
        { label: "nav.shiftCalendar", path: "/shifts" },
        { label: "nav.staffRecords", path: "/staff" },
        { label: "nav.goToRegister", path: "/pos", variant: "go" },
      ],
    },
  ],
  company_it: [{ items: [{ label: "nav.accountOverride" }, { label: "nav.newTopAccount", path: "/employees" }] }],
  // "Feature / rol config" ve "Branding" ayrı ekranlar değil — "Müşteriler" listesindeki "Yönet"
  // modalına gömülü (kullanıcı kararı, 2026-08-03, wireframe'e uygun). Day-0 (UC-17) kapsam dışı.
  vendor_manager: [
    {
      items: [
        { label: "nav.customers", path: "/" },
        { label: "nav.day0Setup" },
        { label: "nav.featureRoleConfig" },
        { label: "nav.branding" },
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
