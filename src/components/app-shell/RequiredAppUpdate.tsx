import { Apple, ArrowUpLeft, ArrowUpRight, Sparkles } from "lucide-react";
import type { Lang } from "@/lib/i18n";

type RequiredAppUpdateProps = {
  lang: Lang;
  appStoreUrl: string;
  installedVersion: string | null;
  minimumVersion: string;
};

const COPY: Record<
  Lang,
  {
    eyebrow: string;
    title: string;
    body: string;
    action: string;
    version: (installed: string, minimum: string) => string;
  }
> = {
  he: {
    eyebrow: "Cloud & Core · גרסה חדשה",
    title: "נדרש עדכון כדי להמשיך",
    body: "עדכנו את האפליקציה כדי ליהנות מחוויה מהירה ויציבה ולקבל תזכורות לשיעורים.",
    action: "עדכון ב-App Store",
    version: (installed, minimum) => `מותקנת ${installed} · נדרשת ${minimum}`,
  },
  ar: {
    eyebrow: "Cloud & Core · إصدار جديد",
    title: "يلزم التحديث للمتابعة",
    body: "حدّثي التطبيق لتجربة أسرع وأكثر استقرارًا ولتلقي تذكيرات الحصص.",
    action: "التحديث من App Store",
    version: (installed, minimum) => `المثبت ${installed} · المطلوب ${minimum}`,
  },
  en: {
    eyebrow: "Cloud & Core · New version",
    title: "Update required to continue",
    body: "Update the app for a faster, more reliable experience and lesson reminders.",
    action: "Update in the App Store",
    version: (installed, minimum) => `Installed ${installed} · Required ${minimum}`,
  },
};

export function RequiredAppUpdate({
  lang,
  appStoreUrl,
  installedVersion,
  minimumVersion,
}: RequiredAppUpdateProps) {
  const copy = COPY[lang];
  const installedLabel = installedVersion ?? "—";
  const Arrow = lang === "en" ? ArrowUpRight : ArrowUpLeft;

  return (
    <main
      dir={lang === "en" ? "ltr" : "rtl"}
      aria-labelledby="required-app-update-title"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-ivory px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1.25rem)]"
    >
      <div
        aria-hidden="true"
        className="absolute -end-24 -top-20 h-72 w-72 rounded-full bg-gold/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-navy/8 blur-3xl"
      />

      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-gold/25 bg-white/80 p-7 text-center shadow-[0_28px_80px_rgba(11,29,58,0.16)] backdrop-blur-xl sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/35 bg-navy text-ivory shadow-[0_12px_32px_rgba(11,29,58,0.24)]">
          <Sparkles className="h-6 w-6 text-gold" aria-hidden="true" />
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">
          {copy.eyebrow}
        </p>
        <h1
          id="required-app-update-title"
          className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-navy"
        >
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty text-sm leading-7 text-slate">
          {copy.body}
        </p>

        <a
          href={appStoreUrl}
          rel="external noopener"
          className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(11,29,58,0.22)] transition-transform active:scale-[0.98]"
        >
          <Apple className="h-5 w-5" aria-hidden="true" />
          <span>{copy.action}</span>
          <Arrow className="h-4 w-4" aria-hidden="true" />
        </a>

        <p className="mt-5 text-[11px] tracking-wide text-slate/70">
          {copy.version(installedLabel, minimumVersion)}
        </p>
      </section>
    </main>
  );
}
