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

export function authFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
