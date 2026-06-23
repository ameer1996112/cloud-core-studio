import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { roleHome } from "@/lib/auth-redirect";

// All /admin/* routes require an admin profile.
// Instructors and members are bounced to their own home.
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", u.user.id)
      .maybeSingle();
    const role = p?.role;
    if (role !== "admin") throw redirect({ to: roleHome(role) });
    return { role: "admin" as const };
  },
  component: () => <Outlet />,
});
