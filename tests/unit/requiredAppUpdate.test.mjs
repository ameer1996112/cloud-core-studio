import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequiredAppUpdate } from "../../src/components/app-shell/RequiredAppUpdate.tsx";

const appStoreUrl = "https://apps.apple.com/il/app/cloud-core/id6786035836";

function render(lang) {
  return renderToStaticMarkup(
    React.createElement(RequiredAppUpdate, {
      lang,
      appStoreUrl,
      installedVersion: "1.0.4",
      minimumVersion: "1.0.5",
    }),
  );
}

describe("required iOS app update gate", () => {
  test("renders one non-dismissible App Store action in every supported language", () => {
    const hebrew = render("he");
    const arabic = render("ar");
    const english = render("en");

    expect(hebrew).toContain('<main dir="rtl"');
    expect(hebrew).toContain("נדרש עדכון כדי להמשיך");
    expect(hebrew).toContain(`href="${appStoreUrl}"`);
    expect(hebrew.match(/href=/g)).toHaveLength(1);
    expect(hebrew).not.toContain("אחר כך");

    expect(arabic).toContain('<main dir="rtl"');
    expect(arabic).toContain("يلزم التحديث للمتابعة");

    expect(english).toContain('<main dir="ltr"');
    expect(english).toContain("Update required to continue");
    expect(english).toContain("Installed 1.0.4 · Required 1.0.5");
  });
});
