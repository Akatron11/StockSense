# Feature Flag Enforcement — Tasarım

**Tarih:** 2026-08-14
**Kapsam:** PROCESS.md'deki "Day-0 → UC-19 → feature flag enforcement" 3'lü sırasının son maddesi.

## Arka plan / neden

`company_features` tablosu ve CRUD'ı (`GET/PUT /api/companies/{id}/features`, `vendor_manager`-only,
`VendorCustomersPage.tsx`'in "Yönet" modalına gömülü) UC-22 kapsamında zaten var. Sabit bir feature
listesi var (`backend/app/routers/companies.py::KNOWN_FEATURES`, serbest metin değil — 2026-08-03
kullanıcı kararı): `layout_onerisi`, `mobil_app`, `merkez_depo_senaryosu`, `kpi_modulu`.

Sorun: bu flag'leri **kontrol eden hiçbir yer yok**. Vendor Manager bir feature'ı kapatsa bile ilgili
sayfa/endpoint tamamen çalışmaya devam ediyor — flag'ler şu an sadece DB'de duran, hiçbir etkisi
olmayan bir ayar.

## Kararlar (kullanıcı onaylı, 2026-08-14 — brainstorming diyaloğuyla netleşti)

1. **Hem backend hem frontend enforcement.** Backend ilgili endpoint'lerde 403 döner (gerçek güvenlik
   sınırı), frontend feature kapalıyken ilgili nav öğesini hiç göstermez (kullanıcı kapalı bir şeye
   tıklayıp hataya düşmez) — UC-19'daki role-bazlı nav filtreleme deseniyle aynı ruh.
2. **Frontend, feature durumunu mevcut `GET /api/auth/branding`'den öğrenir** — yeni bir istek/endpoint
   yok, `AppShell` zaten her mount'ta bu endpoint'i çekiyor (marka rengi/logo için).
3. **`mobil_app` backend'de login'de reddedilir.** Mobil istemciler `POST /api/auth/login`'e body'de
   `subdomain` gönderiyor (web Host header'a güveniyor — bu, mevcut kod yorumunda zaten belgelenmiş bir
   ayrım sinyali). `payload.subdomain is not None` VE `mobil_app` kapalıysa → 403, mobil kullanıcı hiç
   token alamaz.
4. **Kapsam: 4 feature'ın hepsi tek turda.** Ayrı turlara bölünmüyor — her biri küçük (1-2 endpoint ya
   da tek alan nullama), paylaşılan bir `require_feature()` yardımcısıyla tekrar az.
5. **Doğrudan URL ile erişimde özel bir "feature kapalı" ekranı yok.** Nav öğesi gizlense de biri
   `/layout` veya `/stock-request`'e elle giderse, sayfa açılır ama backend 403 döner — sayfanın zaten
   var olan genel `loadError`/`error-text` deseni kullanılır, 403 body'sinde ayırt edici bir mesaj
   döndürülmez. Day-0 sihirbazının role-bazlı 403'lerinde de aynı yaklaşım var (client-side koruma yok,
   backend 403 yeterli sayılıyor) — tutarlılık için aynı desen izleniyor.
6. **Canlı güncelleme yok.** Vendor Manager bir feature'ı değiştirdiğinde, o an açık bir oturumdaki
   kullanıcı sayfayı yenilemeden/yeniden login olmadan görmez — marka rengi/logo'nun zaten çalıştığı
   şekilde (mount-time fetch, websocket/polling yok).

## Kapsam dışı (bilinçli, bu round için)

- 403 body'sinde feature-özel bir hata mesajı (karar 5).
- Canlı/anlık feature güncellemesi (karar 6).
- `kpi_modulu`/diğerleri için ayrı bir "feature kapalı" UI bileşeni.

## Backend

### Yeni paylaşılan yardımcı

**`backend/app/services/feature_flags.py`** (yeni dosya) — `require_role` (`deps.py`) ile aynı desende:

```python
def get_enabled_features(db: Session, company_id: int) -> set[str]:
    """Bir şirket için açık olan feature'ların adlarını döner."""
    rows = db.scalars(
        select(CompanyFeature.feature_name).where(
            CompanyFeature.company_id == company_id, CompanyFeature.enabled.is_(True)
        )
    )
    return set(rows)


def require_feature(db: Session, company_id: int, feature_name: str) -> None:
    """Feature kapalıysa 403 fırlatır. Endpoint'in en başında, require_role'den hemen sonra çağrılır."""
    if feature_name not in get_enabled_features(db, company_id):
        raise HTTPException(status_code=403, detail=f"Bu özellik şirketiniz için kapalı: {feature_name}")
```

### Uygulama noktaları

- **`backend/app/routers/layout_suggestion.py`** — `GET /layout-suggestion` ve
  `POST /layout-suggestion/apply`, ikisi de fonksiyon başında `require_feature(db, claims["company_id"],
  "layout_onerisi")` çağırır (mevcut role kontrolünden hemen sonra).
