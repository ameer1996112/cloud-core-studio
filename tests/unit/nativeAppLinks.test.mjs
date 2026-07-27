import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  nativeMemberRouteFromUrl,
  startNativeAppLinkHandling,
} from "../../src/lib/nativeAppLinks.ts";

describe("native app links", () => {
  test("opens Cloud & Core member URLs at the matching in-app route", () => {
    expect(
      nativeMemberRouteFromUrl(
        "https://cloudandcorestudio.com/member/bookings?source=whatsapp#upcoming",
      ),
    ).toBe("/member/bookings?source=whatsapp#upcoming");
  });

  test("leaves non-member and untrusted URLs in the browser", () => {
    expect(nativeMemberRouteFromUrl("https://cloudandcorestudio.com/admin/messages")).toBeNull();
    expect(
      nativeMemberRouteFromUrl("https://cloudandcorestudio.com/member/not-a-route"),
    ).toBeNull();
    expect(nativeMemberRouteFromUrl("https://example.com/member/bookings")).toBeNull();
  });

  test("maps the retired payment destination to the current packages screen", () => {
    expect(
      nativeMemberRouteFromUrl("https://cloudandcorestudio.com/member/payments?source=email"),
    ).toBe("/member/packages?source=email");
  });

  test("removes a listener that finishes installing after its lifecycle ends", async () => {
    let resolveInstallation;
    let cleanupCalls = 0;
    const installation = new Promise((resolve) => {
      resolveInstallation = resolve;
    });
    const stop = startNativeAppLinkHandling(() => installation);

    stop();
    resolveInstallation(() => {
      cleanupCalls += 1;
    });
    await installation;
    await Promise.resolve();

    expect(cleanupCalls).toBe(1);
  });

  test("publishes and claims the iOS member-link association", async () => {
    const association = JSON.parse(
      await readFile("firebase-public/.well-known/apple-app-site-association", "utf8"),
    );
    expect(association.applinks.details).toContainEqual({
      appIDs: ["GMNK33H8Z4.com.cloudandcore.studio"],
      components: [
        { "/": "/member" },
        { "/": "/member/account" },
        { "/": "/member/bookings" },
        { "/": "/member/packages" },
        { "/": "/member/payments" },
        { "/": "/member/schedule" },
      ],
    });

    const entitlements = await readFile("ios/App/App/App.entitlements", "utf8");
    expect(entitlements).toContain("<string>applinks:cloudandcorestudio.com</string>");

    const firebase = JSON.parse(await readFile("firebase.json", "utf8"));
    expect(firebase.hosting.ignore).toContain("**/.*");
    expect(firebase.hosting.ignore).toContain("!**/.well-known/**");
    expect(firebase.hosting.headers).toContainEqual({
      source: "/.well-known/apple-app-site-association",
      headers: [
        { key: "Content-Type", value: "application/json" },
        { key: "Cache-Control", value: "public, max-age=3600" },
      ],
    });
  });
});
