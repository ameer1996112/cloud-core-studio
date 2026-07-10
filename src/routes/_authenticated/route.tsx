import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell/AppShell";
import { requireAuthenticatedRoute } from "@/lib/route-guards";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    return requireAuthenticatedRoute(`${location.pathname}${location.searchStr}${location.hash}`);
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
  notFoundComponent: AuthedNotFound,
});

function AuthedLayout() {
  const { role } = Route.useRouteContext();

  return (
    <AppShell role={role}>
      <Outlet />
    </AppShell>
  );
}

function AuthedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate">רגע שקט</p>
        <h1 className="font-display text-3xl text-navy">משהו נעצר אצלנו</h1>
        <p className="text-sm text-slate">אפשר לנסות שוב בעוד רגע.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="cta-navy hover:cta-navy-hover px-5 py-2 text-xs"
          >
            {t("common.retry")}
          </button>
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.22em] text-slate hover:text-navy self-center"
          >
            {t("nav.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthedNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate">הדף לא נמצא</p>
        <h1 className="font-display text-3xl text-navy">העמוד הזה לא נשמר</h1>
        <Link to="/" className="inline-flex cta-navy hover:cta-navy-hover px-5 py-2 text-xs mt-2">
          {t("nav.home")}
        </Link>
      </div>
    </div>
  );
}
