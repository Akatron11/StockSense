# StockSense Projesi için Piyasa Araştırması — Benzer Sistemler

> Kaynak: `topic.pdf` — "StockSense: Stock Control POS & Store Remodeling Recommender" proje brifi.
> Bu liste, projenin kapsadığı alanlarda (POS, envanter, satış analitiği, mağaza düzeni önerisi) halihazırda var olan sistemleri, karşılaştırma ve konumlandırma amacıyla derler.
>
> **Not:** Brif 3 kişilik takım öneriyor, ancak proje **solo (tek kişi)** olarak geliştiriliyor. Bu doküman boyunca kapsam/zaman/yöntem önerileri buna göre revize edilmiştir — paralel çalışma değil, sıralı ve düşük bakım yüklü seçimler önceliklidir.

---

## 1. POS + Envanter Yönetimi
Doğrudan "checkout + stok düşme" fonksiyonuna sahip, doğrudan rakip sayılabilecek sistemler.

| İsim | Not |
|---|---|
| **Square POS** | Küçük perakendede yaygın, güçlü envanter modülü |
| **Shopify POS** | E-ticaret + fiziksel mağaza entegrasyonu |
| **Lightspeed Retail** (eski adı: Vend) | Perakendeye özel, çok terminalli senkronizasyon |
| **Toast POS** | Ağırlıklı olarak restoran/perakende karışık |
| **Clover POS** | Donanım + yazılım paketi olarak satılıyor |
| **Odoo POS** | Açık kaynak / self-hosted alternatif |

## 2. Mağaza Düzeni / Planogram Yazılımları
"Store remodeling recommendation" kısmına en yakın, projenin asıl farklılaşma noktası olan kategori.

| İsim | Not |
|---|---|
| **Blue Yonder Space Planning** (eski adı: JDA Space Planning) | Kurumsal seviye raf/layout optimizasyonu |
| **Nielsen Spaceman** | Sektörde en bilinen planogram araçlarından biri |
| **Symphony RetailAI** | Veri odaklı raf ve kategori yönetimi |
| **Impact Analytics** | Space/assortment optimizasyonu |

## 3. Market Basket Analysis / Association Rule Mining Araçları
Projenin teknik alt yapısına (co-occurrence, Apriori) karşılık gelen genel amaçlı araçlar.

| İsim | Not |
|---|---|
| **mlxtend** (Python) | Brifte doğrudan önerilen kütüphane, Apriori/association rules |
| **Orange Data Mining** | Görsel/no-code arayüzle association rule mining |
| **RapidMiner** | Kurumsal veri madenciliği platformu |
| **IBM SPSS Modeler** | Association Rules modülü mevcut |

## 4. Computer Vision Tabanlı Mağaza Analitiği (Kapsam Dışı Referans)
Brifte açıkça "Out of Scope" denen yaklaşım; projeyle karıştırılmaması için referans olarak eklendi.

| İsim | Not |
|---|---|
| **Trax Retail** | Raf görüntüleme + CV tabanlı stok tespiti |
| **Focal Systems** | Otomatik raf/stok takibi, kamera tabanlı |

---

## Square POS vs Lightspeed Retail — Detaylı Kıyaslama

### Ortak Yönler
- İkisi de bulut tabanlı, çok terminalli POS + envanter çözümü sunuyor.
- İkisi de kart işlem ücretlendirmesi benzer seviyede: ~%2.6 + 10¢ (kart hazır işlem).
- İkisi de web + mobil companion arayüzü, satış raporlama, stok takibi ve düşük-stok uyarısı sağlıyor.
- İkisi de küçük/orta ölçekli perakendeciler için tasarlanmış, hızlı kurulum vaat ediyor.
- İkisi de üçüncü parti entegrasyonlarla (muhasebe, e-ticaret) genişletilebiliyor.

### Farklı Yönler

