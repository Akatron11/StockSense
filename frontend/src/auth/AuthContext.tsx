import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { me } from "../api/auth";
import type { UserOut } from "../types/auth";

const TOKEN_STORAGE_KEY = "stocksense_token";

interface AuthContextValue {
  token: string | null;
  user: UserOut | null;
  isLoading: boolean;
  setSession: (token: string, user: UserOut) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  // Sayfa yenilendiğinde token localStorage'da kalır ama `user` sıfırlanır —
  // token varsa /api/auth/me ile kullanıcıyı geri yükle, geçersizse oturumu kapat.
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    me(token)
      .then(setUser)
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, []);

  function setSession(newToken: string, newUser: UserOut) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  }
  return ctx;
}
