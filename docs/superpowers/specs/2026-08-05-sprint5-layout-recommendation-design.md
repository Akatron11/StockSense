# Sprint 5 — Layout Önerisi (Co-occurrence/Apriori) Tasarımı

**Tarih:** 2026-08-05
**Kapsam:** Sprint 5'in eksik parçası — UC-15 (Layout Önerisi Görüntüleme), mimari madde 7,
`stocksense-jira-sprint-plani.md`'deki "Analytics & Layout Önerisi" epic'i.

## Arka plan / neden

Sprint 4'te satış raporu/KPI backend'i (`/api/reports/sales`, `/api/reports/top-products`,
`/api/reports/profit-margin`) zaten tamamlanmıştı. Sprint 5'in gerçek yeni işi, brief'in
"Store remodeling recommendation" bölümündeki co-occurrence/Apriori tabanlı öneri motoru —
henüz hiç kodlanmamıştı.

Brief'teki (`topic.pdf`, madde 20) gereksinim seviyeleri:
- **MUST:** Kayıtlı satış verisinden (ürün sıklığı + co-purchase deseni) bir layout önerisi üret;
  basit co-occurrence sayımı veya association-rule mining (Apriori) yeterli.
- **SHOULD:** Öneriyi sadece metin listesi değil, basit bir layout/floor-plan diyagramı olarak
  görselleştir.
- **COULD:** Manager önerilen değişikliği simüle edip tahmini iyileşme metriği görsün.
- **Definition of Done:** Üretilen öneri, gerekçesi seed verideki gerçek co-purchase verisine kadar
  izlenebilir şekilde gösterilmeli.

**Kapsam kararı (kullanıcı onaylı, 2026-08-05):** Bu sprintte sadece **MUST + Definition of Done**
kapsanıyor (çift/skor listesi + gerekçe). **SHOULD** (floor-plan/zone görselleştirmesi) ve **COULD**
(simülasyon) bilinçli olarak kapsam dışı bırakıldı, `PROCESS.md`'ye açık madde olarak eklendi.

## Mimari

- Yeni `backend/app/services/layout_recommendation.py`: `compute_recommendation(db, branch_id)` —
  şubenin `Sale`/`SaleItem` kayıtlarını çekip pandas ile co-occurrence sayımı yapar; şube hacmi
  eşiğin üstündeyse mlxtend ile Apriori/association_rules'a geçer. İkisi de aynı çıktı şeklini
  (ürün çifti + normalize skor) üretir — `stock.py`/`reports.py` desenindeki servis-katmanı ayrımına
  uygun.
