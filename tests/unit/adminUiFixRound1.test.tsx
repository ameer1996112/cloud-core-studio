import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportsInsightList } from "../../src/routes/_authenticated/admin/reports";
import { PaymentRecordFailureAnnouncement } from "../../src/routes/_authenticated/admin/payments";
import { ConciergeJourneyList } from "../../src/components/admin/ConciergeCommandCenter";

import { safeErrorMessage } from "../../src/lib/error-messages";
import { destructiveActionFailureMessage } from "../../src/components/admin/admin-destructive-state";
import { settingsQueryViewState } from "../../src/components/admin/settings-query-state";
import {
  paymentAuxiliaryViewState,
  paymentRecordFailureState,
  paymentSummaryViewState,
} from "../../src/components/admin/payments-view-state";
import { adminKpiViewState } from "../../src/components/admin/admin-kpi-state";

const hostileTechnicalError =
  'PostgrestError: relation "private.payments" does not exist; JWT=secret-token; rpc_admin_charge failed';
const decoder = new TextDecoder();
const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function renderReadyAdminRoute(routePath: string, data: unknown) {
  const script = `
import { mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";
import * as actualReactStart from "@tanstack/react-start";
import * as actualReactQuery from "@tanstack/react-query";

const queryData = ${JSON.stringify(data)};
mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  createFileRoute: () => (options) => ({ options }),
  Link: ({ children, to, params: _params, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));
mock.module("@tanstack/react-start", () => ({
  ...actualReactStart,
  createClientOnlyFn: (fn) => fn,
  useServerFn: () => () => Promise.resolve(null),
}));
mock.module("@tanstack/react-query", () => ({
  ...actualReactQuery,
  useQuery: () => ({
    data: queryData,
    isLoading: false,
    isError: false,
    error: null,
    refetch() {},
  }),
  useMutation: () => ({
    mutate() {},
    mutateAsync: async () => undefined,
    isPending: false,
    variables: undefined,
  }),
  useQueryClient: () => ({ invalidateQueries() {} }),
}));
mock.module("@/lib/i18n", () => ({
  getActiveLang: () => "en",
  getLocale: () => "en-US",
  labelForMethod: (value) => String(value),
  labelForStatus: (value) => String(value),
  t: (key) => key,
  tForLang: (_lang, key) => key,
  useI18n: () => ({
    lang: "en",
    locale: "en-US",
    dir: "ltr",
    t: (key) => key,
  }),
}));
mock.module("@/hooks/useDocumentTitle", () => ({ useDocumentTitle() {} }));
mock.module("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({}) } } }));

const routeModule = await import(${JSON.stringify(resolve(root, routePath))});
process.stdout.write(renderToStaticMarkup(React.createElement(routeModule.Route.options.component)));
`;
  const result = Bun.spawnSync({
    cmd: ["/Users/ameeramer/.bun/bin/bun", "-e", script],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr) || `could not render ${routePath}`);
  }
  return decoder.decode(result.stdout);
}

