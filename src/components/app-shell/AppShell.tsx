import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Globe2, X, LogOut } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { navForRole, bottomTabsForRole, isActive, type NavGroup } from "./useRoleNav";
import type { AppRole } from "@/lib/auth-redirect";
import { applyLang, LANG_META, t, useI18n, type Lang } from "@/lib/i18n";

type Props = {
  role: AppRole;
  children: ReactNode;
};

export function AppShell({ role, children }: Props) {
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const groups = navForRole(role);
  const bottomTabs = bottomTabsForRole(role);

  // Shell separation: members use bottom nav (no drawer);
  // admin/instructor use sidebar+drawer (no bottom nav).
  const useBottomNav = role === "member";
  const useDrawer = role === "admin" || role === "instructor";
  const contentFrameClass = useBottomNav ? "member-content-frame" : "admin-content-frame";
  const isRtl = LANG_META[lang].dir === "rtl";
  const mobileDrawerSideStyle = { insetInlineStart: 0 as const };

  useEffect(() => {
    if (!useDrawer || !mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingInlineEnd = document.body.style.paddingInlineEnd;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollbarCompensation = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarCompensation > 0) {
      document.body.style.paddingInlineEnd = `${scrollbarCompensation}px`;
    }

    mobileDrawerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingInlineEnd = previousPaddingInlineEnd;
      previouslyFocused?.focus?.();
    };
  }, [mobileOpen, useDrawer]);
  const menuControl = useDrawer ? (
    <button
      onClick={() => setMobileOpen(true)}
      aria-label={t("shell.openMenu")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] transition-[background-color,color] duration-200 hover:bg-gold/8 hover:text-[var(--color-text-primary)]"
    >
      <StandardMenuIcon />
    </button>
  ) : (
    <span className="inline-flex h-10 w-10 items-center justify-center" aria-hidden>
      <BrandMark className="h-4 w-4" tone="gold" />
    </span>
  );
  const signOutControl = (
    <button
      onClick={signOut}
      aria-label={t("shell.signOut")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-transparent text-[var(--color-text-muted)] transition-[background-color,color] duration-200 hover:bg-gold/10 hover:text-[var(--color-text-primary)]"
    >
      <LogOut className="h-[18px] w-[18px]" />
    </button>
  );

  async function signOut() {
    if (isSigningOut) return;
    flushSync(() => setIsSigningOut(true));
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isSigningOut) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-ivory text-foreground">
        <div className="text-center">
          <p className="eyebrow">Cloud &amp; Core</p>
          <h1 className="mt-3 font-display text-[clamp(2rem,5vw,2.75rem)] leading-none font-semibold">
            {t("shell.signingOut")}
          </h1>
          <div className="mx-auto mt-6 h-px w-16 bg-gold/70" />
        </div>
      </div>
    );
  }

  if (role === "member" && !isHydrated) {
    return (
      <div className="fixed inset-0 bg-ivory text-foreground">
        <div className="mx-auto flex min-h-full w-full max-w-[28rem] items-center justify-center px-6">
          <div className="member-card w-full max-w-sm p-8 text-center shadow-[var(--shadow-elevated)]">
            <img
              src="/brand/cloud-core-logo-full.png"
              alt="Cloud & Core Studio"
              className="mx-auto h-auto w-[12.5rem]"
            />
            <div className="mx-auto mt-5 h-px w-12 bg-gold/70" />
            <div className="mt-6 space-y-3">
              <div className="skeleton-brand h-4 rounded-full" />
              <div className="skeleton-brand mx-auto h-4 w-3/4 rounded-full" />
              <div className="skeleton-brand mx-auto h-11 w-full rounded-[16px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 flex overflow-hidden bg-[var(--color-surface-warm)] text-foreground"
    >
      {useDrawer && (
        <SidebarPanel
          role={role}
          groups={groups}
          pathname={pathname}
          lang={lang}
          onSignOut={signOut}
          className="hidden lg:flex"
        />
      )}

      {/* Mobile drawer mirrors sidebar — admin/instructor only */}
      {useDrawer && mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
            className="mobile-drawer-backdrop lg:hidden fixed inset-0 z-40"
          />
          <div
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("shell.openMenu")}
            tabIndex={-1}
            className="mobile-drawer-shell lg:hidden fixed inset-y-0 z-50"
            style={mobileDrawerSideStyle}
          >
            <SidebarPanel
              role={role}
              groups={groups}
              pathname={pathname}
              lang={lang}
              onSignOut={signOut}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <main className="member-shell-main flex-1 flex flex-col overflow-y-auto">
        {/* Mobile bar */}
        <div
          className="member-mobile-header-pad lg:hidden sticky top-0 z-30 flex h-[calc(52px+env(safe-area-inset-top))] items-end justify-between border-b border-[color:var(--color-border)] bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-warm)_100%)] px-4 shadow-[var(--shadow-card)]"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex h-[52px] w-11 shrink-0 items-center justify-start">
            {isRtl ? menuControl : signOutControl}
          </div>
          <span className="flex h-[52px] min-w-0 flex-1 items-center justify-center px-2">
            <BrandHeaderWordmark />
          </span>
          <div className="flex h-[52px] w-11 shrink-0 items-center justify-end">
            {isRtl ? signOutControl : menuControl}
          </div>
        </div>

        {/* Page header */}
        <header
          className={`${useBottomNav ? "hidden md:block" : "block"} px-[clamp(1rem,4vw,3rem)] pt-4 sm:pt-6 md:pt-12 pb-3 md:pb-6`}
        >
          <div
            className={`${contentFrameClass} grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4`}
          >
            <div className="min-w-0">
              <p className="eyebrow">{eyebrowFor(role)}</p>
              <h1 className="mt-2 font-display text-[clamp(1.95rem,4vw,2.75rem)] leading-[1.08] font-semibold text-foreground truncate">
                {currentSectionLabel(pathname, groups)}
              </h1>
            </div>
            <div className="hidden shrink-0 items-center justify-end gap-4 border-b border-gold/40 pb-1 text-xs font-display text-slate md:flex">
              {useBottomNav ? <BrandHeaderWordmark className="scale-[0.95]" /> : null}
            </div>
          </div>
        </header>

        {/* Member desktop/tablet top nav — replaces the missing sidebar */}
        {useBottomNav && (
          <nav
            aria-label={t("shell.practice")}
            className="hidden md:block px-[clamp(1rem,4vw,3rem)] pb-3"
          >
            <div
              className={`${contentFrameClass} flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gold/30 pb-2`}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {bottomTabs.map(({ to, icon: Icon, label, exact }) => {
                const active = exact
                  ? pathname === to
                  : pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative inline-flex min-h-11 items-center gap-2 text-sm transition-colors pb-2 ${
                      active ? "text-navy font-medium" : "text-slate hover:text-navy"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-80" />
                    <span>{label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-gold"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Content */}
        <div className={`px-[clamp(1rem,4vw,3rem)] flex-1 ${useBottomNav ? "md:pb-16" : "pb-12"}`}>
          <div className={contentFrameClass}>{children}</div>
        </div>

        {/* Bottom tabs — member only, mobile only */}
        {useBottomNav && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-1.5 pointer-events-none">
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className="mx-auto flex max-w-[28rem] min-h-[var(--member-bottom-nav-height)] justify-around gap-0.5 rounded-[calc(var(--radius-lg)+2px)] border border-gold/30 bg-ivory/96 px-1.5 py-1 shadow-[0_-10px_34px_-28px_rgba(28,43,69,0.28)] backdrop-blur pointer-events-auto"
            >
              {bottomTabs.map(({ to, icon: Icon, label, exact }) => {
                const active = exact
                  ? pathname === to
                  : pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex-1 flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1.5 text-[11px] leading-tight transition-colors ${
                      active ? "bg-white/72 text-navy" : "text-slate hover:text-navy"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-navy" : ""}`} />
                    <span className="max-w-full truncate text-center leading-tight">{label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute bottom-1 h-[2px] w-5 rounded-full bg-gold"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}

function SidebarPanel({
  role,
  groups,
  pathname,
  lang,
  onSignOut,
  onNavigate,
  className = "",
}: {
  role: AppRole;
  groups: NavGroup[];
  pathname: string;
  lang: Lang;
  onSignOut: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const isRtl = LANG_META[lang].dir === "rtl";
  const isMobileDrawer = Boolean(onNavigate);

  return (
    <aside
      dir={isRtl ? "rtl" : "ltr"}
      className={`relative flex h-full flex-col bg-[var(--color-surface-warm)] text-navy ${isMobileDrawer ? "mobile-sidebar-panel" : "w-[min(75vw,300px)] px-4 pb-6 shadow-[var(--shadow-sidebar)] lg:w-72"} ${className}`}
    >
      {onNavigate && (
        <button
          onClick={onNavigate}
          aria-label={t("shell.closeMenu")}
          className="absolute inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] bg-white/84 text-[var(--color-text-muted)] shadow-[var(--shadow-card)] transition-[background-color,color,transform] duration-200 hover:bg-white hover:text-[var(--color-text-primary)] active:scale-[0.98] lg:hidden"
          style={{
            top: "calc(env(safe-area-inset-top) + 10px)",
            insetInlineStart: "0.75rem",
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div
        className={
          isMobileDrawer
            ? "mobile-sidebar-header"
            : "flex items-center justify-start gap-2 px-0 pb-3 pt-5"
        }
      >
        <Link
          to={role === "member" ? "/member" : "/admin"}
          onClick={onNavigate}
          className={`inline-flex min-h-11 items-center gap-2 text-navy ${isMobileDrawer ? "justify-center" : ""}`}
        >
          <BrandSidebarLockup compact={isMobileDrawer} />
        </Link>
      </div>
      <div className={isMobileDrawer ? "px-5 pb-3" : "pb-4"}>
        <div className="h-px w-full bg-[var(--color-sand)]" />
      </div>

      <nav
        className={`flex-1 overflow-y-auto text-start ${isMobileDrawer ? "mobile-sidebar-nav" : "py-0"}`}
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p
              className={`text-start font-semibold uppercase text-gold ${isMobileDrawer ? "mobile-sidebar-group-label" : "mb-1.5 mt-4 px-0 text-[11px] tracking-[0.12em]"}`}
            >
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center justify-start gap-2.5 text-start font-normal transition-[background-color,color,box-shadow,transform] duration-200 ${isMobileDrawer ? "mobile-sidebar-nav-item" : "h-11 rounded-[var(--radius-md)] px-3 text-[14px]"} ${
                        active
                          ? "bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-elevated)_100%)] text-[var(--color-ivory)] shadow-[var(--shadow-card)]"
                          : "text-[var(--color-text-secondary)] hover:bg-gold/8 hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {isRtl ? (
                        <>
                          <span className="min-w-0 truncate">{item.label}</span>
                          <Icon
                            className={`h-[15px] w-[15px] shrink-0 ${active ? "text-gold" : "text-[var(--color-text-secondary)] opacity-85 group-hover:text-[var(--color-text-primary)]"}`}
                          />
                        </>
                      ) : (
                        <>
                          <Icon
                            className={`h-[15px] w-[15px] shrink-0 ${active ? "text-gold" : "text-[var(--color-text-secondary)] opacity-85 group-hover:text-[var(--color-text-primary)]"}`}
                          />
                          <span className="min-w-0 truncate">{item.label}</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={
          isMobileDrawer
            ? "mobile-sidebar-footer"
            : "mt-auto border-t border-[var(--color-sand)] pt-4"
        }
      >
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-white/72 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 text-start">
            <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate tracking-normal">
              {t("nav.settings")}
            </p>
            <LanguageButtons lang={lang} />
          </div>
          <button
            onClick={onSignOut}
            className="flex w-full items-center justify-start gap-2 rounded-[var(--radius-md)] py-2.5 text-[13px] text-[var(--color-text-muted)] text-start transition-[background-color,color] duration-200 hover:bg-gold/8 hover:text-[var(--color-text-primary)]"
          >
            {isRtl ? (
              <>
                <span className="min-w-0 truncate">{t("shell.signOut")}</span>
                <LogOut className="h-[15px] w-[15px] shrink-0" />
              </>
            ) : (
              <>
                <LogOut className="h-[15px] w-[15px] shrink-0" />
                <span className="min-w-0 truncate">{t("shell.signOut")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function LanguageButtons({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const codes = Object.keys(LANG_META) as Lang[];
  const currentLang = LANG_META[lang] ? lang : "he";
  const current = LANG_META[currentLang];

  function choose(next: Lang) {
    applyLang(next);
    setOpen(false);
  }

  return (
    <div
      className="relative inline-block text-start"
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white/78 text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] transition-[background-color,color,border-color] duration-200 hover:bg-white ${
          compact ? "h-10 w-10 px-0" : "min-h-11 px-4 text-xs"
        }`}
        aria-label={compact ? current.label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-navy)] text-ivory">
          <Globe2 className="h-3.5 w-3.5" />
        </span>
        <span className={compact ? "sr-only" : "min-w-0 truncate"}>{current.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate transition-transform ${compact ? "hidden" : ""} ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[var(--color-surface-warm)] p-1 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
        >
          {codes.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={lang === code}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(code)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 text-sm transition-[background-color,color] duration-200 ${
                currentLang === code
                  ? "bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-elevated)_100%)] text-ivory"
                  : "text-slate hover:bg-white hover:text-navy"
              }`}
            >
              <span className="truncate">{LANG_META[code].label}</span>
              {currentLang === code && <Check className="h-4 w-4 shrink-0 text-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/brand/cloud-core-wordmark.png"
      alt="Cloud & Core"
      width={1095}
      height={300}
      className={`block h-auto w-[10.25rem] max-w-full object-contain object-center ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}

function BrandMark({
  className = "",
  tone = "navy",
}: {
  className?: string;
  tone?: "gold" | "navy";
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current [mask-image:url('/brand/cloud-core-mark.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] ${tone === "gold" ? "text-gold" : "text-[var(--color-text-primary)]"} ${className}`.trim()}
    />
  );
}

function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex min-h-11 items-center ${className}`.trim()}>
      <BrandMark className="h-7 w-7" />
      <BrandWordmark />
    </span>
  );
}

function BrandSidebarLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-2.5 text-start">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-gold/35 bg-white/72 shadow-[var(--shadow-card)]">
        <BrandMark className="h-6 w-6" />
      </span>
      <BrandWordmark className={compact ? "w-[8.6rem] sm:w-[9.25rem]" : "w-[9.25rem]"} />
    </span>
  );
}

function BrandHeaderWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center justify-center ${className}`.trim()}>
      <BrandWordmark className="w-[10.5rem] sm:w-[11rem]" />
    </span>
  );
}

function StandardMenuIcon() {
  return (
    <span aria-hidden className="inline-flex h-5 w-5 flex-col items-center justify-center gap-1">
      <span className="h-[2px] w-5 rounded-full bg-current" />
      <span className="h-[2px] w-5 rounded-full bg-current" />
      <span className="h-[2px] w-5 rounded-full bg-current" />
    </span>
  );
}

function eyebrowFor(role: AppRole): string {
  if (role === "admin") return t("shell.admin");
  if (role === "instructor") return t("shell.pulse");
  return t("shell.practice");
}

function currentSectionLabel(pathname: string, groups: NavGroup[]): string {
  for (const g of groups) {
    for (const item of g.items) {
      if (isActive(pathname, item))
        return item.label === t("nav.overview") ? t("nav.operations") : item.label;
    }
  }
  return "Cloud & Core";
}
