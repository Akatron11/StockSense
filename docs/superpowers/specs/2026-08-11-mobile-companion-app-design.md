# Mobil Companion App — Sprint 6 Kapsam ve Tasarım

**Tarih:** 2026-08-11
**Kapsam:** Sprint 6 (Mobile App). Mimari madde 8 ("Mobil API entegrasyonu"), SRS başındaki mobil
TODO notu ve `PROCESS.md`'deki "Mobil companion app" açık maddesi bu spec ile kapatılıyor.

## Arka plan / neden

Mobil companion app kapsamı daha önce sadece bir yönelim olarak bırakılmıştı: mimari doküman
(`stocksense-architecture-tr.md` madde 8, satır 169) "manager companion app", React Native,
web ile aynı backend endpoint'leri, JWT paylaşımlı diyordu; SRS (satır 7, 282, 510) salt-okunur
ve UC-11/13/14/16 ile ilişkilendirilmesini öneriyordu — ama hiçbiri bağlayıcı karar değildi.

**Takvim notu:** Sprint plana göre Sprint 6 tarihi 8-10 Ağustos'tu (deadline: 10 Ağustos), bu spec
11 Ağustos'ta yazılıyor — yani plana göre gecikmiş durumdayız. Kullanıcı kararı (2026-08-11):
gerçek deadline durumu netleşmedi ama hızlandırılmış/minimal bir MVP ile ilerlenecek.

## Kullanıcıyla netleşen kararlar (brainstorming, metin modunda)

1. **Hedef roller: tüm yönetici rolleri** — `seller_manager`, `stock_manager`, `branch_manager`,
   `region_manager`, `general_manager`. Mimarideki "manager companion app" ismiyle tutarlı;
   kasiyer (`cashier`) ve `company_it`/`vendor_manager` kapsam dışı.
2. **Salt-okunur + bildirim okundu/okunmadı takibi.** Diğer aksiyonlar (örn. layout önerisini
   mobilden uygulama) bu turun kapsamı dışında bırakıldı. Okundu/okunmadı takibi tek istisna —
   bunun için yeni bir backend tablosu gerekiyor (bkz. aşağıda).
3. **Ekranlar: SRS ipucundaki 4'ü.** UC-11 (Bildirimler), UC-13 (Satış raporu), UC-14 (En çok/az/hiç
   satılmayan ürün), UC-16 (Kâr marjı/KPI). Layout önerisi (UC-15) ve diğer tüm yazma-ağırlıklı
   ekranlar (POS, stok/fiyat düzenleme, hesap yönetimi vb.) kapsam dışı.
4. **`company_features`: tek bir `mobil_app` feature'ı.** Bu isim zaten `routers/companies.py::KNOWN_FEATURES`
   içinde önceden tanımlıydı, yeni bir isim uydurulmadı. **Önemli karar:** bu turda **enforce
   edilmiyor** — var olan `layout_onerisi`/`kpi_modulu` presedanıyla tutarlı (hiçbir feature flag
   şu an backend'de gerçek bir 403/kapı olarak çalışmıyor, sadece Satıcı Yöneticisi panelinde
   görüntülenen/işaretlenen kayıtlar). İleride enforcement eklenmek istenirse bu, ayrı ve daha
   geniş bir iş (UC-22'nin kapsam dışı bırakılan "rol" kısmıyla birlikte ele alınabilir, bkz.
   `PROCESS.md`).
5. **Mobil tenant/login: login formuna opsiyonel bir `subdomain` alanı.** Web'de tenant, `Host`
   header'daki subdomain'den çözülüyor (`deps.py::get_company_from_host`) — mobil native app'te
   bu header'ı güvenilir şekilde set etmenin garantisi yok, bu yüzden `LoginRequest`'e opsiyonel
   bir `subdomain` alanı eklenip backend bunu `Host` header'ına ek bir yol olarak kabul edecek.

## Mimari

Backend'e **iki küçük ekleme** dışında yeni endpoint yazılmıyor — mimari madde 8'deki "mobil app
aynı backend API endpoint'lerini kullanır, ayrı/mobile-özel endpoint yazılmaz" kararına sadık
kalınıyor:

1. **Bildirim okundu/okunmadı tablosu** (yeni) — bildirimler kalıcı kayıt değil, anlık sorgu
   sonucu (düşük stok / SKT eşiği aşımı) olduğu için "hangi bildirim okundu" bilgisini bildirimin
   kendi bir ID'siyle değil, onu üreten satırın doğal anahtarıyla (`kind + product_id + branch_id`)
   tutuyoruz.
