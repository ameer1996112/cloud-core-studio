import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyLang, LANG_META, useI18n } from "@/lib/i18n";
import {
  capturePromotionAttribution,
  claimPublicPromotion,
  fetchPublicPromotion,
} from "@/lib/promotions";

export const Route = createFileRoute("/promo/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang:
      search.lang === "he" || search.lang === "ar" || search.lang === "en"
        ? search.lang
        : undefined,
  }),
  component: PublicPromotionPage,
});

function PublicPromotionPage() {
  const { slug } = Route.useParams();
  const { lang: requestedLang } = Route.useSearch();
  const { lang, dir } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);
  const [attributionReady, setAttributionReady] = useState(false);
  const promotion = useQuery({
    queryKey: ["public-promotion", slug],
    queryFn: () => fetchPublicPromotion(slug),
  });
  const claim = useMutation({ mutationFn: claimPublicPromotion });
  const copy = promotion.data?.localizedContent[lang] ?? promotion.data?.localizedContent.he;

  useEffect(() => {
    let current = true;
    if (requestedLang) applyLang(requestedLang);
    setAttributionReady(false);
    void capturePromotionAttribution(slug, window.location.search)
      .catch(() => null)
      .finally(() => {
        if (current) setAttributionReady(true);
      });
    void supabase.auth.getSession().then(({ data }) => {
      if (current) setAuthenticated(Boolean(data.session));
    });
    return () => {
      current = false;
    };
  }, [requestedLang, slug]);

  async function act() {
    if (!promotion.data || !attributionReady) return;
    if (!authenticated) {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.assign(`/auth?mode=signup&returnTo=${returnTo}`);
      return;
    }
    if (promotion.data.promotionType === "announcement") {
      window.location.assign(promotion.data.actionUrl);
      return;
    }
    const result = await claim.mutateAsync(promotion.data);
    if (result.status === "claimed" || result.status === "already_claimed") return;
  }

  const claimed = claim.data?.status === "claimed" || claim.data?.status === "already_claimed";
  const confirmation =
    lang === "he"
      ? {
          eyebrow: "ההטבה מוכנה",
          title: "השיעור שלך מחכה לך",
          body: "הקרדיט נוסף לארנק ההטבות. עכשיו אפשר לבחור שיעור מהלו״ז המסונן.",
          cta: "לבחירת שיעור",
        }
      : lang === "ar"
        ? {
            eyebrow: "العرض جاهز",
            title: "حصتك بانتظارك",
            body: "تمت إضافة الرصيد إلى محفظة العروض. اختاري الآن حصة من الجدول المصفّى.",
            cta: "اختيار حصة",
          }
        : {
            eyebrow: "Benefit ready",
            title: "Your class is waiting",
            body: "The credit is now in your promotion wallet. Choose a class from the filtered schedule.",
            cta: "Choose a class",
          };
  if (promotion.isLoading) return <main className="min-h-dvh bg-ivory" />;
  if (!promotion.data || !copy) {
    return (
      <main dir={dir} className="grid min-h-dvh place-items-center bg-ivory px-6 text-center">
        <div>
          <h1 className="font-display text-4xl text-navy">Cloud &amp; Core</h1>
          <p className="mt-3 text-slate">This promotion is not currently available.</p>
          <Link to="/member/schedule" className="btn-navy mt-6 inline-flex">
            View schedule
          </Link>
        </div>
      </main>
    );
  }
  const displayCopy = claimed ? confirmation : copy;

  return (
    <main dir={LANG_META[lang].dir} className="min-h-dvh bg-[#f5eddf] px-4 py-10 sm:px-6 sm:py-16">
      <article className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-gold/35 bg-navy px-6 py-10 text-ivory shadow-2xl sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_15%,rgba(217,174,88,.24),transparent_28%),radial-gradient(circle_at_88%_82%,rgba(255,248,233,.11),transparent_32%)]" />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[.2em]">{displayCopy.eyebrow}</p>
          </div>
          <h1 className="mt-5 font-display text-5xl leading-none text-ivory sm:text-7xl">
            {displayCopy.title}
          </h1>
          <p className="mt-5 text-base leading-8 text-ivory/80 sm:text-lg">{displayCopy.body}</p>
          {promotion.data.promotionType === "free_class_credit" && !claimed ? (
            <p className="mt-4 font-semibold text-gold">
              {promotion.data.remaining} / {promotion.data.claimLimit}
            </p>
          ) : null}
          {claimed ? (
            <a
              href={promotion.data.actionUrl}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 font-bold text-navy"
            >
              {displayCopy.cta}
              <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
            </a>
          ) : (
            <button
              type="button"
              disabled={!attributionReady || claim.isPending || promotion.data.soldOut}
              onClick={act}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-6 font-bold text-navy disabled:opacity-50"
            >
              {displayCopy.cta}
              <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}
        </div>
      </article>
    </main>
  );
}
