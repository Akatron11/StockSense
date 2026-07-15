# StockSense — Jira / Scrum Sprint Planı

Hoca talimatı: proje Scrum ile yönetilecek (Jira board zorunlu). Bu dosya, `stocksense-ogrenme-plani.md`'deki 7 fazı gerçek takvime (6 Temmuz 2026 – 14 Ağustos 2026, 40 gün) bağlar ve Jira board'un epic/sprint yapısını tanımlar.

---

## Sprint 1 Detaylandırması (6 – 13 Temmuz, 8 gün)

**Gün 1-3 (6-8 Temmuz) — Planification & SRS:**
- Jira board kurulumu (epic'ler + sprint'lerin board'a girilmesi)
- GitHub repo kurulumu
- Geliştirme araçlarının kurulumu (Python, Node, PostgreSQL/Docker, Expo, vb. — bkz. `stocksense-ogrenme-plani.md`)
- SRS dokümanı yazımı: Scope, Introduction, Audience, Use Case'ler, Component tablosu, Non-functional requirements (performance, hardware, security), Functional requirements, Diyagramlar (Class diagram, Use Case diagram), Features listesi

**Gün 4-8 (9-13 Temmuz) — Backend Temelleri:**
- Python syntax tazeleme, FastAPI temel routing/Pydantic, basit CRUD denemesi
- SQLAlchemy ile PostgreSQL bağlantısı, ilk model tanımları

---

## Sprint 2 Detaylandırması (14 – 19 Temmuz, 6 gün)

**Prototype / UI Design (retroaktif olmayan, Sprint 2 başında tamamlandı):**
- 20 ekranlık HTML/CSS wireframe prototipi (Figma yerine elle kod — kullanıcı tercihi): Login, 7 rol evi
  (kabuk + pano), Kasiyer POS + ödeme/iade/PIN modalları, stok/işlem ekranları (4), raporlama/layout (4),
  hesap/personel ekranları (4) — bkz. `prototype.md`, `prototype/` klasörü
- Ortak kabuk deseni netleştirildi (rol-bazlı filtreli sidebar + üst-bar, paylaşılan `app.css`/`app.js`)
- Rol modeli düzeltmesi: eski tek "Admin" → **Satıcı Yöneticisi** (vendor/tenant-üstü) + **Şirket IT**
  (şirket-içi teknik) olarak ikiye ayrıldı — mimari/SRS/use-case diyagramına işlendi
- İade/değişim PIN akışı netleştirildi: onay işlem *başlatılırken* değil *tamamlanırken* istenir
- Multi-tenant login çözümü kararlaştırıldı: subdomain → `company_id` (mimariye madde 16 olarak eklendi)
- i18n (TR/EN) NFR olarak eklendi; wireframe'de aktifleştirilmedi (bilinçli karar — React'te react-i18next
  ile yapılacak, aynı işi iki kez yapmamak için)

**DB Şeması & Auth:**
- `employees.role` enum'ı 9 role göre güncellenecek (Kasiyer, Stock Manager, Seller Manager, Operasyon Şefi,
  Şube/Bölge/Genel Müdür, Şirket IT, Satıcı Yöneticisi — + 5 yardımcı rol)
- Satıcı Yöneticisi için `branch_id`/`region_id`/`company_id` üçünün de nullable olduğu doğrulanacak (tenant-üstü)
- JWT payload tasarımı: `company_id` (+ varsa `branch_id`/`region_id`) claim'leri
- Subdomain → `company_id` çözümleyen middleware/dependency (madde 16) — auth katmanıyla birlikte kurulacak
- Şifre hash'leme (bcrypt/argon2), `manager_pin` alanı için ayrı doğrulama akışı

---

## Sprint 3 Detaylandırması (20 – 25 Temmuz, 6 gün)

**Epic: POS Core**
- Ürün arama endpoint'i — barkod/SKU (UC-01 / FR-01)
- Satış tamamlama endpoint'i — DB-atomic stok düşümü (UC-02 / FR-02, mimari madde 3)
- Concurrency testi — son birim yarışı senaryosu (mimari madde 3)
- İade/değişim başlatma + tamamlarken PIN onay endpoint'leri (UC-03/UC-04 / FR-03/FR-04)
- Kasaya geç — terminal seçimi endpoint'i (UC-05 / FR-05)
- Şube stoğu CRUD + düşük stok eşiği (UC-08/UC-10 / FR-08/FR-10)
- Merkez depo talebi endpoint'i (UC-09 / FR-09)
- Düşük stok + SKT bildirim mekanizması — bildirim hedefi prensibi (UC-11/UC-12 / FR-11/FR-12, mimari madde 14)

## Sprint 4 Detaylandırması (26 Temmuz – 2 Ağustos, 8 gün)

