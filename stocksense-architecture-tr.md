# StockSense — Architecture

Bu dosya, projenin genel işletmelere ölçeklenebilir mimarisini adım adım tartışıp karara bağladıkça buraya ekleniyor.

> İlgili geçmiş belgeler (referans amaçlı):
> - `stocksense-todo-small-scale-draft.md` — ilk küçük-ölçek varsayımıyla yazılmış kapsam taslağı.
> - `stocksense-mimari-kararlar.md` — küçük-ölçek varsayımıyla alınmış önceki mimari kararlar (referans/ders çıkarma amaçlı, bu dosyanın yerini alıyor).

---

## Kapsam Değişikliği — Neden Bu Dosya Var

Hoca talimatı: proje küçük ölçekli tek mağaza için değil, **genel işletmelere** (zincir marketler, şubeleşmiş satış yerleri, küçük aile marketleri) ölçeklenebilir bir ürün olarak tasarlanacak — talep eden işletmeye göre ölçeklendirilecek.

`topic.pdf` brifi "small retail stores" diye çerçeveliyor; bu hocanın sözlü talimatıyla genişletildi. Tasarım prensibi: **veri modeli ve rol modeli genel (büyük) senaryoya göre kurulacak, ama implementasyon en küçük somut örnekten (tek şube) başlayıp genişleyecek.** Böylece küçük işletme senaryosu, büyük modelin doğal bir alt kümesi olur; tersini yapmak (küçükten tasarlayıp büyütmeye çalışmak) şema/rol yeniden yazımı gerektirirdi — ilk turda yaşadığımız sorun buydu.

Referans senaryo: DIMA (KKTC, Girne) gibi bir zincir market — Karaoğlanoğlu, Girne Merkez, Lapta, Alsancak, Özanköy gibi şubeleri olan, bölge ve muhtemelen merkez ofis katmanı olan bir yapı.

---

## 1. Organizasyon Hiyerarşisi

**3 seviye: Şube (Store) → Bölge (Region) → Merkez/Şirket (Company).**

Küçük bir aile marketi bu modelin "1 şubeli, bölgesiz, doğrudan company-level'a bağlı" en basit hali olarak temsil edilir — ayrı bir veri modeli gerekmez.

## 2. Rol Hiyerarşisi

```
Kasiyer, [login'siz personel: kasap, manav, raf düzenleyen personel, temizlikçi vb.]
  ↓ (yetki/POS ekseni)                    ↓ (shift/vardiya ekseni)
{Stock Manager, Seller Manager} ←── paralel, yetki kalıtımı yok ──→ Operasyon Şefi
  ↓                                                                    ↓ (organizasyonel, yetki değil)
Şube Müdürü ←──────────────────────────────────────────────────────────┘
  ↓
Bölge Müdürü                      ← bölgesindeki tüm şubelerden sorumlu
  ↓
Genel Müdür                       ← şirket genelinden sorumlu (iş/business yetkisi)

Şirket IT (bir şirketin kendi teknik ekibi — iş hiyerarşisinin DIŞINDA, paralel teknik rol; Genel Müdür dahil kimsenin üstünde/altında değil)
Satıcı Yöneticisi (TÜM müşterilerin dışında/üstünde — satıcının/proje sahibinin platform rolü; tek bir şirkete bağlı değil)
```

