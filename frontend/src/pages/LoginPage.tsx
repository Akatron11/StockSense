import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { login, getLoginBranding } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { applyBrandColor } from "../theme/brandColor";
import type { BrandingOut } from "../types/company";
import "../styles/login.css";

// Madde 16 — Login ekranı subdomain'e göre müşterinin markasıyla (company_branding) açılır,
// giriş öncesi bile markalı deneyim (auth'suz GET /api/auth/branding, Host header'dan çözülür).
export function LoginPage() {
  const { t, i18n } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<BrandingOut | null>(null);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getLoginBranding()
      .then((b) => {
        setBranding(b);
        applyBrandColor(b.primary_color);
      })
      .catch(() => setBranding(null));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { access_token, user } = await login({ username, password });
      setSession(access_token, user);
      navigate(user.role === "cashier" ? "/pos" : "/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t("login.errorInvalid"));
      } else {
        setError(t("login.errorGeneric"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="login-topstrip">
        <div className="login-lang">
          <span className={i18n.language === "tr" ? "on" : ""} onClick={() => i18n.changeLanguage("tr")} style={{ cursor: "pointer" }}>
            TR
          </span>
          <span className="sep" />
          <span className={i18n.language === "en" ? "on" : ""} onClick={() => i18n.changeLanguage("en")} style={{ cursor: "pointer" }}>
            EN
          </span>
        </div>
      </div>

      <div className="login-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-brandbox">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt={branding.display_name} className="login-logo-img" />
            ) : (
              <div className="login-logo">LOGO</div>
            )}
            <div className="login-appname" style={branding?.primary_color ? { color: branding.primary_color } : undefined}>
              {branding?.display_name ?? "StockSense"}
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="username">{t("login.username")}</label>
            <input
              id="username"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">{t("login.password")}</label>
            <div className="login-input-wrap">
              <input
                id="password"
                className="login-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")}
                title={t(showPassword ? "login.hidePassword" : "login.showPassword")}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.5 18.5 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("login.submitting") : t("login.submit")}
          </button>

          <div className="login-note">{t("login.forgotPassword")}</div>
        </form>
      </div>
    </div>
  );
}