**Epic: Web Frontend**
- Wireframe'deki ortak kabuk deseni (sidebar+topbar) React bileşenine dönüştürülür
- Login sayfası — gerçek JWT auth entegrasyonu (mimari madde 8, 16)
- Kasiyer POS ekranı — gerçek API bağlantısı (ödeme/iade/PIN modalları)
- Rol bazlı pano'lar: Operasyon Şefi, Şube/Bölge/Genel Müdür, Seller/Stock Manager
- Ürün kataloğu, fiyat yönetimi, merkez depo talebi ekranları
- Hesap yönetimi, personel kaydı, vardiya takvimi ekranları
- Satıcı Yöneticisi + Şirket IT panelleri
- react-i18next entegrasyonu — TR/EN (mimari madde 17)

## Sprint 5 Detaylandırması (3 – 7 Ağustos, 5 gün)

**Epic: Analytics & Layout Önerisi**
- pandas ile co-occurrence sayımı (mimari madde 7)
- mlxtend ile Apriori association-rule mining (mimari madde 7)
- Satış hacmine göre otomatik yöntem geçiş eşiği belirleme (mimari madde 7)
- Seed/demo veri üretimi — kasıtlı desenli çekirdek + gürültü (mimari madde 7, Seed Veri Stratejisi)
- Satış raporu, en çok/az/hiç satılmayan, KPI rapor endpoint'leri — live-query (UC-13/14/16 / FR-13/14/16, mimari madde 5)
- Layout önerisi frontend entegrasyonu — "öneriyi uygula" (UC-15 / FR-15)

## Sprint 6 Detaylandırması (8 – 12 Ağustos, 5 gün)

**Ön koşul:** Mobil companion app kapsamı henüz netleşmedi (bkz. `PROCESS.md` açık madde) — bu sprint başlamadan
önce kapsam kararı (hangi UC'ler, `company_features` temsili) verilmeli.

**Epic: Mobile App**
- Mobil kapsam kararı (kapsam netleşmeden diğer görevler başlamaz)
- Expo proje kurulumu
- Salt-okunur ekranlar — aynı backend API'lerini kullanır (mimari madde 8, "Mobil API entegrasyonu")
- Mobil JWT auth (web ile paylaşımlı token mekanizması)

## Sprint 7 Detaylandırması (13 – 14 Ağustos, 2 gün)

**Epic: Integration & Test & Sunum**
- Uçtan uca entegrasyon testleri (POS concurrency senaryosu dahil)
- Seed veri ile çok-kiracılı (multi-tenant) demo senaryosu — `*.localhost` subdomain gösterimi (mimari madde 16)
- Sunum hazırlığı — hocaya demo akışı
- Son doküman senkronizasyonu (İngilizce mimari dosyasının güncellenmesi — bkz. CLAUDE.md dosya notları)

---

## Genel Sprint Takvimi

| Sprint | Tarih | Süre | İçerik |
|---|---|---|---|
| Sprint 1 | 6 Tem – 13 Tem | 8 gün | Planification + SRS + Backend temelleri |
| Sprint 2 | 14 Tem – 19 Tem | 6 gün | Prototype/UI Design + DB Şeması & Auth |
| Sprint 3 | 20 Tem – 25 Tem | 6 gün | POS Backend (concurrency, stok) |
| Sprint 4 | 26 Tem – 2 Ağu | 8 gün | React Web Frontend |
| Sprint 5 | 3 Ağu – 7 Ağu | 5 gün | Analytics & Layout Önerisi |
| Sprint 6 | 8 Ağu – 12 Ağu | 5 gün | React Native Mobil App |
| Sprint 7 | 13 Ağu – 14 Ağu | 2 gün | Entegrasyon, Test, Sunum |

## Jira Epic Listesi

1. Planification & Setup
2. Documentation — SRS
3. Backend Foundation
4. Prototype / UI Design (Wireframe)
5. Veritabanı Şeması & Auth
6. POS Core
7. Web Frontend
8. Analytics & Layout Önerisi
9. Mobile App
10. Integration & Test & Sunum

## Jira Board Yapısı

- **Sütunlar:** Backlog → To Do → In Progress → Review/Test → Done
- Her epic altına ilgili sprint'in görevleri task olarak eklenir.
- Gerçek doküman içeriği (SRS metni, diyagramlar) Jira'da değil, repo içinde (`docs/` klasörü ya da bu dizindeki markdown dosyaları) tutulur; Jira task'ları bu içeriğe link verir.

---

## Not

- Bu plan, `stocksense-ogrenme-plani.md`'deki 7 fazın birebir takvime aktarılmış hali. Fazların içeriği değişirse bu dosya da güncellenmeli.
- Sprint süreleri eşit değil (8/6/6/8/5/5/2 gün) — haftalık eşit bölme yerine gerçek iş yüküne (öğrenme + geliştirme dengesine) sadık kalındı.
- **14 Temmuz güncellemesi:** Prototype/UI Design yeni bir epic olarak eklendi (Epic 4), bu yüzden eski Epic 4-9
  bir kayarak Epic 5-10 oldu. Jira board'da epic'leri girerken bu sıralamayı kullan.
