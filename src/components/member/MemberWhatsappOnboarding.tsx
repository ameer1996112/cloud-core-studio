import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  getMemberWhatsappOnboardingState,
  respondMemberWhatsappOnboarding,
} from "@/lib/memberNotifications.functions";
import { MEMBER_NOTIFICATION_CENTER_QUERY_KEY } from "@/lib/memberNotificationQueryKeys";

const QUERY_KEY = ["member-whatsapp-onboarding"] as const;

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    eyebrow: "A quieter way to stay prepared",
    title: "Studio updates on WhatsApp",
    body: "Receive booking confirmations, class reminders, and important schedule changes.",
    accept: "Enable WhatsApp updates",
    decline: "No, thank you",
    error: "We could not save your choice. Please try again.",
  },
  he: {
    eyebrow: "להישאר מעודכנת, בשקט",
    title: "עדכוני הסטודיו ב‑WhatsApp",
    body: "לקבלת אישורי הזמנה, תזכורות לשיעורים ושינויים חשובים במערכת.",
    accept: "הפעלת עדכוני WhatsApp",
    decline: "לא, תודה",
    error: "לא הצלחנו לשמור את הבחירה. אפשר לנסות שוב.",
  },
  ar: {
    eyebrow: "ابقَي على اطلاع بهدوء",
    title: "تحديثات الاستوديو عبر WhatsApp",
    body: "لتلقي تأكيدات الحجز وتذكيرات الحصص والتغييرات المهمة في الجدول.",
    accept: "تفعيل تحديثات WhatsApp",
    decline: "لا، شكرًا",
    error: "تعذر حفظ اختيارك. حاولي مرة أخرى.",
  },
};

export function MemberWhatsappOnboarding() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const getState = useServerFn(getMemberWhatsappOnboardingState);
  const respond = useServerFn(respondMemberWhatsappOnboarding);
  const [errorMessage, setErrorMessage] = useState("");
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getState(),
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: (decision: "accepted" | "declined") => respond({ data: { decision } }),
    onMutate: () => setErrorMessage(""),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEY, { eligible: false });
      void queryClient.invalidateQueries({ queryKey: MEMBER_NOTIFICATION_CENTER_QUERY_KEY });
    },
    onError: () => setErrorMessage(copy.error),
  });

  if (!query.data?.eligible) return null;

  return (
    <section
      role="dialog"
      aria-labelledby="member-whatsapp-onboarding-title"
      aria-describedby="member-whatsapp-onboarding-description"
      className="fixed inset-x-4 bottom-[calc(var(--member-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-gold/30 bg-ivory shadow-[var(--shadow-elevated)] md:bottom-8"
    >
      <div className="h-1 bg-gradient-to-r from-gold/35 via-gold to-gold/35" />
      <div className="p-5 text-start">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-white text-navy">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
              {copy.eyebrow}
            </p>
            <h2
              id="member-whatsapp-onboarding-title"
              className="mt-1 text-lg font-semibold text-navy"
            >
              {copy.title}
            </h2>
            <p
              id="member-whatsapp-onboarding-description"
              className="mt-1 text-sm leading-6 text-slate"
            >
              {copy.body}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("accepted")}
            className="cta-navy min-h-11 flex-1 px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {copy.accept}
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("declined")}
            className="min-h-11 rounded-[var(--radius-pill)] px-4 py-2.5 text-sm font-medium text-slate transition-colors hover:bg-white hover:text-navy disabled:opacity-60"
          >
            {copy.decline}
          </button>
        </div>
        {errorMessage && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
