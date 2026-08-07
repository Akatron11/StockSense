from pydantic import BaseModel


class LayoutZoneProduct(BaseModel):
    id: int
    name: str


class LayoutZoneCreate(BaseModel):
    name: str
    width: int
    height: int


class LayoutZoneUpdate(BaseModel):
    name: str | None = None
    width: int | None = None
    height: int | None = None
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
