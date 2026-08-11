# Mobil Companion App (Sprint 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sprint 6'yı kapatan bir mobil companion app — 5 yönetici rolü için, var olan backend API'lerini kullanan, salt-okunur (bildirim okundu/okunmadı takibi hariç) bir Expo/React Native uygulaması.

**Architecture:** Backend'e 2 küçük ekleme (bildirim okundu/okunmadı tablosu + login'e opsiyonel `subdomain` alanı); `mobile/` altında web'den tamamen bağımsız yeni bir Expo projesi, 5 ekran (Login + 4 salt-okunur rapor/bildirim ekranı), rol-bazlı tab görünürlüğü.

**Tech Stack:** Backend: FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2 (mevcut stack, değişmiyor). Mobil: Expo (TypeScript template), React Navigation (native-stack + bottom-tabs), `expo-secure-store`.

## Global Constraints

- Backend'e **yeni endpoint yazılmayacak** dışında sadece 2 küçük ekleme (spec madde "Mimari") — mevcut `GET /api/reports/sales`, `GET /api/notifications` endpoint'leri doğrudan tüketilecek.
- `mobil_app` company feature'ı **bu turda enforce edilmiyor** — hiçbir backend endpoint'i 403 döndürmeyecek şekilde kapı olarak kullanılmayacak (spec kararı 4).
- Projede otomatik test altyapısı yok (pytest kurulu değil) — backend doğrulaması curl ile, mobil doğrulaması Expo Go ile uçtan uca yapılacak (projenin tüm önceki sprintlerindeki konvansiyonla tutarlı, bkz. `PROCESS.md`).
- Mobil kod, web'den (`frontend/`) **bağımsız bir codebase** — kod paylaşımı/monorepo yok, sadece aynı API sözleşmesi paylaşılıyor.
- `stock_manager` rolü, backend'de `/api/reports/sales`'e zaten erişemiyor (`routers/reports.py::ROLES_WITH_ACCESS` içinde yok) — mobilde de sadece Bildirimler tab'ını görecek, diğer 3 tab gizlenecek (bkz. Task 10).
- `seller_manager` için `profit_margin_pct` backend'den `null` gelir — KPI ekranı bunu null olduğunda kart olarak göstermeyecek (web'deki `ReportsDetailPage.tsx` ile aynı davranış).

---

## Bölüm A — Backend

### Task 1: `NotificationRead` modeli + migration

**Files:**
- Create: `backend/app/models/notification_read.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/7c9e2b4f1a83_add_notification_reads.py`

**Interfaces:**
- Consumes: `Base`, `TimestampMixin` (`backend/app/models/base.py`), `Employee` (FK hedefi, `backend/app/models/staff.py`).
- Produces: `NotificationRead` modeli — `id, employee_id, kind (str), product_id, branch_id, read_at` — Task 2'nin router kodu bunu import edip kullanacak.

- [ ] **Step 1: `NotificationRead` modelini yaz**

`backend/app/models/notification_read.py`:

```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class NotificationRead(Base, TimestampMixin):
    """Mobil companion app — bildirim okundu/okunmadı takibi (Sprint 6).

    Bildirimler (`GET /api/notifications`) kalıcı bir kayıt değil, anlık bir sorgu sonucu
    (düşük stok / SKT eşiği aşımı) — bu yüzden "hangi bildirim okundu" bilgisi bildirimin
    kendi bir ID'siyle değil, onu üreten satırın doğal anahtarıyla (kind + product_id +
    branch_id) tutuluyor. Bkz. docs/superpowers/specs/2026-08-11-mobile-companion-app-design.md.
    """

    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "kind", "product_id", "branch_id",
            name="uq_notification_read_employee_item",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # "low_stock" | "expiring"
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee: Mapped["Employee"] = relationship()
```

- [ ] **Step 2: Modeli `models/__init__.py`'ye ekle**

`backend/app/models/__init__.py` — mevcut içerik:

```python
from .base import Base
from .catalog import Product, Stock, StockRequest
from .layout import LayoutRecommendationApplication, LayoutZone, StockZone
from .sales import Return, ReturnItem, Sale, SaleItem
from .staff import Employee, Shift
from .tenancy import Branch, Company, CompanyBranding, CompanyFeature, Region

__all__ = [
    "Base",
    "Company",
    "Region",
    "Branch",
    "CompanyFeature",
    "CompanyBranding",
    "Product",
    "Stock",
    "StockRequest",
    "Employee",
    "Shift",
    "Sale",
    "SaleItem",
    "Return",
    "ReturnItem",
    "LayoutRecommendationApplication",
    "LayoutZone",
    "StockZone",
]
```

Yeni hali:

```python
from .base import Base
from .catalog import Product, Stock, StockRequest
from .layout import LayoutRecommendationApplication, LayoutZone, StockZone
from .notification_read import NotificationRead
from .sales import Return, ReturnItem, Sale, SaleItem
from .staff import Employee, Shift
from .tenancy import Branch, Company, CompanyBranding, CompanyFeature, Region

__all__ = [
    "Base",
    "Company",
    "Region",
    "Branch",
    "CompanyFeature",
    "CompanyBranding",
    "Product",
    "Stock",
    "StockRequest",
    "Employee",
    "Shift",
    "Sale",
    "SaleItem",
    "Return",
    "ReturnItem",
    "LayoutRecommendationApplication",
    "LayoutZone",
    "StockZone",
    "NotificationRead",
]
```

- [ ] **Step 3: Alembic migration'ı elle yaz** (autogenerate yerine — proje konvansiyonu autogenerate sonrası elle temizlemek, ama burada tablo basit olduğu için doğrudan yazmak daha hızlı)

