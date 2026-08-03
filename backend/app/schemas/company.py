from pydantic import BaseModel, ConfigDict


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
