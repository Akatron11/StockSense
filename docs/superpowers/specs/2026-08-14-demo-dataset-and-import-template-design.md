# Sunum İçin Gerçekçi Demo Veri Seti ve Excel Import Şablonu — Tasarım

**Tarih:** 2026-08-14
**Kapsam:** Ders sunumu için iki gerçekçi, büyük ölçekli şirket verisi (MegaMarket, Şen Market) DB'ye
seed edilecek; ayrıca sunum sırasında canlı olarak Day-0 sihirbazıyla (UC-17,
`2026-08-13-day0-vendor-setup-design.md`) oluşturulacak yeni bir şirkete Excel import özelliğiyle
(`2026-08-13-excel-product-import-design.md`) yüklenecek 100 ürünlük hazır bir şablon üretilecek.

## Arka plan / neden

Mevcut `testco` (Test Market) verisi (`seed_test_data.py` + `seed_sales_data.py`) küçük ölçekli,
elle yazılmış, manuel Swagger testleri ve layout-önerisi demosu için tasarlanmış. Sunumda projenin
gerçek bir marketin büyüklüğüne yakın veriyle (çoklu bölge/şube, yüzlerce ürün, binlerce satış)
çalıştığını göstermek için ayrı, daha büyük bir veri seti gerekiyor. Bu, `testco`'nun yerini almıyor;
onunla birlikte var olacak, ayrı script(lar) olarak eklenecek.

Ayrıca sunum sırasında canlı olarak Day-0 sihirbazıyla sıfırdan bir şirket kurulacak ve o şirkete
Excel import özelliğiyle ürün yüklenecek — bunun için önceden hazırlanmış, gerçekçi 100 ürünlük bir
`.xlsx` dosyası gerekiyor.

## Kararlar (kullanıcı onaylı, 2026-08-14 — brainstorming diyaloğuyla netleşti)

### 1. Kapsam ve izolasyon

- `testco` verisine hiç dokunulmaz — tamamen ayrı, yeni script(lar) eklenir.
- Bu iş `main`'den ayrılmış `feature/sample-data-excel` worktree'sinde yürütülüyor
  (`.worktrees/feature-sample-data-excel/`).

### 2. Şirketler

**MegaMarket** (`subdomain: megamarket`) — büyük zincir:
- 5 bölge × 2 şube = 10 şube
- 800+ ürün katalog
- Feature flag'ler: hepsi açık (`layout_onerisi`, `mobil_app`, `merkez_depo_senaryosu`, `kpi_modulu`)

**Şen Market** (`subdomain: senmarket`) — orta ölçekli:
- 1 bölge × 5-6 şube
- 300 ürün katalog (MegaMarket'in 800 ürünlük havuzunun kategori-dengeli bir alt kümesi — bkz.
  Karar 3)
- Feature flag'ler: sadece `layout_onerisi` + `mobil_app` açık; `merkez_depo_senaryosu` ve
  `kpi_modulu` kapalı

**"Küçük şube" kavramı (her iki şirkette de geçerli):** Her bölgede en az bir şube "küçük şube"
olarak işaretlenir. Fark **personelden değil** (tüm şubelerde tam rol seti bulunur — bkz. Karar 4),
**stok çeşitliliği ve satış hacminden** gelir:
- Kataloğun ~%40'ı stoklanır (tam şubenin stokladığı ürünlerin rastgele bir alt kümesi)
- Günlük satış hacmi normal şubenin ~%30-40'ı

Bu ayrım bilinçli: `layout_onerisi` gibi feature flag'ler şirket seviyesinde açık/kapalı
(`require_feature`), kullanım ise ayrıca role bağlı (`require_role(claims, "seller_manager")`,
[`layout_suggestion.py:30`](../../../backend/app/routers/layout_suggestion.py)) — küçük şubede
personel eksiltilseydi o şubede belirli özellikler hiç kullanılamaz hale gelirdi. Stok/satış hacmi
üzerinden fark yaratmak bu çelişkiyi önlüyor.

### 3. Ürün kataloğu — Mockaroo pipeline

**Kategori listesi (16 kategori, kullanıcı onaylı, ihtiyaç halinde implementasyon sırasında
ayarlanabilir):** Süt Ürünleri, Fırın, Temizlik, Atıştırmalık, İçecek, Şarküteri, Kahvaltılık, Et
Ürünleri, Meyve-Sebze, Donmuş Gıda, Bakliyat/Konserve, Bebek Ürünleri, Kişisel Bakım, Ev/Temizlik
Gereçleri, Kahve-Çay, Evcil Hayvan.

