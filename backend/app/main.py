from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    auth,
    companies,
    employees,
    layout_suggestion,
    layout_zones,
    notifications,
    org,
    products,
    reports,
    returns,
    sales,
    shifts,
    stock,
    stock_requests,
    stock_zones,
)

app = FastAPI(title="StockSense API")

# Dev frontend (Vite, port 5173) — düz localhost ve *.localhost subdomain'leri (madde 16 multi-tenant testi) kapsar.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://([a-zA-Z0-9-]+\.)?(localhost|127\.0\.0\.1):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(returns.router)
app.include_router(stock.router)
app.include_router(stock_requests.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(layout_suggestion.router)
app.include_router(layout_zones.router)
app.include_router(stock_zones.router)
app.include_router(shifts.router)
app.include_router(employees.router)
app.include_router(org.router)
app.include_router(companies.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
