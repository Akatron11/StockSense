from pydantic import BaseModel, ConfigDict, Field


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    role: str
    age: int
    address: str
    username: str | None = None
    password: str | None = None
    branch_id: int | None = None  # region_manager → branch_manager / vendor_manager → şube-scoped roller
    region_id: int | None = None  # general_manager → region_manager / vendor_manager → region_manager
    company_id: int | None = None  # sadece vendor_manager — hedef şirket (kendi company_id'si yok)
    manager_pin: str | None = None  # sadece PIN_APPROVER_ROLES (stock/seller_manager, operations_chief)


class EmployeeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    age: int | None = None
    address: str | None = None
    is_active: bool | None = None
    manager_pin: str | None = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    role: str
    username: str | None = None
    age: int
    address: str
    branch_id: int | None = None
    region_id: int | None = None
    company_id: int | None = None
    is_active: bool


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=1)
