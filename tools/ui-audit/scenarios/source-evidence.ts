import type { ProductSource } from "../types";

type MatrixSection = "public" | "shared" | "member" | "instructor" | "admin";

const publicModules: Record<string, string> = {
  "/": "src/routes/index.tsx",
  "/auth": "src/routes/auth.tsx",
  "/auth?mode=signup": "src/routes/auth.tsx",
  "/auth?mode=forgot": "src/routes/auth.tsx",
  "/auth_/reset": "src/routes/auth_.reset.tsx",
  "/reset-password": "src/routes/reset-password.tsx",
  "/member/schedule": "src/routes/member.schedule.tsx",
  "/privacy": "src/routes/privacy.tsx",
  "/terms": "src/routes/terms.tsx",
  "/support": "src/routes/support.tsx",
  "/checkout": "src/routes/checkout.tsx",
  "/payment-result?status=success": "src/routes/payment-result.tsx",
  "/payment-result?status=failed": "src/routes/payment-result.tsx",
  "/payment-result?status=pending": "src/routes/payment-result.tsx",
  "/payment-result?status=cancelled": "src/routes/payment-result.tsx",
  "/app": "src/routes/app.tsx",
  "/download": "src/routes/download.tsx",
  "/downalod": "src/routes/downalod.tsx",
  "/instagram": "src/routes/instagram.tsx",
  "/promo/yoga-lina": "src/routes/promo.yoga-lina.tsx",
};

const sharedModules: Record<string, string> = {
  "/_authenticated layout": "src/routes/_authenticated/route.tsx",
  "/studio": "src/routes/_authenticated/studio.tsx",
  "/schedule": "src/routes/_authenticated/schedule.tsx",
  "/bookings": "src/routes/_authenticated/bookings/index.tsx",
  "/bookings/$id": "src/routes/_authenticated/bookings/$id.tsx",
  "/plans": "src/routes/_authenticated/plans.tsx",
};

const memberSources: Record<string, ProductSource> = {
  "/member": { module: "src/routes/_authenticated/member/index.tsx", export: "Route" },
  "/member/schedule authenticated branch": {
    module: "src/routes/member.schedule.tsx",
    export: "MemberScheduleContent",
  },
  "Class detail sheet": {
    module: "src/components/member/ClassDetailSheet.tsx",
    export: "ClassDetailSheet",
  },
  "Booking confirmation": {
    module: "src/components/member/ClassDetailSheet.tsx",
    export: "ClassDetailSheet",
  },
  "Booking failure/stale seat": {
    module: "src/components/member/ClassDetailSheet.tsx",
    export: "ClassDetailSheet",
  },
  "Waitlist/full states": {
    module: "src/components/member/ClassDetailSheet.tsx",
    export: "ClassDetailSheet",
  },
  "/member/bookings": {
    module: "src/routes/_authenticated/member/bookings.tsx",
    export: "Route",
  },
  "/member/packages": {
    module: "src/routes/_authenticated/member/packages.tsx",
    export: "Route",
  },
  "/member/account": {
    module: "src/routes/_authenticated/member/account.tsx",
    export: "Route",
  },
  "/receipts/$id": {
    module: "src/routes/_authenticated/receipts/$id.tsx",
    export: "Route",
  },
};

function adminModule(route: string): string {
  if (route === "/admin") return "src/routes/_authenticated/admin/index.tsx";
  if (route === "/admin/classes") return "src/routes/_authenticated/admin/classes/index.tsx";
  if (route === "/admin/members") return "src/routes/_authenticated/admin/members/index.tsx";
  return `src/routes/_authenticated${route}.tsx`;
}

export function productSourceFor(section: MatrixSection, route: string): ProductSource {
  if (section === "public" && route === "/checkout")
    return { module: "src/routes/checkout.tsx", export: "CheckoutPresentation" };
  if (section === "public") return { module: publicModules[route], export: "Route" };
  if (section === "shared") return { module: sharedModules[route], export: "Route" };
  if (section === "member") return memberSources[route];
  if (section === "instructor") {
    return {
      module: "src/routes/_authenticated/instructor/index.tsx",
      export: "Route",
    };
  }
  return { module: adminModule(route), export: "Route" };
}

const redirectTargets: Record<string, string> = {
  "public|/|default": "redirect to /auth",
  "public|/downalod|default": "redirect to /download",
  "shared|/studio|default": "redirect to the signed-in role home",
  "shared|/schedule|default": "redirect to /member/schedule",
  "shared|/bookings|default": "redirect to /member/bookings",
  "shared|/bookings/$id|default": "redirect to /member/bookings",
  "shared|/plans|default": "redirect to /member/packages",
  "admin|/admin/bookings|default": "redirect to /admin/calendar",
  "admin|/admin/schedule|default": "redirect to /admin/calendar",
  "admin|/admin/planner|default": "redirect to /admin/calendar",
  "admin|/admin/templates|default": "redirect to /admin/messages",
  "admin|/admin/credits|default": "redirect to /admin/members",
  "admin|/admin/audit|default": "redirect to /admin",
};

export function redirectExpectation(matrixKey: string): string {
  return matrixKey.endsWith("|permission-denied")
    ? "redirect signed-out or wrong-role access to the authorized entry route"
    : (redirectTargets[matrixKey] ?? "redirect according to the product route guard");
}