`backend/alembic/versions/7c9e2b4f1a83_add_notification_reads.py`:

```python
"""add_notification_reads

Revision ID: 7c9e2b4f1a83
Revises: 3fe2cbfd7d52
Create Date: 2026-08-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c9e2b4f1a83'
down_revision: Union[str, Sequence[str], None] = '3fe2cbfd7d52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notification_reads',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('employee_id', sa.BigInteger(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('product_id', sa.BigInteger(), nullable=False),
        sa.Column('branch_id', sa.BigInteger(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id', 'kind', 'product_id', 'branch_id', name='uq_notification_read_employee_item'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notification_reads')
```

- [ ] **Step 4: Migration'ı çalıştır**

Run: `cd backend && alembic upgrade head`
Expected: `Running upgrade 3fe2cbfd7d52 -> 7c9e2b4f1a83, add_notification_reads` çıktısı, hata yok.

- [ ] **Step 5: Tabloyu doğrula**

Run: `docker exec summer-db-1 psql -U postgres -d stocksense -c "\d notification_reads"`
Expected: `id, employee_id, kind, product_id, branch_id, read_at, created_at` kolonları + unique constraint listelenir.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/notification_read.py backend/app/models/__init__.py backend/alembic/versions/7c9e2b4f1a83_add_notification_reads.py
git commit -m "feat: add notification_reads table for mobile read-tracking"
```

---

### Task 2: `GET /api/notifications`'a `is_read` + `POST /api/notifications/read`

**Files:**
- Modify: `backend/app/schemas/notification.py`
- Modify: `backend/app/routers/notifications.py`

**Interfaces:**
- Consumes: `NotificationRead` modeli (Task 1), `get_current_claims`/`get_db` (`backend/app/deps.py`, `backend/app/database.py`).
- Produces: `NotificationsOut` artık her item'da `is_read: bool` taşıyor; yeni `POST /api/notifications/read` (body: `NotificationReadIn`) — mobil `api/notifications.ts::markNotificationRead` bunu Task 6'da kullanacak.

- [ ] **Step 1: Şemaları güncelle**

`backend/app/schemas/notification.py` — mevcut içerik tamamen değişiyor:

```python
from datetime import date
from typing import Literal

from pydantic import BaseModel


class LowStockItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    quantity: int
    threshold: int
    is_read: bool = False


class ExpiringItem(BaseModel):
    product_id: int
    product_name: str
    branch_id: int
    best_before_date: date
    is_read: bool = False


class NotificationsOut(BaseModel):
    low_stock: list[LowStockItem]
    expiring: list[ExpiringItem]


class NotificationReadIn(BaseModel):
    kind: Literal["low_stock", "expiring"]
    product_id: int
    branch_id: int
```

- [ ] **Step 2: Router'ı güncelle** — `is_read` hesaplama + yeni `POST /read`

`backend/app/routers/notifications.py` — tam yeni içerik:

```python
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_claims
from ..models import NotificationRead, Product, Stock
from ..schemas.notification import ExpiringItem, LowStockItem, NotificationReadIn, NotificationsOut
from ..services.notification_targets import target_branches

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# stocksense-api-tr.md'de gün sayısı belirtilmemişti — implementasyon sırasında karar verildi
# (2026-07-27): SKT'ye 7 gün ya da daha az kalan ürünler "yaklaşan" sayılır.
EXPIRING_WITHIN_DAYS = 7


def _read_keys(db: Session, employee_id: int, kind: str) -> set[tuple[int, int]]:
    rows = db.execute(
        select(NotificationRead.product_id, NotificationRead.branch_id).where(
            NotificationRead.employee_id == employee_id, NotificationRead.kind == kind
        )
    ).all()
    return {(product_id, branch_id) for product_id, branch_id in rows}


