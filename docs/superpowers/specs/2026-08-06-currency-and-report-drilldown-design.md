# TL Para Birimi Gösterimi + Satış Raporu Drill-Down Tasarımı

**Tarih:** 2026-08-06
**Kapsam:** İki bağımsız iyileştirme — (1) tüm fiyat gösterimlerine ₺ eklenmesi, (2) `region_manager`/
`general_manager`'ın `/reports` sayfasında bölge/şube bazında detaya inebilmesi.

## 1) TL (₺) Para Birimi Gösterimi

**Karar (kullanıcı onaylı):** ₺ sembolü, sayıdan **önce** (örn. `₺45.90`).

**Kapsam:** `grep .toFixed(2)` ile tarandı, 9 dosyada 24 kullanım bulundu — hepsi gerçek para tutarı
(satış, fiyat, kâr, sepet toplamı vb.). Miktar (`adet`) ve yüzde (`%`) gösterimleri bu kapsamda **değil**.

**Yaklaşım:** Tek bir paylaşılan yardımcı fonksiyon — `frontend/src/utils/currency.ts::formatCurrency(amount:
number): string` → `` `₺${amount.toFixed(2)}` `` — yazılıp 24 kullanım yerinin tamamı buna geçirilir.
Tekrarlanan `.toFixed(2)` yerine tek kaynak, ileride para birimi formatı değişirse (örn. binlik ayraç)
tek yerden güncellenir.

**Dosyalar (24 kullanım, 9 dosya):**
`BranchManagerDashboard.tsx` (2), `GeneralManagerDashboard.tsx` (2), `SellerManagerDashboard.tsx` (1),
`ReportsDetailPage.tsx` (3), `PriceManagementPage.tsx` (4), `ProductCatalogPage.tsx` (2),
`StockManagerDashboard.tsx` (1), `CashierPos.tsx` (8, bir tanesi i18n interpolasyonu içinde —
`t("pos.lastSaleCompleted", { total: ... })`), `SalesTrendChart.tsx` (1, tooltip `title` attribute'u
içinde).

**Kapsam dışı:** `LayoutSuggestionPage.tsx`'teki `score` yüzdesi (para değil), her yerdeki `adet` sayıları.

## 2) Satış Raporu Drill-Down (Şube/Bölge Detayına İnme)

### Arka plan

Kullanıcının istediği hiyerarşi:
- **Şube Müdürü:** kendi şubesinin özetini inceleyebilmeli — **zaten var**, değişiklik gerekmiyor
  (`branch_manager` her zaman kendi şubesinin raporunu görüyor).
- **Bölge Müdürü:** kendi bölgesini VE o bölgedeki şubeleri ayrı ayrı inceleyebilmeli.
- **Genel Müdür:** tüm şirketi, bölgeleri VE her bölgenin şubelerini inceleyebilmeli.

**Önemli bulgu:** Backend (`backend/app/routers/reports.py::_resolve_scope`, Sprint 4'ten beri var) bunu
**zaten tam olarak destekliyor** — `GET /api/reports/sales` `branch_id`/`region_id` query param'larını
kabul ediyor, `region_manager` için `branch_id` verilirse o şubeye (kendi bölgesi içinde doğrulanarak),
`general_manager` için `region_id` verilirse o bölgeye, `branch_id` verilirse o şubeye (şirket içinde
doğrulanarak) iniyor. **Hiçbir backend değişikliği gerekmiyor.**

Eksik olan tamamen frontend tarafı: `ReportsDetailPage.tsx` bu param'ları hiç göndermiyor, sadece üst
seviyeyi (`days` dışında hiçbir filtre olmadan) çekiyor. Ayrıca Ana Sayfa'daki (`GeneralManagerDashboard.tsx`)
kırılım tablosu (`report.breakdown`) zaten var ama **tıklanamıyor**, statik.

**Karıştırılmaması gereken ayrı bir konu:** Sidebar'daki "Şube/bölge detayı" nav grubu (Stok/Fiyat/Layout
öğeleri) bu işle **alakasız** — o, stok/fiyat *düzenleme* yetkisinin üst rollere kalıtımıyla ilgili, önceden
bilinen ayrı bir açık madde (`PATCH /api/stock` 403 veriyor). Bu spec sadece *görüntüleme* (raporu
inceleme) ile ilgili.

