import { createAppMarketingAnalytics } from "../../src/lib/app-marketing.analytics";

const analytics = createAppMarketingAnalytics({
  dispatch: () => {},
  getContext: () => ({}),
});

analytics.track("app_landing_login", { cta_location: "header" });

// @ts-expect-error PII-like fields cannot be submitted by typed callers.
analytics.track("app_landing_login", { email: "private@example.com" });

// @ts-expect-error Navigation and attribution cannot be overridden by typed callers.
analytics.track("app_landing_support_click", { href: "/support", utm_source: "instagram" });

// @ts-expect-error Member identifiers cannot be submitted by typed callers.
analytics.track("app_landing_login", { member_id: "member-1" });
