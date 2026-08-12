import { authFetch } from "./client";
import type { CurrencyRatesOut } from "../types/currency";

// Faz 3 "döviz ekranı" (PROCESS.md, 2026-08-11) — sadece branch_manager/region_manager/general_manager
// çağırabilir (backend::CURRENCY_ACCESS_ROLES), diğer roller 403 alır.
export function getCurrencyRates(token: string): Promise<CurrencyRatesOut> {
  return authFetch<CurrencyRatesOut>(token, "/api/currency/rates");
}
