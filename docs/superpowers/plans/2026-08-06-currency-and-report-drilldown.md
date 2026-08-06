# TL Para Birimi + Satış Raporu Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tüm fiyat gösterimlerine ₺ eklemek; `region_manager`/`general_manager`'ın `/reports` sayfasında bölge/şube bazında breadcrumb ile detaya inebilmesini sağlamak.

**Architecture:** Para birimi için tek bir paylaşılan `formatCurrency()` yardımcı fonksiyonu, 24 kullanım yerine uygulanır. Drill-down için backend'de hiçbir değişiklik yok (zaten `branch_id`/`region_id` destekliyor) — sadece `api/reports.ts` bu param'ları geçirecek şekilde genişler, `ReportsDetailPage.tsx`'e local state (`drillPath`) ile breadcrumb + tıklanabilir kırılım tablosu eklenir.

**Tech Stack:** React 19 + TypeScript, react-i18next.

**Kaynak spec:** `docs/superpowers/specs/2026-08-06-currency-and-report-drilldown-design.md`

## Global Constraints

- Bu projede otomatik test suite yok — doğrulama `tsc -b --noEmit` + tarayıcıda uçtan uca manuel.
- ₺ sembolü sayıdan **önce** (`₺45.90`), sadece gerçek para tutarlarına uygulanır — `adet` sayıları ve
  `%` yüzdeleri kapsam dışı.
- Drill-down UI'ı sadece `region_manager`/`general_manager` rollerinde render edilir.
- Backend'e (`backend/`) bu planda **hiç dokunulmuyor**.

---

### Task 1: `formatCurrency` yardımcı fonksiyonu + tüm kullanım yerlerine uygulanması

**Files:**
- Create: `frontend/src/utils/currency.ts`
- Modify: `frontend/src/pages/BranchManagerDashboard.tsx`
- Modify: `frontend/src/pages/GeneralManagerDashboard.tsx`
- Modify: `frontend/src/pages/SellerManagerDashboard.tsx`
- Modify: `frontend/src/pages/ReportsDetailPage.tsx`
- Modify: `frontend/src/pages/PriceManagementPage.tsx`
- Modify: `frontend/src/pages/ProductCatalogPage.tsx`
- Modify: `frontend/src/pages/StockManagerDashboard.tsx`
- Modify: `frontend/src/pages/CashierPos.tsx`
- Modify: `frontend/src/components/SalesTrendChart.tsx`

**Interfaces:**
- Produces: `formatCurrency(amount: number): string` — döndürür `` `₺${amount.toFixed(2)}` ``.

- [ ] **Step 1: Yardımcı fonksiyonu yaz**

`frontend/src/utils/currency.ts`:

```typescript
export function formatCurrency(amount: number): string {
  return `₺${amount.toFixed(2)}`;
}
```

- [ ] **Step 2: `BranchManagerDashboard.tsx` — 2 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{report.total_sales.toFixed(2)}` → `{formatCurrency(report.total_sales)}`
- `{p.quantity} adet · {p.revenue.toFixed(2)}` → `{p.quantity} adet · {formatCurrency(p.revenue)}`

- [ ] **Step 3: `GeneralManagerDashboard.tsx` — 2 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{report.total_sales.toFixed(2)}` → `{formatCurrency(report.total_sales)}`
- `{b.total_sales.toFixed(2)}` → `{formatCurrency(b.total_sales)}`