Kasiyer'in iki ayrı bağlantısı var: **yetki/POS ekseni** üzerinden Stock Manager/Seller Manager'ın (dolayısıyla Şube Müdürü'nün) yetki kalıtımı zincirinde yer alır (bkz. "Yetki kalıtımı" altındaki madde); **shift/vardiya ekseni** üzerinden ise Operasyon Şefi'ne bağlıdır (bkz. madde 13). Bu iki eksen birbirinden bağımsızdır.

### Rol tanımları
- **Kasiyer:** POS ile satış yapar.
- **Stock Manager:** Şubenin stoklarından sorumlu (ekleme/düzenleme, düşük stok eşiği).
- **Seller Manager:** Planogram/raf dizaynından sorumlu — brief'in satır 8-10'undaki (co-occurrence/Apriori tabanlı layout önerisi) **doğal sahibi ve kullanıcısı** bu rol.
- **Operasyon Şefi:** Mağaza içi operasyondan ve şubedeki tüm personelin (login'li ya da login'siz, managerlar ve yardımcıları hariç) vardiya/shift takibinden sorumlu (bkz. madde 13). POS yetkisine sahiptir (bkz. "Kasaya Geç"). Stock Manager/Seller Manager ile **paralel/aynı seviyede** — aralarında yetki kalıtımı yoktur, stok/layout gibi manager-seviyesi iş kararı veremez.
- **Şube Müdürü:** O şubenin tüm operasyonundan sorumlu; şube seviyesindeki tüm raporları/yetkileri görür.
- **Bölge Müdürü:** Kendi bölgesindeki tüm şubeleri görebilir/karşılaştırabilir.
- **Genel Müdür:** Şirket genelinde tam iş görünürlüğü ve karar yetkisi — tüm bölgeleri/şubeleri görür.
- **Şirket IT:** Bir şirketin kendi teknik/IT ekibi. Kendi şirketi içinde hesap kurtarma (şifre sıfırlama, kilit açma — Genel Müdür dahil herkesin hesabı için), sistemde bozulan veriye müdahale, ve üstü olmayan üst hesabın (yeni Genel Müdür) oluşturulması. **İş kararı veremez, business hiyerarşisinin bir parçası değildir** — Genel Müdür'ün ne üstünde ne altında, tamamen paralel/ayrı bir teknik yetki alanı.
- **Satıcı Yöneticisi (Vendor):** Satıcının/proje sahibinin platform rolü — tenant üstü, tüm müşterilerin dışında. Yeni müşteri onboarding'i (Day-0 kurulum), müşteri bazlı feature/rol konfigürasyonu ve görsel kimlik (branding) bu roldedir. Tek bir şirkete bağlı değildir (`company_id` yok). (Eski tek "Admin" rolü, gerçekte iki farklı sorumluluğu birleştirdiği için Satıcı Yöneticisi + Şirket IT olarak ikiye ayrıldı.)

### Yetki kalıtımı (permission inheritance) prensibi
İş hiyerarşisindeki her üst rol, altındaki tüm rollerin yetkilerini otomatik kapsar (Şube Müdürü ⊇ Stock Manager + Seller Manager + Kasiyer; Bölge Müdürü ⊇ kendi bölgesindeki tüm Şube Müdürü yetkileri; Genel Müdür ⊇ hepsi). Bu, her rol için ayrı yetki listesi yazmak yerine tek bir kural + role özel ek yetkiler şeklinde modellenir — bakım yükünü azaltır, tutarsızlık riskini düşürür.

### "Kasaya Geç" — Sadece Operasyon Şefi'nde
- "Kasaya Geç" özelliği (panelden aynı oturumda, re-login olmadan POS arayüzüne geçme) **sadece Operasyon Şefi'nde** bulunur. Stock Manager, Seller Manager, Şube Müdürü ve üstü roller bu özelliğe sahip değildir, hiçbir şekilde POS'a geçemezler — bu yetki tamamen Operasyon Şefi'nde toplanmıştır.
- Gerekçe: yoğun saatlerde kasaya destek olma sorumluluğu artık net biçimde Operasyon Şefi'nin görev tanımında; managerlar sadece kendi işlerine (stok, layout, şube yönetimi) odaklanır.
- Mekanizma bir auth değişikliği değildir, sadece UI/route değişikliğidir — session zaten Operasyon Şefi'nin kimliğini taşır; birden fazla terminal varsa müsait olanı seçer.

## 3. Stok Yönetimi — Şube Bazlı, Tedarik Zinciri Kapsam Dışı

- Stok her zaman **şube bazlı** tutulur (`branch_id` ile ilişkili).
- Stoğun fiziksel olarak nasıl geldiği (merkezi depo dağıtımı, direkt toptancı alımı, ya da ikisinin karışımı) bir **tedarik zinciri/lojistik** konusu — sistemin ilgi alanı dışında (otomatik tedarikçiye sipariş geçme zaten kapsam dışıydı, bu kararla tutarlı).

### Concurrency — DB-Atomic Yaklaşım
- Son birim yarışı (brief MUST) uygulama katmanında değil, **veritabanı seviyesinde atomic işlemle** çözülür.
- ❌ Yanlış: "check-then-act" (önce SELECT ile oku, sonra uygulama kodunda karar verip UPDATE et) — okuma/yazma arasındaki boşlukta race condition oluşur.
- ✅ Doğru: Tek atomic sorgu, örn. `UPDATE stock SET quantity = quantity - 1 WHERE product_id = X AND branch_id = Y AND quantity > 0;` — etkilenen satır sayısı 0 ise satış reddedilir.
- Bu mekanizma kaç terminalin aynı anda yarıştığını bilmek zorunda değildir, N terminale/N şubeye genelleşir.

## 4. Ürün Kataloğu ve Fiyatlandırma

- Ürün kataloğu (isim, SKU, kategori) **merkezi/company-level** tanımlanır.
- Fiyat alanı **şube bazlı override edilebilir** (opsiyonel) — boşsa company-level varsayılan fiyat geçerli olur.
- Gerekçe: zincirlerde toptancı fiyatı şubeye göre değişebilir (senin gözlemin); bu esnekliği şemaya baştan koymak, ileride "şubeye göre fiyat farkı" ihtiyacı çıkarsa yeniden yapılanma gerektirmez. Prototipte tüm şubeler aynı fiyatı kullanabilir, mimari zaten iki durumu da destekler.

## 5. Raporlama ve Layout Önerisi — Hesaplama vs Görüntüleme Ayrımı

- Rapor ve layout önerisi şube verisinden hesaplanır (detay ve gerekçe için bkz. madde 7 — "Hesaplama kapsamı").
- **Görüntüleme yetkisi kapsam/hiyerarşiye göre artar:** Şube Müdürü kendi şubesini, Bölge Müdürü bölgesindeki tüm şubeleri, Genel Müdür şirket genelini görür/karşılaştırır.
- Seller Manager, kendi şubesinin layout önerisini görüntüler ve uygulamaya koyar (bkz. Rol tanımları).

### Raporlama — Live-Query
- Satış raporları ve best-seller/slow-mover tespiti, istek anında canlı SQL sorgusuyla hesaplanır (cache/pre-aggregation yok) — madde 9'daki `sale_items` SUM yaklaşımı bu prensibin bir uygulamasıdır.
- Gerekçe: bu ölçekte performans farkı hissedilmez; cache eklemek gereksiz karmaşıklık (invalidation mantığı) getirir.

## 6. Operasyonel Akışlar

### Hesap Oluşturma
- **İlk Kurulum (Day-0):** Bir işletme sisteme yeni geçtiğinde (örn. DIMA sistemi satın aldığında), içeride sıfır veri vardır — şirket, bölgeler, şubeler ve ilk kullanıcılar (ilk Genel Müdür, ilk Bölge Müdürleri, ilk Şube Müdürleri dahil) sisteme girilmelidir. Bu, yeni müşteri onboarding'i olduğu için **Satıcı Yöneticisi** tarafından yapılır (satıcının işi).
- **Steady-State (sistem canlıyken), üst seviye alt seviyeyi oluşturur:**
  - Kasiyer/Stock Manager/Seller Manager hesaplarını **Şube Müdürü** oluşturur — yeni işe alımı en iyi o bilir, her hesap için merkez ofise gitmek gereksiz sürtünme yaratır.
  - Yeni bir Şube Müdürü hesabını **Bölge Müdürü** oluşturur.
  - Yeni bir Bölge Müdürü hesabını **Genel Müdür** oluşturur.
  - Genel Müdür'ün kendi hesabını (örn. yeni bir Genel Müdür atandığında) **Şirket IT** oluşturur — çünkü Genel Müdür'ün iş hiyerarşisinde üstü yoktur. (Day-0'daki *ilk* Genel Müdür'ü Satıcı Yöneticisi kurar; steady-state'teki GM değişikliklerini Şirket IT yürütür.)
- **Şirket IT her zaman override yetkisine sahiptir** — kendi şirketi içinde herhangi bir seviyedeki şifre sıfırlama, toplu hesap açılışı, ya da ilgili yöneticinin bu işi başka birine devretmek istemesi durumunda, Şirket IT bunu her zaman yapabilir.
- Bu, hesap oluşturmayı **iş kararı değil, operasyonel/idari işlem** olarak konumlandırır — Şirket IT'nin "iş kararı veremez" kuralıyla çelişmez.

### İade / Değişim — Manager PIN Onayı
- Gerçek hayattaki gözlem: kapalı kasayı iade/değişim için açmak fiziksel bir anahtar gerektiriyor, belirli bir kişiden isteniyor. Dijital karşılığı: **ikinci bir onay adımı (PIN doğrulama)**.
- **Akış:** Kasiyer iade/değişimi kurar (iade edilecek ürünler + tutar) → işlemi **tamamlarken** aynı POS terminalinde "Onay Gerekli" modalı açılır (PIN, işlem başlatılırken değil *tamamlanırken* istenir — onaylayan, kesinleşmiş iadeyi görerek onaylar) → onay yetkisi olan biri (Stock Manager, Seller Manager, Operasyon Şefi — ya da bunların yardımcıları: Stock Manager Yardımcısı, Seller Manager Yardımcısı; bkz. madde 10) kendi kısa PIN kodunu (4-6 haneli, ana giriş şifresinden ayrı) girer → sistem PIN'i o şubede onay yetkisi olan kullanıcılarla eşleştirir → eşleşme varsa işlem tamamlanır ve kayda hem "işlemi yapan: Kasiyer X" hem "onaylayan: Y" düşer. **Şube Müdürü (ve Şube Müdürü Yardımcısı) bu onay havuzunda yer almaz** — floor-level onay sorumluluğu Stock/Seller Manager ve Operasyon Şefi'nde toplanmıştır.
- Kasiyerin oturumu bu sırada hiç değişmez/kapanmaz — bu bir rol değişimi (bkz. madde 2, "'Kasaya Geç' — Sadece Operasyon Şefi'nde") değil, tek seferlik bir onay olayı.
- Fiziksel anahtarın aksine, dijital onay **tek kişiyle sınırlı değil** — o an şubede bulunan herhangi bir onay yetkilisi (Stock Manager, Seller Manager, Operasyon Şefi ya da bunların yardımcıları) onaylayabilir; Şube Müdürü bu havuzda değildir. Bu, fiziksel dünyadaki gerçek bir sorunu (anahtarı tutan kişi izinliyse iş durur) otomatik çözer.

### Stok Bildirimleri
- Stok tükendiğinde (0'a düştüğünde) VE yapılandırılabilir eşiğin altına düştüğünde **Stock Manager'a bildirim gider** (bu, sabit bir kural değil — bkz. madde 14, "Bildirim Hedefi Prensibi": bildirim o an bu yetkiyi fiilen taşıyan en spesifik aktif role gider).
- Concurrency red olayı (son birim yarışını kaybeden kasiyerin satışı reddedildiğinde) de aynı bildirim kanalına bağlanır — "bu ürün için son birim satıldı, stok 0" sinyali aynı hedef-belirleme prensibiyle (madde 14) ilgili role düşer.

### Ödeme — Tam Mock
- Gerçek bir ödeme gateway'i (Stripe, iyzico vb.) entegre edilmeyecek.
- "Satış tamamlandı" denildiğinde sadece veritabanına `payment_method: cash/card` gibi bir alan yazılır, hiçbir gerçek finansal işlem tetiklenmez.
- Gerekçe: akademik prototip için gerçek ödeme entegrasyonu gereksiz hukuki/mali risk taşır; brief de bunu talep etmiyor.

## 7. Layout Önerisi Yöntemi — Ölçeğe Göre Otomatik Geçiş

- Yöntem seçimi **otomatik ve satış hacmine dayalı**: düşük hacimli işletmelerde (aile marketi tipi, günlük satış sayısı düşük) **basit co-occurrence sayımı**, yüksek hacimli işletmelerde (zincir market şubesi) **Apriori/association-rule mining** kullanılır.
- Gerekçe: Zincir marketteki günlük yüksek satış hacminde basit co-occurrence sayımı yanıltıcı/gürültülü sonuçlar üretir (rastgele birlikte satılan ürünler de anlamlı görünür); küçük işletmede ise Apriori'nin support/confidence hesaplamaları için yeterli veri hacmi olmayabilir, gereksiz karmaşıklık katar.
- **Geçiş mekanizması:** Tek bir eşik değeri (satış hacmi/gün ya da benzeri bir metrik) belirlenir; şubenin/işletmenin hacmi bu eşiğin altındaysa co-occurrence, üstündeyse Apriori otomatik devreye girer. Ara bir "hibrit" katman yok — geçiş net bir eşikle yapılır.
- **Eşik değeri implementasyon aşamasında belirlenecek:** Her iki yöntem de gerçek/seed veri üzerinde test edilip hangi satış hacmi aralığında hangi yöntemin yanlış/anlamsız sonuç verdiği gözlemlenerek eşik sayısal olarak sabitlenecek (şu an tasarım kararı netleşti, sayısal değer henüz yok).
- **Hesaplama kapsamı:** Öneri her zaman **şube bazlı** hesaplanır — şirket genelinde birleştirilmiş veri kullanılmaz. Gerekçe: madde 4'teki şube bazlı fiyat override'ı zaten şubeler arası satış davranışının farklılaşabileceğini kabul ediyor; her şubenin kendi co-occurrence/Apriori deseni kendi gerçekliğini yansıtmalı.

### Seed/Demo Veri Stratejisi
- Definition of Done'ın gerektirdiği "seeded transactions" için hibrit yaklaşım: **kasıtlı desenli çekirdek** (örn. Cips-Kola, Ekmek-Süt gibi bilinçli yüksek co-occurrence içeren birkaç ürün çifti) + bunun üzerine **programatik çoğaltma**.
- Çoğaltma sırasında sadece desenli çiftler değil, **rastgele/sıradan alışverişler de (gürültü)** karıştırılır — gerçek hayatta çoğu alışveriş tek ürün veya alakasız kombinasyonlardan oluşur.
- Gerekçe: gürültüsüz veri, co-occurrence/Apriori motorunun "her şeyi anlamlı buluyor" gibi yanıltıcı bir izlenim vermesine yol açar. Gerçek sınav, motorun gürültü içinde gerçek sinyali ayırt edebilmesi — bu doğrudan madde 7'deki eşik testinin veri kaynağıdır.
- Veri üretimi implementasyon aşamasında ele alınacak.

## 8. Teknoloji Stack

- **Backend:** Python + FastAPI.
- **Veritabanı:** PostgreSQL, SQLAlchemy (ORM) üzerinden erişilecek.
- **Web/POS frontend:** React.
- **Mobil (manager companion app):** React Native — web tarafında zaten React öğrenileceği için component/state mantığı aynı ekosisteme taşınıyor, ayrı bir dil/framework öğrenme yükü eklenmiyor.
- **Analitik:** pandas (co-occurrence) + mlxtend (Apriori) — bkz. madde 7.
- **Auth:** JWT (token tabanlı, stateless) — hem web hem mobil client aynı token mekanizmasını kullanır, ayrı bir session store gerekmez.
- **Real-time sync:** Yok — **polling** kullanılacak (brief'te zaten opsiyonel olarak geçiyor). Concurrency güvenliği zaten DB-atomic mekanizmayla (madde 3 — "Concurrency — DB-Atomic Yaklaşım") sağlandığı için WebSocket gerekmiyor. *Not: WebSocket, proje kapsamı dışında, istenirse ayrıca kişisel öğrenme hedefi olarak takip edilebilir.*
- **Mobil API entegrasyonu:** Mobil app, web dashboard ile **aynı backend API endpoint'lerini** kullanır — ayrı/mobile-özel endpoint yazılmaz, sadece UI farklılaşır.

## 9. Veritabanı Şeması

Tasarım süreci: küçükten büyüğe doğru (tek tablo yeter mi sorusuyla başlanıp, ihtiyaç ortaya çıktıkça ayrıştırılarak) ilerlendi. Alan adları İngilizce, tablo isimleri çoğul.

```
products
  id (PK), name, sku, category, default_price, cost_price, best_before_date

stock
  product_id (FK), branch_id (FK), quantity, low_stock_threshold, price_override (nullable)
  [product_id + branch_id birlikte PK]

branches
  id (PK), name, region_id (FK)

regions
  id (PK), name, company_id (FK)

companies
  id (PK), name

employees
  id (PK), first_name, last_name, username (nullable), password_hash (nullable), role,
  branch_id (FK, nullable), region_id (FK, nullable), company_id (FK, nullable),
  age, address, manager_pin (nullable)

sales
  id (PK), sale_date, branch_id (FK), employee_id (FK)

sale_items
  id (PK), sale_id (FK), product_id (FK), quantity, line_total

shifts
  id (PK), employee_id (FK), shift_date, start_time, end_time, is_day_off (boolean)
```

### Tasarım Kararlarının Gerekçeleri
- **`sku`:** Brief'in SHOULD gereksinimi olan "hızlı manuel SKU/kod girişi"ni karşılar — kasiyer barkod donanımı olmadan bu koda göre ürünü hızlıca bulabilir. `best_before_date` (son tüketim tarihi) ile karıştırılmamalı, ikisi alakasız bilgiler.
- **`products` / `stock` ayrımı:** Ürünün sabit/tanımlayıcı bilgisi (isim, kategori) merkezi katalogda (`products`); "şu şubede kaç adet var, ne fiyata" bilgisi şubeye özgü olduğu için ayrı bir tabloda (`stock`). `products`—`branches` arası ilişki çoka-çok olduğu için (`bir ürün birden çok şubede, bir şube birden çok üründe bulunur`), `stock` bu ilişkiyi çözen ara/bridge tablodur.
- **`price_override` nullable:** Boşsa `products.default_price` geçerli olur (madde 4); şube farklı fiyatlandırmak isterse bu alanı doldurur.
- **Hiyerarşi zinciri (branches → regions → companies):** Her seviye, bir üst seviyenin FK'sini taşır (bire-çok ilişkilerde FK "çok" tarafına gider) — küçük işletme senaryosu, `region_id`/`company_id` alanlarının tek bir sabit satıra işaret ettiği en basit alt küme olarak temsil edilir (madde 1).
- **`employees` tek tablo, 3 nullable FK:** Roller farklı seviyelere bağlı olduğu için (Kasiyer/Stock Manager/Seller Manager/Operasyon Şefi/login'siz "Personel"/Şube Müdürü/Şube Müdürü Yardımcısı/Stock Manager Yardımcısı/Seller Manager Yardımcısı → branch; Bölge Müdürü/Bölge Müdürü Yardımcısı → region; Genel Müdür/Genel Müdür Yardımcısı → company; Şirket IT → company; Satıcı Yöneticisi → hiçbiri, tenant üstü), her personel sadece bir seviyeye bağlı olacağından üç FK alanından ikisi (Satıcı Yöneticisi'nde üçü) her zaman boş kalır. Bu normal bir tasarım — "polymorphic association" (tek bir alanın duruma göre farklı tablolara işaret etmesi) yerine tercih edildi çünkü veritabanı seviyesinde referans bütünlüğü otomatik garanti edilir.
- **`manager_pin` nullable:** Sadece PIN onay yetkisi olan roller için doldurulur — Stock Manager, Seller Manager, Operasyon Şefi ve bunların yardımcıları (madde 6 — iade/değişim onay akışı). Şube Müdürü ve üstü roller bu havuzda olmadığı için bu alan onlarda boş kalır.
- **`password_hash` / `username` nullable:** Login'i olmayan personel (kasap, manav, raf düzenleyen personel vb. — bkz. madde 13) da aynı `employees` tablosunda tutulur, ama bu alanlar boş bırakılır — sisteme giriş yapamazlar. Bu, ayrı bir "login'siz personel" tablosu açmak yerine tercih edildi çünkü `shifts` tablosunun tek bir `employee_id` ile hem login'li hem login'siz personele referans verebilmesini sağlıyor (polymorphic association'dan kaçınma gerekçesiyle tutarlı).
- **`password_hash`:** Şifre düz metin olarak değil, hash'lenmiş halde tutulacak (implementasyon notu).
- **`cost_price`:** Maliyet fiyatı — `default_price` (satış fiyatı) ile birlikte net kâr marjı hesaplanabilmesi için eklendi (bkz. madde 12).
- **`sales` / `sale_items` ayrımı:** Bir satışın başlık bilgisi (tarih, şube, personel) satış başına bir kez; içindeki her ürün kalemi (ürün, miktar, tutar) ayrı bir satır. Toplam tutar ayrı bir alanda saklanmaz — ihtiyaç anında `sale_items.line_total` alanları `SUM` ile toplanarak hesaplanır (madde 5 — "Raporlama — Live-Query" prensibiyle tutarlı). `sale_items`, co-occurrence/Apriori hesaplamasının veri kaynağıdır — aynı `sale_id`'yi paylaşan satırlar "birlikte satın alınan ürünler" kümesini oluşturur.

---

## 10. Çoklu Müşteri (Multi-Tenant) Mimarisi

Proje bitiminde tek bir müşteriye değil, farklı ölçekteki işletmelere (DIMA gibi büyük zincirler, aile işletmeleri gibi küçük yapılar) satılabilecek bir ürün olarak tasarlanacak. Müşteri kendisi konfigüre etmez — **Satıcı Yöneticisi** (satıcı/proje sahibinin platform rolü), müşterinin ihtiyacına göre sistemi yapılandırıp teslim eder.

- **İzolasyon modeli:** Ayrı deployment/veritabanı yerine **paylaşımlı şema** kullanılacak — tüm müşteriler aynı veritabanında, `companies` tablosu zaten mevcut `branches → regions → companies` hiyerarşisi doğal tenant sınırı olarak kullanılacak.
- **Sorgu izolasyonu:** JWT token'a kullanıcının `company_id`'si (ve varsa `branch_id`/`region_id`) gömülür; tüm sorgular ortak bir middleware/dependency katmanından geçerek otomatik olarak bu kapsamla filtrelenir — her endpoint'te ayrı ayrı `company_id` filtresi yazmaya güvenilmez, altyapı seviyesinde garanti edilir.
- **Feature flag sistemi:** Yeni bir `company_features` tablosu — hangi modüllerin (layout önerisi, mobil app, merkez depo senaryosu, KPI modülü vb.) hangi müşteride aktif olduğunu tutar. Satıcı, yeni müşteri onboarding'inde bunu bir panelden işaretler. **Şema netleşti (SRS Class Diagram sırasında):** her feature için bir satır (`company_id, feature_name, enabled`) — yeni bir özellik eklendiğinde şema değişikliği gerekmez, sadece yeni satırlar eklenir.
  > **TODO:** Mobil companion app'in `company_features` üzerinden nasıl temsil edileceği (tek bir "mobil erişim" feature'ı mı, yoksa her mobil ekran/rapor için ayrı feature'lar mı) — mobil kapsamı netleşince (bkz. SRS `stocksense-srs-tr.md` başındaki mobil TODO notu) buraya geri dönülecek.
- **Rol seti:** Sabit kalır, müşteriye göre sadece aç/kapa yapılır — yeni rol tipi tanımlama runtime bir özellik değildir (ileride geri bildirime göre elle geliştirilebilir). Sabit set: Kasiyer, Stock Manager, Seller Manager, Şube Müdürü, Bölge Müdürü, Genel Müdür, Operasyon Şefi, Şirket IT, Satıcı Yöneticisi — artı beş **yardımcı** rolü: Seller Manager Yardımcısı, Stock Manager Yardımcısı, Şube Müdürü Yardımcısı, Bölge Müdürü Yardımcısı, Genel Müdür Yardımcısı. Yardımcı roller, kendi principal'ıyla (örn. Stock Manager Yardımcısı ↔ Stock Manager) **birebir aynı yetkiye** sahiptir — sistemde ayrı bir "vekalet durumu" takibi yoktur, ikisi her an aynı işlemleri yapabilir. Amaç: principal izinli/hasta olduğunda kesintisiz kapsama sağlamak.
- **Görsel kimlik:** Yeni bir `company_branding` tablosu (logo url, ana renk, işletme adı) — müşteriye özel tema.

## 11. Stok Kaynağı — Şube Stoğu ve Merkez Depo (Madde 3 Güncellemesi)

Madde 3'teki "tedarik zinciri kapsam dışı" kararı, **fiziksel lojistiğin** (toptancı ilişkileri, nakliye vb.) kapsam dışı kaldığı anlamında hâlâ geçerli. Ancak sisteme şu senaryo eklenecek: bir şube, bir ürünü **(a) kendi stoğundan kullanır** ya da **(b) merkez depodan getirtir**. Bu, tam bir tedarik zinciri/lojistik yönetimi değil — sadece stoğun iki olası kaynağının sistemde temsil edilmesi. Detay (merkez depo veri modeli, transfer akışı) implementasyon aşamasında netleştirilecek.

## 12. Finansal Takip — Net Kâr Marjı (Madde 9 Şema Güncellemesi)

`products` tablosuna `cost_price` (maliyet fiyatı) alanı eklendi — mevcut `default_price` satış fiyatını temsil ediyor, `cost_price` ile birlikte net kâr marjı hesaplanabilecek. Bu, işletme sahibinin mali takibini yapabileceği KPI raporlarının temelini oluşturur.

## 13. Shift/Vardiya Yönetimi

Operasyon Şefi, şubedeki **tüm personelin** (login'li ya da login'siz — kasap, manav, raf düzenleyen personel dahil, managerlar ve yardımcıları hariç) vardiya saatlerini ve off günlerini yönetir. Bu, ilk tasarımda (madde 2'nin eski notu) kapsam dışı bırakılmıştı, şimdi gerçek bir özellik olarak dahil ediliyor.

- Login'i olmayan personel `employees` tablosunda `username`/`password_hash` alanları NULL bırakılarak temsil edilir (bkz. madde 9 gerekçeleri) — sisteme giriş yapamazlar, sadece vardiya amaçlı kayıtları vardır.
- Bu kişilerin `role` alanı genel bir "Personel" değeri taşır — kasap/manav/raf düzenleyen gibi iş unvanları sistem için önemli değildir, hepsi aynı muameleyi görür.
- Yeni `shifts` tablosu (madde 9) her personel için tarih, başlangıç/bitiş saati ve off-gün bilgisini tutar.

## 14. Bildirim Hedefi Prensibi ve SKT (Son Kullanma Tarihi) Bildirimi

**Genel prensip:** Rol-bazlı bildirimler (SKT, düşük stok vb.) sabit bir hesaba değil, **o an ilgili yetkiyi fiilen elinde bulunduran en spesifik/en alt aktif role** gider. Madde 10'daki rol aç/kapa sistemi nedeniyle her müşteride farklı roller aktif olabilir — büyük bir zincirde bu doğrudan Stock Manager'a gider, Stock Manager hesabı olmayan küçük bir işletmede ise yetki kalıtımı zinciri gereği (madde 2) doğrudan Şube Müdürü'ne/patrona gider. Bu prensip hem SKT bildirimine hem de madde 6'daki düşük stok bildirimine uygulanır.

**SKT akışı:** Bir ürünün SKT'si yaklaştığında bildirim yukarıdaki prensiple hedef role ulaşır. Operasyon Şefi (o işletmede aktifse) sürece **her zaman sabit bir adım olarak** dahil olur — indirim kararı ve raf yerleşimi için bildirimi alan yetkiliyle birlikte çalışır. Operasyon Şefi bildirimi ilk alan taraf değildir, kalıtım zincirinin dışında kaldığı için (madde 2) stok/SKT bildirim hedefi olamaz.

Sistem, ürünün fiziksel konumunu (depo/raf) ayrı bir veri alanıyla takip etmez — tek `stock.quantity` yeterli kabul edilir; ayrı bir `shelf_stock` tablosu/"rafa çıkarma" işlemi değerlendirildi ama gereksiz karmaşıklık getirdiği için (YAGNI) vazgeçildi.

## 15. Barkod Tarama Akışı

Kasiyer barkod okuttuğunda sistem `products.sku` alanı üzerinden arama yapar — ayrı bir `barcode` alanı yoktur, barkod donanımı `sku` ile birebir aynı koda karşılık gelir (madde 9'daki `sku` gerekçesiyle tutarlı). Eşleşme bulunduğunda kasiyer ekranında ürün adı, fiyat ve SKT gösterilir. SKT yaklaşmış bir üründe indirim/raf kararı kasiyerin görev alanı değildir (bkz. madde 14) — ekranda sadece bilgi olarak görünür, herhangi bir aksiyon kasiyerden beklenmez. Barkod okuyucu donanımı klavye-emülasyonu olarak çalışır, ayrı bir donanım entegrasyonu gerekmez (implementasyon notu).

## 16. Multi-Tenant Login (Subdomain ile Şirket Çözümü)

Madde 10, sorguların JWT'deki `company_id` ile filtrelendiğini söyler ama bu `company_id`'nin **login anında** nasıl belirlendiğini tanımlamamıştı. Karar:

- Her müşteri kendi **subdomain**'inden girer (`dima.stocksense.com`) — gelen isteğin `Host` başlığından subdomain okunur ve `company_id`'ye çözülür. Kullanıcı adları böylece **şirket içinde** benzersiz olur (farklı zincirlerde aynı kullanıcı adı çakışmaz).
- Login ekranı, subdomain'e göre o müşterinin markasıyla (`company_branding`) açılır — giriş öncesi bile markalı deneyim (bkz. madde 10, UC-23).
- **Güvenlik:** Login, kullanıcının gerçekten o subdomain'in şirketine ait olduğunu doğrular (subdomain→`company_id` + kullanıcı-şirket eşleşmesi). Aksi halde A şirketi kullanıcısı B'nin kapısından giriş deneyemez.
- **Satıcı Yöneticisi**, tenant üstü olduğu için ayrı bir yönetim kapısından girer (ör. `admin.stocksense.com`).
- **Demo/teslim:** Gerçek domain/wildcard DNS zorunlu değil — tarayıcıların `*.localhost`'u otomatik `127.0.0.1`'e çözmesi sayesinde (`dima.localhost`, `bakkal.localhost`) birden çok tenant maliyetsiz gösterilebilir. Prod'da wildcard DNS + wildcard TLS gerekir.

## 17. Lokalizasyon (i18n)

Arayüz **iki dilli (TR/EN)**. Dil, Login ekranında seçilir; sistem içinde üst-barda toggle yoktur, kullanıcı menüsünden değiştirilebilir. Implementasyonda React tarafında bir i18n kütüphanesi (react-i18next) kullanılacak. (Gereksinim SRS NFR'de somutlaşır.)

---

## Açık Kararlar (Henüz Netleşmedi)

Yok — mimari/planification aşamasındaki tüm ana kararlar netleşti. Detaylandırma (örn. ek alanlar, index'ler, migration sırası) implementasyon aşamasında ele alınacak.