**Akış:**
1. Kullanıcı Mockaroo'da bir şema kurar ve **800 satırlık tek bir CSV** üretir. Alanlar:
   - `product_name` — marka + ürün tipi + boy/gramaj (örn. "Ülker Çikolata 70g")
   - `category` — yukarıdaki 16 kategoriden Custom List
   - `default_price` — kategoriye göre makul aralıkta (örn. 5-500 TL)
   - (opsiyonel) `best_before_date` — kullanıcı isterse Mockaroo'da üretir, istemezse script
     tarafında kategoriye göre üretilir (bkz. Karar 5)
2. Kullanıcı CSV'yi teslim eder.
3. `backend/generate_demo_dataset.py` bu CSV'yi okur:
   - **SKU** kategori + sıra numarasından programatik üretilir (örn. `SKU-SUTURUNLERI-014`),
     mevcut `SKU-XXXX-nn` konvansiyonuna uyar, Mockaroo'dan istenmez.
   - **`cost_price`**, kategoriye göre farklı kâr marjı oranıyla `default_price`'tan hesaplanır
     (Mockaroo'dan istenmez) — bkz. Karar 6.
   - MegaMarket'in 800 ürününün tamamı kullanılır; Şen Market için bu 800'ün kategori-dengeli
     rastgele 300'lük bir alt kümesi seçilir (iki şirket bazı ürünleri paylaşır — gerçek hayatta
     iki market zincirinin ortak tedarikçilerden aynı ürünleri alması gibi).

**Şen Market ↔ MegaMarket ürün ilişkisi:** Şen Market'in kataloğu MegaMarket'in alt kümesi
(ayrı bir CSV üretmeye gerek yok).

### 4. Personel yapısı

