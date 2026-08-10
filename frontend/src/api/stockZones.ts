import { authFetch } from "./client";
import type { StockZoneCreatePayload, StockZoneOut, StockZoneUpdatePayload } from "../types/stockZone";

export function listStockZones(token: string): Promise<StockZoneOut[]> {
  return authFetch<StockZoneOut[]>(token, "/api/stock-zones");
}

export function createStockZone(token: string, payload: StockZoneCreatePayload): Promise<StockZoneOut> {
  return authFetch<StockZoneOut>(token, "/api/stock-zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateStockZone(
  token: string,
  zoneId: number,
  payload: StockZoneUpdatePayload,
): Promise<StockZoneOut> {
  return authFetch<StockZoneOut>(token, `/api/stock-zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteStockZone(token: string, zoneId: number): Promise<void> {
  return authFetch<void>(token, `/api/stock-zones/${zoneId}`, { method: "DELETE" });
}
