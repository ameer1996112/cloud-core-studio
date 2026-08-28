import { ArrowLeft, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { trackPromotionEngagement, type MemberPromotion } from "@/lib/promotions";

export function PromotionCard({
  promotion,
  claimPending,
  onClaim,
  onDismiss,
}: {
  promotion: MemberPromotion;
  claimPending: boolean;
  onClaim: () => void;
  onDismiss: () => void;
}) {
  const { lang, dir } = useI18n();
  const viewed = useRef(false);
  const copy = promotion.localizedContent[lang] ?? promotion.localizedContent.he;
  const dismissLabel =
    lang === "he" ? "סגירת המבצע" : lang === "ar" ? "إغلاق العرض" : "Dismiss promotion";
  const claimed = promotion.claimedByCurrentUser;
  const confirmationCopy =
    lang === "he"
      ? {
          ...copy,
          eyebrow: "ההטבה מוכנה",
          title: "הקרדיט נוסף לארנק שלך",
          body: "בחרי עכשיו שיעור מהלו״ז המסונן וההטבה תחול אוטומטית בהזמנה.",
          cta: "לבחירת שיעור",
        }
      : lang === "ar"
        ? {
            ...copy,
            eyebrow: "العرض جاهز",
            title: "تمت إضافة الرصيد إلى محفظتك",
            body: "اختاري حصة من الجدول المصفّى وسيُطبّق العرض تلقائياً عند الحجز.",
            cta: "اختيار حصة",
          }
        : {
            ...copy,
            eyebrow: "Benefit ready",
            title: "The credit is in your wallet",
            body: "Choose a class from the filtered schedule and the benefit will apply automatically.",
            cta: "Choose a class",
          };
  const displayCopy = claimed ? confirmationCopy : copy;
  const canClaim =
    promotion.promotionType === "free_class_credit" && !claimed && !promotion.soldOut;

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void trackPromotionEngagement(promotion.slug, "impression", promotion.id, {
      remaining: promotion.remaining,
    }).catch(() => null);
  }, [promotion.id, promotion.remaining, promotion.slug]);

  return (
    <aside
      dir={dir}
      className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-[#d8ae58]/55 bg-[#071a32] px-5 py-6 text-[#fff8e9] shadow-[0_22px_60px_rgba(4,17,34,0.24)] sm:px-7 sm:py-7"
      data-promotion-slug={promotion.slug}
    >
      <button
        type="button"
        aria-label={dismissLabel}
        className="absolute end-3 top-3 z-20 rounded-full p-2 text-ivory/70 hover:bg-white/10 hover:text-ivory"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_15%,rgba(217,174,88,.2),transparent_25%),radial-gradient(circle_at_88%_82%,rgba(255,248,233,.11),transparent_30%)]" />
      <div className="relative grid gap-5 pe-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[#e8bd66]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
              {displayCopy.eyebrow}
            </span>
          </div>
          <h2 className="font-display text-2xl leading-tight text-[#fff8e9] sm:text-3xl">
            {displayCopy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#fff8e9]/82 sm:text-base">
            {displayCopy.body}
          </p>
          {promotion.promotionType === "free_class_credit" && !claimed ? (
            <p className="mt-3 text-sm font-bold text-[#efc36b]">
              {promotion.remaining} / {promotion.claimLimit}
            </p>
          ) : null}
        </div>
        {canClaim ? (
          <button
            type="button"
            disabled={claimPending}
            onClick={() => {
              void trackPromotionEngagement(promotion.slug, "cta_clicked", promotion.id).catch(
                () => null,
              );
              onClaim();
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#efc36b] bg-[#efc36b] px-5 text-sm font-bold text-[#071a32] transition hover:bg-[#f8d88f] disabled:cursor-wait disabled:opacity-65"
          >
            {displayCopy.cta}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
          </button>
        ) : (
          <a
            href={promotion.actionUrl}
            onClick={() => {
              void trackPromotionEngagement(promotion.slug, "cta_clicked", promotion.id).catch(
                () => null,
              );
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#efc36b]/65 px-5 text-sm font-bold text-[#fff8e9] transition hover:bg-white/10"
          >
            {displayCopy.cta}
            <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
          </a>
        )}
      </div>
    </aside>
  );
}