### Kararlar (kullanıcı onaylı)

1. Drill-down arayüzü **`/reports` sayfasına** eklenir — Ana Sayfa dashboard'larına dokunulmaz.
2. Navigasyon **breadcrumb** ile — "Şirket geneli > Marmara > Kadıköy Şube" gibi bir iz, her segment
   tıklanıp geri dönülebilir.

### Tasarım

**Backend:** Değişiklik yok (zaten hazır).

**Frontend (`api/reports.ts`):** `getSalesReport` fonksiyonu opsiyonel `branchId`/`regionId` parametresi
alacak şekilde genişler:

```typescript
export function getSalesReport(
  token: string, days: 7 | 30 | 90, branchId?: number, regionId?: number,
): Promise<SalesReportOut> {
  const params = new URLSearchParams({ days: String(days) });
  if (branchId !== undefined) params.set("branch_id", String(branchId));
  if (regionId !== undefined) params.set("region_id", String(regionId));
  return authFetch<SalesReportOut>(token, `/api/reports/sales?${params}`);
}
```

**Frontend (`ReportsDetailPage.tsx`):**

- Yeni local state: `drillPath: {id: number, label: string}[]` — kullanıcının tıklayarak indiği
  bölge/şube zinciri. Başlangıçta boş (üst seviye: `general_manager` için şirket geneli, `region_manager`
  için kendi bölgesi).
- `drillPath`'in son elemanı varsa onun `id`'si `branchId` ya da `regionId` olarak API'ye gönderilir
  (hangi seviyede olduğumuza göre — `drillPath.length === 1` → `region_id` [general_manager] ya da
  `branch_id` [region_manager]; `drillPath.length === 2` → her zaman `branch_id`, en derin seviye).
- Breadcrumb: kök segment (statik metin: `general_manager` için "Şirket geneli"/i18n, `region_manager`
  için `report.scope_label` — kendi bölge adı) + `drillPath` elemanları. Kökten sonraki her segment
  tıklanınca `drillPath` o noktaya kadar kesilir (geri gider).
- Kırılım tablosu (`report.breakdown`) tıklanabilir hale gelir — bir satıra tıklamak, o satırın
  `id`/`label`'ını `drillPath`'e ekler (bir seviye iner). `breakdown` her zaman şu anki seviyenin BİR ALT
  seviyesini gösteriyor (backend `_resolve_scope`'un `scope` değerine göre otomatik: "company" → bölge
  kırılımı, "region" → şube kırılımı, "branch" → boş/leaf) — bu yüzden ek bir mantık gerekmiyor, backend
  zaten doğru seviyeyi dönüyor.
- Şube seviyesine inildiğinde (`scope === "branch"`) `breakdown` boş döner (backend'in mevcut davranışı) —
  bu doğal olarak "daha derine inilemez" (leaf) durumunu ifade eder, ekstra bir kontrol gerekmiyor.
- Bu breadcrumb/drill-down bloğu **sadece `region_manager` ve `general_manager` rollerinde** render edilir
  (`user.role` üzerinden) — `branch_manager`/`seller_manager` için hiçbir zaman `breakdown` dolu gelmediği
  için zaten anlamsız, ama kod olarak da gösterilmez (gereksiz boş bölüm görünmesin diye).

### Test planı

- `regionmgr1` ile `/reports` → varsayılan bölge görünümü, kırılım tablosunda şubeler listelenir, bir
  şubeye tıklayınca o şubenin raporu (breadcrumb: "Marmara > Kadıköy Şube") gelir, breadcrumb'daki
  "Marmara"ya tıklayınca geri döner.
- `genmgr1` ile `/reports` → şirket geneli, kırılımda bölgeler, bir bölgeye tıklayınca o bölgenin raporu +
  şube kırılımı (breadcrumb: "Şirket geneli > Marmara"), bir şubeye daha tıklayınca üç seviyeli breadcrumb.
- `branchmgr1`/`sellermgr1` ile `/reports` → hiçbir breadcrumb/kırılım bölümü görünmüyor (regresyon yok).
- Bölge dışı bir şubeye ya da şirket dışı bir bölgeye elle URL/param ile erişim denemesi → backend zaten
  404 döndürüyor (mevcut davranış, değişmedi).
