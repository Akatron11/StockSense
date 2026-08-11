import { apiFetch, authFetch } from "./client";
import type { LoginRequest, TokenResponse, UserOut } from "../types/auth";

export function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function me(token: string): Promise<UserOut> {
  return authFetch<UserOut>(token, "/api/auth/me");
}
