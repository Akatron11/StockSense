import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { roleLabel } from "../auth/roleLabels";
import { navForRole } from "./navConfig";
import { Avatar } from "./Avatar";
import { getLoginBranding } from "../api/auth";
import { applyBrandColor } from "../theme/brandColor";

interface AppShellProps {
  pageTitle: string;
  children: ReactNode;
}

// prototype/app.css'teki ".app/.rail/.topbar" ortak kabuk deseninin React karşılığı.
// Nav grupları kullanıcının rolüne göre navConfig.ts'ten otomatik çözülür. Aktif öğe artık gerçek
// URL'e (location.pathname) göre belirleniyor — path'i olan öğeler tıklanabilir Link, olmayanlar
// (henüz ekranı kurulmayan) düz metin kalıyor.
export function AppShell({ pageTitle, children }: AppShellProps) {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Şirketin ana rengi — /api/auth/branding host header'dan (subdomain) çözer, auth gerektirmez,
    // login öncesiyle aynı endpoint. admin subdomain'de primary_color null döner, tema değişmez.
    getLoginBranding()
      .then((b) => applyBrandColor(b.primary_color))
      .catch(() => applyBrandColor(null));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const roleText = user ? roleLabel(user.role) : "";
  const navGroups = user ? navForRole(user.role) : [];

  return (
    <div className="app">
      <aside className="rail">
        <div className="logo">LOGO</div>
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
                        <span className="ic" /> {t(item.label)}
                      </Link>
                    ) : (
                      <>
                        <span className="ic" /> {t(item.label)}
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
            <span className="brand-slot">{t("chrome.brandSlot")}</span>

            <div className={`bellwrap${bellOpen ? " open" : ""}`} ref={bellRef}>
              <div className="bell" onClick={() => setBellOpen((v) => !v)}>
                <span className="badge" />
              </div>
              <div className="bell-pop">
                <div className="bp-head">{t("chrome.notifications")}</div>
                <div className="bell-item">
                  <span className="tag">{t("chrome.system")}</span>
                  <span className="muted-small">{t("chrome.notificationsPlaceholder")}</span>
                </div>
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
                  {t("chrome.language")}
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
                  {t("chrome.logout")}
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
