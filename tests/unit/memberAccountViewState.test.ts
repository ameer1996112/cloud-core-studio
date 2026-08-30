import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MemberOutcomePanel } from "../../src/components/member/MemberOutcomePanel";
import { ensureI18nNamespaces } from "../../src/lib/i18n";
import {
  deriveMemberOutcome,
  memberPackageOutcomeKind,
  memberRecoveryKind,
  type MemberOutcomeKind,
} from "../../src/lib/member-account-view-state";

await ensureI18nNamespaces(["member"]);

describe("deriveMemberOutcome", () => {
  test.each([
    ["loading", "neutral", false],
    ["no-package", "info", false],
    ["active-package", "success", false],
    ["expiring-package", "warning", true],
    ["exhausted-credits", "warning", true],
    ["payment-pending", "info", true],
    ["payment-succeeded", "success", true],
    ["payment-failed", "danger", true],
    ["missing-receipt", "warning", true],
    ["expired-session", "danger", true],
    ["offline-retry", "danger", true],
    ["profile-validation-error", "danger", true],
  ] as const)("maps %s without changing the authoritative state", (kind, tone, announce) => {
    expect(deriveMemberOutcome({ kind, lang: "en" })).toMatchObject({ tone, announce });
  });

  test.each(["he", "ar", "en"] as const)("localizes recovery copy in %s", (lang) => {
    const outcome = deriveMemberOutcome({ kind: "payment-failed", lang });

    expect(outcome.title).not.toBe("member.outcome.paymentFailed.title");
    expect(outcome.body).not.toBe("member.outcome.paymentFailed.body");
    expect(outcome.nextAction?.label).not.toBe("recovery.action.support");
  });

  test.each([
    ["en", "The payment status is confirmed."],
    ["he", "סטטוס התשלום מאושר."],
    ["ar", "حالة الدفع مؤكدة."],
  ] as const)("keeps generic payment success status-only in %s", (lang, approvedBody) => {
    expect(deriveMemberOutcome({ kind: "payment-succeeded", lang }).body).toBe(approvedBody);
  });

  test("keeps caller-owned detail and recovery targets exact", () => {
    expect(
      deriveMemberOutcome({
        kind: "profile-validation-error",
        lang: "en",
        body: "Name is required.",
        nextAction: { label: "Review name", href: "#profile-name" },
      }),
    ).toMatchObject({
      body: "Name is required.",
      nextAction: { label: "Review name", href: "#profile-name" },
    });
  });

  test("does not infer a different state from provider or account detail", () => {
    const kinds: MemberOutcomeKind[] = ["payment-pending", "payment-succeeded", "payment-failed"];

    expect(kinds.map((kind) => deriveMemberOutcome({ kind, lang: "en" }).tone)).toEqual([
      "info",
      "success",
      "danger",
    ]);
  });

  test("normalizes only the supplied package status, credits, and expiry facts", () => {
    expect(memberPackageOutcomeKind({ status: null, credits: 0 })).toBe("no-package");
    expect(memberPackageOutcomeKind({ status: "expired", credits: 8 })).toBe("no-package");
    expect(memberPackageOutcomeKind({ status: "active", credits: 0 })).toBe("exhausted-credits");
    expect(
      memberPackageOutcomeKind({
        status: "active",
        credits: 3,
        expiresAt: "2026-09-03T00:00:00.000Z",
        now: new Date("2026-08-28T00:00:00.000Z").getTime(),
      }),
    ).toBe("expiring-package");
    expect(memberPackageOutcomeKind({ status: "active", credits: 3 })).toBe("active-package");
  });

  test("keeps offline and expired-session recovery ahead of the caller fallback", () => {
    expect(memberRecoveryKind({ online: false, sessionExpired: false })).toBe("offline-retry");
    expect(memberRecoveryKind({ online: true, sessionExpired: true })).toBe("expired-session");
    expect(
      memberRecoveryKind({
        online: true,
        sessionExpired: false,
        fallback: "account-unavailable",
      }),
    ).toBe("account-unavailable");
  });
});

describe("MemberOutcomePanel", () => {
  test("renders critical failure and recovery as persistent alert content", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberOutcomePanel, {
        outcome: deriveMemberOutcome({ kind: "offline-retry", lang: "en" }),
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("Check your connection");
    expect(html).toContain("Retry");
  });

  test("renders successful payment as persistent status content", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberOutcomePanel, {
        outcome: deriveMemberOutcome({ kind: "payment-succeeded", lang: "en" }),
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Payment received");
  });
});
