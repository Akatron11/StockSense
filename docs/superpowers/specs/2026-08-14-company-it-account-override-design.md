# Company IT Hesap Override (UC-19) — Tasarım

**Tarih:** 2026-08-14
**Kapsam:** PROCESS.md'deki 4'lü sıranın (Day-0 → Company IT paneli → account-recovery/UC-19 →
feature flag enforcement) 2. maddesi — brainstorming sırasında netleşti: "Company IT paneli" ayrı
bir kapsam değil, UC-19'un implementasyonunun kendisi zaten o paneli tamamlıyor. 4'lü sıra fiilen
3'e indi: **Day-0 (tamamlandı) → UC-19 (bu spec) → feature flag enforcement.**

## Arka plan / neden

`prototype/sirket-it-panel.html` wireframe'i Company IT için iki nav öğesi tanımlıyordu: "Hesap
override" (şifre sıfırla + kilit aç) ve "Yeni üst hesap" (UC-18 GM dalı). İkincisi zaten
`EmployeeManagementPage.tsx`/`/employees` üzerinden çalışıyor. Birincisi (`nav.accountOverride`)
hiç `path` almamış, tıklanamıyor — Company IT'in şu anki tek işlevi GM hesabı oluşturmak, bunun
dışında ana sayfası bile boş bir placeholder (`home.placeholderNote`).

SRS UC-19 ("Account Recovery / Company IT Override") üç alt-yetenek tanımlıyor: (1) her seviyede
şifre sıfırlama, (2) toplu hesap oluşturma, (3) hesap oluşturma yetkisini başkasına devretme.

## Kararlar (kullanıcı onaylı, 2026-08-14 — brainstorming diyaloğuyla netleşti)

1. **"Company IT paneli" ve "UC-19" tek madde** — ayrı ele alınmayacak, PROCESS.md'deki 4'lü sıra
   fiilen 3'e indi.