- **`backend/app/routers/stock_requests.py`** — `POST ""` ve `GET ""`, ikisi de
  `require_feature(db, claims["company_id"], "merkez_depo_senaryosu")` çağırır.
- **`backend/app/routers/reports.py`** — mevcut `can_see_margin` boolean'ı (rol kontrolüne dayanıyor)
  artık `"kpi_modulu" in get_enabled_features(db, claims["company_id"])`'i de VE'liyor. `profit_margin_pct`/
  `profit_margin_amount` zaten bu boolean'a göre `None` dönüyor (mevcut kod, değişmiyor) — sadece koşula
  bir madde ekleniyor.
- **`backend/app/routers/auth.py::login`** — `payload.subdomain is not None` (mobil istemci sinyali) ve
  hedef şirketin `get_enabled_features`'ında `"mobil_app"` yoksa, kullanıcı doğrulamasından *önce* 403
  (gereksiz DB sorgusu/parola karşılaştırması yapılmaz — mobil client + kapalı feature kombinasyonu tek
  başına yeterli red sebebi).

### `BrandingOut` genişletmesi

**`backend/app/schemas/company.py::BrandingOut`** — yeni alan:

```python
class BrandingOut(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = None
    display_name: str
    enabled_features: list[str] = []
```

**`backend/app/routers/auth.py::get_login_branding`** — `company is None` durumunda (admin subdomain,
vendor_manager) `enabled_features=[]`; aksi halde `list(get_enabled_features(db, company.id))`.

## Frontend

### Tip ve API güncellemesi

**`frontend/src/types/company.ts::BrandingOut`** — `enabled_features: string[]` eklenir.

### `AppShell.tsx`

Mevcut `getLoginBranding()` fetch'inin sonucundan yeni bir state (`enabledFeatures: string[]`)
tutulur. `navForRole(role)` çağrısı `navForRole(role, enabledFeatures)`'a genişletilir.

### `navConfig.ts`

`navForRole` fonksiyonu ikinci bir opsiyonel parametre alır (`enabledFeatures?: string[]`) ve dönen nav
grup listesini, her `NavItemConfig`'e eklenecek opsiyonel bir `requiresFeature?: string` alanına göre
filtreler:

```typescript
export interface NavItemConfig {
  label: string;
  variant?: "go";
  path?: string;
  icon: IconName;
  requiresFeature?: string; // dolu ise, enabledFeatures'da yoksa öğe listelenmez
}
```

- `seller_manager`'ın `nav.layoutSuggestion` öğesine `requiresFeature: "layout_onerisi"` eklenir.
- `stock_manager`'ın `nav.stockRequest` öğesine `requiresFeature: "merkez_depo_senaryosu"` eklenir.
- `kpi_modulu`/`mobil_app` için nav'da hiçbir değişiklik gerekmiyor (KPI zaten `/reports`'un bir alt
  bölümü, ayrı bir nav öğesi değil; mobil app web nav'ında hiç yer almıyor).

`ReportsDetailPage.tsx`'te **hiçbir değişiklik yok** — `report.profit_margin_pct === null` kontrolü
zaten var, backend'in alanı `None` döndürmesi yeterli.

Mobil app'te (React Native) **hiçbir değişiklik yok** — login isteği zaten 403 alırsa mevcut hata
gösterme akışından geçer.

## Test planı

**Backend (curl):**
- `layout_onerisi` kapalıyken `GET /api/layout-suggestion` → 403; `PUT` ile açılınca → 200.
- `merkez_depo_senaryosu` kapalıyken `POST /api/stock-requests` → 403; açılınca → 201.
- `kpi_modulu` kapalıyken `GET /api/reports/sales` (uygun rolle) → `profit_margin_pct: null`; açılınca
  dolu değer.
- `mobil_app` kapalıyken `subdomain` alanlı `POST /api/auth/login` → 403; açılınca → 200 + token. Aynı
  şirkete web'den (Host header, `subdomain` alansız) login her durumda etkilenmemeli.
- Feature kapalıyken/açıkken yetkisiz rol (örn. `branch_manager` `layout-suggestion`'a) hâlâ ayrı
  sebepten 403 alıyor mu (role kontrolü feature kontrolünden önce/sonra fark etmeksizin çalışıyor mu)
  — regresyon kontrolü.

**Frontend (tarayıcıda uçtan uca):**
- `layout_onerisi` kapatılıp `sellermgr1` ile giriş → "Layout önerisi" nav'da yok; açılınca geri geliyor.
- `merkez_depo_senaryosu` kapatılıp `stockmgr1` ile giriş → "Merkez depo talebi" nav'da yok; açılınca
  geri geliyor.
- `kpi_modulu` kapatılıp `genmgr1`/`branchmgr1`/`regionmgr1` ile `/reports` → kâr marjı kartı hiç yok;
  açılınca geri geliyor.
- Konsol hatasız, `tsc -b --noEmit` temiz.
