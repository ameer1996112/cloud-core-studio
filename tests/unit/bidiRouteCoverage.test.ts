import { describe, expect, test } from "bun:test";
import { relative, resolve } from "node:path";

import {
  auditRouteBidi,
  ROUTE_BIDI_AUDIT_EXCLUSIONS,
  type RouteBidiCategory,
} from "../helpers/routeBidiAudit";

const root = resolve(import.meta.dir, "../..");
const routesRoot = resolve(root, "src/routes");
const fixtureRoot = resolve(root, "tests/fixtures/bidi-audit");
const result = auditRouteBidi(routesRoot);
const protectedUses = result.protectedUses.map((use) => ({
  ...use,
  file: relative(root, use.file),
}));

describe("route-level bidi value coverage", () => {
  test("flattens array spreads, merges object spreads in order, and terminates static cycles", () => {
    const spreadFindings = auditRouteBidi(fixtureRoot)
      .violations.filter((finding) => finding.file.endsWith("spread-static.tsx"))
      .map(({ category, snippet }) => ({ category, snippet }))
      .sort((left, right) => left.snippet.localeCompare(right.snippet));
    const expectedTokens = [
      "phone:055-101-0001",
      "email:spread-base@example.com",
      "url:https://example.com/nested",
      "phone:055-202-0002",
      "phone:055-303-0003",
      "email:spread-he@example.com",
      "url:https://example.com/ar",
      "email:cycle-safe@example.com",
      "phone:055-505-0005",
      "phone:055-606-0006",
      "email:conditional-object@example.com",
      "url:https://example.com/object/en",
      "phone:055-707-0007",
      "email:spread-ar@example.com",
      "url:https://example.com/object/final",
      "email:final-object@example.com",
      "url:https://example.com/object/cycle",
    ].sort((left, right) => left.localeCompare(right));

    expect(spreadFindings).toEqual(
      expectedTokens.map((snippet) => ({ category: "contact", snippet })),
    );
    expect(spreadFindings).toHaveLength(17);
    expect(spreadFindings.some(({ snippet }) => snippet.includes("stale-object"))).toBe(false);
    expect(spreadFindings.some(({ snippet }) => snippet.includes("nested-object"))).toBe(false);
  });

  test("finds every contact nested through static objects, arrays, and map callbacks", () => {
    const nestedFindings = auditRouteBidi(fixtureRoot).violations.filter((finding) =>
      finding.file.endsWith("nested-static.tsx"),
    );

    for (const token of [
      "055-111-2233",
      "nested-en@example.com",
      "https://example.com/en/help",
      "055-222-3344",
      "nested-he@example.com",
      "https://example.com/he/help",
      "055-333-4455",
      "nested-ar@example.com",
      "https://example.com/ar/help",
    ]) {
      expect(
        nestedFindings.some(
          (finding) => finding.category === "contact" && finding.snippet.includes(token),
        ),
      ).toBe(true);
    }
  });

  test("classifies every Intl date-time option shape without accepting combined output as date-only", () => {
    const intlResult = auditRouteBidi(fixtureRoot);
    const violations = intlResult.violations.filter((finding) =>
      finding.file.endsWith("intl-options.tsx"),
    );
    const protectedIntl = intlResult.protectedUses.filter((finding) =>
      finding.file.endsWith("intl-options.tsx"),
    );

    for (const marker of [
      "toLocaleString()",
      'toLocaleString("en-US", {})',
      "calendar",
      "fractionalSecondDigits",
      "dayPeriod",
      "timeZoneName",
      "dynamicOptions",
    ]) {
      expect(
        violations.some(
          (finding) => finding.category === "time-range" && finding.snippet.includes(marker),
        ),
      ).toBe(true);
    }

    expect(
      violations.some(
        (finding) => finding.category === "localized-date" && finding.snippet.includes("hour"),
      ),
    ).toBe(false);
    expect(
      protectedIntl.some(
        (finding) => finding.category === "localized-date" && finding.snippet.includes("weekday"),
      ),
    ).toBe(true);
    expect(
      protectedIntl.some(
        (finding) => finding.category === "time-range" && finding.snippet.includes("hour"),
      ),
    ).toBe(true);
    for (const marker of [
      '{ second: "2-digit" }',
      "{ fractionalSecondDigits: 3 }",
      '{ dayPeriod: "long" }',
      '{ timeZoneName: "long" }',
      '{ timeStyle: "long" }',
    ]) {
      const matching = protectedIntl.filter(
        (finding) => finding.category === "time-range" && finding.snippet.includes(marker),
      );
      expect(matching).toHaveLength(1);
      expect(
        violations.some(
          (finding) => finding.category === "localized-date" && finding.snippet.includes(marker),
        ),
      ).toBe(false);
    }
    for (const marker of ['{ dateStyle: "long" }', '{ era: "long" }']) {
      expect(
        protectedIntl.some(
          (finding) => finding.category === "localized-date" && finding.snippet.includes(marker),
        ),
      ).toBe(true);
      expect(
        violations.some(
          (finding) => finding.category === "time-range" && finding.snippet.includes(marker),
        ),
      ).toBe(false);
    }
  });

  test("detects embedded contacts, semantic technical fields, combined timestamps, and indirect visible templates", () => {
    const fixtureViolations = auditRouteBidi(fixtureRoot).violations;

    expect(fixtureViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "contact",
          snippet: "phone:055-939-8438",
        }),
        expect.objectContaining({
          category: "technical-input",
          snippet: expect.stringContaining("cover_image_url"),
        }),
        expect.objectContaining({
          category: "identifier",
          snippet: expect.stringContaining("idempotency_key"),
        }),
        expect.objectContaining({
          category: "identifier",
          snippet: expect.stringContaining("provider_message_id"),
        }),
        expect.objectContaining({
          category: "time-range",
          snippet: expect.stringContaining("toLocaleString"),
        }),
        expect.objectContaining({
          category: "localized-date",
          snippet: expect.stringContaining("toLocaleDateString"),
        }),
        expect.objectContaining({
          category: "time-range",
          snippet: expect.stringContaining("toLocaleTimeString"),
        }),
      ]),
    );
  });

  test("every live route technical output and input found by the AST audit uses the shared layer", () => {
    expect(result.violations).toEqual([]);
  });

  test("the audit exercises every technical-value category", () => {
    for (const category of [
      "contact",
      "currency",
      "identifier",
      "localized-date",
      "time-range",
      "technical-input",
    ] satisfies RouteBidiCategory[]) {
      expect(protectedUses.some((use) => use.category === category)).toBe(true);
    }
  });

  test("the required public, member, and admin callsites are enforced by the audit", () => {
    expect(protectedUses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "src/routes/support.tsx", category: "contact" }),
        expect.objectContaining({ file: "src/routes/terms.tsx", category: "contact" }),
        expect.objectContaining({ file: "src/routes/checkout.tsx", category: "currency" }),
        expect.objectContaining({ file: "src/routes/checkout.tsx", category: "technical-input" }),
        expect.objectContaining({
          file: "src/routes/_authenticated/member/packages.tsx",
          category: "localized-date",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/member/packages.tsx",
          category: "currency",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/reports.tsx",
          category: "currency",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/classes/$id.tsx",
          category: "localized-date",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/classes/$id.tsx",
          category: "time-range",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/members/$id.tsx",
          category: "contact",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/members/$id.tsx",
          category: "currency",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/messages.tsx",
          category: "identifier",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/admin/programs.tsx",
          category: "technical-input",
        }),
        expect.objectContaining({
          file: "src/routes/_authenticated/member/bookings.tsx",
          category: "time-range",
        }),
      ]),
    );
    const termsContacts = protectedUses.filter(
      (use) => use.file === "src/routes/terms.tsx" && use.category === "contact",
    );
    expect(termsContacts).toHaveLength(12);
    expect(termsContacts.filter((use) => use.snippet.startsWith("phone:"))).toHaveLength(6);
    expect(termsContacts.filter((use) => use.snippet.startsWith("email:"))).toHaveLength(6);
  });

  test("documents narrow exclusions so ordinary prose and non-visible values are not misclassified", () => {
    expect(ROUTE_BIDI_AUDIT_EXCLUSIONS).toEqual([
      "authored prose and translation strings containing ordinary counts or illustrative currency copy",
      "non-visible href, metadata, query, storage, and server payload values",
      "plain numeric form controls whose values have no directional text",
    ]);
  });
});
