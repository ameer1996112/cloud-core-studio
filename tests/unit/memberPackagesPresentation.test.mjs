import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

const emptyPackageData = {
  mine: [],
  subscriptions: [],
  payments: [],
  ledger: [],
  plans: [],
  member: { name: "Ari Member", remaining_credits: 0 },
};

const availablePlan = {
  id: "plan-1",
  name: "Studio Five",
  description: "cloud_monthly_1x_week",
  price_cents: 28000,
  credits: 5,
  duration_days: 30,
};

let packageQueryResult = {
  data: { ...emptyPackageData, plans: [availablePlan] },
  isLoading: false,
  isError: false,
  refetch: () => Promise.resolve(),
};

let capturedSheetContentProps = null;

mock.module("@/components/ui/sheet", () => ({
  Sheet: ({ open, onOpenChange, children }) =>
    React.createElement(
      "div",
      { "data-sheet-open": String(open), "data-has-open-handler": String(Boolean(onOpenChange)) },
      children,
    ),
  SheetContent: ({ children, onOpenAutoFocus, onCloseAutoFocus, ...props }) => {
    capturedSheetContentProps = { onOpenAutoFocus, onCloseAutoFocus };
    return React.createElement(
      "section",
      {
        ...props,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "payment-sheet-title",
        "aria-describedby": "payment-sheet-description",
        "data-sheet-part": "content",
      },
      children,
    );
  },
  SheetHeader: ({ children, ...props }) => React.createElement("header", props, children),
  SheetTitle: ({ children, ...props }) =>
    React.createElement("h2", { id: "payment-sheet-title", ...props }, children),
  SheetDescription: ({ children, ...props }) =>
    React.createElement("p", { id: "payment-sheet-description", ...props }, children),
}));

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));

mock.module("@tanstack/react-start", () => ({
  useServerFn: () => () => Promise.resolve(null),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }) => {
    if (queryKey[0] === "member-packages") return packageQueryResult;
    if (queryKey[0] === "my-package-requests") return { data: [], isLoading: false };
    return { data: null, isLoading: false };
  },
  useMutation: () => ({ mutate() {}, isPending: false }),
  useQueryClient: () => ({ invalidateQueries() {} }),
}));

mock.module("@/lib/member.functions", () => ({ getMyPackages: {} }));
mock.module("@/lib/studioSettings.functions", () => ({ getPublicStudioSettings: {} }));
mock.module("@/lib/memberRequests.functions", () => ({
  createManualPackagePayment: {},
  getMyPackageRequests: {},
}));
mock.module("@/lib/receipts.functions", () => ({ createCheckoutSession: {} }));
mock.module("@/lib/subscriptions.functions", () => ({ cancelMySubscription: {} }));

mock.module("@/lib/i18n", () => ({
  LANG_META: {
    en: { dir: "ltr" },
    he: { dir: "rtl" },
    ar: { dir: "rtl" },
  },
  labelForMethod: (value) => value,
  labelForStatus: (value) => value,
  t: (key, params) => {
    const copy = {
      "nav.plans": "Packages",
      "member.packages.kicker": "Credits and plans",
      "member.packages.body": "Manage your active package and purchase your next one.",
      "member.activePackage": "Active package",
      "member.stat.credits": "Credits",
      "payments.pending": "Pending",
      "member.noActivePackage": "No active package",
      "packages.available": "Available packages",
      "packages.recent": "Recent requests",
      "packages.creditHistory": "Credit history",
      "packages.paymentHistory": "Payment history",
      "member.empty.packages.title": "No packages available yet",
      "member.empty.packages.body": "Packages will appear here when available.",
      "member.empty.payments.body": "No payments yet.",
      "packages.noCredit": "No credit activity",
      "packages.noPayments": "No payments",
      "packages.choosePackage": "Choose package",
      "packages.validDays": `${params?.days ?? ""} days`,
      "packages.noExpiry": "No expiry",
      "packages.allPrograms": "All studio programs",
      "common.loading": "Loading",
      "member.error.title": "We couldn't load this page",
      "member.error.body": "Please try again.",
      "common.retry": "Retry",
    };
    return copy[key] ?? key;
  },
  useI18n: () => ({ lang: "en", locale: "en-US", dir: "ltr" }),
}));

mock.module("@/components/member/PremiumClassCard", () => ({
  MemberEmptyState: ({ title, body }) =>
    React.createElement("div", { "data-testid": "empty-state" }, `${title} ${body}`),
}));

mock.module("@/lib/planDisplay", () => ({
  formatPlanPrice: (plan) => `₪${Number(plan.price_cents) / 100}`,
  getPlanDisplay: (plan) => ({
    name: plan.name,
    description: plan.description,
    memberLine: plan.name,
  }),
}));

mock.module("@/lib/test-records", () => ({ hasTestPlanRecord: () => false }));
mock.module("@/hooks/useDocumentTitle", () => ({ useDocumentTitle: () => {} }));
mock.module("@/components/ui/bidi", () => ({
  LtrInline: ({ children, ...props }) => React.createElement("span", props, children),
}));
mock.module("sonner", () => ({
  toast: Object.assign(() => {}, { success() {}, error() {} }),
}));

