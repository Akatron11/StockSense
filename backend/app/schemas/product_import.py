from pydantic import BaseModel


class ImportRowErrorOut(BaseModel):
    row: int | None
    message: str


class ImportErrorsOut(BaseModel):
    errors: list[ImportRowErrorOut]


class ImportResultOut(BaseModel):
    created: int
