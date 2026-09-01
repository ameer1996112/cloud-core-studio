import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { memberCatalog } from "../../src/lib/i18n/catalogs/member.ts";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("member package payment and deletion-request UI", () => {
  test("keeps the authenticated package payment amount authoritative, isolated, and recoverable", () => {
    const packages = read("src/routes/_authenticated/member/packages.tsx");

    expect(packages).toContain("formatPlanPrice(plan)");
    expect(packages).toContain('<BidiValue kind="currency">{formatPlanPrice(plan)}</BidiValue>');
    expect(packages).toContain('t("packages.total")');
    expect(packages).toContain('className="min-w-0"');
    expect(packages).toContain("break-words font-display");
    expect(packages).toContain("window.location.href = res.checkout_url");
    expect(packages).toContain("checkoutRequestInFlightRef");
    expect(packages).toContain("checkoutRequestInFlightRef.current = false");
    expect(packages).toContain("if (!open && checkoutPayment.isPending) return;");
    expect(packages).toContain('setCheckoutFeedback("error")');
    expect(packages).toContain("<MemberFeedbackPanel");
    expect(packages).toContain('t("common.retry")');
  });

  test("requires deletion confirmation, prevents repeat submission, and focuses durable feedback", () => {
    const account = read("src/routes/_authenticated/member/account.tsx");

    expect(account).toContain("<AlertDialog");
    expect(account).toContain("deletionRequestInFlightRef");
    expect(account).toContain("submitDeletionRequest()");
    expect(account).toContain('result?.ok !== true || typeof result.status !== "string"');
    expect(account).toContain('deletionFeedback === "submitted"');
    expect(account).toContain('deletionFeedback === "already-requested"');
    expect(account).toContain("deletionFeedbackRef.current?.focus()");
    expect(account).toContain("deletionTriggerRef.current?.focus()");
    expect(account).toContain('live="assertive"');
    expect(account).toContain('to="/support"');
  });

  test("localizes payment recovery and deletion-request feedback in every supported member language", () => {
    for (const lang of ["en", "he", "ar"]) {
      const messages = memberCatalog[lang];
      for (const key of [
        "packages.cardPaymentError",
        "packages.cardPaymentRetry",
        "packages.total",
        "profile.deleteConfirmTitle",
        "profile.deleteConfirmDescription",
        "profile.deleteConfirmAction",
        "profile.deleteRequestSubmitting",
        "profile.deleteRequestSubmittedTitle",
        "profile.deleteRequestSubmittedBody",
        "profile.deleteRequestErrorBody",
        "profile.deleteRequestSupport",
      ]) {
        expect(messages[key]).toBeTruthy();
      }
    }
  });
});
