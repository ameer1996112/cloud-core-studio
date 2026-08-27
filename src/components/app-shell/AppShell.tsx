import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Globe2, X, LogOut } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createClientOnlyFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  navForRole,
  bottomTabsForRole,
  isActive,
  usesMemberShell,
  type NavGroup,
  type NavItem,
} from "./useRoleNav";
import type { AppRole } from "@/lib/auth-redirect";
import { applyLang, LANG_META, t, useI18n, type Lang } from "@/lib/i18n";
import { MemberNotificationCenter } from "@/components/member/MemberNotificationCenter";
import { MemberPushOnboarding } from "@/components/member/MemberPushOnboarding";
import { MemberWhatsappOnboarding } from "@/components/member/MemberWhatsappOnboarding";
import { MemberRouteSkeleton, type MemberRoute } from "@/components/member/MemberRouteSkeleton";
import { deactivateMemberPushTokens } from "@/lib/memberNotifications.functions";
import { syncMyPreferredLanguage } from "@/lib/member.functions";
import {
  isPlainPrimaryNavigationClick,
  queueLatestDocumentNavigation,
  shouldClearPendingMobileNavigation,
} from "./memberNavigation";

type Props = {
  role: AppRole;
  children: ReactNode;
};

type MemberDesktopHeaderProps = {
  tabs: NavItem[];
  pathname: string;
  isRtl: boolean;
  notificationControl: ReactNode;
  signOutControl: ReactNode;
};

type MemberMobileBottomNavigationProps = {
  tabs: NavItem[];
  pathname: string;
  isRtl: boolean;
  onNavigate?: (pathname: string) => void;
};

