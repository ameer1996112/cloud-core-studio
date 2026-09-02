import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberField, MemberProfileSaveStatus } from "../../src/components/member/MemberField.tsx";
import { ensureI18nNamespaces, t } from "../../src/lib/i18n.ts";

const root = resolve(import.meta.dir, "../..");
const accountSource = readFileSync(
  resolve(root, "src/routes/_authenticated/member/account.tsx"),
  "utf8",
);
const stylesSource = readFileSync(resolve(root, "src/styles/member.css"), "utf8");

await ensureI18nNamespaces(["member"]);

describe("member profile fields", () => {
  test("associates a field label with its control", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemberField,
        { id: "profile-name", label: "Name" },
        React.createElement("input", { value: "", readOnly: true }),
      ),
    );

    expect(html).toContain('for="profile-name"');
    expect(html).toContain('id="profile-name"');
  });

  test("preserves an existing description association while adding the stable id", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemberField,
        { id: "profile-phone", label: "Phone" },
        React.createElement("input", {
          "aria-describedby": "profile-phone-help",
          value: "",
          readOnly: true,
        }),
      ),
    );

    expect(html).toContain('id="profile-phone"');
    expect(html).toContain('aria-describedby="profile-phone-help"');
  });

  test("announces only the truthful profile save state", () => {
    const copy = {
      pending: t("common.saving"),
      succeeded: t("profile.saved"),
      failed: t("profile.saveError"),
    };

    const render = (props) =>
      renderToStaticMarkup(
        React.createElement(MemberProfileSaveStatus, {
          id: "profile-save-status",
          ...props,
        }),
      );

    expect(render({ pending: true, succeeded: false, failed: false })).toContain(
      `>${copy.pending}</span>`,
    );
    expect(render({ pending: false, succeeded: true, failed: false })).toContain(
      `>${copy.succeeded}</span>`,
    );
    expect(render({ pending: false, succeeded: false, failed: true })).toContain(
      `>${copy.failed}</span>`,
    );
    const idle = render({ pending: false, succeeded: false, failed: false });
    expect(idle).toContain('role="status"');
    expect(idle).toMatch(/aria-atomic="true"><\/span>$/);
    expect(idle).not.toContain(copy.succeeded);
  });

  test("the production account route uses stable ids for every editable setting", () => {
    for (const id of [
      "profile-name",
      "profile-phone",
      "profile-language",
      "profile-emergency-contact",
      "profile-energy-preference",
      "concierge-pace",
      "concierge-intention",
      "concierge-paused",
      "delete-reason",
    ]) {
      expect(accountSource).toContain(`id="${id}"`);
    }

    expect(accountSource).toContain('htmlFor="concierge-paused"');
  });

  test("the production account page groups its four concerns and exposes truthful states", () => {
    for (const id of ["profile-details", "between-us", "session", "privacy"]) {
      expect(accountSource).toMatch(new RegExp(`<MemberSection\\s+id="${id}"`));
    }

    expect(accountSource).toContain('<MemberRouteSkeleton route="account" />');
    expect(accountSource).toContain("<MemberRouteError");
    expect(accountSource).toContain("<MemberPageIntro");
    expect(accountSource).toContain("<MemberProfileSaveStatus");
    expect(accountSource).toContain("LANG_META[selectedLanguage].label");
    expect(accountSource).not.toContain("selectedLanguage.toUpperCase()");
    expect(accountSource).not.toContain("studioImages.logoWall");
  });

  test("account controls meet the touch-target contract in production styles", () => {
    expect(stylesSource).toMatch(
      /\.member-account-page \.editorial-input\s*\{[^}]*min-height:\s*44px/s,
    );
    expect(stylesSource).toMatch(/\.member-toggle-row\s*\{[^}]*min-height:\s*44px/s);
    expect(stylesSource).toMatch(
      /\.member-toggle-row input\[type="checkbox"\]\s*\{[^}]*inline-size:\s*20px[^}]*block-size:\s*20px/s,
    );
    expect(stylesSource).toMatch(/\.member-account-action\s*\{[^}]*min-height:\s*44px/s);
  });

  test("profile save actions keep intentional spacing and disabled hierarchy", () => {
    expect(accountSource.match(/member-account-save-action/g)).toHaveLength(2);
    expect(stylesSource).toMatch(
      /\.member-account-save-row\s*\{[^}]*display:\s*flex[^}]*gap:\s*[^;]+;[^}]*margin-block-start:/s,
    );
    expect(stylesSource).toMatch(/\.member-account-save-action\s*\{[^}]*min-inline-size:\s*11rem/s);
    expect(stylesSource).toMatch(
      /\.member-account-save-action:disabled\s*\{[^}]*background-color:/s,
    );
    expect(stylesSource).toMatch(/\.member-account-save-action:disabled\s*\{[^}]*opacity:\s*1/s);
    expect(stylesSource).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*\.member-account-save-action\s*\{[^}]*inline-size:\s*100%[^}]*min-inline-size:\s*0/s,
    );
  });

  test("privacy links remain visually separated instead of touching like a segmented control", () => {
    expect(stylesSource).toMatch(
      /\.member-account-legal-links\s*\{[^}]*display:\s*grid[^}]*gap:\s*var\(--space-3\)/s,
    );
    expect(stylesSource).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*\.member-account-legal-links\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
  });

  test("the account route exposes a calm editorial hierarchy for session and deletion content", () => {
    expect(accountSource).toContain(
      '<p className="member-page-body member-account-section-copy max-w-2xl">',
    );
    expect(accountSource).toContain(
      '<p className="member-account-section-copy text-sm leading-6 text-slate">\n                {t("profile.endSession")}',
    );
    expect(accountSource).toContain(
      '<p className="member-account-section-copy text-sm leading-6 text-slate">\n              {t("profile.privacyBody")}',
    );
    expect(accountSource).toContain(
      'className="member-danger-zone__explanation text-sm leading-6 text-slate"',
    );
    expect(accountSource).toContain(
      'className="btn-ghost member-account-action member-danger-zone__action',
    );

    const start = accountSource.indexOf('<div className="member-danger-zone">');
    const dangerZone = accountSource.slice(start, accountSource.indexOf("</MemberSection>", start));
    expect(dangerZone.indexOf("member-danger-zone__explanation")).toBeGreaterThan(-1);
    const deleteReasonStart = dangerZone.indexOf('<MemberField id="delete-reason"');
    const deleteReasonEnd = dangerZone.indexOf("</MemberField>", deleteReasonStart);
    expect(deleteReasonStart).toBeGreaterThan(
      dangerZone.indexOf("member-danger-zone__explanation"),
    );
    expect(dangerZone.indexOf("member-danger-zone__action")).toBeGreaterThan(deleteReasonEnd);
  });
});
