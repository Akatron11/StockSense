import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_claims
from ..schemas.currency import CurrencyRatesOut

router = APIRouter(prefix="/api/currency", tags=["currency"])

# Faz 3 "döviz ekranı" (PROCESS.md, 2026-08-11) — kullanıcı kararıyla sadece bu 3 rol (quantity
# takibi/satış takibi ile aynı set).
CURRENCY_ACCESS_ROLES = {"branch_manager", "region_manager", "general_manager"}

SUPPORTED_TARGETS = ("USD", "EUR", "GBP")
# Frankfurter — ECB verisine dayalı, API key gerektirmeyen ücretsiz kur servisi.
FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"

# Basit bellek-içi önbellek — her popover açılışında dış servise istek atmamak için (kurlar günde
# birkaç kez güncellenir, saatlik önbellek yeterli). Tek process varsayımıyla modül-seviyesi dict.
_cache: dict = {"data": None, "fetched_at": 0.0}
CACHE_TTL_SECONDS = 3600


@router.get("/rates", response_model=CurrencyRatesOut)
def get_currency_rates(claims: dict = Depends(get_current_claims)):
    if claims["role"] not in CURRENCY_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Bu görünüme erişim yetkiniz yok")

    now = time.time()
    if _cache["data"] is not None and now - _cache["fetched_at"] < CACHE_TTL_SECONDS:
        return _cache["data"]

    try:
        response = httpx.get(
            FRANKFURTER_URL,
            params={"base": "TRY", "symbols": ",".join(SUPPORTED_TARGETS)},
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError:
        if _cache["data"] is not None:
            return _cache["data"]
        raise HTTPException(status_code=502, detail="Güncel kur bilgisi alınamadı, lütfen daha sonra tekrar deneyin.")

    result = CurrencyRatesOut(base="TRY", date=payload.get("date"), rates=payload.get("rates", {}))
    _cache["data"] = result
    _cache["fetched_at"] = now
    return result