export function MemberDesktopHeader({
  tabs,
  pathname,
  isRtl,
  notificationControl,
  signOutControl,
}: MemberDesktopHeaderProps) {
  return (
    <header className="member-desktop-header hidden md:block">
      <div className="member-content-frame member-desktop-header__row">
        <Link
          to="/member"
          reloadDocument={pathname === "/member/schedule"}
          aria-label="Cloud & Core"
          className="member-desktop-header__brand"
        >
          <BrandHeaderWordmark />
        </Link>
        <nav
          aria-label={t("shell.practice")}
          className="member-desktop-header__nav"
          dir={isRtl ? "rtl" : "ltr"}
        >
          {tabs.map((item) => {
            const { to, icon: Icon, label } = item;
            const active = isActive(pathname, item);
            return (
              <Link
                key={to}
                to={to}
                reloadDocument={pathname === "/member/schedule" && to !== pathname}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "member-desktop-nav__link member-desktop-nav__link--active"
                    : "member-desktop-nav__link"
                }
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="member-desktop-header__actions">
          {notificationControl}
          {signOutControl}
        </div>
      </div>
    </header>
  );
}

export function MemberMobileBottomNavigation({
  tabs,
  pathname,
  isRtl,
  onNavigate,
}: MemberMobileBottomNavigationProps) {
  const documentNavigationSequence = useRef(0);

  useEffect(
    () => () => {
      documentNavigationSequence.current += 1;
    },
    [],
  );

  return (
    <nav
      aria-label={t("shell.practice")}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1 pointer-events-none"
    >
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto flex max-w-[28rem] min-h-[var(--member-bottom-nav-height)] justify-around gap-0.5 rounded-[var(--radius-lg)] border border-gold/30 bg-ivory/96 px-1.5 py-0.5 shadow-[0_-8px_28px_-24px_rgba(28,43,69,0.24)] backdrop-blur pointer-events-auto"
      >
        {tabs.map((item) => {
          const { to, icon: Icon, label } = item;
          const active = isActive(pathname, item);
          const isDocumentNavigation = pathname === "/member/schedule" && to !== pathname;
          return (
            <Link
              key={to}
              to={to}
              preload="render"
              reloadDocument={isDocumentNavigation}
              onClick={
                active || !onNavigate
                  ? undefined
                  : (event) => {
                      if (!isPlainPrimaryNavigationClick(event)) return;

                      onNavigate(to);
                      if (!isDocumentNavigation) return;

                      event.preventDefault();
                      queueLatestDocumentNavigation(
                        to,
                        documentNavigationSequence,
                        window.requestAnimationFrame.bind(window),
                        window.location.assign.bind(window.location),
                      );
                    }
              }
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`member-bottom-nav-link relative flex-1 flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 py-1 text-[13px] leading-tight transition-colors ${
                active ? "font-semibold text-navy" : "text-slate hover:text-navy"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-navy" : ""}`} />
              <span className="max-w-full truncate text-center leading-tight">{label}</span>
              {active && (
                <span aria-hidden className="absolute bottom-1 h-[2px] w-5 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function memberRouteForPath(pathname: string): MemberRoute {
  if (pathname === "/member/schedule" || pathname.startsWith("/member/schedule/")) {
    return "schedule";
  }
  if (pathname === "/member/bookings" || pathname.startsWith("/member/bookings/")) {
    return "bookings";
  }
  if (pathname === "/member/packages" || pathname.startsWith("/member/packages/")) {
    return "packages";
  }
  if (pathname === "/member/account" || pathname.startsWith("/member/account/")) {
    return "account";
  }
  return "home";
}

export function MemberRouteContent({
  pathname,
  isPendingPathChange,
  children,
}: {
  pathname: string;
  isPendingPathChange: boolean;
  children: ReactNode;
}) {
  return (
    <div
      key={`${pathname}:${isPendingPathChange ? "pending" : "ready"}`}
      className="member-route-transition"
      aria-busy={isPendingPathChange || undefined}
    >
      {isPendingPathChange ? (
        <MemberRouteSkeleton route={memberRouteForPath(pathname)} />
      ) : (
        children
      )}
    </div>
  );
}

const disconnectMemberPushSession = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  await memberPush.disconnectMemberPushSession();
});

const getCurrentMemberPushToken = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.getCurrentMemberPushToken();
});

const getCurrentMemberPushInstallationId = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.getCurrentMemberPushInstallationId();
});

export function AppShell({ role, children }: Props) {
  const { lang } = useI18n();
  const { pathname, resolvedPathname, isRouteLoading } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      resolvedPathname: state.resolvedLocation?.pathname ?? state.location.pathname,
      isRouteLoading: state.isLoading,
    }),
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingMobilePathname, setPendingMobilePathname] = useState<string | null>(null);
  const mobileNavigationStartedRef = useRef(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (role !== "member") return;
    void syncMyPreferredLanguage({ data: { preferredLanguage: lang } }).catch((error) => {
      console.warn("member_language_sync_failed", error);
    });
  }, [lang, role]);

  const groups = navForRole(role);
  const bottomTabs = bottomTabsForRole(role);

  // Shell separation: members use bottom nav (no drawer);
  // admin/instructor use sidebar+drawer (no bottom nav).
  const useBottomNav = usesMemberShell(role);
  const useDrawer = role === "admin" || role === "instructor";
  const contentFrameClass = useBottomNav ? "member-content-frame" : "admin-content-frame";
  const isRtl = LANG_META[lang].dir === "rtl";
  const mobileDrawerSideStyle = { insetInlineStart: 0 as const };

  useEffect(() => {
    if (!pendingMobilePathname) return;

    if (isRouteLoading) {
      mobileNavigationStartedRef.current = true;
      return;
    }

    if (
      shouldClearPendingMobileNavigation({
        destination: pendingMobilePathname,
        isLoading: isRouteLoading,
        resolvedPathname,
        navigationStarted: mobileNavigationStartedRef.current,
      })
    ) {
      mobileNavigationStartedRef.current = false;
      setPendingMobilePathname(null);
      return;
    }

    const fallback = window.setTimeout(() => {
      mobileNavigationStartedRef.current = false;
      setPendingMobilePathname(null);
    }, 1_500);
    return () => window.clearTimeout(fallback);
  }, [isRouteLoading, pendingMobilePathname, resolvedPathname]);

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
      className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] transition-[background-color,color] duration-200 hover:bg-gold/8 hover:text-[var(--color-text-primary)]"
    >
      <StandardMenuIcon />
    </button>
  ) : (
    <MemberNotificationCenter viewport="mobile" className="member-shell-action" />
  );
  const signOutControl = (
    <button
      onClick={signOut}
      aria-label={t("shell.signOut")}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] bg-transparent text-[var(--color-text-muted)] transition-[background-color,color] duration-200 hover:bg-gold/10 hover:text-[var(--color-text-primary)]"
    >
      <LogOut className="h-[18px] w-[18px]" />
    </button>
  );

  async function signOut() {
    if (isSigningOut) return;
    flushSync(() => setIsSigningOut(true));
    if (role === "member") {
      try {
        const token = await getCurrentMemberPushToken();
        const installationId = await getCurrentMemberPushInstallationId();
        if (token || installationId) {
          await deactivateMemberPushTokens({
            data: { ...(token ? { token } : {}), ...(installationId ? { installationId } : {}) },
          });
        }
      } catch (error) {
        console.warn("member_push_deactivate_on_signout_failed", error);
      }
      await disconnectMemberPushSession();
    }
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
          <h1 className="cc-page-title mt-3">{t("shell.signingOut")}</h1>
          <div className="mx-auto mt-6 h-px w-16 bg-gold/70" />
        </div>
      </div>
    );
  }

  if (role === "member" && !isHydrated) {
    return (
      <div className="fixed inset-0 bg-ivory text-foreground" dir={isRtl ? "rtl" : "ltr"}>
        <div className="member-content-frame px-4 pt-[calc(env(safe-area-inset-top)+4rem)]">
          <MemberRouteSkeleton route="home" />
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 flex overflow-hidden bg-[var(--color-surface-warm)] text-foreground"
    >
      {role === "member" && <MemberWhatsappOnboarding />}
      {role === "member" && <MemberPushOnboarding />}
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

      <main className="member-shell-main min-w-0 flex-1 flex flex-col overflow-y-auto">
        {/* Mobile bar */}
        <div
          className={`member-mobile-header-pad ${useBottomNav ? "md:hidden" : "lg:hidden"} sticky top-0 z-30 flex h-[calc(52px+env(safe-area-inset-top))] items-end justify-between border-b border-[color:var(--color-border)] bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-warm)_100%)] px-4 shadow-[var(--shadow-card)]`}
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

        {/* Compact desktop navigation — member only */}
        {useBottomNav && (
          <MemberDesktopHeader
            tabs={bottomTabs}
            pathname={pathname}
            isRtl={isRtl}
            notificationControl={
              <MemberNotificationCenter viewport="desktop" className="member-shell-action" />
            }
            signOutControl={signOutControl}
          />
        )}

        {/* Page header — admin/instructor only */}
        {!useBottomNav && (
          <header className="block px-[clamp(1rem,4vw,3rem)] pt-4 sm:pt-6 md:pt-12 pb-3 md:pb-6">
            <div className={contentFrameClass}>
              <div className="min-w-0">
                <p className="eyebrow">{eyebrowFor(role)}</p>
                <h1 className="cc-page-title mt-2 truncate">
                  {currentSectionLabel(pathname, groups)}
                </h1>
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        <div className={`px-[clamp(1rem,4vw,3rem)] flex-1 ${useBottomNav ? "md:pb-16" : "pb-12"}`}>
          <div className={contentFrameClass}>
            {useBottomNav ? (
              <MemberRouteContent
                pathname={pendingMobilePathname ?? pathname}
                isPendingPathChange={pendingMobilePathname !== null}
              >
                {children}
              </MemberRouteContent>
            ) : (
              children
            )}
          </div>
        </div>

        {/* Bottom tabs — member only, mobile only */}
        {useBottomNav && (
          <MemberMobileBottomNavigation
            tabs={bottomTabs}
            pathname={pathname}
            isRtl={isRtl}
            onNavigate={(to) => {
              mobileNavigationStartedRef.current = false;
              flushSync(() => setPendingMobilePathname(to));
            }}
          />
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
              className={`text-start font-semibold text-gold ${isMobileDrawer ? "mobile-sidebar-group-label" : "mb-1.5 mt-4 px-0 text-[12px] tracking-normal"}`}
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
          className="absolute bottom-full end-0 z-50 mb-2 w-44 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[var(--color-surface-warm)] p-1 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
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
  const strokeColor = tone === "gold" ? "#C59B4E" : "var(--color-navy)";
  const goldColor = "#C59B4E";
  const fillColor = tone === "gold" ? "rgba(197, 155, 78, 0.08)" : "rgba(11, 29, 58, 0.03)";

  return (
    <svg
      viewBox="0 0 160 112"
      aria-hidden="true"
      className={`inline-block shrink-0 overflow-visible ${className}`}
    >
      {/* Cloud path */}
      <path
        d="M38.7 72.8h80.1c13.5 0 24.4-10.2 24.4-22.8 0-12.2-10.1-22.2-22.9-22.8C115.8 13.5 102.1 4 86.1 4 70.8 4 57.6 12.8 51.5 25.5c-2.4-.7-4.9-1-7.5-1-15 0-27.2 11.4-27.2 25.5 0 12.6 9.7 22.8 21.9 22.8Z"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Core line (gold/bronze bar below representing pilates/reformer bar) */}
      <path
        d="M51.7 86.7h56.6"
        fill="none"
        stroke={goldColor}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
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
