# Layout Önerisi — SHOULD (Floor-Plan Görselleştirme) + COULD (Simülasyon) Tasarımı

**Tarih:** 2026-08-07
**Kapsam:** UC-15'in Sprint 5'te bilinçli kapsam dışı bırakılan iki seviyesi — brief'teki
(`topic.pdf` madde 20) SHOULD ve COULD gereksinimleri. Mimari madde 7,
`stocksense-jira-sprint-plani.md`'deki Sprint 6 (deadline sonrası) planına giriyor.

## Arka plan / neden

Sprint 5'te sadece MUST (co-occurrence/Apriori çift/skor listesi + "Uygula") kapsandı, SHOULD
(floor-plan diyagramı) ve COULD (simülasyon + iyileşme metriği) `PROCESS.md`'ye açık madde olarak
bırakılmıştı (bkz. `docs/superpowers/specs/2026-08-05-sprint5-layout-recommendation-design.md`).
2026-08-07'de kullanıcı kararıyla bu iki seviye ele alındı — mobil companion app kapsamı hoca
onayı bekleyene kadar ertelendi, bu iş öne alındı.

**Kritik kısıt:** Veritabanında hiçbir zaman gerçek bir raf/zone/konum verisi olmamıştı — mimari
madde 14, "ayrı bir `shelf_stock` tablosu/'rafa çıkarma' işlemi değerlendirildi ama gereksiz
karmaşıklık getirdiği için (YAGNI) vazgeçildi" diyor. Bu tasarım o kararı **tersine çevirir**:
artık gerçek bir zone/konum modeli ekleniyor, çünkü SHOULD'un "floor-plan diyagramı" gereksinimi
bunu gerektiriyor. Madde 14'teki eski YAGNI kararı bu spec ile geçersiz kalıyor.

## Kullanıcıyla netleşen kararlar (brainstorming, görsel companion ile)

1. **Floor-plan serbest/zone-bazlı**, grid (satır×sütun) değil — kullanıcının paylaştığı referans
   görsel (gerçek bir market planı, isimli dikdörtgen bloklar: DAIRY, BAKERY, MEAT & POULTRY vb.)
   bu yönde karar verdirdi.
2. **Zone'lar kategoriden otomatik değil, Seller Manager'ın serbestçe oluşturduğu manuel zone'lar.**
   Daha zengin/gerçekçi ama daha fazla kurulum işi — kullanıcı bu trade-off'u bilerek seçti.
3. **Bir ürün bir şubede en fazla bir zone'a ait** (many-to-many değil) — basit tutuluyor.
4. **Zone editörü: form ile kur + sadece konum sürüklenir** (B seçeneği). Tam sürükle+boyutlandır
   (A) bilinçli olarak **stretch-goal** — vakit kalırsa sonra eklenebilir, MVP kapsamı değil.
5. **Ürün atama: aranabilir/filtrelenebilir seçici**, checklist değil — Sprint 7'de planlanan
   2-şirketli demo senaryosunda şirket başına ~700-1000 ürün olacağı için (kullanıcı uyarısı,
   2026-08-07) düz checklist büyük kataloglarda kullanılamaz. Mevcut `GET /api/products/search`
   deseni (POS/StockRequestPage'de zaten var) yeniden kullanılıyor.
6. **SHOULD overlay: bağlantı çizgisi** (A seçeneği) — güçlü ilişkili ama birbirinden uzak
   zone'lar arasına kesikli çizgi + skor etiketi çizilir (liste ayrıca da kalır, çizgi yok
   seçeneği elendi).
7. **COULD metriği: 0-100 yerleşim skoru** (öneri skorlarıyla ağırlıklı ortalama zone-mesafesinin
   normalize edilmiş hali) — "62 → 78 (+16 puan)" gibi tek sayı, çift-sayımı yerine.
8. **Teknoloji: düz SVG/CSS**, yeni bir grafik/canvas kütüphanesi eklenmiyor — projede zaten
   `SalesTrendChart`'ta aynı konvansiyon var (CSS bar chart, kütüphanesiz).

## Veri modeli

