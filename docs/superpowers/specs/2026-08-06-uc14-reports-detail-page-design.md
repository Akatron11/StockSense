# UC-14 Tamamlama + Satış Raporları/KPI Detay Sayfası Tasarımı

**Tarih:** 2026-08-06
**Kapsam:** UC-14'ün eksik kalan kısmı (en az satan + hiç satılmayan ürün raporu) ve Sprint 5 öncesinden
kalan bir açık madde — "Satış raporları" / "Kâr marjı / KPI" nav öğelerinin tıklanamıyor olması.

## Arka plan / neden

`stocksense-jira-sprint-plani.md`'deki Sprint 5 gözden geçirmesinde iki eksik/tutarsız nokta bulundu:

1. **UC-14 kısmen eksik:** Backend (`GET /api/reports/sales`) sadece "en çok satan" (top 5) döndürüyor.
   "En az satan" ve "hiç satılmayan ürün" hiç implement edilmemiş (kodda `least_selling`/`never_sold`
   yok).
2. **Önceden bilinen açık madde (PROCESS.md, 2026-07-31'den kalma):** `branch_manager`/`region_manager`/
   `general_manager`/`seller_manager` nav'larındaki "Satış raporları" ve "Kâr marjı / KPI" öğeleri hiç
   `path` almamış, tıklanamıyor — çünkü aynı veri zaten Ana Sayfa dashboard'larında gösteriliyordu, ayrı
   bir sayfaya gerek olup olmadığına karar verilmemişti.

Ayrıca gözden geçirme sırasında üçüncü bir bulgu ortaya çıktı: `SellerManagerDashboard.tsx` (Ana Sayfa)
hâlâ "Layout önerisi — henüz tasarlanmadı, kapsam dışı" diyen eski bir yer tutucu panel gösteriyor —
Sprint 5'te layout önerisi gerçekten implement edildiği ve kendi nav öğesine (`/layout`) kavuştuğu hâlde
bu panel güncellenmemiş, artık yanlış/eski bilgi veriyor.

## Kararlar (kullanıcı onaylı, 2026-08-06)

1. **Nav öğeleri → ayrı detay sayfası:** "Satış raporları" ve "Kâr marjı / KPI" kaldırılmıyor, gerçek bir
   sayfaya (`/reports`) bağlanıyor.
2. **Tek sayfa, iki nav öğesi aynı yere gider:** Ayrı ayrı sayfa açılmıyor — ikisi de aynı `GET
   /api/reports/sales` verisini farklı açılardan gösterdiği için tek bir `/reports` sayfasında
   birleştiriliyor (tekrar yok, tek kaynak).
3. **"En az satan" limiti:** Top 5 — Ana Sayfa'daki "en çok satan 5" ile simetrik.
4. **"Hiç satılmayan" limiti:** Yok — seçili tarih aralığında hiç satılmayan tüm ürünler listelenir.
5. **Tarih aralığı kapsamı:** "Hiç satılmayan", endpoint'in geri kalanıyla tutarlı olarak **seçili tarih
   aralığı içinde** değerlendirilir (tüm-zamanlar değil) — mimari madde 5'teki live-query prensibiyle
   uyumlu, ayrı bir sorgu yolu açmıyor.
6. **Ana Sayfa dashboard'ları değişmiyor** — bu tamamen ek bir detay sayfası, mevcut top-5 kartları
   aynen kalıyor.
7. **SellerManagerDashboard'daki eski layout yer tutucusu kaldırılıyor** — nav'da zaten çalışan bir
   `/layout` girişi olduğu için Ana Sayfa'da tekrar/özet göstermeye gerek yok.

## Kapsam dışı (bilinçli)

- Region/General Manager'ın Ana Sayfa'sındaki şube/bölge kırılım tablosu (drill-down) yeni `/reports`
  sayfasına taşınmıyor — bu, mevcut Ana Sayfa'da zaten var, ek karmaşıklık gerektiren ayrı bir konu.
  Yeni sayfa 4 rol için de aynı düz yapıda: kartlar + trend + en çok/az/hiç satan + (izin varsa) marj.

## Backend

**Değişiklik:** `backend/app/routers/reports.py::get_sales_report`, `backend/app/schemas/report.py`

- `SalesReportOut`'a iki yeni alan: `least_selling: list[TopProductItem]`, `never_sold:
  list[NeverSoldItem]` (yeni schema: `product_id: int`, `product_name: str`).
- Hesaplama: mevcut `item_rows` (zaten `branch_ids` + tarih aralığına göre filtrelenmiş satış kalemleri)
  üzerinden — `top_products` zaten `product_agg` dict'inden hesaplanıyor (`reports.py:152-161`), aynı
  `product_agg`'den en az satan 5'i (`reverse=False`, `[:5]`) türetmek yeterli, ekstra sorgu gerekmiyor.
- "Hiç satılmayan": scope içindeki (branch_ids) tüm ürünler (`Product.company_id`/`branch_ids` üzerinden
  `Stock` join'i ile o şubelerde stoklu ürünler) eksi `product_agg`'de görünenler — yeni bir DB sorgusu
  gerekiyor (mevcut satış kalemi sorgusunda bu ürünler zaten yoktu çünkü hiç satılmamışlar).
- `seller_manager` için `can_see_margin` mantığı zaten var, `least_selling`/`never_sold` bundan bağımsız
  — her iki alan da tüm rollere (branch/region/general/seller_manager) gösteriliyor (UC-14, kâr marjıyla
  ilgisi yok).

## Frontend

**Yeni dosya:** `frontend/src/pages/ReportsDetailPage.tsx`

- `getSalesReport(token, days)` (mevcut API client, değişmiyor — response şekli genişliyor).
- Bölümler: özet kartlar (toplam satış, marj varsa, düşük stok, işlem sayısı — `BranchManagerDashboard`
  ile aynı desen), trend grafiği (`SalesTrendChart`), "En çok satan" (mevcut), **yeni:** "En az satan"
  (aynı liste deseni, ters sıralı), **yeni:** "Hiç satılmayan ürünler" (düz liste, sadece isim).
- `RangeSelector` (7/30/90) aynen kullanılıyor.

**Route + nav:**
- `App.tsx`: `/reports` route'u, `ProtectedRoute` altında.
- `navConfig.ts`: `branch_manager`/`region_manager`/`general_manager`'daki hem `nav.salesReports` hem
  `nav.profitKpi` öğelerine `path: "/reports"`; `seller_manager`'daki `nav.salesReports`'a da aynı.

**SellerManagerDashboard.tsx temizliği:**
- "Layout önerisi" kartı (`reports.layoutStatusCard`) ve paneli (`reports.layoutPanelTitle` +
  `layoutPanelHint` + `layoutPanelBody`) kaldırılıyor.
- `cards c3` → `cards c2` (kart sayısı 3'ten 2'ye düşüyor: satış + SKT/indirim).
- `grid2` düzeni artık tek panel (trend) kalıyor — `panel` olarak (grid'e gerek kalmıyor, tek sütun).
- Ölü i18n key'leri (`layoutStatusCard`, `layoutOutOfScope`, `layoutPanelTitle`, `layoutPanelHint`,
  `layoutPanelBody`) hem `tr.json` hem `en.json`'dan silinir.

**i18n (yeni key'ler, `reports.*` altına):**
- `leastSelling`: "En az satan ürünler" / "Least-selling products"
- `neverSold`: "Hiç satılmayan ürünler" / "Never-sold products"
- `noNeverSoldInRange`: "Seçili aralıkta satılmayan ürün yok." / "No unsold products in this range."

## Test planı

- `branchmgr1`, `regionmgr1`, `genmgr1`, `sellermgr1` ile `/reports` sayfasına nav'dan erişim (her iki
  nav öğesinden de aynı sayfaya gidildiği doğrulanır).
- `seller_manager` ile kâr marjı kartının görünmediği (backend zaten `null` döndürüyor) doğrulanır.
- En az satan / hiç satılmayan listelerinin gerçek seed verisiyle (50 ürünlük katalog, kısmi satış
  deseni) doğru geldiği kontrol edilir — 50 üründen sadece bir kısmı satıldığı için "hiç satılmayan"
  listesi dolu çıkmalı.
- `SellerManagerDashboard` (Ana Sayfa) ziyaret edilip layout panelinin artık görünmediği, kart
  sayısının 2'ye düştüğü, konsol hatasız olduğu doğrulanır.
- `tsc -b --noEmit` temiz.