2. **`LoginRequest`'e opsiyonel `subdomain` alanı** — verilirse `Host` header yerine bu kullanılır,
   verilmezse (web'in mevcut davranışı) hiçbir şey değişmez, tamamen geriye dönük uyumlu.

Yeni bir `mobile/` Expo/React Native projesi, web'den (`frontend/`) **bağımsız bir codebase**
olarak kurulur — kod paylaşımı yok, sadece aynı API sözleşmesini konuşuyorlar. Auth: JWT,
`expo-secure-store`'da saklanıyor (AsyncStorage değil — token hassas veri).

## Bileşenler

**Backend (minimal ekleme):**
- `models/notification_read.py` (yeni) → `NotificationRead`: `id, employee_id, kind
  ("low_stock"|"expiring"), product_id, branch_id, read_at`.
- `routers/notifications.py`: `POST /api/notifications/read` (body: `{kind, product_id,
  branch_id}`) eklenir; `GET /api/notifications` dönen her item'a `is_read: bool` ekler.
- `schemas/auth.py::LoginRequest`: `subdomain: str | None = None`.
- `routers/auth.py::login`: `subdomain` body'de geldiyse `get_company_from_host` yerine bunu
  kullanan bir dal.
- Yeni bir Alembic migration (`notification_reads` tablosu).

**Mobil (`mobile/`, yeni proje):**
- `api/client.ts` — web'deki `api/client.ts` ile aynı desen (fetch + `Authorization` header),
  base URL config'den.
- `screens/LoginScreen.tsx` — subdomain + kullanıcı adı + şifre formu.
- `screens/NotificationsScreen.tsx` — düşük stok/SKT listesi + "okundu işaretle".
- `screens/SalesReportScreen.tsx`, `screens/KpiScreen.tsx`, `screens/TopBottomProductsScreen.tsx`
  — `GET /api/reports/sales`'in ilgili alanlarını gösterir (web'deki `ReportsDetailPage.tsx`'in
  mobile'a bölünmüş hali).
- `navigation/` — React Navigation, bottom-tab (4 ekran) + login stack.
- `auth/AuthContext.tsx` — token + claims'i sağlar, rol-bazlı ekran görünürlüğü (web'deki
  `navConfig.ts` mantığının mobile'a taşınmış hali — örn. `seller_manager` KPI ekranını görmez).

## Veri Akışı

1. **Login:** subdomain + kullanıcı adı + şifre → `POST /api/auth/login` → JWT →
   `expo-secure-store` → `AuthContext` claims'i tüm ekranlara sağlar.
2. **Ekran açılışı:** Her ekran mount'ta ilgili `GET`'i çağırır. **Polling yok** (mimari madde 8
   kararıyla tutarlı) — sadece pull-to-refresh ile manuel yenileme.
3. **Bildirim okundu işaretleme:** Satıra dokunma → `POST /api/notifications/read` (optimistic UI,
   hata olursa geri alınır) → ekran `GET` ile yeniden senkronize olur.
4. **Token süresi dolması:** `401` → `AuthContext` token'ı temizler → Login ekranına yönlendirir
   (refresh-token akışı yok, mimaride zaten tanımlı değil).

## Hata Yönetimi

- **Ağ hatası:** Her ekran görünür bir "Bağlantı hatası, tekrar dene" state'i gösterir.
- **401:** `api/client.ts` içinde global bir interceptor — `AuthContext`'i temizler, Login'e
  yönlendirir; ekranların kendi 401 mantığı yazmasına gerek yok.
- **404/401 login'de:** Formda satır içi hata mesajı (web login sayfasıyla aynı desen).
- **422 validasyon hataları:** Web'de yeni eklenen `apiErrorMessage()` helper'ının aynısı
  mobile'a da taşınır (Pydantic'in `detail` dizisini okunur mesaja çeviren ortak fonksiyon —
  commit `3d80556`'da web'de bulunan crash'in aynısının mobile'da tekrarlanmaması için).

## Test Planı

- **Backend:** `NotificationRead` + `POST /api/notifications/read` + login'in `subdomain` dalı
  için curl/Swagger ile uçtan uca doğrulama (projede otomatik test altyapısı yok, konvansiyon
  `PROCESS.md`'deki tüm önceki turlarla tutarlı — curl/tarayıcı testi).
- **Mobil:** Expo Go/simülatörde 5 ekranın gerçek backend'e karşı denenmesi — en az bir
  `seller_manager` (KPI kartı görünmüyor) ve bir `general_manager` (hepsi görünüyor) hesabıyla
  rol-bazlı görünürlük doğrulanacak; yanlış subdomain / yanlış şifre senaryosu da test edilecek.
- `tsc` (mobil proje de TypeScript) hatasız olmalı — web'deki `tsc -b --noEmit` konvansiyonunun
  mobile'a taşınmış hali.

## Kapsam dışı bırakılanlar (bilinçli)

- Layout önerisini mobilden "uygula" — sadece görüntüleme var, aksiyon yok.
- POS, stok/fiyat düzenleme, hesap/personel yönetimi ekranları — mobile hiç girmiyor.
- `mobil_app` feature flag'inin gerçek enforcement'ı (403 kapısı) — UC-22'nin kapsam dışı
  bırakılan "rol" kısmıyla birlikte ileride ele alınabilir.
- Refresh-token / kalıcı oturum yenileme akışı.
- Web ve mobil arası kod paylaşımı (monorepo/shared package) — iki ayrı codebase.