Yeni `layout_zones` tablosu (`backend/app/models/layout.py`'ye eklenir, mevcut
`LayoutRecommendationApplication`'ın yanına):

```python
class LayoutZone(Base, TimestampMixin, UpdatedAtMixin):
    """UC-15 SHOULD — Seller Manager'ın kendi şubesi için serbestçe oluşturduğu, floor-plan
    üzerinde konumlandırılan isimli alan (raf/reyon bölgesi). Gerçek fiziksel ölçü değil,
    görsel/göreli bir temsil (bkz. spec — Zone Editörü bölümü)."""

    __tablename__ = "layout_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)

    branch: Mapped["Branch"] = relationship()
```

`stock` tablosuna nullable `zone_id` eklenir (`backend/app/models/catalog.py::Stock`):

```python
zone_id: Mapped[int | None] = mapped_column(ForeignKey("layout_zones.id"), nullable=True)
zone: Mapped["LayoutZone | None"] = relationship()
```

- `zone_id`, `stock`'un composite PK'sinin (`product_id`, `branch_id`) dışında, mevcut satırın bir
  ek alanı — yeni bir join tablosu gerekmiyor, çünkü zaten "bu ürün bu şubede" satırı `Stock`.
- Zone silinirse (`ON DELETE`), o zone'daki ürünlerin `zone_id`'si `NULL`'a düşer (`ondelete="SET
  NULL"`) — ürün stok/fiyat kaydını kaybetmez, sadece plandan "atanmamış" hale döner.
- Soft-delete kapsamında değil (`companies`/`regions`/`branches`/`employees`/`products` listesine
  girmiyor, madde 9 "Şema Detaylandırma" kararıyla tutarlı) — zone silme gerçek silme, geçmişe FK
  ile bağlı bir olay kaydı değil.
- Migration: `layout_zones` tablosu + `stock.zone_id` kolonu tek bir Alembic migration'da.

## Zone editörü (frontend)

`LayoutSuggestionPage.tsx`'e yeni bir "Mağaza planı" bölümü eklenir (mevcut çift/skor listesi
kalkmaz, altında/yanında durur — MUST'ın üzerine ekleniyor, onun yerine geçmiyor).

**Zone oluşturma/düzenleme formu:**
- Zone adı (metin), genişlik/yükseklik (sayısal alan — piksel/birim, gerçek ölçü değil göreli).
- Ürün atama: arama kutusu (isim/SKU, `GET /api/products/search` + o üründe `zone_id` güncellemesi
  için mevcut `PATCH /api/stock/{id}` kullanılır — yeni alan `zone_id`, `ROLE_ALLOWED_FIELDS`'e
  `seller_manager` için eklenir). Bulunan ürün "ekle"ye tıklanınca zone'un ürün listesine düşer;
  listeden "çıkar" aynı üründe `zone_id: null` PATCH'i tetikler.
- Kaydedilince `POST /api/layout-zones` (yeni zone) veya `PATCH /api/layout-zones/{id}` (var olanı
  düzenleme — sadece adı/boyutu, konum ayrı, aşağıya bkz.).

**Canvas (floor-plan görünümü):**
- Tüm zone'lar `x, y, width, height`'e göre bir `<svg>`/mutlak-konumlu `<div>` alanında dikdörtgen
  olarak çizilir (StockManagerDashboard'daki tablo yerine, bu sayfaya özgü yeni bir görsel alan).
- Sadece **konum** (`x, y`) fare ile sürüklenip bırakılabilir — boyut sabit kalır (resize yok,
  MVP kararı #4). Bırakınca `PATCH /api/layout-zones/{id}` ile `x, y` kaydedilir.
- Zone hiç kurulmamışsa (branch'te `layout_zones` boşsa), bu bölüm "Henüz bir mağaza planı
  oluşturmadınız" boş-durumu + "Zone ekle" butonuyla gösterilir; sayfanın geri kalanı (mevcut
  çift/skor listesi) bugünkü gibi çalışmaya devam eder — hiçbir şey kırılmaz.

## SHOULD — Öneri overlay'i

`GET /api/reports/layout-suggestion` çıktısına her ürünün `zone_id`'si eklenir (mevcut
`suggestions` listesindeki her `product_a_id`/`product_b_id` için `product_a_zone_id`/
`product_b_zone_id`, `Stock` join'i ile — branch zaten scope'lu).

Frontend, canvas üzerinde: her öneri çifti için iki ürünün zone'ları farklıysa (aynı zone'da
değillerse) iki zone merkezi arasına kesikli bir çizgi + skor etiketi (`%68` gibi) çizilir. Her
iki ürün de zone'suzsa (`zone_id: null`) o çift için çizgi çizilmez (planda gösterilecek bir nokta
yok) — mevcut liste görünümünde normal şekilde görünmeye devam eder.

## COULD — Simülasyon + yerleşim skoru

