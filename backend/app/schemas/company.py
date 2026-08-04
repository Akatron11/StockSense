from pydantic import BaseModel, ConfigDict, field_validator

# Logo, DB'de base64 data-URL olarak saklanıyor (kullanıcı kararı, 2026-08-04 — ayrı bir disk/object
# storage kurmaya değmeyecek ölçek). Ham dosya boyutu sınırı ~300KB (base64 karakter sayısı ~1.37 kat).
MAX_LOGO_DATA_URL_LENGTH = 410_000


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