**MegaMarket** — her şubede:
- 1 `branch_manager`
- 1-2 `stock_manager` (manager_pin'li)
- 1-2 `seller_manager` (manager_pin'li)
- 2-3 `cashier`
- 10 login'siz `staff`

Bölge başına 1 `region_manager`. Şirket geneli: 1 `general_manager`, 1 `company_it`.

**Şen Market** — her şubede:
- 1 `branch_manager`, 1 `stock_manager` (pin'li), 1 `seller_manager` (pin'li), 1 `cashier`
- 2 login'siz `staff`

Bölge başına 1 `region_manager` (tek bölge olduğu için toplam 1). Şirket geneli: 1
`general_manager`, 1 `company_it`.

**`vendor_manager`:** Yeni hesap açılmaz — `company_id IS NULL` olduğu için tenant-üstü, testco'dan
gelen mevcut `vendormgr1` her iki yeni şirketi de görebilir/yönetebilir (rolün tasarımı zaten bu).

### 5. Satış / iade / stok talebi üretim mantığı

- **Zaman aralığı:** son 90 gün.
- **Günlük satış hacmi:**
  - MegaMarket normal şube: 80-120 satış/gün; küçük şube: bunun ~%30-40'ı (~25-40/gün)
  - Şen Market normal şube: 40-60 satış/gün; küçük şube: bunun ~%30-40'ı
- **Sepet büyüklüğü:** 1-5 ürün çeşidi, ağırlıklı küçük (testco'daki `_build_basket` desenine
  benzer).
- **Ko-oksurans deseni:** testco'daki `PATTERN_PAIRS` mantığı — her şirket için birkaç ürün çifti
  tanımlanır, sepetlerin bir kısmı (%40 olasılıkla) bu çiftleri içerir + opsiyonel ekstra ürün.
  Layout önerisi (Apriori) özelliğini anlamlı çalıştırmak için.
- **Ödeme yöntemi:** ~%40 cash / %60 card.
- **Kâr marjı (kategoriye göre farklı `cost_price` oranı):** Örn. çabuk bozulan/taze ürünler
  (Meyve-Sebze, Fırın) düşük marj (~%25-35), uzun ömürlü/markalı ürünler (Kişisel Bakım, Temizlik)
  daha yüksek marj (~%35-45) — kesin oranlar implementasyon sırasında script içinde sabitlenir, kâr
  marjı raporunun kategoriler arasında anlamlı farklılık göstermesi yeterli.
- **`best_before_date`:** Her ürüne tarih verilir (boş bırakılmaz).
  - Çabuk bozulan kategoriler (Süt Ürünleri, Fırın, Şarküteri, Donmuş Gıda): 1-60 gün arası —
    bazıları bilerek çok yakın/geçmiş tarihte bırakılır (SKT bildirim senaryosunu tetiklemek için).
  - Uzun ömürlü kategoriler (diğer 12 kategori): 365-730 gün arası.
- **Düşük stok deseni:** Bazı ürün-şube kombinasyonlarında `stock.quantity`, `low_stock_threshold`
  altında bilerek bırakılır (testco'daki süt örneği gibi) — düşük stok bildirimini tetikler.
- **İadeler:** Satışların ~%2-3'ü için `returns` + `return_items` kaydı üretilir, `pending` ve
  `completed` durumları karışık dağıtılır (PIN onay akışını göstermek için).
- **Stok talebi (`stock_requests`):** Her şubede, stoklu ürünlerin küçük bir yüzdesi için 90 günlük
  aralığa yayılmış birkaç geçmiş kayıt üretilir (merkez depo senaryosunu göstermeye yeter — sadece
  MegaMarket'te anlamlı, çünkü Şen Market'te `merkez_depo_senaryosu` flag'i kapalı; Şen Market için
  bu adım atlanır).
- **Shift (vardiya):** Her çalışan için önümüzdeki 7 gün için basit bir vardiya/izin planı üretilir.

### 6. Excel import demo şablonu ("Day-0" sunum senaryosu)

- MegaMarket'in 800 ürünlük havuzundan kategori-dengeli **100 ürünlük bir alt küme** seçilir.
- Bu 100 ürüne **yeni, bağımsız SKU'lar** üretilir (gerçek MegaMarket/Şen Market SKU'larıyla
  karışmaması için — teknik olarak zorunlu değil çünkü SKU benzersizliği şirket bazlı, ama netlik
  için ayrı tutuluyor).
- Sütun sırası `product_import.py::EXPECTED_HEADERS` ile birebir aynı: `name, sku, category,
  default_price, cost_price, best_before_date`.
- Ayrı bir script (`backend/generate_demo_import_template.py`) bu 100 satırı üretip `.xlsx` olarak
  yazar; kullanıcıya teslim edilir (sunumdan önce Day-0 sihirbazıyla oluşturulacak yeni şirkete bu
  dosya import edilecek).

### 7. Script/dosya yerleşimi ve tekrar-çalıştırılabilirlik

- **`backend/generate_demo_dataset.py`** — Mockaroo CSV'sini okur, MegaMarket + Şen Market'in
  tamamını (region/branch/employee/product/stock/sales/sale_items/returns/return_items/
  stock_requests/shifts/company_features) üretir.
- **`backend/generate_demo_import_template.py`** — aynı CSV'den 100 ürünlük day-0 `.xlsx`
  şablonunu üretir.
- Her iki script de `seed_test_data.py` deseninde **idempotent**: subdomain'e göre var olan şirket
  bulunursa önce silinir, sonra yeniden üretilir — sunumdan önce güvenle tekrar çalıştırılabilir.
- **CSV girdi dosyası konumu:** `backend/seed_data/megamarket_products.csv`. Bu dosya
  **`.gitignore`'a eklenir** — tek seferlik/gösterimlik veri olduğu, sunum sonrası tekrar
  kullanılmayacağı için repo'ya yük olarak girmez. Script'lerin kendisi (`.py`) commit edilir;
  ihtiyaç olursa yeni bir Mockaroo export'uyla tekrar çalıştırılabilir.

## Kapsam dışı (bilinçli, bu tur için)

- `testco` verisinin değiştirilmesi/büyütülmesi.
- Mockaroo şemasının kendisinin (custom list içerikleri, tam ürün isim listesi) bu spec içinde
  satır satır sabitlenmesi — kullanıcı Mockaroo'da kurarken üzerinde son ince ayarı yapabilir,
  script kategori/fiyat/tarih mantığına bağlı kaldığı sürece esnektir.
- Day-0 sihirbazının veya Excel import özelliğinin kendisinde değişiklik — ikisi de zaten var
  (`2026-08-13-day0-vendor-setup-design.md`, `2026-08-13-excel-product-import-design.md`), bu iş
  sadece onlarla birlikte kullanılacak demo verisini üretiyor.