- [ ] **Step 4: `SellerManagerDashboard.tsx` — 1 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{report.total_sales.toFixed(2)}` → `{formatCurrency(report.total_sales)}`

- [ ] **Step 5: `ReportsDetailPage.tsx` — 3 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir (iki tanesi `top_products`/`least_selling` listelerinde birebir aynı satır, ikisini de değiştir):
- `{report.total_sales.toFixed(2)}` → `{formatCurrency(report.total_sales)}`
- `{p.quantity} adet · {p.revenue.toFixed(2)}` (iki yerde) → `{p.quantity} adet · {formatCurrency(p.revenue)}`

(Bu dosyada Task 3'te de değişiklik olacak — o task'ı bu task'tan SONRA çalıştır, çakışma olmaması için.)

- [ ] **Step 6: `PriceManagementPage.tsx` — 4 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{row.default_price.toFixed(2)}` → `{formatCurrency(row.default_price)}`
- `{row.price_override !== null ? row.price_override.toFixed(2) : ...}` → `{row.price_override !== null ? formatCurrency(row.price_override) : ...}`
- `{row.effective_price.toFixed(2)}` → `{formatCurrency(row.effective_price)}`
- `{editing?.default_price.toFixed(2)}` → `{editing?.default_price !== undefined ? formatCurrency(editing.default_price) : ""}` (orijinal optional-chaining davranışını koru — `editing` `undefined`/`null` ise boş string dönsün, `formatCurrency(undefined)` çağrılmasın)

- [ ] **Step 7: `ProductCatalogPage.tsx` — 2 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{product.default_price.toFixed(2)}` → `{formatCurrency(product.default_price)}`
- `{product.cost_price !== null && product.cost_price !== undefined ? product.cost_price.toFixed(2) : "—"}` → `{product.cost_price !== null && product.cost_price !== undefined ? formatCurrency(product.cost_price) : "—"}`

- [ ] **Step 8: `StockManagerDashboard.tsx` — 1 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `{item.effective_price.toFixed(2)}` → `{formatCurrency(item.effective_price)}`

- [ ] **Step 9: `CashierPos.tsx` — 8 kullanım**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir (dosyayı önce okuyup her satırın tam bağlamını doğrula, satır numaraları değişmiş olabilir):
- `{product.default_price.toFixed(2)}` → `{formatCurrency(product.default_price)}`
- `{line.product.default_price.toFixed(2)}` → `{formatCurrency(line.product.default_price)}`
- `{(line.product.default_price * line.quantity).toFixed(2)}` → `{formatCurrency(line.product.default_price * line.quantity)}`
- `{subtotal.toFixed(2)}` (3 farklı yerde aynı satır) → `{formatCurrency(subtotal)}`
- `{t("pos.lastSaleCompleted", { total: lastSaleTotal.toFixed(2) })}` → `{t("pos.lastSaleCompleted", { total: formatCurrency(lastSaleTotal) })}`
- `{sale.total.toFixed(2)} · {...}` → `{formatCurrency(sale.total)} · {...}`

- [ ] **Step 10: `SalesTrendChart.tsx` — 1 kullanım (tooltip)**

`import { formatCurrency } from "../utils/currency";` ekle. Değiştir:
- `` title={`${point.day}: ${point.total_sales.toFixed(2)}`} `` → `` title={`${point.day}: ${formatCurrency(point.total_sales)}`} ``

- [ ] **Step 11: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

Beklenen: temiz, hata yok.

- [ ] **Step 12: Tarayıcıda hızlı görsel kontrol**

Backend+frontend çalışıyorsa (`http://testco.localhost:5173`), `branchmgr1` ile `/reports`'a git, "Toplam satış" kartında `₺` görünmeli. `cashier1` ile POS ekranına git, sepet toplamında `₺` görünmeli.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/utils/currency.ts frontend/src/pages/BranchManagerDashboard.tsx frontend/src/pages/GeneralManagerDashboard.tsx frontend/src/pages/SellerManagerDashboard.tsx frontend/src/pages/ReportsDetailPage.tsx frontend/src/pages/PriceManagementPage.tsx frontend/src/pages/ProductCatalogPage.tsx frontend/src/pages/StockManagerDashboard.tsx frontend/src/pages/CashierPos.tsx frontend/src/components/SalesTrendChart.tsx
git commit -m "feat: add TL (₺) currency formatting across all price displays"
```

---

### Task 2: `api/reports.ts` — `branch_id`/`region_id` param desteği

**Files:**
- Modify: `frontend/src/api/reports.ts`

**Interfaces:**
- Produces: `getSalesReport(token: string, days: 7|30|90, branchId?: number, regionId?: number): Promise<SalesReportOut>`.

- [ ] **Step 1: Fonksiyonu güncelle**

`frontend/src/api/reports.ts`:

```typescript
import { authFetch } from "./client";
import type { SalesReportOut } from "../types/report";

