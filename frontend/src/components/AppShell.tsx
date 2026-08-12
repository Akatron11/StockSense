import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { navForRole } from "./navConfig";
import { Avatar } from "./Avatar";
import { Icon } from "./icons";
import { BrandMark } from "./BrandMark";
import { getLoginBranding } from "../api/auth";
import { getNotifications } from "../api/notifications";
import { getCurrencyRates } from "../api/currency";
import { applyBrandColor } from "../theme/brandColor";
import type { NotificationsOut } from "../types/notification";
import type { CurrencyRatesOut } from "../types/currency";

interface AppShellProps {
  pageTitle: string;
  children: ReactNode;
}

// Faz 3 "döviz ekranı" (PROCESS.md, 2026-08-11) — quantity/satış takibiyle aynı 3 rol, kullanıcı kararı.
const CURRENCY_ROLES = new Set(["branch_manager", "region_manager", "general_manager"]);
const CURRENCY_TARGETS = ["USD", "EUR", "GBP"] as const;

// prototype/app.css'teki ".app/.rail/.topbar" ortak kabuk deseninin React karşılığı.
// Nav grupları kullanıcının rolüne göre navConfig.ts'ten otomatik çözülür. Aktif öğe artık gerçek
// URL'e (location.pathname) göre belirleniyor — path'i olan öğeler tıklanabilir Link, olmayanlar
// (henüz ekranı kurulmayan) düz metin kalıyor.
export function AppShell({ pageTitle, children }: AppShellProps) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { token, user, logout } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationsOut | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [rates, setRates] = useState<CurrencyRatesOut | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [targetCurrency, setTargetCurrency] = useState<(typeof CURRENCY_TARGETS)[number]>("USD");
  const currencyRef = useRef<HTMLDivElement>(null);

  const subdomain = window.location.hostname.split(".")[0];

  useEffect(() => {
    // Şirketin markası — /api/auth/branding host header'dan (subdomain) çözer, auth gerektirmez,
    // login öncesiyle aynı endpoint. admin subdomain'de primary_color/logo_url null döner, değişmez.
    getLoginBranding()
      .then((b) => {
        applyBrandColor(b.primary_color);
        setLogoUrl(b.logo_url);
        setBrandName(b.display_name);
      })
      .catch(() => applyBrandColor(null));
  }, []);

  useEffect(() => {
    if (!token) return;
    setNotifError(null);
    getNotifications(token)
      .then(setNotifications)
      .catch(() => setNotifError(t("chrome.notificationsLoadError")));
  }, [token, bellOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const roleText = user ? roleLabel(t, user.role) : "";
  const navGroups = user ? navForRole(user.role) : [];
  const notifCount = notifications ? notifications.low_stock.length + notifications.expiring.length : 0;
  const canUseCurrency = user ? CURRENCY_ROLES.has(user.role) : false;

  function toggleCurrency() {
    setCurrencyOpen((v) => {
      const next = !v;
      if (next && !rates && !ratesLoading && token) {
        setRatesLoading(true);
        setRatesError(null);
        getCurrencyRates(token)
          .then(setRates)
          .catch(() => setRatesError(t("chrome.currencyLoadError")))
          .finally(() => setRatesLoading(false));
      }
      return next;
    });
  }

  const parsedAmount = Number(amount.replace(",", "."));
  const rate = rates?.rates[targetCurrency];
  const converted = rate !== undefined && !Number.isNaN(parsedAmount) ? parsedAmount * rate : null;

  return (
    <div className="app">
      <aside className="rail">
        <div className={`logo${logoUrl ? " has-image" : ""}`}>
          {logoUrl ? <img src={logoUrl} alt={t("chrome.logoAlt")} className="logo-img" /> : <BrandMark size={56} />}
        </div>
        {brandName && <div className="brand-name">{brandName}</div>}
        <div className="rail-role">{roleText}</div>

        {navGroups.map((group, groupIndex) => (
          <div key={group.groupLabel ?? `group-${groupIndex}`}>
            {group.groupLabel && <div className="nav-group">{t(group.groupLabel)}</div>}
            <ul className="nav">
              {group.items.map((item) => {
                const isActive = item.path !== undefined && item.path === location.pathname;
                const className = [isActive ? "active" : "", item.variant === "go" ? "go" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={item.label} className={className}>
                    {item.path ? (
                      <Link to={item.path} className="nav-link">
                        <span className="ic">
                          <Icon name={item.icon} />
                        </span>{" "}
                        {t(item.label)}
                      </Link>
                    ) : (
                      <>
                        <span className="ic">
                          <Icon name={item.icon} />
                        </span>{" "}
                        {t(item.label)}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="rail-spacer" />
        <div className="rail-user">
          <Avatar name={user?.full_name} />
          <div className="who">
            <span>{user?.full_name}</span>
            <span className="muted-small">{roleText}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">{pageTitle}</div>
          <div className="topbar-right">
            <span className="brand-slot">{subdomain}</span>

            {canUseCurrency && (
              <div className={`currencywrap${currencyOpen ? " open" : ""}`} ref={currencyRef}>
                <div className="bell" onClick={toggleCurrency} title={t("chrome.currency")}>
                  <Icon name="currency" />
                </div>
                <div className="currency-pop">
                  <div className="bp-head">{t("chrome.currency")}</div>
                  {ratesLoading && <div className="muted-small">{t("common.loading")}</div>}
                  {ratesError && <div className="error-text">{ratesError}</div>}
                  {rates && (
                    <>
                      <div className="field">
                        <label>{t("chrome.currencyAmountLabel")}</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>{t("chrome.currencyTargetLabel")}</label>
                        <select
                          className="input"
                          value={targetCurrency}
                          onChange={(e) => setTargetCurrency(e.target.value as (typeof CURRENCY_TARGETS)[number])}
                        >
                          {CURRENCY_TARGETS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="kv">
                        <span>{t("chrome.currencyResultLabel")}</span>
                        <span>{converted !== null ? `${converted.toFixed(2)} ${targetCurrency}` : "—"}</span>
                      </div>
                      {rates.date && (
                        <div className="muted-small">{t("chrome.currencyAsOf", { date: rates.date })}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className={`bellwrap${bellOpen ? " open" : ""}`} ref={bellRef}>
              <div className={`bell${notifCount > 0 ? " has-notifications" : ""}`} onClick={() => setBellOpen((v) => !v)}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifCount > 0 && <span className="badge">{notifCount > 9 ? "9+" : notifCount}</span>}
              </div>
              <div className="bell-pop">
                <div className="bp-head">{t("chrome.notifications")}</div>
                {notifError && <div className="bell-item muted-small">{notifError}</div>}
                {!notifError && notifCount === 0 && (
                  <div className="bell-item muted-small">{t("chrome.noNotifications")}</div>
                )}
                {notifications?.low_stock.map((item) => (
                  <div className="bell-item" key={`low-${item.product_id}-${item.branch_id}`}>
                    <span className="tag">{t("chrome.lowStockSection")}</span>
                    <span className="muted-small">
                      {t("chrome.lowStockItem", { name: item.product_name, quantity: item.quantity, threshold: item.threshold })}
                    </span>
                  </div>
                ))}
                {notifications?.expiring.map((item) => (
                  <div className="bell-item" key={`exp-${item.product_id}-${item.branch_id}`}>
                    <span className="tag">{t("chrome.expiringSection")}</span>
                    <span className="muted-small">
                      {t("chrome.expiringItem", { name: item.product_name, date: item.best_before_date })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`usermenu${userMenuOpen ? " open" : ""}`} ref={userMenuRef}>
              <Avatar name={user?.full_name} onClick={() => setUserMenuOpen((v) => !v)} />
              <div className="usermenu-pop">
                <div className="um-head">
                  <span>{user?.full_name}</span>
                  <span className="muted-small">{roleText}</span>
                </div>
                <div className="um-div" />
                <div className="um-row">
                  <span className="um-row-label">
                    <Icon name="language" /> {t("chrome.language")}
                  </span>
                  <span className="um-lang">
                    <span className={i18n.language === "tr" ? "on" : ""} onClick={() => i18n.changeLanguage("tr")} style={{ cursor: "pointer" }}>
                      TR
                    </span>
                    <span className="sep" />
                    <span className={i18n.language === "en" ? "on" : ""} onClick={() => i18n.changeLanguage("en")} style={{ cursor: "pointer" }}>
                      EN
                    </span>
                  </span>
                </div>
                <div className="um-div" />
                <div className="um-row um-row-clickable" onClick={logout}>
                  <span className="um-row-label">
                    <Icon name="logout" /> {t("chrome.logout")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
