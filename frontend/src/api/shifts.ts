import { authFetch } from "./client";
import type { RosterEmployee, ShiftItem, ShiftUpsertPayload } from "../types/shift";

export function listShifts(token: string): Promise<ShiftItem[]> {
  return authFetch<ShiftItem[]>(token, "/api/shifts");
}

export function listRoster(token: string): Promise<RosterEmployee[]> {
  return authFetch<RosterEmployee[]>(token, "/api/shifts/roster");
}

export function listWeekShifts(token: string, startDate: string): Promise<ShiftItem[]> {
  return authFetch<ShiftItem[]>(token, `/api/shifts/week?start_date=${startDate}`);
}

export function assignShift(token: string, employeeId: number, payload: ShiftUpsertPayload): Promise<ShiftItem> {
  return authFetch<ShiftItem>(token, `/api/shifts/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
