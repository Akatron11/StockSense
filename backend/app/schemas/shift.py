from datetime import date, time

from pydantic import BaseModel, ConfigDict


class ShiftOut(BaseModel):
    employee_id: int
    employee_name: str
    shift_date: date
    start_time: time | None = None
    end_time: time | None = None
    is_day_off: bool


class ShiftUpsert(BaseModel):
    shift_date: date
    start_time: time | None = None
    end_time: time | None = None
    is_day_off: bool = False


class RosterEmployee(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    role: str
