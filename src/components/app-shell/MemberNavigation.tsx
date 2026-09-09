import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { bottomTabsForRole, isActive } from "./useRoleNav";
import { StudioLogo } from "@/components/brand/StudioLogo";
import { t } from "@/lib/i18n";

export function MemberHeader({
  pathname,
  notifications,
  signOut,
  language,
}: {
  pathname: string;
  notifications: ReactNode;
  signOut: ReactNode;
  language: ReactNode;
}) {
  const tabs = bottomTabsForRole("member");
  return (
    <header className="studio-member-header">
      <div className="studio-member-header-inner">
        <Link to="/member" aria-label={t("nav.home")} className="studio-member-brand">
          <StudioLogo />
        </Link>
        <nav aria-label={t("shell.practice")} className="studio-member-desktop-nav">
          {tabs.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: !!item.exact }}
              aria-current={isActive(pathname, item) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="studio-member-tools">
          {language}
          {notifications}
          {signOut}
        </div>
      </div>
    </header>
  );
}

export function MemberBottomNavigation({ pathname }: { pathname: string }) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const shell = nav?.closest<HTMLElement>(".member-app");
    if (!nav || !shell) return;
    const measure = () =>
      shell.style.setProperty("--member-nav-height", `${nav.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    measure();
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--member-nav-height");
    };
  }, []);
  return (
    <nav ref={navRef} className="studio-member-bottom-nav" aria-label={t("shell.practice")}>
      <div className="studio-member-bottom-nav-inner">
        {bottomTabsForRole("member").map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: !!item.exact }}
            aria-current={isActive(pathname, item) ? "page" : undefined}
          >
            <item.icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