| Kriter | Square POS | Lightspeed Retail |
|---|---|---|
| Fiyatlandırma modeli | Ücretsiz plan var, aylık sabit ücret yok (temel kullanımda) | Aylık taban ücret var (~$89/ay), ücretsiz plan yok |
| Hedef kitle | Küçük işletme, tekli lokasyon, basit katalog | Çok lokasyonlu, karmaşık ürün kataloğuna sahip büyüyen perakendeciler |
| Envanter derinliği | Temel düzeyde; varyant/PO takibi için "Retail Plus" ek ücretli | Yerleşik güçlü envanter: varyant matrisleri, seri no takibi, PO iş akışları |
| Çoklu lokasyon yönetimi | Sınırlı | Merkezi stok senkronizasyonu, konsolide raporlama |
| Raporlama | Temel satış raporları | Daha derin/detaylı analitik |
| Kurulum hızı / öğrenme eğrisi | Anında operasyona geçiş, minimum öğrenme eğrisi | Daha fazla yapılandırma gerektirir, daha dik öğrenme eğrisi |
| Ek ekosistem | Ödeme, bordro, online sipariş — tek sağlayıcıdan bütünleşik paket | Restoran modunda masa yönetimi, kitchen display gibi özel modüller |

---

## Blue Yonder Space Planning vs Nielsen Spaceman (NIQ) — Kıyaslama

### Ortak Yönler
- İkisi de kurumsal seviye planogram yazılımı — sürükle-bırak ile sanal raf/fikstür üzerinde ürün yerleştirme.
- İkisi de satış/performans verisine dayalı optimizasyon yapıyor (space-to-sales, profit per linear foot gibi metrikler).
- İkisi de mağaza kümeleme (clustering) ve "what-if" senaryo simülasyonu sunuyor.
- İkisi de HQ-mağaza arası gerçek zamanlı senkronizasyon/dağıtım özelliğine sahip.
- İkisi de büyük CPG/perakende zincirlerine hitap ediyor, POS'tan bağımsız ayrı bir "space management" katmanı olarak satılıyor.

### Farklı Yönler

| Kriter | Blue Yonder Space Planning | Nielsen Spaceman (NIQ) |
|---|---|---|
| Konumlandırma | "Endüstri standardı" planogramlama, büyük ölçekli kurumsal | Nielsen'in pazar verisiyle entegre space planning |
| 2026 öne çıkan özellik | AI ajanları ile doğal dilde toplu planogram düzenleme | "Smart placement algorithm" ile otomatik yerelleştirilmiş planogram üretimi |
| Veri kaynağı | Kendi satış/performans verisi | Nielsen'in kendi pazar ölçüm verisiyle zenginleştirilmiş analiz |
| İşbirliği modeli | Web tabanlı, tedarikçi/mağaza ekipleri "tek versiyon" üzerinde ortak çalışabiliyor | HQ-mağaza arası senkronize dijital ortam |
| Vaat edilen iş etkisi | Operasyonel verimlilikte %50'ye varan artış | Gelirde %10-20 artış (alan yeniden dağılımı ile) |

### Ortak Nokta — İkisi de StockSense'in Kapsamının Dışında
Her ikisi de çok büyük ölçekli, ayrı bir yazılım kategorisi — POS'a gömülü değil, ayrı satılan kurumsal ürünler. Küçük mağaza ölçeğinde erişilebilir değiller ve association-rule/co-occurrence'ı basit bir şekilde göstermek yerine kurumsal "space-to-sales" optimizasyon motorları sunuyorlar. Bu, satır 8-10'daki boşluğu (küçük ölçekli, POS'a gömülü, basit ama kanıtlanabilir layout önerisi) doğruluyor.

---

## Satır 8 — Layout Önerisi Motoru İçin Yöntem Değerlendirmesi

### Seçenek 1: Basit Co-occurrence Sayma
Fişlerdeki ürün çiftlerinin birlikte geçme sayısını sayar (örn. "Cips-Kola: 204 kez birlikte satıldı, %68 birliktelik").

**Artıları:** Hızlı uygulanır (pandas ile birkaç saat), sonucu açıklaması kolay ve sezgisel, küçük seed veri setinde bile anlamlı sonuç verir, parametre ayarı derdi yok.
**Eksileri:** Sadece ikili ilişkileri doğal olarak yakalar, istatistiksel güç taşımaz (rastgele mi gerçek mi ayırt edemez), akademik derinliği Apriori'ye göre daha sınırlı görünebilir.

