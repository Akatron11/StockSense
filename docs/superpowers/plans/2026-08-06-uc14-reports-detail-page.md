# UC-14 Tamamlama + Satış Raporları/KPI Detay Sayfası Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UC-14'ün eksik kalan kısmını (en az satan + hiç satılmayan ürün) tamamlamak ve "Satış raporları"/"Kâr marjı / KPI" nav öğelerini gerçek bir detay sayfasına bağlamak; ayrıca artık yanlış bilgi veren eski "Layout önerisi — kapsam dışı" panelini Ana Sayfa'dan kaldırmak.

**Architecture:** `GET /api/reports/sales` response'u iki yeni alanla (`least_selling`, `never_sold`) genişler — ek DB sorgusu sadece `never_sold` için gerekiyor (top/least zaten var olan `item_rows` agregasyonundan türetiliyor). Yeni bir `ReportsDetailPage.tsx`, dört rolün ("Satış raporları"/"Kâr marjı / KPI" nav öğeleri olan) ortak kullandığı tek bir `/reports` route'una bağlanıyor.

**Tech Stack:** FastAPI, SQLAlchemy, React 19 + TypeScript, react-i18next.

**Kaynak spec:** `docs/superpowers/specs/2026-08-06-uc14-reports-detail-page-design.md`

## Global Constraints

- Bu projede otomatik test suite yok — doğrulama curl/Swagger + tarayıcı ile manuel yapılır.
- "Hiç satılmayan" hesaplaması **seçili tarih aralığı içinde** değerlendirilir (tüm-zamanlar değil) —
  endpoint'in geri kalanıyla (days/start/end) tutarlı.
- "En az satan" ve "hiç satılmayan" tüm rollere (branch/region/general/seller_manager) gösterilir — kâr
  marjı görünürlüğünden (`can_see_margin`) bağımsız.
- Ana Sayfa dashboard'ları (`BranchManagerDashboard`, `GeneralManagerDashboard`) bu planda **değişmiyor**
  — sadece `SellerManagerDashboard`'daki eski layout paneli kaldırılıyor.
- Region/General Manager'ın Ana Sayfa'daki şube/bölge kırılım tablosu yeni `/reports` sayfasına
  taşınmıyor (kullanıcı kararı, ayrıca ele alınacak).

---

### Task 1: Backend — `least_selling` + `never_sold` alanları

**Files:**
- Modify: `backend/app/schemas/report.py`
- Modify: `backend/app/routers/reports.py`

**Interfaces:**
- Produces: `SalesReportOut.least_selling: list[TopProductItem]`, `SalesReportOut.never_sold:
  list[NeverSoldItem]` (yeni schema).

- [ ] **Step 1: Şemaya yeni alanları ekle**

`backend/app/schemas/report.py` — `BreakdownItem` sınıfının hemen altına, `SalesReportOut`'tan önce ekle:

```python
class NeverSoldItem(BaseModel):
    product_id: int
    product_name: str
```

`SalesReportOut`'a şu iki alanı ekle (`breakdown` alanının hemen altına):

```python
    least_selling: list[TopProductItem]
    never_sold: list[NeverSoldItem]
```

- [ ] **Step 2: Router'da hesaplamayı ekle**

