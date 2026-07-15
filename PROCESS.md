# StockSense — Process / Açık Adımlar Takibi

Bu dosya, proje boyunca ertelenen ya da devam eden adımların takibini tutar. Bir madde çözüldüğünde işaretlenir, gerekirse ilgili dosyaya (mimari, SRS vb.) referans bırakılır.

---

## Açık Maddeler

- [ ] **Mobil companion app** — SRS ve mimari dosyasında TODO olarak işaretli, hem use case kapsamı (mevcut UC'lere mi dahil edilecek yoksa ayrı UC'ler mi gerekecek) hem de `company_features` üzerinden nasıl temsil edileceği henüz netleşmedi. (bkz. `stocksense-srs-tr.md` başındaki TODO notu, `stocksense-architecture-tr.md` madde 10'daki TODO notu)
- [ ] **İngilizce çeviri** — Mobil iş bittikten sonra, belirlenecek dosyalar İngilizceye çevrilecek (hangi dosyaların dahil olacağı ayrıca netleştirilecek).

## Doküman Senkronizasyonu (prototip sürecinde alınan kararlar)

Prototip tasarımı sırasında alınan/netleşen kararlar; `stocksense-architecture-tr.md` ve `stocksense-srs-tr.md`'ye
işlenmeyi bekliyor. Kararların özeti `prototype.md` → "Prototip Kararları" bölümünde.

- [x] **Admin → iki ayrı rol (Satıcı Yöneticisi + Şirket IT)** — işlendi (architecture madde 2/6/9/10, SRS aktörler/UC-17-18-19-22-23/gömülü diyagramlar/FR/component, `stocksense-usecase-diagram.puml`). Eski tek "Admin" ikiye ayrıldı. İşlenen yerler:
  `architecture-tr` madde 2 (rol hiyerarşisi + tanımlar), madde 6 (hesap oluşturma), madde 10 (rol seti,
  feature/branding "satıcı"); `srs-tr` Aktörler (8→9), UC-17/22/23 → Satıcı, UC-18 (GM dalı)/UC-19 → Şirket IT,
  use case diyagramları, class diagram `role` seti, FR tablosu. UC-18 GM dalı = Şirket IT (karar verildi).
- [x] **İade PIN = tamamlarken** — işlendi: `architecture-tr` madde 6 akışı keskinleştirildi; `srs-tr` UC-04 + FR-04 netleştirildi.
- [x] **Multi-tenant login çözümü (subdomain)** — işlendi: `architecture-tr` yeni **madde 16**; `srs-tr` NFR Güvenlik'e
  çapraz-tenant giriş engeli bullet'ı eklendi.
- [x] **i18n (TR/EN arayüz)** — işlendi: `srs-tr` NFR'ye **Lokalizasyon** bölümü; `architecture-tr` yeni **madde 17**.

## Prototip — Kalan İşler

- [x] **Kalan ekranlar** — `prototype.md`'deki Bölüm 0-5'teki masaüstü ekranlarının tümü wireframe olarak
  üretildi (yalnızca Mobil — Bölüm 6 — kapsam netleşmediği için bekliyor). Tüm dosyalar `prototype/` altında.
- [x] **Dil geçişini aktifleştirme (wireframe)** — YAPILMAYACAK (karar: kullanıcı). Wireframe'ler React'te yeniden
  yazılacağı için JS i18n'i burada kurmak düşük getirili. Gerçek i18n React aşamasında **react-i18next** ile
  yapılacak; TR/EN string kataloğu orada tutulacak. Login/kullanıcı-menüsündeki TR|EN toggle'ları wireframe'de
  görsel yer tutucu. (i18n gereksinimi NFR olarak SRS'e girecek — bkz. Doküman Senkronizasyonu.)