2. **Kilit açma (wireframe'deki "Kilit aç" butonu) kapsam dışı** — sistemde hiçbir hesap kilitleme
   mekanizması (örn. başarısız giriş sayacı) yok, bunu da tasarlamak ayrı ve büyük bir iş. Sadece
   şifre sıfırlama yapılacak.
3. **Şifre sıfırlama akışı:** Company IT yeni şifreyi kendisi girer (mevcut hesap oluşturma
   akışıyla aynı desen) — rastgele geçici şifre üretimi yok. Kullanıcı bir sonraki girişte
   değiştirmeye **zorlanmaz** (zorunlu-değiştirme bayrağı/ekranı kapsam dışı — yeni bir DB kolonu +
   login akışına yeni bir adım gerektirir, kapsamı büyütür).
4. **Şifre sıfırlama kapsamı: şirket içindeki HER çalışan** (mimari dokümanın "her seviye, GM
   dahil" kararıyla birebir) — kasiyer, stok yöneticisi, şube müdürü dahil, sadece GM ile sınırlı
   değil. Bu, mevcut hiyerarşi-bazlı `_manageable_query`'den farklı bir kapsam gerektiriyor.
5. **Şifre sıfırlama için ayrı bir sayfa** (`/account-override`, wireframe'e uygun) — şirket geneli
   çalışan listesi + arama + her satırda "Şifre sıfırla". `EmployeeManagementPage.tsx`'in
   hiyerarşi-bazlı create/manage desenine karışmıyor.
6. **Toplu hesap oluşturma sadece `general_manager` hedefiyle sınırlı** — mevcut
   `CREATABLE_ROLES["company_it"] = {"general_manager"}` sınırını aşmıyor, override yetkisi burada
   devreye girmiyor (override sadece şifre sıfırlamada geçerli).
7. **Toplu oluşturma formatı: Day-0 sihirbazındaki tekrarlanabilir satır deseni** ("+ Hesap ekle"),
   Excel import değil — GM sayısı bir şirkette genelde az, ayrı bir dosya-parse altyapısı
   gerekmiyor.
8. **Toplu oluşturmada hata davranışı: kısmi başarı** (Day-0 ile tutarlı) — başarılı satırlar
   kalıcı kalır, hatalı satır düzeltilip tekrar denenebilir. Yeni bir backend endpoint'i
   gerektirmiyor, mevcut `POST /api/employees` satır satır çağrılır.
9. **Toplu oluşturma, mevcut `/employees` sayfasına eklenir** (yeni bir sayfa/nav öğesi değil) —
   `EmployeeManagementPage.tsx`'teki mevcut "Yeni hesap" modalının yanına, **sadece `company_it`
   rolü için görünen** bir "Toplu ekle" seçeneği/modalı. Diğer roller (branch/region/general
   manager) için mevcut tekli akış değişmeden kalır.
10. **Yetki devri (UC-19'un 3. alt-yeteneği) tamamen kapsam dışı** — kullanıcı kararı: "şu an için
    sadece kendisi GM hesabı oluşturabilsin, başka bişey yapmasın, ileride düşünürüz." Mevcut
    `company_it → general_manager` tek yönlü yetkisi değişmeden kalıyor, yeni bir delegasyon
    modeli/tablosu eklenmiyor.

## Kapsam dışı (bilinçli, bu round için)

- Hesap kilitleme mekanizmasının kendisi (ve "Kilit aç" özelliği).
- Şifre sıfırlama sonrası zorunlu değiştirme bayrağı/ekranı.
- Hesap oluşturma yetkisinin başka bir role/kişiye devri (delegasyon modeli).
- Toplu oluşturmanın GM dışındaki rollere (kasiyer, stok yöneticisi vb.) genişletilmesi.
- Feature flag enforcement — 4'lü sıranın (şimdi 3'lü) son maddesi, ayrı bir tur.

## Backend

### Yeni endpoint'ler (hepsi sadece `company_it`)

**`GET /api/employees/company-wide`** — `backend/app/routers/employees.py`
- Hiyerarşiden bağımsız, çağıranın `company_id`'sindeki **tüm** çalışanları döner (her rol, her
  şube/bölge) — mevcut hiyerarşi-bazlı `_manageable_query`'den ayrı bir sorgu/fonksiyon (override
  yetkisi "kimi yönetebilirim"den değil "hangi şirkete aitim"den geliyor).
- Response şekli mevcut `EmployeeOut` listesiyle aynı (rol/şube/bölge/durum bilgisi dahil, arama
  frontend'de yapılacak — mevcut `GET /api/employees` deseniyle tutarlı, ekstra query param
  gerekmiyor).
- 403 diğer rollere.

**`POST /api/employees/{id}/reset-password`** — `backend/app/routers/employees.py`
- Body: `{"new_password": str}`.
- Hedef çalışan `Employee.company_id == claims["company_id"]` olmalı (404 değilse — cross-tenant
  erişim engeli, mevcut konvansiyonla tutarlı).
- `hash_password` (mevcut `security.py` fonksiyonu) ile hash'lenip kaydedilir.
- Zorunlu-değiştirme bayrağı yok (karar 3).
- **Not:** mevcut `EmployeeCreate.password` alanında hiçbir uzunluk/karmaşıklık kuralı yok
  (`password: str | None = None`, `schemas/employee.py`) — bu endpoint de aynı konvansiyonu takip
  eder, tek kural boş string reddi (`min_length=1`). Yeni bir parola politikası bu spec'in kapsamı
  dışında.
- 200 (boş body ya da güncellenmiş `EmployeeOut`), 404 (hedef yok/başka şirkete ait), 422 (boş
  şifre).

### Toplu GM oluşturma — yeni endpoint YOK

Frontend, mevcut `POST /api/employees`'i (zaten `company_it → general_manager` çalışıyor) satır
satır çağırır — Day-0 sihirbazının `handleSubmit` desenindeki `createdId` bazlı kısmi hata
kurtarmasıyla aynı yaklaşım.

## Frontend

### `AccountOverridePage.tsx` — yeni sayfa (`/account-override`, sadece `company_it`)

- `navConfig.ts`'teki `company_it` → `nav.accountOverride` öğesine `path: "/account-override"`
  eklenir (`homeLabelForRole` zaten bu öğeyi ilk sıradaki kabul ettiği için Company IT'in artık
  gerçek bir ana sayfası olur, boş placeholder'ın yerini alır).
- `GET /api/employees/company-wide`'dan gelen listeyi gösterir — arama (isim/kullanıcı adı),
  rol/şube-bölge/durum sütunları, her satırda "Şifre sıfırla" butonu.
- "Şifre sıfırla" → modal (yeni şifre input'u, wireframe'deki hint'in basitleştirilmiş hali —
  "Company IT yeni şifreyi belirler" ) → `POST /api/employees/{id}/reset-password`.
- Yeni dosyalar: `api/employees.ts`'e `listEmployeesCompanyWide`/`resetEmployeePassword`,
  `types/employee.ts`'e ilgili tipler gerekiyorsa.

### `EmployeeManagementPage.tsx`'e "Toplu ekle" modalı

- Sadece `creatorRole === "company_it"` iken "Yeni hesap" butonunun yanında ikinci bir "Toplu
  ekle" butonu görünür.
- Modal: Day-0'daki `UserDraft`/tekrarlanabilir-satır deseninin sadeleştirilmiş hali (tek hedef rol
  zaten `general_manager` olduğu için rol seçici yok) — ad/soyad/kullanıcı adı/şifre alanları, "+
  Hesap ekle" ile çoğalan satırlar, "Oluştur" ile hepsi sırayla `POST /api/employees`'e gönderilir.
- Her satır `createdId: number | null` taşır — bir satır 409/422 alırsa döngü durur, önceki
  başarılı satırlar `createdId` ile işaretli kalır, "Tekrar dene" sadece kalanları gönderir.
- Diğer roller (branch/region/general_manager) için bu buton/modal hiç render edilmez — mevcut
  tekli "Yeni hesap" akışı değişmez.

## Test planı

**Backend (curl):**
- `GET /api/employees/company-wide` → 200, tüm roller (cashier/stock_manager/general_manager vb.)
  tek listede; yetkisiz rol → 403.
- `POST /api/employees/{id}/reset-password` → 200, yeni şifreyle giriş başarılı, eski şifreyle
  giriş 401; başka şirkete ait `id` → 404; yetkisiz rol → 403; boş/çok kısa şifre → 422.
- Toplu oluşturma için ayrı bir backend testi yok (mevcut `POST /api/employees` zaten test edilmiş,
  sadece frontend'in tekrarlı çağrısı test ediliyor).

**Frontend (tarayıcıda uçtan uca):**
- `companyit1` ile giriş → nav'da "Hesap override" artık tıklanabilir, ana sayfa placeholder değil.
- `/account-override`'da tüm şirket çalışanları (farklı roller/şubeler) tek listede görünüyor,
  arama çalışıyor, bir kasiyerin şifresi sıfırlanıp yeni şifreyle giriş doğrulanıyor.
- `/employees`'te `companyit1` ile "Toplu ekle" görünüyor, 2 GM satırı eklenip gönderiliyor, ikisi
  de `201` ile oluşuyor; kasıtlı bir tekrarlanan kullanıcı adıyla kısmi hata senaryosu (1. satır
  başarılı, 2. satır 409) → "Tekrar dene" sadece 2. satırı tekrar gönderiyor.
- `genmgr1`/`branchmgr1` ile `/employees`'te "Toplu ekle" hiç görünmüyor (regresyon kontrolü).
- `genmgr1` ile `/account-override`'a direkt URL → 403 (backend), sayfa/aksiyon işlevsiz.
- Konsol hatasız, `tsc -b --noEmit` temiz.