### Seçenek 2: Apriori / Association Rule Mining (mlxtend)
Support, confidence ve **lift** metrikleriyle çalışır; lift > 1 gerçek bir ilişkiyi, lift ≈ 1 tesadüfi gösterir. Çoklu ürün gruplarını (A+B+C) da yakalayabilir.

**Artıları:** Yanlış pozitifleri filtreler, çoklu grup yakalar, brifte doğrudan önerilen yöntem olduğu için akademik ağırlığı yüksek, ileride genişletilebilir.
**Eksileri:** Parametre hassasiyeti (min support/confidence yanlış seçilirse ya hiç kural çıkmaz ya da anlamsız kadar çok kural çıkar), küçük seed veri setinde istatistiksel olarak zayıf/gürültülü kalabilir, açıklaması ("lift 2.3") co-occurrence kadar sezgisel değil, geliştirme süresi daha uzun.

### Seçenek 3: Hibrit Yaklaşım
Katman 1 (MUST): Basit co-occurrence ile temel öneriyi garanti altına al. Katman 2 (vakit kalırsa): mlxtend ile en güçlü çiftlerin lift değerini hesaplayıp "istatistiksel doğrulama" olarak ekle (örn. "204 kez birlikte satıldı — lift skoru 2.3, yani tesadüfi değil").

