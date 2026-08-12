# Excel Ürün İçe Aktarma (Import) Modülü Tasarımı

**Tarih:** 2026-08-13
**Kapsam:** PROCESS.md Faz 4'te açık bırakılan "Excel import modülü" — ürünlerin hâlihazırda tutulduğu
Excel'den toplu içe aktarım.

## Arka plan / neden

Ürün kataloğu şu an sadece tekil `POST /api/products` ile, `general_manager` tarafından tek tek
girilebiliyor. Gerçek dünyada bir şirket sisteme ilk geçtiğinde elindeki kataloğu (Sprint 7'deki
multi-tenant demo notuna göre şirket başına ~700-1000 ürün olabilir) satır satır elle girmek
pratik değil — bu modül, kullanıcının kendi Excel dosyasından toplu bir ilk yükleme yapabilmesini
sağlıyor.

## Kararlar (kullanıcı onaylı, 2026-08-13 — brainstorming diyaloğuyla netleşti)

1. **Kullanım amacı:** Sadece **ilk kurulum / bulk seed** senaryosu. Periyodik/tekrarlayan toplu
   güncelleme (var olan ürünleri güncelleme) kapsam dışı — import sadece **yeni ürün oluşturur**,
   var olan bir SKU'yu güncellemez.
2. **Yetki:** Sadece `general_manager` — mevcut `POST /api/products` yetkisiyle birebir tutarlı, yeni
   bir rol kararı gerekmedi.
3. **Template alanları:** Sadece mevcut `ProductCreate` şemasındaki alanlar (`name`, `sku`, `category`,
   `default_price`, `cost_price`, `best_before_date`). Şube-özel stok miktarı (`Stock` tablosu) template'e
   dahil edilmiyor — kapsam dışı, ayrı bir konu.
4. **Hata davranışı:** **Hepsi-ya-da-hiçbiri.** Dosyada herhangi bir satır hatalıysa hiçbir ürün eklenmez,
   kullanıcı satır bazlı hata listesini görüp dosyayı düzeltip tekrar yükler.
5. **Dosya formatı:** Sadece `.xlsx`. CSV desteklenmiyor.
6. **Template sağlama:** İndirilebilir örnek `.xlsx` template dosyası — doğru sütun başlıkları + 1-2 örnek
   satır içerir.
7. **Hata raporlama:** Satır numarası + hata mesajı listesi (örn. `"Satır 5: default_price geçerli bir
   sayı değil"`), genel bir özet mesajı değil.
8. **Boyut sınırı:** 2000 satır / 5MB üst sınır — gerçek kullanım senaryosunun (700-1000 ürün) bir hayli
   üzerinde, sunucuyu koruyan bir güvenlik sınırı. Aşılırsa `422`.
9. **Yaklaşım:** **Senkron tek istek** (arka plan işi/job queue değil) — kod tabanında hiç background-job
   altyapısı yok, 2000 satır sınırıyla parse+validate+insert birkaç saniyede biter, mevcut mimariye en
   uyumlu seçenek.

## Kapsam dışı (bilinçli)

- Var olan ürünleri güncelleme (upsert) — sadece yeni ürün oluşturma.
- Şube-bazlı stok miktarı import'u.
- CSV desteği.
- Arka plan işi / ilerleme takibi (polling) — dosya küçük olduğu için gerekmiyor.
- Negatif fiyat kontrolü gibi `ProductCreate`'te zaten var olmayan validasyonlar — import, mevcut tekil
  ürün ekleme davranışıyla birebir tutarlı kalıyor, yeni bir iş kuralı eklenmiyor.

## Backend

