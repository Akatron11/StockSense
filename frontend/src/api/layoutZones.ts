import { authFetch } from "./client";
import type { LayoutZoneCreatePayload, LayoutZoneOut, LayoutZoneUpdatePayload } from "../types/layoutZone";

export function listLayoutZones(token: string): Promise<LayoutZoneOut[]> {
  return authFetch<LayoutZoneOut[]>(token, "/api/layout-zones");
}

export function createLayoutZone(token: string, payload: LayoutZoneCreatePayload): Promise<LayoutZoneOut> {
  return authFetch<LayoutZoneOut>(token, "/api/layout-zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLayoutZone(
  token: string,
  zoneId: number,
  payload: LayoutZoneUpdatePayload,
): Promise<LayoutZoneOut> {
  return authFetch<LayoutZoneOut>(token, `/api/layout-zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteLayoutZone(token: string, zoneId: number): Promise<void> {
  return authFetch<void>(token, `/api/layout-zones/${zoneId}`, { method: "DELETE" });
}
