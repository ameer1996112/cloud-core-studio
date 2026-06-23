import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell/AppShell";
import type { AppRole } from "@/lib/auth-redirect";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
  notFoundComponent: AuthedNotFound,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <div className="min-h-screen bg-ivory" />;
  }

  const role: AppRole = (profile?.role as AppRole) ?? "member";

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
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">רגע שקט</p>
        <h1 className="font-display italic text-3xl text-navy">משהו נעצר אצלנו</h1>
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">הדף לא נמצא</p>
        <h1 className="font-display italic text-3xl text-navy">העמוד הזה לא נשמר</h1>
        <Link to="/" className="inline-flex cta-navy hover:cta-navy-hover px-5 py-2 text-xs mt-2">
          {t("nav.home")}
        </Link>
      </div>
    </div>
  );
}
