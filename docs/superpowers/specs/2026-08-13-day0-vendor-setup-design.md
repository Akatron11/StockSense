# Day-0 (İlk Kurulum, UC-17) — Vendor Manager Kurulum Sihirbazı Tasarımı

**Tarih:** 2026-08-13
**Kapsam:** PROCESS.md'de uzun süredir açık bekleyen UC-17 (Day-0 İlk Kurulum) — Satıcı Yöneticisi'nin
yeni bir müşteri (market) için sistemi sıfırdan kurabileceği gerçek bir akış. Bu, aynı zamanda 4
parçalık bir dizinin ilk turu: **1) Day-0 (bu spec) → 2) company_it paneli → 3) şifre sıfırlama
(UC-19) → 4) feature flag enforcement**, sırayla ele alınacak.

## Arka plan / neden

`stocksense-api-tr.md`'deki mevcut tasarım kararı ("Satıcı Yöneticisi genel CRUD endpoint'lerini
sırayla çağırır: `POST /api/companies` → `POST /api/regions` → `POST /api/branches` →
`POST /api/employees`") hiç implement edilmemişti — sadece `GET` endpoint'leri vardı, `POST` yoktu.
Ayrıca `employees.py::CREATABLE_ROLES` hiyerarşisinde `vendor_manager` hiç yer almıyordu (sadece
`company_it → general_manager` zinciri vardı) — yani Satıcı Yöneticisi şu an ilk hesabı bile
oluşturamıyor. Şu an yeni bir şirket eklemenin tek yolu `seed_test_data.py`'yi elle çalıştırmak.

Frontend'de `navConfig.ts`'teki `vendor_manager` → `nav.day0Setup` nav öğesi hiç `path` almamış,
tıklanamıyor (bilinen bir açık madde).

## Kararlar (kullanıcı onaylı, 2026-08-13 — brainstorming diyaloğuyla netleşti)

1. **Day-0'da kimler oluşturuluyor:** Şirket + bölge(ler) + şube(ler) + **en az 1 `general_manager`**
   (zorunlu — şirketin "üstü" olmadan kullanılamaz) + isteğe bağlı olarak **hiyerarşideki herhangi bir
   diğer rol** (`company_it`, `region_manager`, `branch_manager`, `cashier`, `stock_manager`,
   `seller_manager`, `operations_chief`, `staff`) — vendor tam org şemasını tek oturumda kurabilir,
   ama sadece GM zorunlu, gerisi opsiyonel.
2. **Vendor'ın hesap oluşturma yetkisi sürekli**, sadece Day-0'a özel değil — bir şirkete ileride
   ihtiyaç olursa (örn. ikinci bir `company_it` gerekirse) vendor yine ekleyebilir.
3. **Yan karar:** `general_manager` da artık `company_it` hesabı oluşturabilir (şu an sadece ters
   yön, `company_it → general_manager`, vardı — çift yönlü yapılıyor, çünkü ikisi de şirket
   hiyerarşisinin tepesinde, birbirini oluşturabilmeleri daha tutarlı).
4. **Bölge/şube ekleme endpoint'leri genel amaçlı** (`POST /api/regions`, `POST /api/branches`) —
   Day-0'a özel değil, ileride tekrar kullanılabilir olacak şekilde yazılıyor.
5. **UI akışı: adım adım sihirbaz** (tek sayfa, çok adımlı form) — mevcut CRUD sayfa deseninden
   farklı olarak, kullanıcının "sıfırdan sona kadar tamamlayan tek bir akış" isteğini karşılıyor.
6. **Sihirbazda birden fazla bölge/şube eklenebilir** ("Bölge ekle"/"Şube ekle" ile tekrarlanabilir
   satırlar) — gerçek bir market zinciri Day-0'da birden fazla şubeyle başlayabilir.
