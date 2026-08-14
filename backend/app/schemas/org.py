from pydantic import BaseModel, ConfigDict, Field, field_validator

# regions.name ve branches.name DB kolonları String(150) (bkz. app/models/tenancy.py) — DataError
# yerine 422 için burada da sınırlanıyor.
REGION_NAME_MAX_LENGTH = 150
BRANCH_NAME_MAX_LENGTH = 150


class RegionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RegionCreate(BaseModel):
    company_id: int
    name: str = Field(min_length=1, max_length=REGION_NAME_MAX_LENGTH)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name boş olamaz")
        return normalized


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class BranchCreate(BaseModel):
    region_id: int
    name: str = Field(min_length=1, max_length=BRANCH_NAME_MAX_LENGTH)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name boş olamaz")
        return normalized
