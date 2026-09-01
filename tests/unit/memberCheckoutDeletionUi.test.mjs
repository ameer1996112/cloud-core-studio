import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MESSAGES } from "../../src/lib/i18n.ts";

const root = resolve(import.meta.dir, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("member checkout and deletion-request UI", () => {
  test("keeps checkout amounts sourced from the existing plan data and isolated for RTL", () => {
    const checkout = read("src/routes/checkout.tsx");
    const packages = read("src/routes/_authenticated/member/packages.tsx");

    expect(checkout).toContain("selectedPlanDetails.priceIls");
    expect(checkout).toContain("<LtrInline>₪{selectedPlanDetails.priceIls}</LtrInline>");
    expect(packages).toContain("const price = formatPlanPrice(plan)");
    expect(packages).toContain("<LtrInline>{price}</LtrInline>");
    expect(packages).toContain('t("packages.total")');
  });

  test("provides durable checkout failure feedback while preserving the existing HYP handoff", () => {
    const packages = read("src/routes/_authenticated/member/packages.tsx");

    expect(packages).toContain("window.location.href = res.checkout_url");
    expect(packages).toContain('setCheckoutFeedback("error")');
    expect(packages).toContain("disabled={!method || pending || (isOnline && !checkoutComplete)}");
    expect(packages).toContain('t("packages.openingSecurePayment")');
    expect(packages).toContain('t("common.retry")');
    expect(packages).toContain('onSubmit(method, method === "card" && recurringCard, checkout)');
  });

  test("requires confirmation, prevents repeat submission, and focuses persistent deletion feedback", () => {
    const account = read("src/routes/_authenticated/member/account.tsx");

    expect(account).toContain("<AlertDialog");
    expect(account).toContain("if (!deletion.isPending) deletion.mutate()");
    expect(account).toContain('deletionFeedback === "submitted"');
    expect(account).toContain('deletionFeedback === "already-requested"');
    expect(account).toContain("deletionFeedbackRef.current?.focus()");
    expect(account).toContain('live="assertive"');
    expect(account).toContain('to="/support"');
    expect(account).toContain("deletionTriggerRef.current?.focus()");
  });

  test("localizes checkout and deletion feedback for English, Hebrew, and Arabic", () => {
    for (const lang of ["en", "he", "ar"]) {
      const messages = MESSAGES[lang];
      for (const key of [
        "checkout.purchaseSummary",
        "checkout.intro",
        "checkout.authoritativePrice",
        "checkout.continueToSignIn",
        "checkout.paymentReviewAfterSignIn",
        "packages.purchaseSummary",
        "packages.total",
        "packages.openingSecurePayment",
        "profile.deleteConfirmTitle",
        "profile.deleteRequestSubmittedTitle",
        "profile.deleteRequestErrorBody",
      ]) {
        expect(messages[key]).toBeTruthy();
      }
    }
  });
});
