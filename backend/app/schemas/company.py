import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..deps import VENDOR_ADMIN_SUBDOMAIN

# Logo, DB'de base64 data-URL olarak saklanıyor (kullanıcı kararı, 2026-08-04 — ayrı bir disk/object
# storage kurmaya değmeyecek ölçek). Ham dosya boyutu sınırı ~300KB (base64 karakter sayısı ~1.37 kat).
MAX_LOGO_DATA_URL_LENGTH = 410_000

# DNS-label-safe: baş/son karakter alfanümerik olmalı, tire sadece ortada olabilir (maks. 63 karakter).
SUBDOMAIN_PATTERN = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
RESERVED_SUBDOMAINS = {VENDOR_ADMIN_SUBDOMAIN}

# companies.name DB kolonu String(150) (bkz. app/models/tenancy.py) — DataError yerine 422 için burada
# da sınırlanıyor.
COMPANY_NAME_MAX_LENGTH = 150


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=COMPANY_NAME_MAX_LENGTH)
    subdomain: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name boş olamaz")
        return normalized

    @field_validator("subdomain")
    @classmethod
    def validate_subdomain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not SUBDOMAIN_PATTERN.match(normalized):
            raise ValueError(
                "subdomain sadece küçük harf, rakam ve tire içerebilir; tire ile başlayamaz/bitemez (maks. 63 karakter)"
            )
        if normalized in RESERVED_SUBDOMAINS:
            raise ValueError(f"'{normalized}' rezerve bir subdomain, kullanılamaz")
        return normalized


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    subdomain: str
    is_active: bool


class FeatureOut(BaseModel):
    feature_name: str
    enabled: bool


class FeatureUpdate(BaseModel):
    enabled: bool


class BrandingOut(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = None
    display_name: str


class BrandingUpdate(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = None
    display_name: str

    @field_validator("logo_url")
    @classmethod
    def validate_logo_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not value.startswith("data:image/"):
            raise ValueError("logo_url bir data:image/... base64 URL'i olmalı")
        if len(value) > MAX_LOGO_DATA_URL_LENGTH:
            raise ValueError("Logo çok büyük (maks. ~300KB)")
        return value
