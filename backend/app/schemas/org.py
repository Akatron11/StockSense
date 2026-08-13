from pydantic import BaseModel, ConfigDict


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RegionCreate(BaseModel):
    company_id: int
    name: str


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class BranchCreate(BaseModel):
    region_id: int
    name: str