const packagesModule = await import("../../src/routes/_authenticated/member/packages.tsx");

function renderPackages() {
  return renderToStaticMarkup(React.createElement(packagesModule.Route.options.component));
}

describe("member packages presentation", () => {
  test("places available inventory and its purchase action before explanation and history", () => {
    const html = renderPackages();
    const intro = html.indexOf("member-page-intro");
    const inventory = html.indexOf("Available packages");
    const purchase = html.indexOf("Choose package");
    const explanation = html.indexOf("package-value-strip");
    const creditHistory = html.indexOf("Credit history");

    expect(intro).toBeGreaterThanOrEqual(0);
    expect(inventory).toBeGreaterThan(intro);
    expect(purchase).toBeGreaterThan(inventory);
    expect(explanation).toBeGreaterThan(purchase);
    expect(creditHistory).toBeGreaterThan(explanation);
    expect(html).toContain("min-h-11 w-full");
    expect(html).toContain("member-history-disclosure");
    expect(html).not.toContain("cloud_monthly_1x_week");
  });

  test("separates loading, fatal error, cached-content, and empty states truthfully", () => {
    const original = packageQueryResult;
    try {
      packageQueryResult = {
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: () => Promise.resolve(),
      };
      const loading = renderPackages();
      expect(loading).toContain('role="status"');
      expect(loading).not.toContain("No active package");
      expect(loading).not.toContain('data-testid="empty-state"');

      packageQueryResult = {
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: () => Promise.resolve(),
      };
      const fatal = renderPackages();
      expect(fatal).toContain('role="alert"');
      expect(fatal).toContain(">Retry</button>");
      expect(fatal).not.toContain("No active package");
      expect(fatal).not.toContain('data-testid="empty-state"');

      packageQueryResult = {
        data: { ...emptyPackageData, plans: [availablePlan] },
        isLoading: false,
        isError: true,
        refetch: () => Promise.resolve(),
      };
      const cached = renderPackages();
      expect(cached).toContain("Studio Five");
      expect(cached).toContain("Choose package");
      expect(cached).not.toContain('role="alert"');

      packageQueryResult = {
        data: emptyPackageData,
        isLoading: false,
        isError: false,
        refetch: () => Promise.resolve(),
      };
      const empty = renderPackages();
      expect(empty).toContain("No packages available yet");
      expect(empty).toContain('data-testid="empty-state"');
    } finally {
      packageQueryResult = original;
    }
  });

  test("opens an accessible payment sheet and restores focus to its exact purchase control", () => {
    const focused = [];
    const initialFocused = [];
    const initialPrevented = [];
    const closed = [];
    const prevented = [];
    const restoreFocusRef = {
      current: { isConnected: true, focus: () => focused.push("purchase") },
    };

    const html = renderToStaticMarkup(
      React.createElement(packagesModule.PaymentMethodSheet, {
        open: true,
        plan: availablePlan,
        lang: "en",
        settings: { payments_enabled: true, payments_provider: "hyp" },
        pending: false,
        initialFocusRef: { current: { focus: () => initialFocused.push("cash") } },
        restoreFocusRef,
        onOpenChange: () => {},
        onClosed: () => closed.push(true),
        onSubmit: () => {},
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="payment-sheet-title"');
    expect(html).toContain('aria-describedby="payment-sheet-description"');
    expect(html).toContain("packages.paymentTitle");
    expect(html).toContain("Studio Five");
    expect(html).toContain("packages.cashLabel");
    expect(html).toContain("packages.cardRecurringLabel");
    expect(html).toContain("common.cancel");
    expect(capturedSheetContentProps.onOpenAutoFocus).toBeFunction();
    expect(capturedSheetContentProps.onCloseAutoFocus).toBeFunction();

    capturedSheetContentProps.onOpenAutoFocus({
      preventDefault: () => initialPrevented.push(true),
    });
    expect(initialPrevented).toEqual([true]);
    expect(initialFocused).toEqual(["cash"]);

    capturedSheetContentProps.onCloseAutoFocus({
      preventDefault: () => prevented.push(true),
    });
    expect(prevented).toEqual([true]);
    expect(focused).toEqual(["purchase"]);
    expect(closed).toEqual([true]);
  });

  test("checkout terms consent gives its link a 44px focusable target", () => {
    const html = renderToStaticMarkup(
      React.createElement(packagesModule.CheckoutTermsConsent, {
        checkout: { termsAccepted: false },
        copy: {
          consent: "I have read and agree to the",
          terms: "terms and purchase conditions",
        },
        onChange: () => {},
      }),
    );

    expect(html).toContain('href="/terms"');
    expect(html).toContain("inline-flex min-h-11 min-w-11 items-center");
    expect(html).toContain("focus-visible:outline");
  });

  test("shared sheet automatic close remains a visible 44px target", () => {
    const source = readFileSync(
      new URL("../../src/components/ui/sheet.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("inline-flex h-11 w-11");
    expect(source).toContain("focus-visible:outline");
  });
});