export function getSalesReport(
  token: string,
  days: 7 | 30 | 90,
  branchId?: number,
  regionId?: number,
): Promise<SalesReportOut> {
  const params = new URLSearchParams({ days: String(days) });
  if (branchId !== undefined) params.set("branch_id", String(branchId));
  if (regionId !== undefined) params.set("region_id", String(regionId));
  return authFetch<SalesReportOut>(token, `/api/reports/sales?${params.toString()}`);
}
```

- [ ] **Step 2: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

(Bu noktada `BranchManagerDashboard.tsx`/`GeneralManagerDashboard.tsx`/`SellerManagerDashboard.tsx` gibi mevcut çağıranlar `getSalesReport(token, days)` şeklinde 2 argümanla çağırmaya devam ediyor — yeni parametreler opsiyonel olduğu için bunlar bozulmamalı, derleme temiz kalmalı.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/reports.ts
git commit -m "feat: add optional branch_id/region_id params to getSalesReport"
```

---

### Task 3: `ReportsDetailPage.tsx` — breadcrumb + tıklanabilir kırılım tablosu

**Files:**
- Modify: `frontend/src/pages/ReportsDetailPage.tsx`

**Interfaces:**
- Consumes: `getSalesReport` (Task 2'de genişletildi), `user.role` (`useAuth()`), `report.breakdown`/
  `report.scope`/`report.scope_label` (mevcut `SalesReportOut` tipi, değişmedi).

- [ ] **Step 1: Sayfayı güncelle**

`frontend/src/pages/ReportsDetailPage.tsx` — dosyanın tamamını şu hale getir (Task 1'in bu dosyadaki
`formatCurrency` değişiklikleri zaten uygulanmış olmalı, bu adım onun üzerine ekleme yapıyor):

```typescript
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import { formatCurrency } from "../utils/currency";
import type { SalesReportOut } from "../types/report";

interface DrillStep {
  id: number;
  label: string;
}

const DRILLABLE_ROLES = new Set(["region_manager", "general_manager"]);

// UC-14 (en çok/az/hiç satılmayan) + UC-13/16 (satış raporu/kâr marjı) tek bir detay sayfasında.
// "Satış raporları" ve "Kâr marjı / KPI" nav öğeleri ikisi de bu sayfaya gider (aynı veri, tek kaynak
// — kullanıcı kararı, bkz. docs/superpowers/specs/2026-08-06-uc14-reports-detail-page-design.md).
// Ana Sayfa dashboard'larındaki top-5/trend kartlarının tekrarı değil, ayrı bir detay sayfası.
// Drill-down (region_manager/general_manager): backend zaten branch_id/region_id destekliyor
// (bkz. docs/superpowers/specs/2026-08-06-currency-and-report-drilldown-design.md) — bu sayfa sadece
// breadcrumb + tıklanabilir kırılım tablosuyla bunu kullanıyor, backend'e dokunulmadı.
export function ReportsDetailPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const canDrill = user ? DRILLABLE_ROLES.has(user.role) : false;

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [drillPath, setDrillPath] = useState<DrillStep[]>([]);
  const [rootLabel, setRootLabel] = useState<string>("");
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const isGeneralManager = user?.role === "general_manager";

    // Sadece EN ÜST seviyedeyken (drillPath boş) region_id'ye gerek yok — general_manager şirket
    // geneli, region_manager kendi bölgesi (backend zaten claims'ten çözüyor). Bir seviye indiğinde
    // (drillPath.length === 1): general_manager için bu bir region_id, region_manager için bu bir
    // branch_id (region_manager'ın altında sadece şube var, bölge yok). İki seviye indiğinde
    // (drillPath.length === 2, sadece general_manager): bu her zaman bir branch_id.
    let effectiveBranchId: number | undefined;
    let effectiveRegionId: number | undefined;
    if (drillPath.length === 1) {
      if (isGeneralManager) {
        effectiveRegionId = drillPath[0].id;
      } else {
        effectiveBranchId = drillPath[0].id;
      }
    } else if (drillPath.length === 2) {
      effectiveBranchId = drillPath[1].id;
    }

    getSalesReport(token, days, effectiveBranchId, effectiveRegionId)
      .then((data) => {
        setReport(data);
        if (drillPath.length === 0) setRootLabel(data.scope_label);
      })
      .catch(() => setError(t("reports.reportLoadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days, drillPath]);

  function handleBreakdownClick(id: number, label: string) {
    setDrillPath((prev) => [...prev, { id, label }]);
  }

  function handleBreadcrumbClick(index: number) {
    // index === -1 -> köke dön (drillPath tamamen boşalır); index >= 0 -> o noktaya kadar kes
    setDrillPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  return (
    <AppShell pageTitle={t("nav.salesReports")}>
      <div className="toolbar">
        <div className="scope">
          {canDrill && rootLabel ? (
            <span className="breadcrumb">
              <button className="breadcrumb-link" onClick={() => handleBreadcrumbClick(-1)}>
                {rootLabel}
              </button>
              {drillPath.map((step, idx) => (
                <span key={step.id}>
                  {" › "}
                  <button className="breadcrumb-link" onClick={() => handleBreadcrumbClick(idx)}>
                    {step.label}
                  </button>
                </span>
              ))}
            </span>
          ) : (
            t("reports.scope", { label: report?.scope_label ?? t("reports.defaultScope") })
          )}
        </div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">{t("common.loading")}</div>
      ) : (
        <>
          <section className={`cards${report.profit_margin_pct === null ? " c3" : ""}`}>
            <div className="card">
              <div className="lbl">{t("reports.totalSales")}</div>
              <div className="page-title">{formatCurrency(report.total_sales)}</div>
            </div>
            {report.profit_margin_pct !== null && (
              <div className="card">
                <div className="lbl">{t("reports.netMargin")}</div>
                <div className="page-title">%{report.profit_margin_pct.toFixed(1)}</div>
                {report.cost_data_coverage_pct < 100 && (
                  <div className="muted-small">{t("reports.costCoverage", { pct: report.cost_data_coverage_pct.toFixed(0) })}</div>
                )}
              </div>
            )}
            <div className="card">
              <div className="lbl">{t("reports.lowStock")}</div>
              <div className="page-title">{report.low_stock_count}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.transactions")}</div>
              <div className="page-title">{report.transaction_count}</div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              {t("reports.salesTrend")} <span className="hint">{t("reports.netSalesLast", { days: report.days })}</span>
            </div>
            <div className="panel-body">
              <SalesTrendChart trend={report.trend} />
            </div>
          </section>

          {canDrill && report.breakdown.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                {t("reports.breakdownTitle", { label: report.scope === "company" ? t("reports.region") : t("reports.branch") })}
              </div>
              <div className="panel-body">
                <div className="thead" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                  <span>{report.scope === "company" ? t("reports.region") : t("reports.branch")}</span>
                  <span>{t("reports.sales")}</span>
                  <span>{t("reports.margin")}</span>
                </div>
                {report.breakdown.map((b) => (
                  <button
                    key={b.id}
                    className="trow trow-clickable"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
                    onClick={() => handleBreakdownClick(b.id, b.label)}
                  >
                    <span>{b.label}</span>
                    <span>{formatCurrency(b.total_sales)}</span>
                    <span>{b.profit_margin_pct !== null ? `%${b.profit_margin_pct.toFixed(1)}` : "—"}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="grid2">
            <div className="panel">
              <div className="panel-head">{t("reports.topProducts")}</div>
              <div className="panel-body">
                {report.top_products.length === 0 && <div className="muted-small">{t("reports.noSalesInRange")}</div>}
                {report.top_products.map((p, idx) => (
                  <div className="item" key={p.product_id}>
                    <span className="rank">{idx + 1}</span>
                    <div className="txt">
                      <span>{p.product_name}</span>
                      <span className="muted-small">{p.quantity} adet · {formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">{t("reports.leastSelling")}</div>
              <div className="panel-body">
                {report.least_selling.length === 0 && <div className="muted-small">{t("reports.noSalesInRange")}</div>}
                {report.least_selling.map((p, idx) => (
                  <div className="item" key={p.product_id}>
                    <span className="rank">{idx + 1}</span>
                    <div className="txt">
                      <span>{p.product_name}</span>
                      <span className="muted-small">{p.quantity} adet · {formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">{t("reports.neverSold")}</div>
            <div className="panel-body">
              {report.never_sold.length === 0 && <div className="muted-small">{t("reports.noNeverSoldInRange")}</div>}
              {report.never_sold.map((p) => (
                <div className="item" key={p.product_id}>
                  <span className="txt">{p.product_name}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 2: `.trow-clickable` / `.breadcrumb` / `.breadcrumb-link` CSS'ini ekle**

`frontend/src/styles/app.css` — dosyanın sonuna ekle (mevcut `.trow`/`.scope` kurallarının stilini bozmadan,
sadece tıklanabilirlik için gerekli minimum ekleme):

```css
.trow-clickable{background:none;border:none;font:inherit;color:inherit;text-align:left;cursor:pointer;width:100%;}
.trow-clickable:hover{background:var(--hover, rgba(0,0,0,0.03));}
.breadcrumb-link{background:none;border:none;font:inherit;color:inherit;cursor:pointer;padding:0;text-decoration:underline;}
.breadcrumb-link:hover{opacity:0.7;}
```

(Önce dosyayı okuyup mevcut `.trow`/`.scope` kurallarının tam CSS söz dizimini/değişken adlarını (`--hover`
gibi bir custom property zaten var mı) doğrula, yoksa `rgba(0,0,0,0.03)` gibi düz bir değer kullan.)

- [ ] **Step 3: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReportsDetailPage.tsx frontend/src/styles/app.css
git commit -m "feat: add breadcrumb drill-down to reports page for region/general manager"
```

---

### Task 4: Uçtan uca tarayıcı doğrulaması

**Files:** (kod değişikliği yok)

- [ ] **Step 1: Backend + frontend'i başlat (backend'de kod değişikliği yok ama frontend build'i temiz
  olmalı)**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: `regionmgr1` ile drill-down testi**