**Yerleşim skoru formülü** (frontend'de, zaten yüklenmiş `suggestions` + zone konumlarıyla,
backend'e ekstra istek atmadan hesaplanır):

1. Her öneri çifti için zone merkezleri arası Öklid mesafesi hesaplanır (`d_i`). İki ürün aynı
   zone'daysa ya da biri zone'suzsa, o çift skor hesabına dahil edilmez (mesafe belirsiz).
2. Ağırlıklı ortalama mesafe: `avg_d = Σ(score_i × d_i) / Σ(score_i)`.
3. Normalize: `layout_score = round(100 × max(0, 1 - avg_d / MAX_DISTANCE))`, burada
   `MAX_DISTANCE` = canvas'ın köşegen uzunluğu (tüm zone'ların bounding box'ı) — yani "en kötü
   olası mesafe" 0 puan, "üst üste/bitişik" 100 puana yakın.
4. Hiçbir çift hesaba dahil edilemiyorsa (tüm ürünler zone'suz ya da hiç zone yok) skor
   gösterilmez ("Simülasyon için önce ürünleri zone'lara atayın" notu).

**Simülasyon akışı:**
- "Simülasyon modu" toggle'ı. Kapalıyken canvas salt-görsel + normal zone-sürükleme (kaydedilen).
  Açıkken zone sürükleme **sadece local component state**'te tutulur (backend'e PATCH gitmez),
  bağlantı çizgileri ve yerleşim skoru her sürüklemede canlı yeniden hesaplanır (adım 1-3, tamamen
  client-side, ek API çağrısı yok).
- Başlangıç skoru ("mevcut: 62") sabit gösterilir, sürükledikçe ("simülasyon: 78, +16") yanında
  güncellenir.
- "Kaydet" — simülasyondaki tüm değişen zone konumları için gerçek `PATCH /api/layout-zones/{id}`
  çağrıları yapılır, mod kapanır. "Vazgeç" — local state atılır, zone'lar kayıtlı konumlarına
  döner, mod kapanır.

## API (yeni/değişen endpoint'ler)

**`GET /api/layout-zones`** (sadece `seller_manager`, kendi şubesi — implicit branch_id, mevcut
`stock.py` konvansiyonuyla tutarlı) → `[{id, name, x, y, width, height, product_ids: [...]}]`
(`product_ids`, `Stock.zone_id == zone.id` üzerinden türetilir, ayrı bir alan tutulmaz).

**`POST /api/layout-zones`** (sadece `seller_manager`) — body: `{name, width, height}`. `x, y`
varsayılan `0, 0` (kullanıcı sonradan sürükler). Branch, JWT'den implicit.

**`PATCH /api/layout-zones/{id}`** (sadece `seller_manager`, kendi şubesindeki zone) — kısmi
güncelleme (`name`/`width`/`height`/`x`/`y`, `exclude_unset` deseni — mevcut `stock.py`
konvansiyonu). Çapraz-şube erişim 404.

**`DELETE /api/layout-zones/{id}`** (sadece `seller_manager`) — zone silinir, o zone'daki
`stock.zone_id` alanları `NULL`'a düşer (DB-level `ON DELETE SET NULL`, ekstra kod gerekmez).

**`PATCH /api/stock/{product_id}`** (mevcut endpoint) — `ROLE_ALLOWED_FIELDS`'e `seller_manager`
için `zone_id` eklenir (`{"price_override", "zone_id"}`). `branch_manager`/`region_manager`/
`general_manager` de mevcut tam-kalıtım kuralı gereği (2026-08-07'de kapatılan önceki madde)
otomatik olarak bu alanı da kazanır — ayrı bir karar gerekmiyor, `_INHERITED_FIELDS` setine dahil.

**`GET /api/reports/layout-suggestion`** (mevcut, değişen) — her suggestion satırına
`product_a_zone_id`/`product_b_zone_id` eklenir (nullable).

## Frontend dosyaları

- `LayoutSuggestionPage.tsx` — mevcut çift/skor listesinin üzerine "Mağaza planı" bölümü eklenir
  (canvas + zone editör formu + simülasyon toggle).
- Yeni `api/layoutZones.ts`, `types/layoutZone.ts`.
- `api/stock.ts::StockUpdatePayload`'a `zone_id?: number | null` eklenir.
- Yeni küçük bileşenler: zone dikdörtgeni + sürükleme (mevcut kütüphane yok, `pointerdown`/
  `pointermove`/`pointerup` ile elle, StockManagerDashboard'daki modal deseninden bağımsız yeni
  bir etkileşim — projede ilk sürükle-bırak UI'ı).

## Test planı

- `sellermgr1`: zone oluşturma (form), ürün arama+ekleme, canvas'ta sürükleyip bırakma (`x, y`
  kalıcı), zone silme (ürünlerin `zone_id`'sinin `NULL`'a düştüğü doğrulanır).
- Öneri overlay'i: iki ürün farklı zone'dayken çizgi+skor görünmesi, aynı zone'dayken çizgi
  çizilmemesi, zone'suz üründe çizgi çizilmemesi.
- Simülasyon: mod açıkken sürüklemenin `PATCH` tetiklemediği (network sekmesinde doğrulanır),
  skorun canlı güncellendiği, "Kaydet" ile gerçek `PATCH`lerin gittiği, "Vazgeç" ile state'in
  sıfırlandığı.
- Yetkisiz rol (örn. `stock_manager`, `cashier`) → `layout-zones` endpoint'lerinde 403.
- Çapraz-şube erişim (branch2'nin seller_manager'ı branch1'in zone'unu `PATCH` edemez) → 404.
- Regresyon: zone hiç kurulmamış branch'te (`sellermgr2` ilk kullanımda) sayfa hâlâ eskisi gibi
  çalışıyor, konsol hatasız.

## Kapsam dışı (bu spec'te işlenmedi)

- Tam sürükle + serbest boyutlandırma (zone editörü A seçeneği) — stretch-goal, vakit kalırsa.
- Zone'ların kategoriyle otomatik ilişkilendirilmesi — kullanıcı kararıyla elendi (#2).
- Many-to-many ürün-zone ilişkisi — kullanıcı kararıyla elendi (#3).
- Gerçek fiziksel ölçü birimi/ölçek (metre vb.) — `width`/`height` göreli/keyfi birim, gerçek
  mağaza ölçüsüyle eşleşmiyor.
