# StockSense — Öğrenme Planı ve Kurulum Listesi

Bu dosya, projeyi tek başına 40 günlük sürede geliştirebilmek için gereken teknolojileri, kurulman gereken araçları ve önerilen öğrenme+geliştirme sırasını takip etmek için tutulur.

> Mevcut bilgi geçmişi: HTML, C, C#, C++, OOP, VB.NET, Windows desktop development, SQL, Docker biliniyor (çoğu paslı). Flutter/Dart ile önceden vibe-coding deneyimi var. Python zayıf, React/FastAPI/React Native sıfırdan öğrenilecek.

---

## Bilgisayarda Bulunması Gereken Araçlar

**Zaten var / biliniyor:**
- Git
- Docker (PostgreSQL'i container'da çalıştırmak için kullanılacak)
- Bir kod editörü (VS Code önerilir)

**Yeni kurulması gerekenler:**
1. **Python 3.11+** — backend dili
2. **Node.js + npm** — React (web) ve React Native için JS çalışma ortamı (backend'de kullanılmıyor, sadece frontend araç zinciri için gerekli)
3. **PostgreSQL** — Docker container olarak çalıştırılacak
4. **Expo CLI** — React Native geliştirmeyi kolaylaştırır; telefona "Expo Go" uygulaması kurularak kod anında telefonda canlı test edilebilir, native build derdi olmaz
5. **DBeaver veya pgAdmin** (opsiyonel, önerilir) — PostgreSQL veritabanını görsel incelemek için
6. **Postman veya Thunder Client (VS Code eklentisi)** (opsiyonel, önerilir) — API endpoint'lerini frontend'i beklemeden test etmek için

---

## Önerilen Öğrenme + Geliştirme Sırası (40 Gün)

Öğrenme ile inşa etmek iç içe yapılacak — teori okuyup günler geçirmek yerine, öğrenilen şey hemen projeye uygulanacak.

### Faz 1 — Python + FastAPI Temelleri (Gün 1-8)
- Python syntax tazeleme (OOP bilgisi transfer olduğu için class/fonksiyon kısmı hızlı geçer)
- FastAPI temel routing, Pydantic modelleri, basit bir CRUD API denemesi (örn. basit "ürün listesi" API'si)
- SQLAlchemy ile PostgreSQL bağlantısı, ilk tablo/model tanımları

### Faz 2 — Gerçek DB Şeması + Auth (Gün 9-14)
- Mimari dosyasındaki (`stocksense-architecture-tr.md`) rol/hiyerarşi modelini gerçek PostgreSQL tablolarına dökme
- JWT auth implementasyonu (login, token doğrulama, rol bazlı yetkilendirme)
- Bu noktada backend iskeleti (auth + temel modeller) hazır olmalı

### Faz 3 — POS Backend Mantığı (Gün 15-20)
- Stok decrement (atomic UPDATE), satış kaydı, concurrency testi (iki eşzamanlı istek senaryosu)
- Düşük stok bildirimi mantığı
- Sales report endpoint'leri (item/kategori bazlı, tarih aralığı)

### Faz 4 — React Temelleri + Web POS Arayüzü (Gün 21-28)
- React temelleri (component, state, props, useState/useEffect, fetch ile API'ye bağlanma) — küçük bir deneme projesiyle başlanmalı
- Gerçek POS ekranı: ürün seçimi, adet girişi, satış tamamlama
- Manager dashboard: stok ekleme/düzenleme, raporlar

### Faz 5 — Layout Önerisi (Analitik) (Gün 29-33)
- pandas ile co-occurrence hesaplama, mlxtend ile Apriori — architecture dosyası madde 7'deki otomatik geçiş mantığı
- Seed/demo veri üretimi (kasıtlı desenli çekirdek + gürültü)
- Basit SVG/Recharts ile floor-plan görselleştirmesi

### Faz 6 — React Native Mobil App (Gün 34-38)
- React Native + Expo temelleri (React bilgisi transfer olduğu için bu faz nispeten hızlı geçer)
- Read-only ekranlar: stok, uyarılar, raporlar — web ile aynı API'ye bağlanma

### Faz 7 — Entegrasyon, Test, Sunum Hazırlığı (Gün 39-40)
- Uçtan uca test (Definition of Done senaryoları: canlı satış, concurrency testi, rapor, layout önerisi)
- Seed data son kontrol, sunuma hazırlık

---

## Not

- WebSocket / real-time sync projeye dahil değil, ama istenirse kişisel öğrenme hedefi olarak ayrıca takip edilebilir (bkz. `stocksense-architecture-tr.md` madde 8).
- Bu plan esnek bir taslaktır — ilerleme hızına göre fazlar arasında kayma olabilir, gerektiğinde güncellenmeli.
