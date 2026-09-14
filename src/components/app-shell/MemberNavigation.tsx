import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { bottomTabsForRole, isActive } from "./useRoleNav";
import { StudioLogo } from "@/components/brand/StudioLogo";
import { Menu, UserRound, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { t, useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

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
  const isMobile = useIsMobile();
  const { dir } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = (
    <nav className="ref-member-links" aria-label={t("shell.practice")}>
      {tabs.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: !!item.exact }}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
  if (isMobile)
    return (
      <header className="studio-member-header ref-mobile-header">
        <div className="studio-member-header-inner">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <button className="ref-icon-button" aria-label={t("shell.openMenu")}>
                <Menu size={21} aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent
              className="cc-review cc-reference ref-menu-dialog left-0 top-0 translate-x-0 translate-y-0 sm:left-0 sm:top-0 sm:translate-x-0 sm:translate-y-0"
              showCloseButton={false}
              aria-describedby={undefined}
              dir={dir}
            >
              <DialogTitle className="sr-only">{t("shell.openMenu")}</DialogTitle>
              <DialogClose
                className="ref-icon-button ref-menu-close"
                aria-label={t("common.close")}
              >
                <X size={20} aria-hidden="true" />
              </DialogClose>
              <StudioLogo className="ref-menu-logo" />
              {navigation}
              <div className="ref-menu-preferences">
                {language}
                {notifications}
              </div>
              <div className="ref-menu-signout">
                {signOut}
                <span>{t("shell.signOut")}</span>
              </div>
            </DialogContent>
          </Dialog>
          <Link to="/member" aria-label={t("nav.home")} className="studio-member-brand">
            <StudioLogo />
          </Link>
          <Link to="/member/account" className="ref-icon-button" aria-label={t("nav.profile")}>
            <UserRound size={21} aria-hidden="true" />
          </Link>
        </div>
      </header>
    );
  return (
    <>
      <aside className="ref-member-sidebar">
        <Link to="/member" aria-label={t("nav.home")} className="ref-sidebar-logo">
          <StudioLogo />
        </Link>
        {navigation}
        <div className="ref-menu-signout">
          {signOut}
          <span>{t("shell.signOut")}</span>
        </div>
      </aside>
      <header className="studio-member-header ref-desktop-header">
        <div className="studio-member-header-inner">
          {language}
          {notifications}
        </div>
      </header>
    </>
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