- Eşik sabiti `LAYOUT_METHOD_THRESHOLD_SALES` bu dosyada modül-seviyesi sabit olarak tutulur, seed
  veriyle kalibre edilir (bkz. Seed Veri bölümü). Şirket bazında yapılandırılabilir değil (kullanıcı
  kararı — mimari madde 7'nin "implementasyon aşamasında belirlenecek" notunu bu sprintte kapatıyor).
- Hesaplama **live-query** (mimari madde 5 — "Hesaplama vs Görüntüleme Ayrımı" prensibiyle tutarlı):
  cache/materialized tablo yok, her istekte hesaplanır.
- Skor gösterimi: co-occurrence'ta support oranı (ilgili çiftin geçtiği satış / toplam satış),
  Apriori'de confidence/lift'ten türetilen bir oran — ikisi de `score` alanında 0-1 arası ondalık
  olarak dönüyor (var olan `stocksense-api-tr.md` konvansiyonu, bkz. API bölümü).

## Veri modeli — yeni tablo

`layout_recommendation_applications` — Seller Manager'ın bir öneriyi "kabul ettim/uyguladım" olarak
işaretlemesinin denetim kaydı (fiziksel raf değişikliği sistem dışında gerçekleşir, bu sadece kayıt).

```python
class LayoutRecommendationApplication(Base, TimestampMixin):
    __tablename__ = "layout_recommendation_applications"
    __table_args__ = (
        UniqueConstraint(
            "branch_id", "product_a_id", "product_b_id",
            name="uq_layout_application_branch_pair",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    product_a_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    product_b_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    applied_by: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

- `product_a_id`/`product_b_id` her zaman `id` küçük→büyük sıralı yazılır (A-B ile B-A aynı kayda
  düşsün diye) — servis katmanında normalize edilir.
- Alembic migration gerekiyor.

## Karar değişikliği: `stocksense-api-tr.md` ile çelişki

`stocksense-api-tr.md` satır 340-356'da UC-15 için önceden şu karar yazılıydı: **"saklı bir
öneri/uygulanmışlık kaydı yok, 'uygulama' tamamen fiziksel dünyada oluyor, ayrı endpoint gerekmiyor."**

**Kullanıcı kararı (2026-08-05):** Bu eski karar değiştirildi — çift bazında "uygulandı" kaydı artık
tutulacak (yukarıdaki tablo). Gerekçe: Seller Manager'ın hangi önerileri kabul edip hangilerini
etmediğini zamanla takip edebilmesi, tek seferlik "gördüm" ile "gerçekten uyguladım" ayrımını
denetlenebilir kılması. `stocksense-api-tr.md` bu tasarımla senkronize edildi (bkz. aşağıdaki API
bölümü — endpoint yolu ve mevcut alan adları [`suggestions`, `product_a_id`/`product_b_id`, `score`]
korundu, sadece `apply` alt-route'u ve `applied`/`applied_at`/`applied_by` alanları yeni eklendi).

## API

**`GET /api/reports/layout-suggestion`** (UC-15, sadece `seller_manager`, kendi şubesi — JWT'den
implicit, query param yok)

```json
{
  "method": "apriori",
  "branch_sales_count": 342,
  "suggestions": [
    {
      "product_a_id": 10, "product_a_name": "Cips",
      "product_b_id": 15, "product_b_name": "Kola",
      "score": 0.82,
      "applied": false, "applied_at": null, "applied_by": null
    }
  ]
}
```

- `suggestions` en güçlü 5 çift, `score` büyükten küçüğe sıralı.
- `branch_sales_count`: hangi yöntemin neden seçildiğinin şeffaflığı için (eşik kararına referans).

**`POST /api/reports/layout-suggestion/apply`** (sadece `seller_manager`)

- Body: `{"product_a_id": 10, "product_b_id": 15}`
- `layout_recommendation_applications`'a upsert (aynı çift tekrar gönderilirse `applied_at`/`applied_by`
  güncellenir, hata vermez).
- Yetkisiz rol → 403 (mevcut konvansiyon).

## Seed veri

**Ürün katalogu genişletmesi (`backend/seed_test_data.py`, mevcut script güncellenir):**
- 3 üründen **~50 ürüne** çıkarılır, **7 kategori**: Süt Ürünleri, Fırın, Temizlik (mevcut) +
  Atıştırmalık, İçecek, Şarküteri, Kahvaltılık (yeni), kategori başına ~6-8 ürün.
- Amaç sadece analitik değil — genel katalog/POS arama/stok ekranlarının demo'da daha gerçekçi
  görünmesi (kullanıcı kararı, 2026-08-05).
- Desenli çiftler (4 tane):
  1. Ekmek ↔ Süt 1L (mevcut)
  2. Cips ↔ Kola
  3. Peynir ↔ Zeytin
  4. Makarna ↔ Salça
- Stok satırları: branch1 (Kadıköy) tüm ~50 ürüne sahip; branch2 (Beşiktaş) sadece bir alt küme
  (mevcut çapraz-şube izolasyon-testi mantığı korunur).
- Tam 50 ürünün kesin isim/SKU listesi implementasyon sırasında yazılır — kategori/sayı yapısı ve
  4 çift burada sabitlendi, geri kalanı düz veri girişi.

**Satış verisi üretimi (`backend/seed_sales_data.py`, yeni/ayrı script):**
- `seed_test_data.py`'dan sonra çalışır, testco'nun ürün/şube/çalışan verisi üzerine `Sale`/`SaleItem`
  üretir.
- Desenli çiftler ağırlıklı rastgele seçimle sık üretilir; kalan ürünler (Deterjan + diğer ~40+ ürün)
  tekil/rastgele kombinasyonlarla gürültü olarak karışır.
- Kadıköy (branch1): ~30-50 satış → düşük hacim, co-occurrence tarafını gösterir.
- Beşiktaş (branch2): ~300-500 satış → yüksek hacim, Apriori tarafını gösterir.
- Satışlar son ~30 gün içine rastgele tarihlere yayılır.
- Script tekrar çalıştırılmadan önce mevcut testco sale/sale_item verisini temizler (idempotent).
- `LAYOUT_METHOD_THRESHOLD_SALES` bu iki hacim arasında bir yere kalibre edilir (implementasyon
  sırasında iki yöntem de gerçek üretilen veriyle denenip gözlemlenerek).

## Frontend

- Yeni `pages/LayoutSuggestionPage.tsx` (`/layout` route'u, `seller_manager` nav'ına path eklenir,
  `layout-onerisi.html` wireframe'inin React karşılığı — ama "raf 1..raf 12" grid'i **kullanılmıyor**,
  onun yerine çift/skor listesi + "Uygula" butonu gösterilir, bkz. SHOULD-erteleme kararı).
- Her satırda: ürün çifti adları, skor (yüzde olarak formatlanmış, `score * 100`), "Uygula" butonu
  (`applied: true` ise "Uygulandı" etiketi/disabled).
- `api/layoutSuggestion.ts`, `types/layoutSuggestion.ts` (yeni).

## Diğer doküman güncellemeleri (bu tasarımla birlikte yapılacak)

- `stocksense-api-tr.md`: UC-15 bölümü — `apply` alt-route'u + yeni alanlar + karar değişikliği notu
  eklenir.
- `PROCESS.md`: iki yeni açık/kapalı madde —
  1. SHOULD (floor-plan/zone görselleştirmesi) ve COULD (simülasyon) bilinçli kapsam dışı — açık madde.
  2. Ürün adlarının TR/EN arasında çevrilmemesi bilinçli bir karar (SKU zaten Latin/İngilizce
     karşılık sağlıyor) — bilgi notu, bug değil.

## Test planı

- `sellermgr1` (Kadıköy) ile `GET /api/reports/layout-suggestion` → `method: "co_occurrence"`,
  Ekmek↔Süt üstte.
- Beşiktaş'ta yeni bir `seller_manager` test kullanıcısıyla aynı endpoint → `method: "apriori"`.
- Yetkisiz rol (örn. `cashier1`) → 403.
- `POST /api/reports/layout-suggestion/apply` → `suggestions` listesinde `applied: true` döndüğü,
  tekrar çağrılınca hata vermediği (upsert) doğrulanır.
- Frontend: tarayıcıda uçtan uca — liste doğru render, "Uygula" tıklanınca state güncelleniyor,
  sayfa yenilenince `applied` durumu kalıcı kalıyor (backend'den geldiği için).

## Kapsam dışı (bilinçli, bu spec'te işlenmedi)

- Floor-plan/zone görselleştirmesi (SHOULD).
- Layout simülasyonu + iyileşme metriği (COULD).
- Ürün adlarının çok dilli (TR/EN) desteği.
