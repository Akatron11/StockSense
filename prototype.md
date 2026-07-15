# StockSense — Prototip Ekran Listesi

Bu dosya, prototipte yer alması gereken **tüm ekranları** ve prototiple ilgili tasarım kararlarını tutar.
Kaynak: `stocksense-srs-tr.md` (Use Case'ler / UC-01 – UC-23). Her ekranın hangi UC'ye karşılık geldiği ve
durumu (yapıldı/yapılacak) işaretlenmiştir. Bölüm bölüm gözden geçirilip onaylandıkça üretilir.

**Araç:** Prototip Figma ile değil, **elle yazılan HTML/CSS** ile üretiliyor (hocanın Figma önerisine karşın
kullanıcı tercihi). Dosyalar `prototype/` klasöründe gerçek `.html` dosyaları olarak duruyor; ileride React
frontend'e temel olacak şekilde kurgulanıyor.

---

## Prototip Kararları

- **Ortak kabuk (shared shell):** Tüm yönetim ekranları tek bir ortak çerçeveyi paylaşır — solda rol-bazlı
  sidebar + üstte marka/branding alanı — sadece orta içerik role/ekrana göre değişir. Ayrı ayrı sayfa
  kurulmaz. (İstisna: Kasiyer POS — tam ekran, sidebar yok.)
- **Rol-bazlı filtreli menü:** Sol menü, o rolün yetkisindeki ekranları gösterir. Müdür rollerinde
  **"kendi işi önde + kalıtılan alt-rol yetkileri ayrı grup"** deseni kullanılır (bkz. yetki kalıtımı,
  `stocksense-architecture-tr.md` madde 2/56).
- **Dil (TR/EN):** Arayüz iki dilli. Dil **Login ekranında** seçilir; sistem içinde üst-barda toggle yoktur,
  **avatar → kullanıcı menüsü** içinden değiştirilir. (i18n, SRS'e NFR olarak eklenecek — bkz. `PROCESS.md`.)
  Prototipte dil geçişi tüm ekranlar bitince JS sözlüğüyle aktifleştirilecek.
- **Multi-tenant / subdomain:** Gerçek üründe her müşteri kendi subdomain'inden girer
  (`dima.stocksense.com`) → Host header'dan `company_id` çözülür, login ekranı o müşterinin markasıyla açılır.
  Prototip **nötr/markasız**; üst-barda "marka alanı — subdomain'e göre değişir" yer tutucusu bu konsepti
  anlatır. (Mimariye "multi-tenant login çözümü" olarak işlenecek — bkz. `PROCESS.md`.)
- **Admin → iki ayrı rol:** Eski tek "Admin" ikiye ayrıldı — **Satıcı Yöneticisi (Vendor)** (tenant üstü;
  Day-0 kurulum UC-17, feature/rol config UC-22, branding UC-23) ve **Şirket IT** (şirket içi teknik; hesap
  override/kurtarma UC-19, steady-state yeni üst hesap UC-18 GM dalı). (architecture-tr + SRS'e işlenecek.)
- **İade PIN = tamamlarken:** İade/değişim onayı (PIN) işlem *başlatılırken* değil, **tamamlanırken** istenir —
  onaylayan, kesinleşmiş iadeyi (ürünler + tutar) görerek onaylar. PIN ayrı bir ekran değil, POS içinde modal.
- **Wireframe konvansiyonu:** Renk yok (gri tonları), gerçek veri yok (gri placeholder çubukları / "grafik
  alanı" kutuları), kutu+etiket düzeyinde — ama hizalama/boşluk/yerleşim temiz ve gerçek.

---

## 0. Genel / Ortak

- [x] **Login** — kullanıcı adı + şifre, sağ üstte TR|EN dil seçimi, markasız. Şifre sıfırlama self-service
  değil (IT'ye yönlendirme notu). → `prototype/login.html`
- [x] **Ortak Layout / Navigasyon (kabuk)** — rol-bazlı sidebar + üst-bar (marka alanı, bildirim zili, kullanıcı
  menüsü). İlk olarak Operasyon Şefi ekranıyla oturtuldu. → `prototype/sef-dashboard.html`
- [x] **Dashboard (rol bazlı ana sayfa)** — karar: ortak kabuk + role göre değişen içerik; operasyonel roller
  doğrudan iş ekranına, müdür rolleri özet panoya düşer. (Landing = ana sayfa, ayrı menü maddesi değil.)

## 1. POS / Satış İşlemleri

- [x] **Kasiyer POS** — barkod/SKU arama + son okutulan ürün (SKT bilgisi) + sepet + toplam (UC-01, UC-02).
  Tam ekran, sidebar yok. → `prototype/kasiyer-pos.html`
- [x] **Ödeme Modalı** — satış tamamlama, nakit/kart (mock) (UC-02). → POS içinde modal.
- [x] **İade/Değişim Modalı** — satış no + iade edilecek ürünler + iade tutarı (UC-03). → POS içinde modal.
- [x] **PIN Onay Modalı** — iade *tamamlanırken* yetkili PIN onayı (UC-04). → POS içinde modal.
- [x] **Kasaya Geç — terminal seçimi** — Operasyon Şefi'nin POS'a geçişi, müsait terminal seçimi (UC-05). → `prototype/kasaya-gec.html`

## 2. Stok Yönetimi

- [x] **Ürün Kataloğu Yönetimi** — Genel Müdür, yeni ürün ekleme/düzenleme (UC-06) → `prototype/urun-katalogu.html`
- [x] **Şube Bazlı Fiyat Belirleme** — Seller Manager, price override (UC-07) → `prototype/fiyat-yonetimi.html`
- [x] **Şube Stok Listesi / Ekleme-Düzenleme** — Stock Manager (UC-08) → `prototype/stok-manager-dashboard.html`
- [x] **Merkez Depodan Stok Talebi** — Stock Manager (UC-09) → `prototype/merkez-depo-talebi.html`
- [x] **Düşük Stok Eşiği Ayarlama** — modal/form (UC-10) → stok-manager içinde modal
- [x] **Bildirim Zili Paneli** — düşük stok + SKT bildirimleri, üst-bardaki zil altında (UC-11, UC-12) → kabuk üst-barında (stok/seller)
- [x] **SKT / İndirim Kararı** — Seller Manager + Operasyon Şefi ortak ekranı (UC-12) → `prototype/skt-indirim-karari.html`

## 3. Raporlama / Layout Önerisi

- [x] **Satış Raporu** — ürün/kategori bazlı, tarih aralığı filtreli (UC-13) → `prototype/satis-raporu.html`
- [x] **En Çok/Az Satan ve Hiç Satılmayan Ürün Raporu** (UC-14) → `prototype/en-cok-az-satan.html`
- [x] **Layout Önerisi** — co-occurrence/Apriori tabanlı raf düzeni (UC-15) → `prototype/layout-onerisi.html`
- [x] **Net Kâr Marjı (KPI) Raporu** (UC-16) → `prototype/kpi-raporu.html`

## 4. Hesap / Personel Yönetimi

- [x] **İlk Kurulum (Day-0 Setup)** — Satıcı Yöneticisi, şirket/bölge/şube/ilk kullanıcılar (UC-17) → satici-yonetici-panel modal
- [x] **Hesap Oluşturma Formu** — alt seviye kullanıcı ekleme (UC-18) → `prototype/hesap-yonetimi.html`
- [x] **Hesap Override / Kurtarma** — Şirket IT, şifre sıfırlama, kilit açma, yeni üst hesap (UC-18 GM dalı, UC-19) → `prototype/sirket-it-panel.html`
- [x] **Login'siz Personel Kaydı Oluşturma** — Operasyon Şefi (UC-20) → `prototype/personel-kaydi.html`
- [x] **Vardiya (Shift) Takvimi/Atama** — Operasyon Şefi (UC-21) → `prototype/vardiya-takvimi.html`

## 5. Multi-Tenant / Satıcı İşlemleri (Vendor)

- [x] **Müşteri (Tenant) Listesi / Paneli** — Satıcı Yöneticisi ana ekranı → `prototype/satici-yonetici-panel.html`
- [x] **Müşteri Özellik/Rol Konfigürasyon Paneli** (UC-22) → satici-yonetici-panel modal
- [x] **Görsel Kimlik (Branding) Ayarlama** (UC-23) → satici-yonetici-panel modal

## 6. Mobil (Kapsamı Henüz Netleşmedi — bkz. PROCESS.md)

- [ ] Mobil ekranlar, mobil companion app kapsamı netleşince buraya eklenecek.

---

## Yapılan Ekranlar — Rol Menüleri (referans)

Ortak kabuktaki sol menü, role göre filtrelenir. Yapılan/planlanan rol menüleri:

| Rol | Landing | Menü |
|---|---|---|
| **Kasiyer** | POS | (tam ekran, menü yok) POS · Çıkış |
| **Operasyon Şefi** | Pano | Ana sayfa · Vardiya takvimi · Personel kayıtları · Kasaya geç |
| **Şube Müdürü** | Pano | *Kendi:* Ana sayfa · Satış raporları · Kâr marjı/KPI · Hesap yönetimi — *Şube operasyonu (kalıtılan):* Stok · Merkez depo · Fiyat · Layout |
| **Seller Manager** | Pano | Ana sayfa · Fiyat yönetimi · Satış raporları · Layout önerisi |
| **Stock Manager** | Stok listesi | Stok + eşik · Merkez depo talebi |
| **Bölge/Genel Müdür** | Pano | Şube Müdürü menüsü + (Bölge: şube karşılaştırma / Genel: ürün kataloğu), geniş kapsam |
| **Satıcı Yöneticisi** | Müşteri listesi | Müşteriler · Day-0 kurulum · Feature/rol config · Branding |
| **Şirket IT** | Hesap listesi | Hesap override · Yeni üst hesap |

> Ortak üst-bar bileşenleri (marka alanı, bildirim zili, kullanıcı menüsü/dil) her kabuk ekranında ortaktır —
> gerçek React yapısında tek paylaşılan bileşen olacak, wireframe'de her dosyada tekrar ediyor.

## Notlar

- Bu listedeki her madde onaylandıkça (içerik/bileşenler netleştikçe) HTML olarak üretilir, burada işaretlenir.
- Ekranlar önce iskelet/wireframe olarak üretiliyor; renk, marka, gerçek veri ve i18n aktifleştirme sonraya
  bırakıldı.
- Doküman senkronizasyonu (Admin→2 rol, İade-PIN, subdomain login, i18n NFR) `architecture-tr` ve `srs-tr`
  dosyalarına işlenecek — takip: `PROCESS.md`.
