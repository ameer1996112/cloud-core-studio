import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deliveryMomentCountViewState } from "../../src/components/admin/delivery-monitoring-view-state";
import { settingsPushRegistrationFailure } from "../../src/components/admin/settings-query-state";

const root = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function readLocalizedMessages(key: string) {
  const script = `
import { ensureI18nNamespaces, tForLang } from ${JSON.stringify(resolve(root, "src/lib/i18n.ts"))};
await ensureI18nNamespaces(["admin"]);
const key = ${JSON.stringify(key)};
process.stdout.write(JSON.stringify({
  en: tForLang("en", key),
  he: tForLang("he", key),
  ar: tForLang("ar", key),
}));
`;
  const result = Bun.spawnSync({
    cmd: ["/Users/ameeramer/.bun/bin/bun", "-e", script],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
  return JSON.parse(new TextDecoder().decode(result.stdout)) as Record<"en" | "he" | "ar", string>;
}

describe("Task 10 fix round 2", () => {
  test("class-list cancellation truthfully describes the retained status-only mutation", () => {
    const classes = read("src/routes/_authenticated/admin/classes/index.tsx");
    const cancellation = classes.slice(
      classes.indexOf('c.status === "scheduled"'),
      classes.indexOf("</AdminDestructiveAction>", classes.indexOf('c.status === "scheduled"')),
    );

    expect(classes).toContain("import { listClasses, setClassStatus }");
    expect(classes).toContain("useServerFn(setClassStatus)");
    expect(cancellation).toContain('consequence={t("admin.classes.cancelConsequence")}');
    expect(cancellation).toContain('mut.mutateAsync({ id: c.id, status: "cancelled" })');
    expect(cancellation).not.toContain("cancelClassBookings");

    const copy = readLocalizedMessages("admin.classes.cancelConsequence");
    expect(copy.en).toBe(
      "This class will be marked cancelled and will no longer be available on the active schedule for new bookings. Existing bookings and credits are not changed by this action.",
    );
    expect(copy.he).toBe(
      "השיעור יסומן כמבוטל ולא יהיה זמין עוד בלוח הפעיל להרשמות חדשות. הפעולה אינה משנה הרשמות או קרדיטים קיימים.",
    );
    expect(copy.ar).toBe(
      "سيتم وضع علامة ملغاة على هذه الحصة ولن تعود متاحة في الجدول النشط للحجوزات الجديدة. لا يغيّر هذا الإجراء الحجوزات أو الأرصدة الحالية.",
    );
    expect(Object.values(copy).join(" ")).not.toMatch(
      /refund|returned|credited back|החזר|יוחזר|استرداد|إعادة الرصيد/i,
    );
  });

  test("delivery customer-moment count has truthful loading, error, retry, and ready states", () => {
    let retries = 0;
    const common = {
      error: new Error("provider unavailable"),
      retry: () => {
        retries += 1;
      },
      loadingLabel: "Loading deliveries",
      errorTitle: "Needs attention",
      errorBody: "Could not load delivery activity.",
    };

    const loading = deliveryMomentCountViewState({
      ...common,
      totalMoments: undefined,
      isLoading: true,
      isError: false,
    });
    expect(loading).toEqual({ status: "loading", label: "Loading deliveries" });
    expect(loading).not.toHaveProperty("data", 0);

    const failed = deliveryMomentCountViewState({
      ...common,
      totalMoments: undefined,
      isLoading: false,
      isError: true,
    });
    expect(failed).toMatchObject({
      status: "error",
      title: "Needs attention",
      body: "Could not load delivery activity.",
    });
    expect(failed).not.toHaveProperty("data", 0);
    if (failed.status === "error") failed.retry();
    expect(retries).toBe(1);

    expect(
      deliveryMomentCountViewState({
        ...common,
        totalMoments: 7,
        isLoading: false,
        isError: false,
      }),
    ).toEqual({ status: "ready", data: 7 });

    const delivery = read("src/components/admin/DeliveryMonitoringConsole.tsx");
    expect(delivery).toContain("deliveryMomentCountViewState({");
    expect(delivery).toContain("isLoading: deliveries.isLoading");
    expect(delivery).toContain("isError: deliveries.isError");
    expect(delivery).not.toContain("const totalMoments = monitorData?.totalMoments ?? 0");
  });

  test("settings push-registration failures use the active locale without technical leakage", () => {
    const copy = readLocalizedMessages("settings.pushRegistrationError");
    expect(copy).toEqual({
      en: "Could not start iPhone notifications. Please try again.",
      he: "לא הצלחנו להפעיל התראות באייפון. אפשר לנסות שוב.",
      ar: "تعذر تشغيل إشعارات iPhone. حاول مرة أخرى.",
    });

    const hostile = new Error(
      'PostgrestError: relation "private.admin_push_tokens" missing; JWT=secret-token',
    );
    for (const lang of ["en", "he", "ar"] as const) {
      const message = settingsPushRegistrationFailure(hostile, copy[lang]);
      expect(message).toBe(copy[lang]);
      expect(message).not.toMatch(/Postgrest|private\.admin_push_tokens|JWT|secret-token/i);
    }

    const settings = read("src/routes/_authenticated/admin/settings.tsx");
    expect(settings).toMatch(
      /settingsPushRegistrationFailure\(\s*error,\s*t\("settings\.pushRegistrationError"\),?\s*\)/,
    );
    expect(settings).not.toContain(
      'safeErrorMessage(error, "Could not start iPhone notifications.")',
    );
  });
});
