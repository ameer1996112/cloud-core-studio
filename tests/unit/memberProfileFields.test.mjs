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
});