**Yeni dosyalar/değişiklikler:** `backend/app/routers/products.py`, yeni bir `services/product_import.py`
(parse+validate mantığı, router'ı şişirmemek için ayrı modül).

### `POST /api/products/import`

- Sadece `general_manager` (`require_role(claims, "general_manager")`, mevcut desenle aynı).
- Multipart file upload (`UploadFile`). İçerik tipi/uzantı `.xlsx` değilse → `422`.
- Dosya boyutu > 5MB veya satır sayısı > 2000 → `422` (`"Dosya çok büyük (maks. 2000 satır / 5MB)"`).
- `openpyxl` ile parse edilir (yeni bağımlılık — `requirements.txt`'e eklenecek).
- **Sütun başlığı kontrolü:** satır 1, beklenen sırayla `name, sku, category, default_price, cost_price,
  best_before_date` değilse → tek bir `422` hatası (`"Sütun başlıkları template ile uyuşmuyor, lütfen
  template'i indirip tekrar deneyin"`), satır bazlı hata listesine girmez.
- **Boş satırlar:** tüm hücreleri boş olan satırlar sessizce atlanır (hata sayılmaz, sıra numarasına da
  dahil edilmez).
- **Satır bazlı validasyon** (her dolu satır için, mevcut `ProductCreate` Pydantic şeması yeniden
  kullanılır):
  - Zorunlu alan eksik (`name`/`sku`/`default_price`) → `"Satır N: <alan> zorunlu"`
  - Tip/format hatası (`default_price`/`cost_price` sayı değil, `best_before_date` geçerli tarih değil)
    → `"Satır N: <alan> geçerli bir <tip> değil"`
  - Dosya içinde tekrarlanan SKU → `"Satır N: SKU tekrarlı (<sku>, satır M ile çakışıyor)"`
  - DB'de aynı `company_id` kapsamında zaten var olan SKU → `"Satır N: SKU zaten kayıtlı (<sku>)"`
- **Hepsi-ya-da-hiçbiri:** validasyon tüm satırlar için tamamlanmadan hiçbir DB yazımı yapılmaz. Herhangi
  bir hata varsa → `422` + `{"errors": [{"row": int, "message": str}, ...]}`.
- Hata yoksa → tek bir transaction içinde tüm satırlar `Product` olarak insert edilir → `201` +
  `{"created": N}`.

### `GET /api/products/import/template`

- Sadece `general_manager`.
- Sabit, önceden hazırlanmış bir `.xlsx` dosyasını (doğru sütun başlıkları + 1-2 örnek satır, örn.
  `"Süt 1L", "SKU-MILK-01", "İçecek", 45.90, 30.00, 2026-12-31`) `FileResponse`/`StreamingResponse` ile
  döner.
- Dosya, backend içinde statik bir asset olarak tutulur ya da istek anında `openpyxl` ile üretilir (ikisi
  de eşdeğer maliyette — istek anında üretim tercih edilecek, statik dosya bakımı gerektirmiyor).

## Frontend

**Konum:** `frontend/src/pages/ProductCatalogPage.tsx` (`/catalog`, sadece `general_manager` görüyor) —
mevcut "Yeni ürün ekle" butonunun yanına iki yeni buton.

**Yeni dosyalar:** `api/products.ts`'e `importProducts(file: File)` / `downloadImportTemplate()`,
yeni `components/ImportErrorsModal.tsx`.

### Akış

1. **"Template indir"** → `GET /api/products/import/template` tetiklenir, tarayıcı dosyayı indirir
   (blob + `<a download>` deseni).
2. **"Excel'den içe aktar"** → gizli `<input type="file" accept=".xlsx">` açılır, dosya seçilince
   `POST /api/products/import`'a `FormData` ile gönderilir.
3. **Başarı (201):** başarı mesajı (`"N ürün eklendi"`) gösterilir, ürün listesi otomatik yenilenir
   (mevcut `fetchProducts` tekrar çağrılır, sayfa 1'e dönülür).
4. **Hata (422, satır listesi):** yeni `ImportErrorsModal` açılır — satır no + mesaj tablosu (mevcut modal
   CSS deseniyle tutarlı, `.modal`/`.modal-body` — scroll zaten destekleniyor). Kullanıcı modalı kapatıp
   dosyayı düzeltip tekrar dener.
5. **Hata (422, dosya/format düzeyinde — sütun başlığı, boyut sınırı):** aynı modal, tek satırlık genel
   mesajla (satır no olmadan) gösterilir.

## Test planı

**Backend:**
- Geçerli dosya (5-10 satır) → `201`, DB'de doğru sayıda ürün, alanlar doğru.
- Hatalı satır içeren dosya (örn. 1 satırda eksik `name`) → `422`, DB'de **hiçbir** ürün eklenmemiş
  (transaction rollback doğrulanır).
- DB'de zaten var olan SKU içeren dosya → `422`, ilgili satır hata listesinde.
- Dosya içinde tekrarlanan SKU → `422`, her iki satır da hata listesinde.
- Yanlış sütun başlıkları → `422`, tek genel hata mesajı.
- 2000 satır üstü / 5MB üstü dosya → `422`.
- `.xlsx` olmayan dosya (örn. `.csv`, `.txt`) → `422`.
- Yetkisiz rol (örn. `branch_manager`, `stock_manager`) → `403`.
- Template indirme → `200`, dönen dosya `openpyxl` ile açılabiliyor, sütun başlıkları template ile
  birebir eşleşiyor.

**Frontend (tarayıcıda uçtan uca):**
- Template indirme çalışıyor, indirilen dosya doğru sütunları içeriyor.
- Geçerli dosya yükleme → başarı mesajı + liste yenileniyor, yeni ürünler görünüyor.
- Hatalı dosya → `ImportErrorsModal` doğru satır/mesajları gösteriyor, dosya düzeltilip tekrar
  yüklenince başarılı oluyor.
- Yetkisiz rolle (`branch_manager`) `/catalog`'a girildiğinde import butonları hiç görünmüyor (regresyon
  kontrolü — sayfa zaten `general_manager`'a özel).
