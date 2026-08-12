from pydantic import BaseModel


class CurrencyRatesOut(BaseModel):
    base: str
    date: str | None
    rates: dict[str, float]
