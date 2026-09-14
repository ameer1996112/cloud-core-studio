import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { parentInvitation, PARENT_INVITE_KEY } from "@/lib/health-onboarding";
import { useI18n } from "@/lib/i18n";
import { onboardingCopy } from "@/lib/health-onboarding-copy";

export const Route = createFileRoute("/health/parent")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ParentInvitation,
});
function ParentInvitation() {
  const { lang, dir } = useI18n();
  const c = onboardingCopy[lang];
  useEffect(() => {
    const token = parentInvitation(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/health/parent");
    if (token) {
      // Only the opaque invitation is retained through login, never medical answers.
      // The database independently enforces expiry, single claim and adult identity.
      try {
        sessionStorage.setItem(
          PARENT_INVITE_KEY,
          JSON.stringify({ token, expires: Date.now() + 30 * 60 * 1000 }),
        );
      } catch {
        /* fail closed on the next page */
      }
    }
  }, []);
  return (
    <main dir={dir} className="mx-auto max-w-xl p-8 space-y-6" data-private="true">
      <h1 className="text-3xl font-display">{c.guardianTitle}</h1>
      <p>{c.guardianIntro}</p>
      <a
        className="inline-block rounded-full border px-6 py-3"
        href="/auth?returnTo=%2Fhealth-parent"
      >
        {c.signIn}
      </a>
    </main>
  );
}