@router.get("", response_model=NotificationsOut)
def get_notifications(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    low_stock_branches = target_branches(db, claims, "stock_manager")
    expiring_branches = target_branches(db, claims, "seller_manager")
    employee_id = claims["user_id"]

    low_stock = []
    if low_stock_branches:
        read_keys = _read_keys(db, employee_id, "low_stock")
        rows = db.execute(
            select(Stock, Product.name)
            .join(Product, Product.id == Stock.product_id)
            .where(
                Stock.branch_id.in_(low_stock_branches),
                Stock.quantity <= Stock.low_stock_threshold,
                Product.is_active.is_(True),
            )
        ).all()
        low_stock = [
            LowStockItem(
                product_id=stock.product_id,
                product_name=name,
                branch_id=stock.branch_id,
                quantity=stock.quantity,
                threshold=stock.low_stock_threshold,
                is_read=(stock.product_id, stock.branch_id) in read_keys,
            )
            for stock, name in rows
        ]

    expiring = []
    if expiring_branches:
        read_keys = _read_keys(db, employee_id, "expiring")
        cutoff = date.today() + timedelta(days=EXPIRING_WITHIN_DAYS)
        rows = db.execute(
            select(Stock, Product.name, Product.best_before_date)
            .join(Product, Product.id == Stock.product_id)
            .where(
                Stock.branch_id.in_(expiring_branches),
                Stock.quantity > 0,
                Product.is_active.is_(True),
                Product.best_before_date.is_not(None),
                Product.best_before_date <= cutoff,
            )
        ).all()
        expiring = [
            ExpiringItem(
                product_id=stock.product_id,
                product_name=name,
                branch_id=stock.branch_id,
                best_before_date=bbd,
                is_read=(stock.product_id, stock.branch_id) in read_keys,
            )
            for stock, name, bbd in rows
        ]

    return NotificationsOut(low_stock=low_stock, expiring=expiring)


@router.post("/read", status_code=204)
def mark_notification_read(
    payload: NotificationReadIn,
    claims: dict = Depends(get_current_claims),
    db: Session = Depends(get_db),
):
    employee_id = claims["user_id"]
    existing = db.scalar(
        select(NotificationRead).where(
            NotificationRead.employee_id == employee_id,
            NotificationRead.kind == payload.kind,
            NotificationRead.product_id == payload.product_id,
            NotificationRead.branch_id == payload.branch_id,
        )
    )
    if existing is None:
        db.add(
            NotificationRead(
                employee_id=employee_id,
                kind=payload.kind,
                product_id=payload.product_id,
                branch_id=payload.branch_id,
            )
        )
        db.commit()
```

- [ ] **Step 3: Backend'i (yeniden) başlat**

Run: `cd backend && uvicorn app.main:app --port 8000` (proje konvansiyonu: `--reload` kullanılmıyor, bkz. `PROCESS.md` — kod değişikliğinden sonra süreç elle yeniden başlatılmalı).

- [ ] **Step 4: curl ile doğrula** (`stockmgr1` / `Test1234!`, `testco` subdomain — mevcut seed verisiyle)

```bash
TOKEN=$(curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"stockmgr1","password":"Test1234!"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://testco.localhost:8000/api/notifications -H "Authorization: Bearer $TOKEN"
```

Expected: `low_stock` dizisindeki her item'da `"is_read": false` var.

```bash
curl -s -X POST http://testco.localhost:8000/api/notifications/read -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"kind":"low_stock","product_id":<yukarıdaki bir product_id>,"branch_id":<yukarıdaki branch_id>}'
curl -s http://testco.localhost:8000/api/notifications -H "Authorization: Bearer $TOKEN"
```

Expected: İlk `POST` `204` döner; ikinci `GET`'te o item artık `"is_read": true`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/notification.py backend/app/routers/notifications.py
git commit -m "feat: add is_read tracking to notifications endpoint"
```

---

### Task 3: Login'e opsiyonel `subdomain` alanı

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/routers/auth.py`

**Interfaces:**
- Consumes: `get_company_from_host`, `Company` modeli.
- Produces: `POST /api/auth/login` artık body'de `subdomain` kabul ediyor — mobil `api/auth.ts::login` (Task 5) bunu kullanacak.

- [ ] **Step 1: `LoginRequest`'e alan ekle**

`backend/app/schemas/auth.py` — tam yeni içerik:

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
    subdomain: str | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    user: UserOut
```

- [ ] **Step 2: `login` endpoint'ini güncelle** — `subdomain` verildiyse `Host` header yerine onu kullan

`backend/app/routers/auth.py` mevcut `login` fonksiyonu (satır 27-61) şu şekilde değişiyor — dosyanın geri kalanı (`get_login_branding`, `me`) aynı kalıyor:

```python
@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    company: Company | None = Depends(get_company_from_host),
    db: Session = Depends(get_db),
):
    # Mobil native client'lar Host header'ını web gibi güvenilir şekilde set edemeyebilir —
    # bu yüzden login body'sinde bir subdomain verildiyse Host header yerine o kullanılır.
    # Bkz. docs/superpowers/specs/2026-08-11-mobile-companion-app-design.md.
    if payload.subdomain is not None:
        company = db.scalar(select(Company).where(Company.subdomain == payload.subdomain))
        if company is None:
            raise HTTPException(status_code=404, detail="Unknown company subdomain")

    if company is None:
        # admin subdomain — tenant-üstü vendor_manager girişi (madde 16).
        employee = db.scalar(
            select(Employee).where(
                Employee.company_id.is_(None),
                Employee.role == "vendor_manager",
                Employee.username == payload.username,
            )
        )
    else:
        employee = db.scalar(
            select(Employee).where(Employee.company_id == company.id, Employee.username == payload.username)
        )
    if employee is None or employee.password_hash is None or not verify_password(
        payload.password, employee.password_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(
        {
            "user_id": employee.id,
            "role": employee.role,
            "company_id": employee.company_id,
            "branch_id": employee.branch_id,
            "region_id": employee.region_id,
        }
    )
    user = UserOut(id=employee.id, full_name=f"{employee.first_name} {employee.last_name}", role=employee.role)
    return TokenResponse(access_token=access_token, user=user)
```

**Not:** `get_company_from_host`, `Host` header yoksa/boşsa `400` ile patlıyor — mobil client `subdomain` gönderdiği sürece bu dala hiç girmiyor çünkü `subdomain is not None` kontrolü `company`'yi zaten Host'a bakmadan yeniden atıyor. `payload.subdomain is None` olduğu (web) durumda davranış tamamen eskisiyle aynı.

- [ ] **Step 3: Backend'i yeniden başlat, curl ile doğrula**

```bash
curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"stockmgr1","password":"Test1234!","subdomain":"testco"}'
```

Expected: `200`, `access_token` + `user` döner (`Host` header hiç `testco` içermese bile — burada düz `localhost:8000` kullanıldı).

```bash
curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"stockmgr1","password":"Test1234!","subdomain":"olmayan-sirket"}'
```

Expected: `404 Unknown company subdomain`.

```bash
curl -s -X POST http://testco.localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"stockmgr1","password":"Test1234!"}'
```

Expected: `200` — web'in mevcut davranışı (subdomain'siz, Host'tan çözülüyor) regresyonsuz çalışıyor.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/routers/auth.py
git commit -m "feat: accept optional subdomain in login body for mobile clients"
```

---

## Bölüm B — Mobil (`mobile/`)

### Task 4: Expo proje kurulumu + navigasyon iskeleti + AuthContext

**Files:**
- Create: `mobile/` (Expo scaffold — `npx create-expo-app` üretir)
- Create: `mobile/src/types/auth.ts`
- Create: `mobile/src/auth/AuthContext.tsx`
- Create: `mobile/src/screens/LoginScreen.tsx` (iskelet — Task 5'te doldurulacak)
- Create: `mobile/src/screens/NotificationsScreen.tsx`, `SalesReportScreen.tsx`, `TopBottomProductsScreen.tsx`, `KpiScreen.tsx` (iskelet placeholder — Task 6-9'da doldurulacak)
- Create: `mobile/src/navigation/RootNavigator.tsx`
- Create: `mobile/src/navigation/TabNavigator.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Produces: `AuthContext`/`useAuth()` — `{ token, user, isLoading, setSession(token, user), logout() }` (web'deki `AuthContext.tsx` ile aynı arayüz, sadece storage `expo-secure-store`). Task 5-9'daki tüm ekranlar bunu tüketecek.

- [ ] **Step 1: Expo projesini oluştur**

Run (repo kökünde):
```bash
npx create-expo-app@latest mobile --template blank-typescript
```
Expected: `mobile/` dizini `App.tsx`, `package.json`, `tsconfig.json` vb. ile oluşur.

- [ ] **Step 2: Navigasyon + secure-store bağımlılıklarını kur**

Run:
```bash
cd mobile
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context expo-secure-store
```
Expected: `mobile/package.json`'a bu paketler eklenir, hata olmadan tamamlanır.

- [ ] **Step 3: Auth tiplerini yaz**

`mobile/src/types/auth.ts` (web'deki `frontend/src/types/auth.ts` ile birebir, artı `subdomain`):

```typescript
// backend/app/schemas/auth.py ile birebir eşleşir.
export interface LoginRequest {
  username: string;
  password: string;
  subdomain?: string;
}

export interface UserOut {
  id: number;
  full_name: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  user: UserOut;
}
```

- [ ] **Step 4: `AuthContext`'i yaz** — web'deki desenin `expo-secure-store` versiyonu

`mobile/src/auth/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type { UserOut } from "../types/auth";
import { me } from "../api/auth";

const TOKEN_STORAGE_KEY = "stocksense_token";

interface AuthContextValue {
  token: string | null;
  user: UserOut | null;
  isLoading: boolean;
  setSession: (token: string, user: UserOut) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const freshUser = await me(storedToken);
        setToken(storedToken);
        setUser(freshUser);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function setSession(newToken: string, newUser: UserOut) {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  }
  return ctx;
}
```

**Not:** Bu dosya `../api/auth`'u import ediyor ama o dosya Task 5'te yazılacak — bu adımda proje henüz derlenmeyecek, Task 5 bitince derlenir hale gelecek (tek bir çalışan bütün için ara adımlarda geçici kırıklık kabul edilebilir, plan sırası buna göre kuruldu).

- [ ] **Step 5: Ekran iskeletlerini yaz** (placeholder içerik — sonraki task'larda doldurulacak)

`mobile/src/screens/LoginScreen.tsx`:
```tsx
import { Text, View } from "react-native";

export function LoginScreen() {
  return (
    <View>
      <Text>Login</Text>
    </View>
  );
}
```

`mobile/src/screens/NotificationsScreen.tsx`:
```tsx
import { Text, View } from "react-native";

export function NotificationsScreen() {
  return (
    <View>
      <Text>Bildirimler</Text>
    </View>
  );
}
```

`mobile/src/screens/SalesReportScreen.tsx`:
```tsx
import { Text, View } from "react-native";

export function SalesReportScreen() {
  return (
    <View>
      <Text>Satış raporu</Text>
    </View>
  );
}
```

`mobile/src/screens/TopBottomProductsScreen.tsx`:
```tsx
import { Text, View } from "react-native";

export function TopBottomProductsScreen() {
  return (
    <View>
      <Text>En çok / az / hiç satılmayan</Text>
    </View>
  );
}
```

`mobile/src/screens/KpiScreen.tsx`:
```tsx
import { Text, View } from "react-native";

export function KpiScreen() {
  return (
    <View>
      <Text>KPI / Kâr marjı</Text>
    </View>
  );
}
```

- [ ] **Step 6: Tab navigator'ı yaz** (rol-bazlı görünürlük Task 10'da eklenecek — şimdilik hepsi görünür)

`mobile/src/navigation/TabNavigator.tsx`:

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SalesReportScreen } from "../screens/SalesReportScreen";
import { TopBottomProductsScreen } from "../screens/TopBottomProductsScreen";
import { KpiScreen } from "../screens/KpiScreen";

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Bildirimler" }} />
      <Tab.Screen name="SalesReport" component={SalesReportScreen} options={{ title: "Satış raporu" }} />
      <Tab.Screen name="TopBottomProducts" component={TopBottomProductsScreen} options={{ title: "Ürünler" }} />
      <Tab.Screen name="Kpi" component={KpiScreen} options={{ title: "KPI" }} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 7: Root navigator'ı yaz** — auth durumuna göre Login ya da Tab'lar

`mobile/src/navigation/RootNavigator.tsx`:

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { TabNavigator } from "./TabNavigator";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Tabs" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 8: `App.tsx`'i güncelle**

`mobile/App.tsx` — `create-expo-app`'in ürettiği içeriğin yerine:

```tsx
import { AuthProvider } from "./src/auth/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```

- [ ] **Step 9: Commit** (Task 5'ten sonra derlenecek olsa da, iskelet olarak commit edilir — sonraki task hemen ardından geliyor)

```bash
git add mobile
git commit -m "feat: scaffold Expo mobile project with navigation shell and AuthContext"
```

---

### Task 5: API client + Login ekranı

**Files:**
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`
- Modify: `mobile/src/auth/AuthContext.tsx`
- Modify: `mobile/src/screens/LoginScreen.tsx`
- Create: `mobile/.env.example`

**Interfaces:**
- Consumes: `AuthContext::setSession`/`logout` (Task 4).
- Produces: `apiFetch`, `authFetch`, `ApiError`, `apiErrorMessage`, `setUnauthorizedHandler` (`api/client.ts`) — Task 6-9'daki tüm API çağrıları `authFetch`/`apiErrorMessage`'ı kullanacak. `login(credentials)`, `me(token)` (`api/auth.ts`).

- [ ] **Step 1: `.env.example` ile base URL config'ini tanımla**

`mobile/.env.example`:
```
# Backend'in çalıştığı adres. Android emulator'da host makine 10.0.2.2'dir.
# iOS simulator'da localhost çalışır. Fiziksel cihazda makinenin LAN IP'sini kullanın
# (örn. 192.168.1.23) — cihaz ve backend aynı ağda olmalı.
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

Run: `cd mobile && cp .env.example .env` (kullanıcı kendi ortamına göre `.env`'i düzenleyecek — bkz. `.gitignore`'a ekleme Step 4).

- [ ] **Step 2: API client'ı yaz** — web'deki `frontend/src/api/client.ts` ile aynı desen, farkı base URL kaynağı

`mobile/src/api/client.ts`:

```typescript
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

// Backend hata gövdesindeki `detail` alanı iki farklı şekilde gelebilir: elle raise edilen
// HTTPException'larda düz string, Pydantic'in otomatik doğrulama hatalarında (422) ise
// {msg, loc, ...} objelerinden oluşan bir dizi. Web tarafında bunun render sırasında crash'e
// yol açtığı bulunmuştu (commit 3d80556) — aynı hatanın mobilde tekrarlanmaması için
// web'deki apiErrorMessage() helper'ı birebir taşınıyor.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (typeof body !== "object" || body === null || !("detail" in body)) return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === "object" && d !== null && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => m !== null);
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

// authFetch kullanan çağrılar (login sonrası — bkz. api/auth.ts::me hariç tüm API dosyaları)
// token'ın süresi dolduğunda/geçersiz olduğunda (401) global olarak oturumu kapatır, her ekranın
// kendi 401 mantığı yazmasına gerek kalmaz. AuthContext, mount'ta bu handler'ı kendi logout()'una
// bağlar (bkz. Step 7, AuthContext.tsx güncellemesi).
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export async function authFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw err;
  }
}
```

- [ ] **Step 3: Auth API'sini yaz**

`mobile/src/api/auth.ts`:

```typescript
import { apiFetch, authFetch } from "./client";
import type { LoginRequest, TokenResponse, UserOut } from "../types/auth";

export function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function me(token: string): Promise<UserOut> {
  return authFetch<UserOut>(token, "/api/auth/me");
}
```

- [ ] **Step 4: `.env`'i `.gitignore`'a ekle**

`mobile/.gitignore` dosyasına (Expo scaffold'un ürettiği dosyanın sonuna) ekle:
```
.env
```

- [ ] **Step 5: `AuthContext`'i 401 handler'ına bağla**

`mobile/src/auth/AuthContext.tsx`'teki `AuthProvider` fonksiyonuna, mevcut `useEffect`in hemen altına yeni bir `useEffect` ekle (dosyanın geri kalanı Task 4'teki haliyle aynı kalıyor):

```tsx
import { setUnauthorizedHandler } from "../api/client";
```

importlarına ekle, sonra `AuthProvider` içine:

```tsx
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);
```

(İlk `useEffect`in — token yükleme — hemen altına eklenir.)

- [ ] **Step 6: Login ekranını doldur**

`mobile/src/screens/LoginScreen.tsx`:

```tsx
import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { login } from "../api/auth";

export function LoginScreen() {
  const { setSession } = useAuth();
  const [subdomain, setSubdomain] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await login({ subdomain: subdomain.trim(), username: username.trim(), password });
      await setSession(result.access_token, result.user);
    } catch (err) {
      setError(apiErrorMessage(err, "Giriş başarısız — bilgileri kontrol edin"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StockSense</Text>
      <TextInput
        style={styles.input}
        placeholder="Şirket kodu (subdomain)"
        autoCapitalize="none"
        value={subdomain}
        onChangeText={setSubdomain}
      />
      <TextInput
        style={styles.input}
        placeholder="Kullanıcı adı"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator /> : <Button title="Giriş yap" onPress={handleSubmit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c0392b" },
});
```

- [ ] **Step 7: `tsc` ile derleme kontrolü**

Run: `cd mobile && npx tsc --noEmit`
Expected: Hatasız (Task 4'teki geçici kırıklık artık `api/auth.ts` var olduğu için çözülmüş olmalı).

- [ ] **Step 8: Expo Go'da uçtan uca doğrula**

Run: `cd mobile && npx expo start` → Expo Go ile QR kodu tara (telefon backend'le aynı ağda olmalı, `.env`'deki `EXPO_PUBLIC_API_BASE_URL` makinenin LAN IP'sine ayarlı olmalı).

Manuel test: `testco` / `stockmgr1` / `Test1234!` ile giriş yap → Tab ekranına (şimdilik placeholder içerikli) geçmeli. Yanlış şifre → satır içi hata mesajı görünmeli.

- [ ] **Step 9: Commit**

```bash
git add mobile
git commit -m "feat: add mobile API client and wire up login screen"
```

---

### Task 6: Bildirimler ekranı (liste + okundu işaretleme)

**Files:**
- Create: `mobile/src/types/notification.ts`
- Create: `mobile/src/api/notifications.ts`
- Modify: `mobile/src/screens/NotificationsScreen.tsx`

**Interfaces:**
- Consumes: `authFetch`, `apiErrorMessage` (`api/client.ts`), `useAuth()` (token).
- Produces: `getNotifications(token)`, `markNotificationRead(token, payload)` — bu task'a özel, başka task tüketmiyor.

- [ ] **Step 1: Tipleri yaz**

`mobile/src/types/notification.ts`:

```typescript
// backend/app/schemas/notification.py ile birebir eşleşir.
export interface LowStockItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  quantity: number;
  threshold: number;
  is_read: boolean;
}

export interface ExpiringItem {
  product_id: number;
  product_name: string;
  branch_id: number;
  best_before_date: string;
  is_read: boolean;
}

export interface NotificationsOut {
  low_stock: LowStockItem[];
  expiring: ExpiringItem[];
}

export type NotificationKind = "low_stock" | "expiring";

export interface NotificationReadIn {
  kind: NotificationKind;
  product_id: number;
  branch_id: number;
}
```

- [ ] **Step 2: API fonksiyonlarını yaz**

`mobile/src/api/notifications.ts`:

```typescript
import { authFetch } from "./client";
import type { NotificationReadIn, NotificationsOut } from "../types/notification";

export function getNotifications(token: string): Promise<NotificationsOut> {
  return authFetch<NotificationsOut>(token, "/api/notifications");
}

export function markNotificationRead(token: string, payload: NotificationReadIn): Promise<void> {
  return authFetch<void>(token, "/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Ekranı yaz** — liste + optimistic okundu işaretleme

`mobile/src/screens/NotificationsScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { getNotifications, markNotificationRead } from "../api/notifications";
import type { ExpiringItem, LowStockItem, NotificationsOut } from "../types/notification";

type Row =
  | { kind: "low_stock"; item: LowStockItem }
  | { kind: "expiring"; item: ExpiringItem };

export function NotificationsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<NotificationsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const result = await getNotifications(token);
      setData(result);
    } catch (err) {
      setError(apiErrorMessage(err, "Bildirimler yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkRead(row: Row) {
    if (!token) return;
    // Optimistic: satırı hemen okundu işaretle, hata olursa yeniden yükle.
    setData((prev) => {
      if (!prev) return prev;
      if (row.kind === "low_stock") {
        return {
          ...prev,
          low_stock: prev.low_stock.map((i) =>
            i.product_id === row.item.product_id && i.branch_id === row.item.branch_id ? { ...i, is_read: true } : i
          ),
        };
      }
      return {
        ...prev,
        expiring: prev.expiring.map((i) =>
          i.product_id === row.item.product_id && i.branch_id === row.item.branch_id ? { ...i, is_read: true } : i
        ),
      };
    });
    try {
      await markNotificationRead(token, {
        kind: row.kind,
        product_id: row.item.product_id,
        branch_id: row.item.branch_id,
      });
    } catch {
      load();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const rows: Row[] = [
    ...(data?.low_stock.map((item) => ({ kind: "low_stock" as const, item })) ?? []),
    ...(data?.expiring.map((item) => ({ kind: "expiring" as const, item })) ?? []),
  ];

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => `${row.kind}-${row.item.product_id}-${row.item.branch_id}`}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>Bekleyen bildirim yok</Text>}
      renderItem={({ item: row }) => (
        <Pressable
          style={[styles.row, row.item.is_read && styles.rowRead]}
          onPress={() => !row.item.is_read && handleMarkRead(row)}
        >
          <Text style={styles.rowTitle}>{row.item.product_name}</Text>
          <Text style={styles.rowDetail}>
            {row.kind === "low_stock"
              ? `Düşük stok: ${(row.item as LowStockItem).quantity} / eşik ${(row.item as LowStockItem).threshold}`
              : `SKT: ${(row.item as ExpiringItem).best_before_date}`}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: "center", color: "#888", marginTop: 32 },
  row: { padding: 12, borderRadius: 8, backgroundColor: "#fff3e0" },
  rowRead: { backgroundColor: "#f0f0f0", opacity: 0.6 },
  rowTitle: { fontWeight: "600" },
  rowDetail: { color: "#555", marginTop: 4 },
});
```

- [ ] **Step 4: `tsc` kontrolü**

Run: `cd mobile && npx tsc --noEmit`
Expected: Hatasız.

- [ ] **Step 5: Expo Go'da uçtan uca doğrula** (`sellermgr1` — SKT bildirimi olan hesap, `PROCESS.md`'deki önceki turlardan biliniyor)

Manuel test: Giriş yap → Bildirimler tab'ı açık gelir → SKT kaydı görünür → dokun → satır soluklaşır ("okundu") → uygulamayı kapat/aç → hâlâ okundu olarak görünmeli (backend'e kalıcı yazıldığının kanıtı).

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "feat: implement mobile notifications screen with read tracking"
```

---

### Task 7: Rapor tipleri/API + Satış raporu ekranı

**Files:**
- Create: `mobile/src/types/report.ts`
- Create: `mobile/src/api/reports.ts`
- Create: `mobile/src/hooks/useSalesReport.ts`
- Modify: `mobile/src/screens/SalesReportScreen.tsx`

**Interfaces:**
- Produces: `SalesReportOut` tipi, `getSalesReport(token, days)`, `useSalesReport(days)` hook'u — Task 8 ve 9 aynı hook'u kendi ekranlarında bağımsız olarak kullanacak (`{ report, loading, error }` döner).

- [ ] **Step 1: Rapor tiplerini yaz**

`mobile/src/types/report.ts`:

```typescript
// backend/app/schemas/report.py ile birebir eşleşir.
export interface SalesTrendPoint {
  day: string;
  total_sales: number;
}

export interface TopProductItem {
  product_id: number;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface BreakdownItem {
  id: number;
  label: string;
  total_sales: number;
  profit_margin_pct: number | null;
}

export interface NeverSoldItem {
  product_id: number;
  product_name: string;
}

export interface SalesReportOut {
  scope: "branch" | "region" | "company";
  scope_label: string;
  days: number;
  branch_count: number;
  low_stock_count: number;
  total_sales: number;
  transaction_count: number;
  profit_margin_pct: number | null;
  profit_margin_amount: number | null;
  cost_data_coverage_pct: number;
  trend: SalesTrendPoint[];
  top_products: TopProductItem[];
  breakdown: BreakdownItem[];
  least_selling: TopProductItem[];
  never_sold: NeverSoldItem[];
}
```

- [ ] **Step 2: API fonksiyonunu yaz** (mobilde branch/region drill-down yok — sadece kullanıcının kendi varsayılan kapsamı, web'deki gibi `branch_id`/`region_id` opsiyonel query yok)

`mobile/src/api/reports.ts`:

```typescript
import { authFetch } from "./client";
import type { SalesReportOut } from "../types/report";

export function getSalesReport(token: string, days: 7 | 30 | 90): Promise<SalesReportOut> {
  return authFetch<SalesReportOut>(token, `/api/reports/sales?days=${days}`);
}
```

- [ ] **Step 3: Paylaşılan hook'u yaz** — Task 8/9 de bunu kullanacak, tekrar fetch mantığı yazılmayacak (DRY)

`mobile/src/hooks/useSalesReport.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiErrorMessage } from "../api/client";
import { getSalesReport } from "../api/reports";
import type { SalesReportOut } from "../types/report";

export function useSalesReport(days: 7 | 30 | 90 = 30) {
  const { token } = useAuth();
  const [report, setReport] = useState<SalesReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSalesReport(token, days);
      setReport(result);
    } catch (err) {
      setError(apiErrorMessage(err, "Rapor yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { report, loading, error, reload: load };
}
```

- [ ] **Step 4: Satış raporu ekranını yaz**

`mobile/src/screens/SalesReportScreen.tsx`:

```tsx
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function SalesReportScreen() {
  const { report, loading, error, reload } = useSalesReport(30);

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <Text style={styles.scope}>{report?.scope_label}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Toplam satış (son {report?.days} gün)</Text>
        <Text style={styles.cardValue}>{report?.total_sales.toFixed(2)} ₺</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>İşlem sayısı</Text>
        <Text style={styles.cardValue}>{report?.transaction_count}</Text>
      </View>
      <Text style={styles.sectionTitle}>En çok satan</Text>
      {report?.top_products.map((p) => (
        <View key={p.product_id} style={styles.listRow}>
          <Text>{p.product_name}</Text>
          <Text style={styles.muted}>{p.quantity} adet — {p.revenue.toFixed(2)} ₺</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  container: { padding: 16, gap: 12 },
  scope: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  card: { padding: 16, borderRadius: 8, backgroundColor: "#eef4ff" },
  cardLabel: { color: "#555" },
  cardValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  listRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  muted: { color: "#888" },
});
```

- [ ] **Step 5: `tsc` kontrolü + Expo Go'da doğrula**

Run: `cd mobile && npx tsc --noEmit` → hatasız.
Manuel test: `branchmgr1` ile giriş → Satış raporu tab'ı → toplam satış + en çok satan listesi web'deki `/reports` sayfasıyla aynı sayıları göstermeli.

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "feat: implement mobile sales report screen"
```

---

### Task 8: En çok/az/hiç satılmayan ürünler ekranı

**Files:**
- Modify: `mobile/src/screens/TopBottomProductsScreen.tsx`

**Interfaces:**
- Consumes: `useSalesReport` (Task 7).

- [ ] **Step 1: Ekranı yaz**

`mobile/src/screens/TopBottomProductsScreen.tsx`:

```tsx
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function TopBottomProductsScreen() {
  const { report, loading, error, reload } = useSalesReport(30);

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <Text style={styles.sectionTitle}>En az satan</Text>
      {report?.least_selling.length ? (
        report.least_selling.map((p) => (
          <View key={p.product_id} style={styles.listRow}>
            <Text>{p.product_name}</Text>
            <Text style={styles.muted}>{p.quantity} adet</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Veri yok</Text>
      )}

      <Text style={styles.sectionTitle}>Hiç satılmayan</Text>
      {report?.never_sold.length ? (
        report.never_sold.map((p) => (
          <View key={p.product_id} style={styles.listRow}>
            <Text>{p.product_name}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.muted}>Hiç satılmayan ürün yok</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  container: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  listRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eee" },
  muted: { color: "#888" },
});
```

- [ ] **Step 2: `tsc` kontrolü + Expo Go'da doğrula**

Run: `cd mobile && npx tsc --noEmit` → hatasız.
Manuel test: `sellermgr2` (Beşiktaş, yüksek hacim) ile giriş → "En az satan"/"Hiç satılmayan" listeleri web'deki `/reports` sayfasındaki aynı bölümle eşleşmeli.

- [ ] **Step 3: Commit**

```bash
git add mobile
git commit -m "feat: implement mobile top/bottom/never-sold products screen"
```

---

### Task 9: KPI / Kâr marjı ekranı

**Files:**
- Modify: `mobile/src/screens/KpiScreen.tsx`

**Interfaces:**
- Consumes: `useSalesReport` (Task 7).

- [ ] **Step 1: Ekranı yaz** — `profit_margin_pct` null ise kart hiç gösterilmez (web'deki `ReportsDetailPage.tsx` ile aynı davranış — `seller_manager` bu veriye sahip değil)

`mobile/src/screens/KpiScreen.tsx`:

```tsx
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSalesReport } from "../hooks/useSalesReport";

export function KpiScreen() {
  const { report, loading, error, reload } = useSalesReport(30);

  if (loading && !report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (report && report.profit_margin_pct === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Bu rol için kâr marjı verisine erişim yok</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Net kâr marjı</Text>
        <Text style={styles.cardValue}>%{report?.profit_margin_pct?.toFixed(1)}</Text>
        {report && report.cost_data_coverage_pct < 100 && (
          <Text style={styles.muted}>Maliyet verisi kapsamı: %{report.cost_data_coverage_pct.toFixed(0)}</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Kâr tutarı</Text>
        <Text style={styles.cardValue}>{report?.profit_margin_amount?.toFixed(2)} ₺</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Düşük stoklu ürün sayısı</Text>
        <Text style={styles.cardValue}>{report?.low_stock_count}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#c0392b" },
  muted: { color: "#888" },
  container: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 8, backgroundColor: "#eef4ff" },
  cardLabel: { color: "#555" },
  cardValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
});
```

- [ ] **Step 2: `tsc` kontrolü + Expo Go'da doğrula**

Run: `cd mobile && npx tsc --noEmit` → hatasız.
Manuel test: `branchmgr1` (kâr marjı var) → kart görünür. `sellermgr1` (kâr marjı `null`) → "Bu rol için kâr marjı verisine erişim yok" mesajı, kart yok.

- [ ] **Step 3: Commit**

```bash
git add mobile
git commit -m "feat: implement mobile KPI/profit margin screen"
```

---

### Task 10: Rol-bazlı tab görünürlüğü

**Files:**
- Create: `mobile/src/auth/roleAccess.ts`
- Modify: `mobile/src/navigation/TabNavigator.tsx`

**Interfaces:**
- Consumes: `useAuth().user.role`.
- Produces: `canAccessReports(role)` — bu task içinde tüketiliyor.

- [ ] **Step 1: Rol-erişim yardımcı fonksiyonunu yaz** — `backend/app/routers/reports.py::ROLES_WITH_ACCESS` ile birebir aynı liste

```typescript
// backend/app/routers/reports.py::ROLES_WITH_ACCESS ile birebir eşleşir — stock_manager
// GET /api/reports/sales'e backend'de zaten erişemiyor (403 alır), bu yüzden mobilde de
// rapor tab'ları hiç gösterilmiyor, sadece Bildirimler tab'ı görünür.
const REPORT_ROLES = new Set(["branch_manager", "seller_manager", "region_manager", "general_manager"]);

export function canAccessReports(role: string): boolean {
  return REPORT_ROLES.has(role);
}
```

`mobile/src/auth/roleAccess.ts` olarak kaydet.

- [ ] **Step 2: `TabNavigator`'ı rol-bazlı hale getir**

`mobile/src/navigation/TabNavigator.tsx` — tam yeni içerik:

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { canAccessReports } from "../auth/roleAccess";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SalesReportScreen } from "../screens/SalesReportScreen";
import { TopBottomProductsScreen } from "../screens/TopBottomProductsScreen";
import { KpiScreen } from "../screens/KpiScreen";

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const { user } = useAuth();
  const showReports = user ? canAccessReports(user.role) : false;

  return (
    <Tab.Navigator>
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Bildirimler" }} />
      {showReports && (
        <>
          <Tab.Screen name="SalesReport" component={SalesReportScreen} options={{ title: "Satış raporu" }} />
          <Tab.Screen name="TopBottomProducts" component={TopBottomProductsScreen} options={{ title: "Ürünler" }} />
          <Tab.Screen name="Kpi" component={KpiScreen} options={{ title: "KPI" }} />
        </>
      )}
    </Tab.Navigator>
  );
}
```

- [ ] **Step 3: `tsc` kontrolü**

Run: `cd mobile && npx tsc --noEmit` → hatasız.

- [ ] **Step 4: Expo Go'da regresyon testi**

Manuel test: `stockmgr1` ile giriş → sadece "Bildirimler" tab'ı görünmeli (diğer 3 tab yok). `branchmgr1`/`seller_manager`/`region_manager`/`general_manager` → 4 tab'ın hepsi görünmeli.

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat: hide report tabs for stock_manager (matches backend role access)"
```

---

## Bitirme

- [ ] **`PROCESS.md`'ye özet madde ekle** — Sprint 6'nın tamamlandığını, hangi kararların netleştiğini (spec linkiyle), commit hash'lerini içeren bir madde (önceki sprintlerle aynı format).
- [ ] **`stocksense-jira-sprint-plani.md`'deki Sprint 6 bölümüne "Gerçekleşen durum" notu ekle** (Sprint 5'teki gibi).
- [ ] Kullanıcıya: `documents/stocksense-architecture.md` (İngilizce) senkronizasyonunun hâlâ ayrı bir açık madde olduğunu hatırlat (`PROCESS.md`'deki "İngilizce çeviri" maddesi) — bu plan onu kapsamıyor.