Giriş yap, `/reports`'a git. Beklenen: breadcrumb'da tek segment (kendi bölgesi, örn. "Marmara"), altında
kırılım tablosu (şubeler). Bir şubeye tıkla — breadcrumb "Marmara › Kadıköy Şube" olmalı, rapor o şubenin
verisine göre güncellenmeli (breakdown artık boş/gizli — leaf seviye). Breadcrumb'da "Marmara"ya tıkla —
geri dönmeli.

- [ ] **Step 3: `genmgr1` ile üç seviyeli drill-down testi**

Giriş yap, `/reports`'a git. Beklenen: breadcrumb "Şirket geneli", kırılım tablosu (bölgeler). Bir bölgeye
tıkla — breadcrumb "Şirket geneli › Marmara", kırılım artık o bölgenin şubeleri. Bir şubeye tıkla —
breadcrumb "Şirket geneli › Marmara › Kadıköy Şube", breakdown gizlenmeli (leaf). Her breadcrumb
segmentine tıklayıp doğru seviyeye döndüğünü doğrula.

- [ ] **Step 4: `branchmgr1`/`sellermgr1` regresyonu**

Her ikisiyle de `/reports`'a git — breadcrumb/kırılım bölümü hiç görünmemeli (eskisi gibi düz `Kapsam:
...` metni), sayfa hatasız yükleniyor olmalı.

- [ ] **Step 5: TL gösterimi genel kontrol**

`branchmgr1` ile `/reports`, `cashier1` ile `/pos`, `general_manager` ile `/catalog` ve `seller_manager`
ile `/price` sayfalarını gezip her yerde `₺` göründüğünü doğrula.

- [ ] **Step 6: Konsol kontrolü**

Tüm oturumlarda tarayıcı konsolunda hata olmadığını doğrula.

- [ ] **Step 7: PROCESS.md'yi kullanıcıyla birlikte güncelle**

Bu planın tamamlandığını PROCESS.md'ye işle (kullanıcı onayı gerekir, CLAUDE.md kuralı).