7. **Manager PIN, sihirbazda da sorulabilir:** `stock_manager`/`seller_manager`/`operations_chief`
   satırlarında opsiyonel bir PIN alanı gösterilir. **Not:** PIN'i sonradan değiştirme zaten mevcut
   bir özellik (`PATCH /api/employees/{id}::manager_pin`, `EmployeeManagementPage.tsx`'te zaten var)
   — bu spec kapsamında yeni bir mekanizma gerekmiyor, sihirbaz sadece aynı deseni oluşturma anında
   da sunuyor.
8. **Kısmi hata yönetimi:** Adımlar ayrı API çağrıları (tek bir DB transaction'ı değil). Bir adım
   ortada başarısız olursa, sihirbaz o ana kadar başarıyla oluşturulmuş ID'leri kendi state'inde
   tutar, kullanıcıya nerede kaldığını gösterir, "tekrar dene" ile sadece kalan adımlardan devam
   eder — baştan başlamaya gerek yok.
9. **Steady-state bölge/şube ekleme sahibi (kavramsal karar, implementasyonu bu turda YAPILMIYOR):**
   Day-0 sonrası, var olan bir şirkete yeni bölge/şube eklemek **Genel Müdür'ün işi olacak**
   (kendi `company_id` kapsamında) — vendor'ın her seferinde araya girmesi gereksiz sürtünme, ve
   mimarideki "hesap oluşturma operasyonel iş, iş kararı değil" prensibiyle tutarlı. Bu, aynı
   `POST /api/regions`/`/branches` endpoint'lerinin `general_manager`'a da açılması anlamına
   gelecek — **ayrı bir tur/spec'te ele alınacak, bu round'da kodlanmıyor.**

## Kapsam dışı (bilinçli, bu round için)

- Steady-state bölge/şube ekleme implementasyonu (karar 9 — sadece kavramsal karar verildi).
- Şirket/bölge/şube'yi Day-0 sihirbazı **dışında** düzenleme/silme ekranı (örn. yanlış girilen
  şirket adını düzeltme) — mevcut soft-delete altyapısı (`is_active`) var ama bu tur için bir UI
  eklenmiyor, ihtiyaç çıkarsa ayrıca ele alınır.
- Feature flag enforcement, company_it paneli, şifre sıfırlama (UC-19) — dizinin sonraki turları.
- Branding (logo/renk) — Day-0 sihirbazına dahil değil, mevcut "Yönet" modalından ayrıca yapılır.

## Backend

### Yeni endpoint'ler (hepsi sadece `vendor_manager`)

**`POST /api/companies`** — `backend/app/routers/companies.py`
- Body: `{"name": str, "subdomain": str}`.
- `subdomain`: küçük harfe çevrilir + trim edilir, format doğrulanır (sadece küçük harf/rakam/tire,
  DNS-safe — model zaten `String(63)`), **`"admin"` reddedilir** (`deps.py::VENDOR_ADMIN_SUBDOMAIN`
  ile çakışır — vendor'ın kendi giriş kapısı), unique ihlalinde `409`.
- `201` + `CompanyOut`.

**`POST /api/regions`** — `backend/app/routers/org.py`
- Body: `{"company_id": int, "name": str}`.
- `company_id` var mı doğrulanır (404 yoksa).
- `201` + `RegionOut`.

**`POST /api/branches`** — `backend/app/routers/org.py`
- Body: `{"region_id": int, "name": str}`.
- `region_id` var mı doğrulanır (404 yoksa).
- `201` + `BranchOut`.

### `employees.py` değişiklikleri

**`CREATABLE_ROLES` güncellenir:**
```python
CREATABLE_ROLES: dict[str, set[str]] = {
    "branch_manager": {"cashier", "stock_manager", "seller_manager"},
    "region_manager": {"branch_manager"},
    "general_manager": {"region_manager", "company_it"},   # company_it eklendi (karar 3)
    "company_it": {"general_manager"},
    "operations_chief": {"staff"},
    "vendor_manager": {                                     # yeni (karar 1)
        "general_manager", "company_it", "region_manager", "branch_manager",
        "cashier", "stock_manager", "seller_manager", "operations_chief", "staff",
    },
}
```

**`create_employee`'deki hedef-çözme zincirine yeni bir dal eklenir** (`creator_role ==
"vendor_manager"`): vendor'ın örtük kapsamı olmadığı için hedef her zaman payload'da açıkça
belirtilir:
- `payload.company_id` her zaman zorunlu (404 yoksa).
- Hedef role göre ek alan:
  - `general_manager` / `company_it` → başka bir şey gerekmez.
  - `region_manager` → `payload.region_id` zorunlu, o şirkete ait mi doğrulanır.
  - `branch_manager` / `cashier` / `stock_manager` / `seller_manager` / `operations_chief` /
    `staff` → `payload.branch_id` zorunlu, o şirkete ait bir bölgenin şubesi mi doğrulanır.
- Mevcut `manager_pin`/`PIN_APPROVER_ROLES` doğrulaması değişmeden kalır (zaten role-agnostic).

**`schemas/employee.py::EmployeeCreate`'e `company_id: int | None = None` eklenir** (sadece vendor
kullanıyor, diğer roller için `None` kalır, mevcut davranış korunur).

## Frontend

### Route + nav

`navConfig.ts`'teki `vendor_manager` → `nav.day0Setup` öğesine `path: "/day0-setup"` eklenir.
Yeni `App.tsx` route'u, sadece `vendor_manager`.

### `Day0SetupPage.tsx` — adım adım sihirbaz

**Adımlar:**
1. **Şirket:** ad + subdomain input'u — mevcut projede hiçbir formda live-validation deseni yok, bu
   da yok; format/benzersizlik hatası sadece submit sonrası (backend `422`/`409`) gösterilir.
2. **Bölge(ler):** "Bölge ekle" ile tekrarlanabilir satırlar, en az 1 zorunlu.
3. **Şube(ler):** her bölge altında "Şube ekle" ile tekrarlanabilir satırlar, en az 1 toplam zorunlu.
4. **Kullanıcılar:** "Kullanıcı ekle" ile tekrarlanabilir satırlar — her satırda rol seçimi
   (dropdown, `CREATABLE_ROLES["vendor_manager"]`'daki tüm roller), ad-soyad, kullanıcı adı, şifre,
   role göre hedef bölge/şube seçimi (2-3. adımlarda oluşturulanlardan), ve rol
   `PIN_APPROVER_ROLES`'teyse opsiyonel PIN alanı. En az 1 `general_manager` satırı zorunlu (karar 1).
5. **Özet & Tamamla:** girilen her şeyin listesi, "Kurulumu Tamamla" butonu.

**State/akış:** Wizard, her adımı "Tamamla"ya basılana kadar sadece local state'te tutar — gerçek
API çağrıları hiçbiri son adımda "Kurulumu Tamamla"ya basılana kadar yapılmaz. Basılınca adımlar
sırayla API'ye gönderilir: `POST /api/companies` → (paralel olabilir) `POST /api/regions`×N →
`POST /api/branches`×N → `POST /api/employees`×N. Her başarılı çağrının dönen `id`'si sihirbazın
kendi state'inde saklanır (karar 8 — kısmi hata kurtarma). Bir adım `4xx/5xx` alırsa, sihirbaz o
noktada durur, "X oluşturuldu, Y'de hata: <mesaj>" gösterir, "Tekrar dene" sadece kalan
(henüz `id`'si olmayan) adımları tekrar dener.

**Yeni dosyalar:** `pages/Day0SetupPage.tsx`, `api/companies.ts`'e `createCompany`, `api/org.ts`'e
`createRegion`/`createBranch`, `types/company.ts`/`types/org.ts`'e ilgili payload tipleri.

## Test planı

**Backend (curl, proje konvansiyonu):**
- `POST /api/companies` → 201, `subdomain` küçük harfe çevrildi mi kontrolü, `"admin"` → 422,
  tekrarlanan subdomain → 409, yetkisiz rol → 403.
- `POST /api/regions`/`/branches` → 201, var olmayan `company_id`/`region_id` → 404, yetkisiz rol
  → 403.
- `POST /api/employees` (vendor_manager, her hedef rol için) → 201, `company_id` eksik → 422,
  yanlış şirkete ait `region_id`/`branch_id` → 404, `general_manager`'ın artık `company_it`
  oluşturabildiği (karar 3) → 201.

**Frontend (tarayıcıda uçtan uca):**
- `vendormgr1` ile `/day0-setup`'a git, tam bir şirket kur (1 şirket + 2 bölge + 2 şube + 1 GM + 1
  stock_manager PIN'li), özet ekranında doğru göster, tamamla → gerçekten oluşturulduğunu
  `GET /api/companies` ve yeni şirketin subdomain'inden giriş yaparak doğrula.
- Kasıtlı bir adımda hata oluştur (örn. tekrarlanan subdomain ikinci denemede), "tekrar dene"nin
  önceki adımları tekrarlamadığını doğrula.
- `branchmgr1`/`genmgr1` gibi yetkisiz bir rolle `/day0-setup`'a direkt URL ile gidildiğinde
  sayfanın/butonların işlevsiz kaldığını (backend zaten 403 veriyor) doğrula.
- Yeni oluşturulan şirkette (sıfır ürün/satış/stok) `genmgr1`in dashboard'unun çökmediğini,
  boş-durum mesajlarının doğru göründüğünü doğrula (kullanıcının orijinal "%100 çalışsın" isteğinin
  ampirik doğrulaması — bu round'da yeni bir kod değişikliği gerektirmiyor, sadece mevcut ekranların
  boş state'te davranışını gözlemlemek).
