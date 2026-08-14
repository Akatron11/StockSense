import { authFetch } from "./client";
import type { EmployeeCreatePayload, EmployeeOut, EmployeeUpdatePayload, PasswordResetPayload } from "../types/employee";

export function listEmployees(token: string, includeInactive = false): Promise<EmployeeOut[]> {
  return authFetch<EmployeeOut[]>(token, `/api/employees${includeInactive ? "?include_inactive=true" : ""}`);
}

export function createEmployee(token: string, payload: EmployeeCreatePayload): Promise<EmployeeOut> {
  return authFetch<EmployeeOut>(token, "/api/employees", { method: "POST", body: JSON.stringify(payload) });
}

export function updateEmployee(token: string, employeeId: number, payload: EmployeeUpdatePayload): Promise<EmployeeOut> {
  return authFetch<EmployeeOut>(token, `/api/employees/${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listEmployeesCompanyWide(token: string): Promise<EmployeeOut[]> {
  return authFetch<EmployeeOut[]>(token, "/api/employees/company-wide");
}

export function resetEmployeePassword(token: string, employeeId: number, payload: PasswordResetPayload): Promise<EmployeeOut> {
  return authFetch<EmployeeOut>(token, `/api/employees/${employeeId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
