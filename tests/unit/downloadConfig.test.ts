import { describe, expect, test } from "bun:test";
import * as downloadConfig from "../../src/lib/download-config";

const { detectDownloadClient } = downloadConfig;

describe("download device detection", () => {
  test("keeps Instagram's iPhone browser on the branded download page", () => {
    const instagramIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 390.0.0.0.0";

    expect(detectDownloadClient(instagramIphone)).toBe("meta-in-app-browser");
  });

  test("keeps Facebook's iPhone browser on the branded download page", () => {
    const facebookIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.0.0]";

    expect(detectDownloadClient(facebookIphone)).toBe("meta-in-app-browser");
  });

  test("keeps Instagram's Android browser on the branded download page", () => {
    const instagramAndroid =
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 Instagram 390.0.0.0.0";

    expect(detectDownloadClient(instagramAndroid)).toBe("meta-in-app-browser");
  });

  test("continues to detect ordinary iPhone Safari for direct App Store redirects", () => {
    const safariIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

    expect(detectDownloadClient(safariIphone)).toBe("ios");
  });

  test("builds a user-triggered native App Store URL without dropping tracking parameters", () => {
    const buildNativeAppStoreUrl = (
      downloadConfig as typeof downloadConfig & {
        buildNativeAppStoreUrl?: (url: string) => string;
      }
    ).buildNativeAppStoreUrl;

    expect(
      buildNativeAppStoreUrl?.(
        "https://apps.apple.com/il/app/cloud-core/id6786035836?utm_source=instagram",
      ),
    ).toBe("itms-appss://apps.apple.com/il/app/cloud-core/id6786035836?utm_source=instagram");
  });

  test("leaves malformed and non-Apple URLs unchanged", () => {
    const { buildNativeAppStoreUrl } = downloadConfig;

    expect(buildNativeAppStoreUrl("not a url")).toBe("not a url");
    expect(buildNativeAppStoreUrl("https://example.com/download")).toBe(
      "https://example.com/download",
    );
  });
});
