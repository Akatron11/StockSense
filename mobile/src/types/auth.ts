// backend/app/schemas/auth.py ile birebir eşleşir.
export interface LoginRequest {
  username: string;
  password: string;
  subdomain?: string;
}

export interface UserOut {
  id: number;
  full_name: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  user: UserOut;
}