`backend/app/routers/reports.py` — dosyanın başındaki import satırına `Product` zaten var, `Stock`'u da
ekle (zaten import ediliyor, satır 10'a bak — `from ..models import Branch, Product, Region, Sale,
SaleItem, Return, Stock` — değişiklik gerekmiyorsa atla).

`schemas.report` import satırına `NeverSoldItem` ekle:

```python
from ..schemas.report import BreakdownItem, NeverSoldItem, SalesReportOut, SalesTrendPoint, TopProductItem
```

`top_products` hesaplandığı yerin (`reports.py:157-161`, `top_products = sorted(...)[:5]`) hemen
altına ekle:

```python
    least_selling = sorted(
        (TopProductItem(product_id=pid, product_name=name, quantity=qty, revenue=revenue) for pid, (name, qty, revenue) in product_agg.items()),
        key=lambda p: p.revenue,
    )[:5]

    sold_product_ids = set(product_agg.keys())
    never_sold: list[NeverSoldItem] = []
    if branch_ids:
        never_sold_rows = db.execute(
            select(Product.id, Product.name)
            .join(Stock, Stock.product_id == Product.id)
            .where(Stock.branch_id.in_(branch_ids), Product.id.notin_(sold_product_ids))
            .distinct()
        ).all()
        never_sold = [NeverSoldItem(product_id=pid, product_name=name) for pid, name in never_sold_rows]
```

`return SalesReportOut(...)` çağrısına iki yeni alanı ekle (`breakdown=breakdown,` satırının altına):

```python
        least_selling=least_selling,
        never_sold=never_sold,
```

- [ ] **Step 3: Backend'i başlat, curl ile doğrula**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

```bash
TOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"branchmgr1","password":"Test1234!"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "http://testco.localhost:8000/api/reports/sales?days=90" -H "Authorization: Bearer $TOKEN"
```

Beklenen: `200`, response'ta `least_selling` (en fazla 5 ürün, `revenue` küçükten büyüğe) ve
`never_sold` (satılmamış ürünler, muhtemelen 50 üründen çoğu — testco kataloğunun büyük kısmı hiç
satılmadı) alanları dolu geliyor.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/report.py backend/app/routers/reports.py
git commit -m "feat: complete UC-14 with least-selling and never-sold product reports"
```

Backend'i bu task'ın sonunda durdurma — Task 2 aynı sunucuyu kullanacak (bir sonraki task'a devam
ediyorsan açık bırak, plan tek başına bitiyorsa kapat).

---

### Task 2: Frontend — types, API client, i18n

**Files:**
- Modify: `frontend/src/types/report.ts`
- Modify: `frontend/src/api/reports.ts` (değişiklik gerekmiyor olabilir — kontrol et, response şekli
  genişliyor ama fonksiyon imzası aynı kalıyor)
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: Task 1'in backend response şekli.
- Produces: `SalesReportOut` TS tipi güncel, `reports.leastSelling`/`reports.neverSold`/
  `reports.noNeverSoldInRange` i18n key'leri.

- [ ] **Step 1: TS tipini güncelle**

`frontend/src/types/report.ts` — `BreakdownItem` interface'inin altına ekle:

```typescript
export interface NeverSoldItem {
  product_id: number;
  product_name: string;
}
```

`SalesReportOut` interface'ine iki alan ekle (`breakdown: BreakdownItem[];` satırının altına):

```typescript
  least_selling: TopProductItem[];
  never_sold: NeverSoldItem[];
```

- [ ] **Step 2: i18n key'lerini ekle**

`frontend/src/i18n/locales/tr.json` — `"reports"` bloğunda `"topProducts": "En çok satan ürünler",`
satırının hemen altına ekle:

```json
    "leastSelling": "En az satan ürünler",
    "neverSold": "Hiç satılmayan ürünler",
    "noNeverSoldInRange": "Seçili aralıkta satılmayan ürün yok.",
```

`frontend/src/i18n/locales/en.json` — `"reports"` bloğunda `"topProducts": "Best-selling products",`
(ya da eşdeğer sat��r) hemen altına ekle:

```json
    "leastSelling": "Least-selling products",
    "neverSold": "Never-sold products",
    "noNeverSoldInRange": "No unsold products in this range.",
```

(Önce dosyayı okuyup `topProducts` satırının tam metnini doğrula, sonra ekle.)

- [ ] **Step 3: JSON geçerliliğini ve tip derlemesini doğrula**

```bash
cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"
```

```bash
npx tsc -b --noEmit
```

Beklenen: ikisi de temiz (henüz yeni alanları kullanan bir bileşen olmadığı için tip hatası olmamalı).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/report.ts frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "feat: add least-selling/never-sold types and i18n keys"
```

---

### Task 3: Frontend — `ReportsDetailPage` + route + nav

**Files:**
- Create: `frontend/src/pages/ReportsDetailPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/navConfig.ts`

**Interfaces:**
- Consumes: `getSalesReport` (mevcut `api/reports.ts`, değişmiyor), `RangeSelector`, `SalesTrendChart`
  (mevcut bileşenler), `SalesReportOut` (Task 2'de genişletildi).

- [ ] **Step 1: Sayfayı yaz**

`frontend/src/pages/ReportsDetailPage.tsx` — `BranchManagerDashboard.tsx`'in yapısına birebir benzer
(kartlar + trend + en çok satan), ama Ana Sayfa değil, ayrı bir sayfa (`pageTitle` sabit bir çeviri
key'i kullanıyor, `homeLabelForRole` değil), üstüne "en az satan" ve "hiç satılmayan" panelleri ekleniyor:

```typescript
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { RangeSelector } from "../components/RangeSelector";
import { SalesTrendChart } from "../components/SalesTrendChart";
import { getSalesReport } from "../api/reports";
import type { SalesReportOut } from "../types/report";

// UC-14 (en çok/az/hiç satılmayan) + UC-13/16 (satış raporu/kâr marjı) tek bir detay sayfasında.
// "Satış raporları" ve "Kâr marjı / KPI" nav öğeleri ikisi de bu sayfaya gider (aynı veri, tek kaynak
// — kullanıcı kararı, bkz. docs/superpowers/specs/2026-08-06-uc14-reports-detail-page-design.md).
// Ana Sayfa dashboard'larındaki top-5/trend kartlarının tekrarı değil, ayrı bir detay sayfası.
export function ReportsDetailPage() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getSalesReport(token, days)
      .then(setReport)
      .catch(() => setError(t("reports.reportLoadError")))
      .finally(() => setLoading(false));
  }, [token, days]);

  return (
    <AppShell pageTitle={t("nav.salesReports")}>
      <div className="toolbar">
        <div className="scope">{t("reports.scope", { label: report?.scope_label ?? t("reports.defaultScope") })}</div>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      {error && <div className="error-text">{error}</div>}
      {loading || !report ? (
        <div className="muted-small">{t("common.loading")}</div>
      ) : (
        <>
          <section className="cards">
            <div className="card">
              <div className="lbl">{t("reports.totalSales")}</div>
              <div className="page-title">{report.total_sales.toFixed(2)}</div>
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
                      <span className="muted-small">{p.quantity} adet · {p.revenue.toFixed(2)}</span>
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
                      <span className="muted-small">{p.quantity} adet · {p.revenue.toFixed(2)}</span>
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

- [ ] **Step 2: Route ekle**

`frontend/src/App.tsx` — import listesine ekle:

```typescript
import { ReportsDetailPage } from "./pages/ReportsDetailPage";
```

`<Route path="/employees" ...>` bloğunun hemen altına (ya da uygun bir yere) ekle:

```typescript
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsDetailPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 3: Nav'a path ekle**

`frontend/src/components/navConfig.ts` — dört yerde `path: "/reports"` ekle:

`branch_manager` bloğunda:
```typescript
        { label: "nav.salesReports", path: "/reports" },
        { label: "nav.profitKpi", path: "/reports" },
```

`region_manager` bloğunda (aynı iki satır, aynı değişiklik).

`general_manager` bloğunda (aynı iki satır, aynı değişiklik).

`seller_manager` bloğunda:
```typescript
        { label: "nav.salesReports", path: "/reports" },
```

- [ ] **Step 4: TypeScript derlemesini doğrula**

```bash
cd frontend && npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReportsDetailPage.tsx frontend/src/App.tsx frontend/src/components/navConfig.ts
git commit -m "feat: add ReportsDetailPage, wire /reports route and nav for 4 roles"
```

---

### Task 4: `SellerManagerDashboard` temizliği — eski layout yer tutucusunu kaldır

**Files:**
- Modify: `frontend/src/pages/SellerManagerDashboard.tsx`
- Modify: `frontend/src/i18n/locales/tr.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Interfaces:** Yok — sadece UI temizliği, hiçbir API/tip değişmiyor.

- [ ] **Step 1: Layout kartını ve panelini kaldır**

`frontend/src/pages/SellerManagerDashboard.tsx`:

- Üstteki yorumu güncelle: `// "Layout önerisi" (co-occurrence/Apriori) hiç tasarlanmamış ayrı bir ML
  özelliği — kapsam dışı bırakıldı, panel yer tutucu olarak kalıyor.` satırını sil (artık doğru değil,
  layout önerisi gerçek bir özellik, kendi nav öğesinde: `/layout`).
- `<section className="cards c3">` içindeki üçüncü kartı (`reports.layoutStatusCard` / `layoutOutOfScope`)
  tamamen sil, `cards c3` → `cards c2` yap.
- `<section className="grid2">` içindeki iki panelden ikincisini (`reports.layoutPanelTitle` /
  `layoutPanelHint` / `layoutPanelBody`) tamamen sil. Sadece trend paneli kaldığı için `grid2`'yi
  `panel` olarak değiştir (tek sütun, `<section className="panel">` — `SalesTrendChart` panel'i doğrudan
  bunun içinde kalır, iç `<div className="panel">` sarmalayıcısı kaldırılır).

Sonuç, dosyanın JSX kısmı şöyle olmalı (kartlar bölümünden itibaren):

```typescript
          <section className="cards c2">
            <div className="card">
              <div className="lbl">{t("reports.sellerSalesCard")}</div>
              <div className="page-title">{report.total_sales.toFixed(2)}</div>
            </div>
            <div className="card">
              <div className="lbl">{t("reports.expiringDiscountCard")}</div>
              <div className="page-title">{expiringCount ?? "—"}</div>
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
```

- [ ] **Step 2: Ölü i18n key'lerini sil**

`frontend/src/i18n/locales/tr.json` ve `en.json` — `"reports"` bloğundan şu 5 key'i tamamen sil:
`layoutStatusCard`, `layoutOutOfScope`, `layoutPanelTitle`, `layoutPanelHint`, `layoutPanelBody`.

- [ ] **Step 3: Grep ile ölü referans kalmadığını doğrula**

```bash
cd frontend && grep -rn "layoutStatusCard\|layoutOutOfScope\|layoutPanelTitle\|layoutPanelHint\|layoutPanelBody" src/
```

Beklenen: hiçbir sonuç (boş çıktı).

- [ ] **Step 4: JSON + tip derlemesini doğrula**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/tr.json')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json')); console.log('ok')"
npx tsc -b --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SellerManagerDashboard.tsx frontend/src/i18n/locales/tr.json frontend/src/i18n/locales/en.json
git commit -m "fix: remove stale 'layout suggestion out of scope' placeholder from seller_manager home"
```

---

### Task 5: Uçtan uca tarayıcı doğrulaması

**Files:** (kod değişikliği yok)

- [ ] **Step 1: Backend + frontend'i başlat, dört rolle `/reports`'u test et**

`branchmgr1`, `regionmgr1`, `genmgr1`, `sellermgr1` ile giriş yapıp nav'dan hem "Satış raporları" hem
(varsa) "Kâr marjı / KPI" öğelerine tıkla — ikisi de `/reports`'a gitmeli. Sayfada kartlar + trend + en
çok/az satan + hiç satılmayan listesi görünmeli. `sellermgr1` girişinde kâr marjı kartı **görünmemeli**.

- [ ] **Step 2: `SellerManagerDashboard` (Ana Sayfa) regresyonu**

`sellermgr1` ile Ana Sayfa'yı ziyaret et — "Layout önerisi — kapsam dışı" paneli artık **görünmemeli**,
2 kart (satış + SKT) + tek trend paneli olmalı, konsol hatasız.

- [ ] **Step 3: Konsol/network kontrolü**

Tüm oturumlarda tarayıcı konsolunda hata olmadığını doğrula.

- [ ] **Step 4: PROCESS.md'yi kullanıcıyla birlikte güncelle**

Bu planın tamamlandığını, önceki açık maddenin ("Satış raporları"/"Kâr marjı / KPI" tıklanamıyor)
kapandığını PROCESS.md'ye işle (kullanıcı onayı gerekir, CLAUDE.md kuralı).
