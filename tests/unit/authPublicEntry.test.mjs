import { describe, expect, test } from "bun:test";

const decoder = new TextDecoder();
const cwd = process.cwd();

function renderAuthRoute(lang = "en") {
  const script = `
import { mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";

const currentLang = ${JSON.stringify(lang)};

mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  Link: ({ to, children, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
  useNavigate: () => () => {},
}));

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      signUp: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  },
}));

mock.module("@/integrations/supabase/session-cookie", () => ({
  clearSupabaseAccessTokenCookie() {},
  writeSupabaseAccessTokenCookie() {},
}));

mock.module("@/lib/i18n", () => ({
  LANG_META: {
    en: { dir: "ltr", label: "English" },
    he: { dir: "rtl", label: "עברית" },
    ar: { dir: "rtl", label: "العربية" },
  },
  applyLang() {},
  t: (key) =>
    ({
      "page.auth.title": "Sign in",
      "auth.members": "Members",
      "auth.newHere": "New here",
      "auth.recover": "Recover access",
      "auth.signinHeadline": "Enter the studio",
      "auth.signupHeadline": "Reserve your space",
      "auth.forgotHeadline": "Reset password",
      "auth.checkEmailTitle": "Check your email",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.enter": "Enter the studio",
      "auth.reserve": "Reserve your space",
      "auth.reset": "Send reset link",
      "auth.busy": "One moment…",
      "auth.forgot": "Forgot your password?",
      "auth.create": "New here? Create a member account",
      "auth.already": "Already a member? Sign in",
      "auth.back": "Back to sign in",
      "auth.showPassword": "Show password",
      "auth.hidePassword": "Hide password",
      "auth.guestTitle": currentLang === "he"
        ? "לפני שמתחברים"
        : currentLang === "ar"
          ? "قبل تسجيل الدخول"
          : "Before you sign in",
      "auth.guestBody": currentLang === "he"
        ? "אפשר לעיין בלוח השיעורים ולפתוח פרטי שיעור לפני התחברות."
        : currentLang === "ar"
          ? "يمكنك تصفح الجدول وفتح تفاصيل الحصص قبل تسجيل الدخول."
          : "Browse the schedule and open class details before signing in.",
      "auth.browseSchedule": currentLang === "he"
        ? "עיון בלוח השיעורים"
        : currentLang === "ar"
          ? "تصفح الجدول"
          : "Browse Schedule",
      "auth.guestSupport": currentLang === "he"
        ? "תמיכה"
        : currentLang === "ar"
          ? "الدعم"
          : "Support",
      "legal.privacy": currentLang === "he" ? "פרטיות" : currentLang === "ar" ? "الخصوصية" : "Privacy",
      "legal.terms": currentLang === "he" ? "תנאים" : currentLang === "ar" ? "الشروط" : "Terms",
      "legal.support": currentLang === "he" ? "תמיכה" : currentLang === "ar" ? "الدعم" : "Support",
      "profile.language": "Language",
    })[key] ?? key,
  useI18n: () => ({
    lang: currentLang,
    dir: currentLang === "en" ? "ltr" : "rtl",
  }),
}));

mock.module("sonner", () => ({
  toast: Object.assign(() => {}, { success() {}, error() {} }),
}));

mock.module("@/lib/auth-redirect", () => ({
  homeForCurrentUser: () => Promise.resolve("/member"),
  roleHome: () => "/member",
  getCurrentRole: () => Promise.resolve("member"),
}));

mock.module("@/hooks/useDocumentTitle", () => ({
  useDocumentTitle() {},
}));

mock.module("@/lib/password-reset-flow", () => ({
  getPasswordResetRedirectUrl: () => "https://cloudandcorestudio.com/reset-password",
}));

mock.module("@/lib/guest-auth-intent", () => ({
  resolvePostAuthDestination: ({ fallbackTo }) => fallbackTo,
}));

mock.module("@/lib/image-assets", () => ({
  authImages: {
    hero: { src: "/images/auth-hero.webp" },
  },
}));

const routeModule = await import("./src/routes/auth.tsx");
process.stdout.write(renderToStaticMarkup(React.createElement(routeModule.Route.options.component)));
`;

  const result = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr).trim() || "auth route render failed");
  }

  return decoder.decode(result.stdout);
}

describe("auth public entry", () => {
  test("keeps auth as the first screen while exposing a premium guest path", () => {
    const html = renderAuthRoute("en");

    expect(html).toContain("Enter the studio");
    expect(html).toContain("Before you sign in");
    expect(html).toContain("Browse the schedule and open class details before signing in.");
    expect(html).toContain('href="/member/schedule"');
    expect(html).toContain("Browse Schedule");
    expect(html).toContain('href="/support"');
    expect(html.indexOf("Enter the studio")).toBeLessThan(html.indexOf("Browse Schedule"));
  });

  test("renders hebrew and arabic guest-entry copy with rtl direction", () => {
    const hebrewHtml = renderAuthRoute("he");
    const arabicHtml = renderAuthRoute("ar");

    expect(hebrewHtml).toContain('<main dir="rtl"');
    expect(hebrewHtml).toContain("לפני שמתחברים");
    expect(hebrewHtml).toContain("עיון בלוח השיעורים");

    expect(arabicHtml).toContain('<main dir="rtl"');
    expect(arabicHtml).toContain("قبل تسجيل الدخول");
    expect(arabicHtml).toContain("تصفح الجدول");
  });
});
