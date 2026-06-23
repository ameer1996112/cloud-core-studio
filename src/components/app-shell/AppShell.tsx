import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, X, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const groups = navForRole(role);
  const bottomTabs = bottomTabsForRole(role);

  // Shell separation: members use bottom nav (no drawer);
  // admin/instructor use sidebar+drawer (no bottom nav).
  const useBottomNav = role === "member";
  const useDrawer = role === "admin" || role === "instructor";

  // Mirror the mobile drawer side based on document direction.
  const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";

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
          <h1 className="mt-3 font-display text-[40px] leading-none font-light">
            {t("shell.signingOut")}
          </h1>
          <div className="mx-auto mt-6 h-px w-16 bg-gold" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-ivory text-foreground overflow-hidden">
      {useDrawer && (
        <SidebarPanel
          role={role}
          groups={groups}
          pathname={pathname}
          onSignOut={signOut}
          className="hidden md:flex"
        />
      )}

      {/* Mobile drawer mirrors sidebar — admin/instructor only */}
      {useDrawer && mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-navy/30 backdrop-blur-sm"
          />
          <div className={`md:hidden fixed inset-y-0 z-50 w-72 ${isRtl ? "right-0" : "left-0"}`}>
            <SidebarPanel
              role={role}
              groups={groups}
              pathname={pathname}
              onSignOut={signOut}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Mobile bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-[rgba(11,29,58,0.08)] bg-ivory/85 backdrop-blur sticky top-0 z-30">
          {useDrawer ? (
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t("shell.openMenu")}
              className="inline-flex items-center justify-center h-11 w-11 text-navy"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : (
            <span className="inline-flex h-11 w-11" aria-hidden />
          )}
          <span className="font-display text-lg text-navy">Cloud &amp; Core</span>
          <div className="flex items-center gap-1.5">
            <LanguageButtons lang={lang} compact />
            <button
              onClick={signOut}
              aria-label={t("shell.signOut")}
              className="inline-flex items-center justify-center h-11 w-11 text-slate hover:text-navy"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Page header */}
        <header className="px-5 sm:px-6 md:px-12 pt-4 sm:pt-6 md:pt-12 pb-3 md:pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{eyebrowFor(role)}</p>
              <h1 className="mt-2 font-display text-[28px] sm:text-[32px] md:text-[40px] leading-[1.05] font-light text-foreground truncate">
                {currentSectionLabel(pathname, groups)}
              </h1>
            </div>
            <div className="hidden md:block text-xs italic font-display text-slate border-b border-gold/40 pb-1 shrink-0">
              <LanguageButtons lang={lang} />
            </div>
          </div>
        </header>

        {/* Member desktop/tablet top nav — replaces the missing sidebar */}
        {useBottomNav && (
          <nav
            aria-label={t("shell.practice")}
            className="hidden md:block px-5 sm:px-6 md:px-12 pb-3"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-gold/30 pb-2">
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
        <div
          className={`px-5 sm:px-6 md:px-12 flex-1 ${useBottomNav ? "pb-24 md:pb-16" : "pb-12"}`}
        >
          {children}
        </div>

        {/* Bottom tabs — member only, mobile only */}
        {useBottomNav && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 pointer-events-none">
            <div className="mx-auto max-w-md bg-ivory/95 backdrop-blur border border-gold/30 rounded-[14px] shadow-[0_-2px_16px_-12px_rgba(11,29,58,0.25)] flex justify-around gap-0.5 px-1.5 py-1 pointer-events-auto">
              {bottomTabs.map(({ to, icon: Icon, label, exact }) => {
                const active = exact
                  ? pathname === to
                  : pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-label={label}
                    className={`relative flex-1 flex min-h-12 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] transition ${
                      active ? "text-navy" : "text-slate hover:text-navy"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-navy" : ""}`} />
                    <span className="truncate max-w-full leading-tight">{label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 h-[2px] w-6 rounded-full bg-gold"
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
  onSignOut,
  onNavigate,
  className = "",
}: {
  role: AppRole;
  groups: NavGroup[];
  pathname: string;
  onSignOut: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <aside
      className={`w-64 h-full bg-[#E8DFD1]/30 border-e border-gold/30 flex flex-col ${className}`}
    >
      <div className="p-8 pb-5 flex items-center justify-between">
        <Link
          to={role === "member" ? "/member" : "/admin"}
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center font-display text-2xl font-semibold tracking-tight"
        >
          Cloud &amp; Core
        </Link>
        {onNavigate && (
          <button
            onClick={onNavigate}
            aria-label={t("shell.closeMenu")}
            className="md:hidden h-11 w-11 inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-8 pb-4">
        <div className="h-px w-12 bg-gold" />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-4 mb-2 eyebrow text-[10px]">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={`flex min-h-11 items-center gap-3 px-4 py-2 text-sm rounded-[2px] transition-colors ${
                        active
                          ? "font-medium bg-white border-b border-gold text-foreground"
                          : "text-slate hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 opacity-70" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-6 border-t border-gold/20">
        <button
          onClick={onSignOut}
          className="w-full flex min-h-11 items-center justify-between px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate hover:text-foreground transition-colors"
        >
          <span>{t("shell.signOut")}</span>
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function LanguageButtons({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  return (
    <div className="inline-flex border border-gold/30 bg-ivory text-[10px] uppercase tracking-[0.18em]">
      {(Object.keys(LANG_META) as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => applyLang(code)}
          className={`${compact ? "min-h-11 min-w-11 px-2 py-1" : "min-h-11 px-3 py-1.5"} ${lang === code ? "bg-navy text-ivory" : "text-slate hover:text-navy"}`}
          aria-pressed={lang === code}
        >
          {compact ? code.toUpperCase() : LANG_META[code].label}
        </button>
      ))}
    </div>
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
