import { apiFetch } from "./client";
import type { LoginRequest, TokenResponse, UserOut } from "../types/auth";
import type { BrandingOut } from "../types/company";

export function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function getLoginBranding(): Promise<BrandingOut> {
  return apiFetch<BrandingOut>("/api/auth/branding");
}

export function me(token: string): Promise<UserOut> {
  return apiFetch<UserOut>("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` },
  });
}
