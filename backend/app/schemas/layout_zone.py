from pydantic import BaseModel, Field


class LayoutZoneProduct(BaseModel):
    id: int
    name: str


class LayoutZoneCreate(BaseModel):
    name: str = Field(max_length=100)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class LayoutZoneUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    width: int | None = Field(default=None, gt=0)
    height: int | None = Field(default=None, gt=0)
    x: int | None = None
    y: int | None = None


class LayoutZoneOut(BaseModel):
    id: int
    name: str
    x: int
    y: int
    width: int
    height: int
    products: list[LayoutZoneProduct]
