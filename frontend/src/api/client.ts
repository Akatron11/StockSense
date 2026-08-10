const API_PORT = 8000;

// Backend, tenant'ı Host header'daki subdomain'den çözüyor (madde 16) — frontend de
// aynı subdomain'den açıldığı için, API adresi frontend'in kendi hostname'inden türetilir
// (testco.localhost:5173 -> testco.localhost:8000).
export const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

// Backend hata gövdesindeki `detail` alanı iki farklı şekilde gelebilir: elle raise edilen
// HTTPException'larda düz string, Pydantic'in otomatik doğrulama hatalarında (422) ise
// {msg, loc, ...} objelerinden oluşan bir dizi — ikincisini doğrudan bir string state'ine
// atayıp render etmeye çalışmak "Objects are not valid as a React child" ile çöker (bkz.
// ShiftCalendarPage'deki AM/PM'siz saat girişi bug'ı, 2026-08-10).
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const body = err.body;
  if (typeof body !== "object" || body === null || !("detail" in body)) return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === "object" && d !== null && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => m !== null);
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

export function authFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