**Artıları:** Risk düşük (co-occurrence her zaman MUST'u karşılar), akademik derinlik eklenebilir, açıklaması hâlâ anlaşılır kalır, geliştirme süresi kontrollü (Katman 2 opsiyonel).

**Eksileri:**
- **Bakım yükü (solo geliştirmede daha ağır):** İki ayrı analiz motoru = iki ayrı kod yolu, iki ayrı test senaryosu, daha fazla hata yüzeyi. Bu değerlendirme başta 3 kişilik ekip varsayımıyla yapılmıştı; proje **solo** yürüdüğü için bu dezavantaj katlanarak büyüyor — tek kişi hem geliştirici hem test eden hem de zaman yöneticisi olduğu için iki motoru paralel değil sırayla, tek başına idame ettirmek zorunda.
- **Sonuç çelişkisi:** Co-occurrence'ın "en güçlü" dediği çift ile Apriori'nin lift'e göre "en güçlü" dediği çift farklı çıkabilir; bunu uzlaştıracak ek mantık gerekir.
- **Gerekçelendirme riski:** Brif zaten "co-occurrence VEYA Apriori, ikisi de yeterli" diyor — ikisini birden yapmak jüri gözünde sağlam bir mimari karardan çok gereksiz karmaşıklık (over-engineering) olarak okunabilir, "neden ikisini birden yaptınız" sorusuna net cevap gerektirir.
- **Zaman bütçesi riski (solo'da kritik):** "Opsiyonel" olsa da pratikte "madem başladık tamamlayalım" güdüsüyle asıl MUST/SHOULD işlerinden (örn. satır 9 floor-plan görselleştirme) zaman çalınabilir. Ekip varken bu riski bir başka üye dengeleyebilirdi; solo'da bu tamamen kendi disiplinine kalıyor.
- **Küçük veride katma değer şüphesi:** Seed veri sınırlıysa, ikinci katmanın lift hesaplaması güven katmak yerine gürültülü/güvenilmez bir sayı üretip kafa karıştırabilir.

### Durum
Karar henüz verilmedi — üç seçenek de masada. Solo geliştirmede zaman bütçesi çok daha sıkı olduğu için, hibrit yaklaşımın getirdiği ekstra bakım yükü daha ağır basıyor; **Seçenek 1 (basit co-occurrence)** şu an en güvenli varsayılan gibi duruyor, ama nihai karar netleşmedi.

### Solo Geliştirme İçin Satır 8 → 9 → 10 Sıralaması
Ekip olmadığı için paralel iş bölümü yapılamaz; satırlar sırayla ilerlenmeli:

1. **Satır 8 önce, tamamen bitir** — analiz motorunun çıktı formatı (hangi ürün, hangi bölge, hangi skor) netleşmeden satır 9'a geçmek gereksiz revizyon riski doğurur.
2. **Sonra satır 9** — satır 8'in çıktı formatı belli olduğu için floor-plan görselleştirmesini doğrudan gerçek veriyle bağlayabilirsin, mock veri aşamasına gerek kalmaz.
3. **Satır 10 en son, yalnızca vakit kalırsa** — zaten COULD seviyesinde en düşük öncelikli, hem satır 8 hem satır 9'un üzerine kurulu olduğu için ikisi oturmadan başlanmamalı.

Satır 9'daki görselleştirme *tamamen* satır 8 bitmeden de bir iskelet (statik/örnek veriyle çizim) olarak kodlanabilir, ama gerçek entegrasyon satır 8'in çıktı formatına bağlı olduğundan, solo'da bağlam değiştirme maliyetini azaltmak için **8'i bitirip sonra 9'a geçmek** öneriliyor.

---

## Gap-Fill Tablosu — POS & Inventory Management

StockSense'in bu boyuttaki hedef konumu: **Square kadar kolay öğrenilir, Lightspeed kadar derin envanter kontrolüne yaklaşan** bir orta nokta.

| Boyut | Square POS | **StockSense (Hedef)** | Lightspeed Retail |
|---|---|---|---|
| Öğrenme eğrisi | Çok kolay — anında kullanım | **Kolay** — Square seviyesinde basit checkout akışı | Orta/zor — yapılandırma gerektirir |
| Temel checkout akışı | Var, sade | **Var** — ürün seç, adet gir, satışı tamamla | Var, daha fazla adım/opsiyon içerebilir |
| Stok düşümü (concurrency) | Var ama detay şeffaf değil | **Var** — brifte açıkça istenen gerçek eşzamanlılık senaryosu (2 terminal, son birim) test edilecek | Var, kurumsal ölçekte test edilmiş |
| Manuel SKU/kod girişi | Var | **Var** (SHOULD) — barkod donanımı gerektirmeden hızlı checkout | Var |
| Düşük stok uyarısı | Var (Retail Plus'ta daha esnek) | **Var** — yapılandırılabilir eşik (MUST) | Var, daha gelişmiş kurallarla |
| Varyant / seri no takibi | Ek ücretli modülde | Yok (proje kapsamı dışı, brifte istenmiyor) | Var — güçlü yönü |
| Purchase order (PO) iş akışı | Ek ücretli modülde | Yok (kapsam dışı) | Var — güçlü yönü |
| Çoklu terminal senkronizasyonu | Var, temel düzey | **Var** (opsiyonel WebSocket ile) — brifte "real-time sync" olarak belirtilmiş | Var, kurumsal düzeyde sağlam |
| Envanter derinliği (genel) | Temel | **Orta** — stok ekle/düzenle + seviye görüntüleme, ileri varyant yönetimi yok | Derin — karmaşık katalog, çoklu lokasyon |
| Fiyatlandırma modeli konumu | Ücretsiz/düşük maliyet | (Akademik proje — pazar fiyatlandırması kapsam dışı) | Aylık taban ücretli, daha pahalı |

### Yorum
Bu tablo, StockSense'in POS/envanter ekseninde **Square'in basitliğini** korurken **Lightspeed'in derinliğine yaklaşmadığını, sadece brifte istenen ölçüde** (configurable low-stock threshold, concurrency-safe decrement, temel raporlama) bir orta nokta hedeflediğini gösteriyor. Varyant matrisleri ve PO iş akışları gibi Lightspeed'in asıl güçlü olduğu alanlar bilinçli olarak kapsam dışı bırakılmış — bu, projenin "her şeyi yapmaya çalışmama" stratejisiyle tutarlı.

---

## Gereksinim Bazlı Gap-Fill Tablosu (Brief'e Göre)

Brifte listelenen her gereksinim için Square POS ve Lightspeed Retail'in bunu karşılayıp karşılamadığı işaretlenmiştir (✅ Var / ❌ Yok / ⚠️ Kısmen). **Gap (StockSense)** sütunu, her satırın altındaki gerekçeli açıklamada detaylandırılmıştır.

| # | Gereksinim (Brief) | Öncelik | Square POS | Lightspeed Retail | Gap (StockSense) |
|---|---|---|---|---|---|
| 1 | Çalışan POS akışı: ürün seç, adet gir, satışı tamamla, stok düşsün | MUST | ✅ Var | ✅ Var | Parite |
| 2 | Eşzamanlı 2 terminalden son birime satış — concurrency güvenliği | MUST | ⚠️ Kısmen — gerçek zamanlı stok senkronu var ama race-condition davranışı kamuya açık/dokümante değil | ⚠️ Kısmen — çoklu lokasyon/terminal senkronu güçlü ama son-birim yarış durumu davranışı dokümante değil | Açıkça kanıtlanan concurrency güvenliği (canlı demo) |
| 3 | Manager stok ekleme/düzenleme + güncel seviye görüntüleme | MUST | ✅ Var | ✅ Var | Parite, sonra fırsat olursa genişletme |
| 4 | Configurable low-stock alert eşiği | MUST | ✅ Var (Retail Plus'ta) | ✅ Var | Parite, sonra fırsat olursa dinamik eşik önerisi (COULD) |
| 5 | Manuel SKU/kod girişi (barkod donanımı gerektirmeden) | SHOULD | ✅ Var | ✅ Var | Parite |
| 6 | Ürün/kategori bazlı satış raporu, seçilebilir tarih aralığı | MUST | ✅ Var (Item sales, Category sales — Dashboard) | ✅ Var (40+ hazır rapor) | Parite (temel raporlar), sonra fırsat olursa layout önerisiyle entegrasyon |
| 7 | Gerçek satış verisinden best-seller/slow-mover tespiti | MUST | ✅ Var (Sell-through report) | ✅ Var (Lightspeed Insights) | Parite (temel raporlar), sonra fırsat olursa layout önerisiyle entegrasyon |
| 8 | Co-occurrence / association-rule (Apriori) tabanlı mağaza düzeni önerisi | MUST | ❌ Yok | ❌ Yok | **Hâlâ araştırılıyor** — asıl farklılaşma noktası, yöntem (co-occurrence vs Apriori) karara bağlanacak |
| 9 | Öneriyi basit layout/floor-plan diyagramı olarak görselleştirme | SHOULD | ❌ Yok | ❌ Yok | **Hâlâ araştırılıyor** |
| 10 | Layout değişikliği simülasyonu + tahmini iyileştirme metriği | COULD | ❌ Yok | ❌ Yok | **Hâlâ araştırılıyor** |
| 11 | Manager için read-focused mobil companion app (stok, uyarı, rapor) | MUST | ✅ Var (Square mobil app/Dashboard app) | ✅ Var (Lightspeed mobil app) | Parite |

### Gap (StockSense) — Gerekçeli Açıklamalar

**Satır 1 — POS akışı (ürün seç, adet gir, satış tamamla, stok düşsün):**
Parite. Square ve Lightspeed bu temel akışı zaten sorunsuz sağlıyor; burada yenilik aramak anlamsız çünkü bu, pazarın çözülmüş bir problemi. StockSense bu noktada rakiplerle eşit seviyede doğru ve güvenilir çalışmayı hedefler; geliştirme efor bütçesi bunun yerine satır 8-10'daki asıl farklılaşma alanına (layout önerisi) ayrılır.

**Satır 2 — Eşzamanlı 2 terminalden son birime satış (concurrency):**
Açıkça kanıtlanan concurrency güvenliği. Square ve Lightspeed'in bu senaryodaki (aynı anda iki terminalin son 1 adete "yarışması") davranışı kamuya açık dokümantasyonda net şekilde açıklanmıyor — yani rakipler bunu bir güven/pazarlama noktası olarak öne çıkarmıyor. StockSense bunu bilinçli olarak atomic database update / row-level lock (örn. PostgreSQL `SELECT...FOR UPDATE` ya da `UPDATE...WHERE stock > 0` deseni) ile çözüp, brifin "Definition of Done" kısmında istendiği gibi canlı bir demo ile (iki terminal, son birim, biri kabul biri reddedilir) kanıtlar. Bu, hem teknik doğruluk hem de "biz bunu görünür şekilde test ettik" anlamında rakiplerden ayrışan somut bir güven noktasıdır.

**Satır 3-4 — Manager stok ekleme/düzenleme + configurable low-stock alert eşiği:**
Önce parite, sonra fırsat olursa genişletme. Standart stok düzenleme ve sabit/configurable eşik ayarı her iki rakipte de var; bunu MUST seviyesinde doğru yapmak önceliklidir. Zaman ve kapasite kalırsa, sabit eşik yerine satış hızına göre dinamik/önerilen eşik (örn. "bu ürün haftada ortalama 12 satılıyor, eşiği 5 yerine 15 önerelim") gibi COULD seviyesinde bir ek katılabilir — ancak bu brifte istenmediği için önce MUST'lar garanti altına alınmadan bu yöne kaynak ayrılmaz. Amaç: önce güvenli teslim, sonra fırsatçı iyileştirme.

**Satır 5 — Manuel SKU/kod girişi (barkod donanımı gerektirmeden):**
Parite. Her iki sistem de bunu standart olarak sunuyor; barkod donanımı gerektirmeyen hızlı checkout basit bir UX detayı, farklılaşma potansiyeli taşımıyor. Doğru ve hızlı çalışması yeterli.

**Satır 6-7 — Ürün/kategori satış raporu + best-seller/slow-mover tespiti:**
Önce parite (temel raporlar), sonra layout önerisiyle entegrasyon. Lightspeed'in 40+ hazır raporu ve Square'in Item/Category sales dashboard'u gibi derinlemesine bir raporlama katmanı kurmak bu projenin kapsamı ve süresi için gereksiz risk taşır — brifte istenen sadece "tarih aralığı seçilebilir ürün/kategori raporu" ve "gerçek veriden best-seller/slow-mover tespiti" (MUST seviyesinde, karmaşık değil). Bunlar sağlandıktan sonra, vakit kalırsa raporlama ekranından tek tıkla "bu veriye göre layout önerisini gör" akışı kurularak reporting ile store-remodeling özelliği entegre bir hikaye haline getirilebilir — bu, ayrı iki modül gibi değil, birbirini besleyen tek bir sistem gibi sunulmasını sağlar.

**Satır 8, 9, 10 — Co-occurrence/association-rule tabanlı layout önerisi, floor-plan görselleştirmesi, simülasyon:**
Hâlâ araştırılıyor. Bu üç satır, brifin ana değer önerisinin ("small retail stores... have no data-driven sense of store layout") doğrudan karşılığı ve gap tablosunun en kritik bölümü — hem Square/Lightspeed (POS tarafı) hem de Blue Yonder Space Planning/Nielsen Spaceman (kurumsal planogram tarafı) bunu ya hiç sunmuyor ya da çok büyük ölçekli, POS'tan bağımsız, erişilemez kurumsal ürünler olarak sunuyor. StockSense'in konumu: küçük ölçekli bir POS'un içine gömülü, basit ama kanıtlanabilir (co-occurrence/Apriori tabanlı, gerçek satış verisine dayanan) bir layout önerisi — bu boşluk netleşti, ama yöntem seçimi (basit co-occurrence sayma mı, yoksa baştan Apriori/mlxtend mi) ve Blue Yonder/Nielsen Spaceman'den çıkarılacak ek dersler henüz kesinleşmedi, bu yüzden karar bekleniyor.

**Satır 11 — Manager için read-focused mobil companion app:**
Parite. Her iki sistem de stok/uyarı/rapor görüntüleyen bir mobil uygulama sunuyor. StockSense bunu React Native/Flutter ile aynı temel işlevle (salt-okunur, tam POS değil) karşılar; burada da farklılaşma hedeflenmiyor.

---

### Gözlem (Gap Tablosu Genel Değerlendirmesi)
- Satır 1, 3–7, 11: Her iki sistem de bu temel POS/raporlama gereksinimlerini zaten karşılıyor — burada StockSense'in farklılaşma alanı yok, sadece "doğru yapmak" yeterli.
- Satır 2: Her iki sistemde de kamuya açık dokümantasyon, tam olarak brifte tarif edilen "son birimde yarışan iki terminal" senaryosunu netleştirmiyor — bu senaryonun StockSense'te açıkça test edilip gösterilmesi (brifte de "Definition of Done" içinde isteniyor) belirgin bir kanıtlanabilirlik avantajı olabilir.
- Satır 8–10: **Asıl boşluk burada.** Her iki kurulu sistem de association-rule/co-occurrence tabanlı layout önerisini ve görselleştirmesini sunmuyor. StockSense'in temel değer önerisi bu üç satırda yoğunlaşıyor.
