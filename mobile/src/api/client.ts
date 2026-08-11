export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
// {msg, loc, ...} objelerinden oluşan bir dizi. Web tarafında bunun render sırasında crash'e
// yol açtığı bulunmuştu (commit 3d80556) — aynı hatanın mobilde tekrarlanmaması için
// web'deki apiErrorMessage() helper'ı birebir taşınıyor.
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

// authFetch kullanan çağrılar (login sonrası — bkz. api/auth.ts::me hariç tüm API dosyaları)
// token'ın süresi dolduğunda/geçersiz olduğunda (401) global olarak oturumu kapatır, her ekranın
// kendi 401 mantığı yazmasına gerek kalmaz. AuthContext, mount'ta bu handler'ı kendi logout()'una
// bağlar (bkz. Step 7, AuthContext.tsx güncellemesi).
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export async function authFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiFetch<T>(path, {
      ...options,
      headers: {
        authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw err;
  }
}
