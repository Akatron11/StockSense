# StockSense — Mimari Kararlar

Bu dosya, projenin mimari kararlarını (kesinleşenler + açık olanlar) tek yerde takip etmek için tutulur. Planification aşamasında referans alınır.

---

## Kesinleşen Kararlar

### 1. Kullanıcı Ölçeği (Prototip)
- Prototip kapsamı: **2 kasiyer + 1 manager** sabit varsayım.
- Gerekçe: küçük ölçekli tek-mağaza satış yerleri hedefleniyor (zincir/şube değil); gözlemsel olarak çoğunlukla 1-2 kasa, manager genelde işletme sahibinin kendisi.
- Bu bir kapasite sınırı değil, prototip/demo kapsamının doğal büyüklüğü — final aşamada sayı artabilir (örn. 2 manager, 3-4 kasa).
- **Ölçeklenebilirlik koşulu:** N kasiyer/manager'a genelleşme, sadece yeni kullanıcı kaydı eklemekle mümkün olmalı — şema/kod değişikliği gerektirmemeli.

### 2. Concurrency — DB-Atomic Yaklaşım
- Son birim yarışı (brief satır 2, MUST) uygulama katmanında değil, **veritabanı seviyesinde atomic işlemle** çözülecek.
- ❌ Yanlış: "check-then-act" (önce SELECT ile oku, sonra uygulama kodunda karar verip UPDATE et) — okuma/yazma arasındaki boşlukta race condition oluşur.
- ✅ Doğru: Tek atomic sorgu, örn. `UPDATE stock SET quantity = quantity - 1 WHERE product_id = X AND quantity > 0;` — etkilenen satır sayısı 0 ise satış reddedilir.
- Bu mekanizma kaç terminalin aynı anda yarıştığını bilmek zorunda değildir, bu yüzden N terminale genelleşir. Brief'teki "2 terminal" testi bu mekanizmanın **minimum kanıtıdır**, sistemin üst sınırı değildir.

### 3. Ödeme — Tam Mock
- Gerçek bir ödeme gateway'i (Stripe, iyzico vb.) entegre edilmeyecek — ne production modda ne sandbox modda.
- "Satış tamamlandı" denildiğinde sadece veritabanına `payment_method: cash/card` gibi bir alan yazılır, hiçbir gerçek finansal işlem tetiklenmez.
- Gerekçe: akademik prototip için gerçek ödeme entegrasyonu gereksiz hukuki/mali risk taşır (ticari hesap, PCI-DSS uyumluluk vb.); brief de bunu talep etmiyor.

### 4. Raporlama — Live-Query (Prototip)
- Satış raporları ve best-seller/slow-mover tespiti, istek anında canlı SQL sorgusuyla hesaplanacak (cache/pre-aggregation yok).
- Gerekçe: küçük veri ölçeğinde performans farkı hissedilmez; cache eklemek şu an gereksiz karmaşıklık (invalidation mantığı) getirir.
- Final aşamada performans sorunu gözlemlenirse cache/pre-aggregation'a geçiş değerlendirilecek — "önce doğru çalıştır, ölçüm olmadan optimize etme" prensibi.

### 5. Rol Modeli — Manager ⊇ Kasiyer Yetkisi
- Manager, kasiyerin tüm yetkilerini kapsar (POS'a erişebilir); kasiyer manager dashboard'una erişemez.
- Gerekçe: küçük mağazada sahip/manager sık sık kasaya geçer (yoğun saat, kasiyer izinliyken vb.) — gerçekçi senaryo.
- **Geçiş etkileşimi:** Manager panelden "Kasaya Geç" ile aynı oturumda (re-login olmadan) POS arayüzüne geçer; birden fazla terminal varsa müsait olanı seçer. Bu bir auth değişikliği değil, sadece UI/route değişikliği — session zaten manager kimliğini taşıyor.
- Not: Bu geçiş, concurrency güvenliğini etkilemez — DB-atomic mekanizma kimin login olduğunu umursamaz, sadece aynı anda gelen istekleri sıralar.

### 6. Seed/Demo Veri Stratejisi
- Definition of Done'ın gerektirdiği "seeded transactions" için hibrit yaklaşım: **kasıtlı desenli çekirdek** (örn. Cips-Kola, Ekmek-Süt gibi bilinçli yüksek co-occurrence içeren birkaç ürün çifti) + bunun üzerine **programatik çoğaltma**.
- Çoğaltma sırasında sadece desenli çiftler değil, **rastgele/sıradan alışverişler de (gürültü)** karıştırılacak — gerçek hayatta çoğu alışveriş tek ürün veya alakasız kombinasyonlardan oluşur.
- Gerekçe: gürültüsüz veri, co-occurrence/Apriori motorunun "her şeyi anlamlı buluyor" gibi yanıltıcı bir izlenim vermesine yol açar. Gerçek sınav, motorun gürültü içinde gerçek sinyali ayırt edebilmesi.
- Veri üretimi implementasyon aşamasında ele alınacak.

---

## Açık Kararlar (Planification Aşamasında Netleştirilecek)

### 7. Layout Önerisi Yöntemi (Brief satır 8)
- Seçenekler: (a) basit co-occurrence sayma, (b) Apriori/association-rule mining (mlxtend), (c) hibrit.
- Durum: Karar verilmedi. Solo geliştirme + zaman bütçesi nedeniyle basit co-occurrence şu an güvenli varsayılan gibi duruyor, ama kesinleşmedi.
- Not: Bu karar, satır 9 (floor-plan görselleştirme) ve satır 10'un (simülasyon) çıktı formatını doğrudan etkiliyor — önce bu netleşmeli.

### 8. Veritabanı Şeması — Satış/Co-purchase Verisi
- Layout önerisi motorunun besleneceği veri yapısı henüz tasarlanmadı: transactions/receipts tablosu, hangi ürünlerin birlikte satıldığını tutan ilişki.
- Madde 6 (seed veri) ve madde 7 (yöntem) ile birlikte netleşmeli.

### 9. Real-time Sync — WebSocket mı, Polling mi
- Brief'te "optional" olarak geçiyor.
- 2 kasiyer + 1 manager sabit kapsamda, concurrency zaten DB-atomic ile güvenceye alındığı için WebSocket zorunlu değil; polling (her işlemden sonra güncel stok sorgusu) yeterli olabilir.
- Karar verilmedi.

### 10. Teknoloji Stack Seçimi
- Brief "suggested technologies" olarak listeliyor, zorunlu değil (React, React Native/Flutter, FastAPI/Node.js, PostgreSQL, pandas/mlxtend).
- Solo geliştirme olduğu için hangi stack'in seçileceği (özellikle mobile: React Native vs Flutter; backend: FastAPI vs Express) netleşmeli.

### 11. Auth / Kullanıcı-Oturum Mekanizması
- Rol hiyerarşisi netleşti (madde 5: manager ⊇ kasiyer), ama giriş mekanizmasının kendisi netleşmedi — basit kullanıcı adı/şifre mi, token/session yapısı nasıl olacak.
- Karar verilmedi.

### 12. Mobile App Kapsamı ve Entegrasyonu
- Brief "read-focused" diyor. Manager mobile app'in web dashboard ile aynı API'yi mi kullanacağı, yoksa ayrı endpoint'ler mi gerekeceği netleşmeli.
- Karar verilmedi.