describe("Task 10 fix round 1", () => {
  test("safe admin errors never expose hostile provider or database diagnostics", () => {
    const localizedFallback = "לא הצלחנו להשלים את הפעולה. אפשר לנסות שוב.";
    const renderedMessage = safeErrorMessage(new Error(hostileTechnicalError), localizedFallback);

    expect(renderedMessage).toBe(localizedFallback);
    expect(renderedMessage).not.toContain(hostileTechnicalError);
    expect(renderedMessage).not.toMatch(/Postgrest|private\.payments|JWT|rpc_admin_charge/i);
  });

  test("shared destructive confirmations keep provider diagnostics out of persistent failures", () => {
    const localizedFallback = "לא הצלחנו לבטל. אפשר לנסות שוב.";
    const renderedMessage = destructiveActionFailureMessage(
      new Error(hostileTechnicalError),
      localizedFallback,
    );

    expect(renderedMessage).toBe(localizedFallback);
    expect(renderedMessage).not.toContain(hostileTechnicalError);
  });

  test("settings query failures render a recoverable localized error state", () => {
    let retries = 0;
    const state = settingsQueryViewState({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(hostileTechnicalError),
      retry: () => {
        retries += 1;
      },
      loadingLabel: "טוען הגדרות…",
      errorTitle: "לא הצלחנו לטעון הגדרות",
      errorBody: "אפשר לנסות שוב.",
    });

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected a recoverable error state");
    expect(state.body).toBe("אפשר לנסות שוב.");
    expect(state.body).not.toContain(hostileTechnicalError);
    state.retry?.();
    expect(retries).toBe(1);
  });

  test("payment summary and option queries cannot turn failures into zero or empty data", () => {
    let summaryRetries = 0;
    const summaryState = paymentSummaryViewState({
      payments: { data: [{ amount: 140 }], isLoading: false, isError: false, error: null },
      summary: {
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error(hostileTechnicalError),
      },
      retry: () => {
        summaryRetries += 1;
      },
      loadingLabel: "טוען סיכום…",
      errorTitle: "לא הצלחנו לטעון את הסיכום",
      errorBody: "אפשר לנסות שוב.",
    });

    expect(summaryState.status).toBe("error");
    if (summaryState.status !== "error") throw new Error("expected summary error");
    expect(summaryState.body).not.toContain(hostileTechnicalError);
    summaryState.retry?.();
    expect(summaryRetries).toBe(1);

    const membersState = paymentAuxiliaryViewState({
      data: [{ id: "member-1", name: "Maya" }],
      isLoading: false,
      isError: false,
      error: null,
      retry: () => {},
      loadingLabel: "טוען חברות…",
      errorTitle: "לא הצלחנו לטעון חברות",
      errorBody: "אפשר לנסות שוב.",
    });
    const plansState = paymentAuxiliaryViewState({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(hostileTechnicalError),
      retry: () => {},
      loadingLabel: "טוען חבילות…",
      errorTitle: "לא הצלחנו לטעון חבילות",
      errorBody: "אפשר לנסות שוב.",
    });

    expect(membersState.status).toBe("ready");
    expect(plansState.status).toBe("error");
  });

  test("payment recording failures keep the workflow open with a safe persistent outcome", () => {
    const failureState = paymentRecordFailureState(
      new Error(hostileTechnicalError),
      "לא הצלחנו לרשום את התשלום.",
    );

    expect(failureState.open).toBe(true);
    expect(failureState.outcome.tone).toBe("error");
    expect(failureState.outcome.body).toBe("לא הצלחנו לרשום את התשלום.");
    expect(failureState.outcome.body).not.toContain(hostileTechnicalError);

    const html = renderToStaticMarkup(
      <PaymentRecordFailureAnnouncement outcome={failureState.outcome} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("לא הצלחנו לרשום את התשלום.");
    expect(html).not.toContain(hostileTechnicalError);
  });

  test("instructor and delivery KPI states never synthesize zero while their query is unresolved", () => {
    const loadingState = adminKpiViewState({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      retry: () => {},
      loadingLabel: "Loading instructors…",
      errorTitle: "Instructors unavailable",
      errorBody: "Try again.",
    });
    const errorState = adminKpiViewState({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(hostileTechnicalError),
      retry: () => {},
      loadingLabel: "Loading delivery totals…",
      errorTitle: "Delivery totals unavailable",
      errorBody: "Try again.",
    });

    expect(loadingState).toEqual({ status: "loading", label: "Loading instructors…" });
    expect(errorState.status).toBe("error");
    if (errorState.status !== "error") throw new Error("expected KPI error");
    expect(errorState.body).toBe("Try again.");
    expect(JSON.stringify([loadingState, errorState])).not.toContain('"data":0');
  });

  test("admin list routes render truthful field terms in responsive definition lists", () => {
    const cases = [
      {
        path: "src/routes/_authenticated/admin/members/index.tsx",
        data: [
          {
            id: "member-1",
            name: "Maya",
            status: "active",
            remaining_credits: 3,
            active_plan: { slug: "single_class", name: "Single" },
            tags: [],
            last_visit_at: "2026-08-01T08:00:00.000Z",
            next_booking: { starts_at: "2026-08-29T08:00:00.000Z" },
          },
        ],
        labels: ["common.member", "common.status", "common.plan", "common.credits"],
      },
      {
        path: "src/routes/_authenticated/admin/rooms.tsx",
        data: [
          {
            id: "room-1",
            name: "Cloud Room",
            description: "Main studio",
            image_url: null,
            capacity: 12,
            equipment_count: 8,
            setup_minutes_before: 10,
            setup_minutes_after: 10,
            color: "#D4AF6A",
            notes: null,
            active: true,
          },
        ],
        labels: ["admin.rooms.name", "common.status", "admin.rooms.capacity"],
      },
      {
        path: "src/routes/_authenticated/admin/plans.tsx",
        data: [
          {
            id: "plan-1",
            slug: "single_class",
            name: "Single",
            description: "One class",
            credits: 1,
            price_cents: 8000,
            currency: "ILS",
            duration_days: 14,
            active: true,
          },
        ],
        labels: ["common.plan", "common.status", "admin.plans.credits", "common.duration"],
      },
      {
        path: "src/routes/_authenticated/admin/programs.tsx",
        data: [
          {
            id: "program-1",
            slug: "flow",
            name_en: "Flow",
            name_he: "זרימה",
            name_ar: "تدفق",
            description_en: "Flow class",
            description_he: null,
            description_ar: null,
            age_groups: [],
            level: "all levels",
            default_duration_minutes: 60,
            default_capacity: 12,
            default_credit_cost: 1,
            equipment: [],
            color_tag: "#D4AF6A",
            cover_image_url: null,
            sort_order: 1,
            active: true,
          },
        ],
        labels: ["admin.programs.title", "common.status", "admin.programs.duration"],
      },
      {
        path: "src/routes/_authenticated/admin/instructors.tsx",
        data: [
          {
            id: "instructor-1",
            name: "Maya",
            bio_short: "Flow",
            avatar_url: null,
            active: true,
          },
        ],
        labels: ["admin.instructors.name", "common.status", "common.actions"],
      },
    ];

    for (const routeCase of cases) {
      const html = renderReadyAdminRoute(routeCase.path, routeCase.data);
      expect(html).toContain("<dl");
      for (const label of routeCase.labels) {
        expect(html, `${routeCase.path} should render the ${label} term`).toContain(
          `>${label}</dt>`,
        );
      }
    }
  });

  test("reports insights and Concierge journeys render field-level mobile semantics", () => {
    const reportCopy = {
      "reports.insights": "Studio insights",
      "reports.insight": "Insight",
      "reports.insightDetails": "Details",
      "reports.insightMetric": "Metric",
      "common.actions": "Actions",
    } as const;
    const reportsHtml = renderToStaticMarkup(
      <ReportsInsightList
        lang="en"
        translate={(key) => reportCopy[key as keyof typeof reportCopy] ?? key}
        insights={[
          {
            id: "custom-insight",
            title: "Attendance is rising",
            body: "Five more members attended this period.",
            metric: "+5",
            action: null,
          },
        ]}
      />,
    );
    const conciergeHtml = renderToStaticMarkup(
      <ConciergeJourneyList
        lang="en"
        journeys={[
          {
            journeyType: "booking_confirmed",
            status: "live",
            liveEvents: 4,
            totalEvents: 5,
            channels: ["push"],
          },
        ]}
      />,
    );

    expect(reportsHtml).toContain(">Insight</dt>");
    expect(reportsHtml).toContain(">Details</dt>");
    expect(reportsHtml).toContain(">Metric</dt>");
    expect(conciergeHtml).toContain(">Journey</dt>");
    expect(conciergeHtml).toContain(">Status</dt>");
    expect(conciergeHtml).toContain(">Live events</dt>");
    expect(conciergeHtml).toContain(">Delivery channels</dt>");
  });

  test("destructive confirmations name the real class, program, and instructor consequences", () => {
    expect(read("src/routes/_authenticated/admin/classes/index.tsx")).toContain(
      'consequence={t("admin.classes.cancelConsequence")}',
    );
    expect(read("src/routes/_authenticated/admin/classes/index.tsx")).toContain(
      'consequence={t("admin.classes.archiveConsequence")}',
    );
    expect(read("src/routes/_authenticated/admin/programs.tsx")).toContain(
      'consequence={t("admin.programs.archiveConsequence")}',
    );
    expect(read("src/routes/_authenticated/admin/instructors.tsx")).toContain(
      'consequence={t("admin.instructors.deactivateConsequence")}',
    );
  });

  test("error-safe usages, distinct labels, and 44px instructor targets remain wired", () => {
    const payments = read("src/routes/_authenticated/admin/payments.tsx");
    const kids = read("src/routes/_authenticated/admin/kids.tsx");
    const destructive = read("src/components/admin/AdminDestructiveAction.tsx");
    const reports = read("src/routes/_authenticated/admin/reports.tsx");
    const instructors = read("src/routes/_authenticated/admin/instructors.tsx");
    const adminStyles = read("src/styles/admin.css");

    expect(payments).toContain("paymentRecordFailureState");
    expect(payments).not.toMatch(/(?:save|refund|confirm|cancel)Error instanceof Error/);
    expect(kids).toContain("safeErrorMessage(mutationError, title)");
    expect(kids).not.toContain("mutationError.message");
    expect(destructive).toContain("destructiveActionFailureMessage");
    expect(destructive).not.toContain("error.message");
    expect(reports).toContain('t("reports.range.start")');
    expect(reports).toContain('t("reports.range.end")');
    expect(instructors).toContain("admin-instructor-action-target");
    expect(instructors).not.toContain('className="sr-only">{t("admin.instructors.search")}');
    expect(adminStyles).toMatch(
      /\.admin-instructor-card__actions \.btn-outline,[\s\S]*?min-height:\s*2\.75rem/,
    );
  });
});
