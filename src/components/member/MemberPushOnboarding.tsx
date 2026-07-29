import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientOnlyFn, useServerFn } from "@tanstack/react-start";
import { BellRing, CalendarCheck2, Clock3, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n, type Lang } from "@/lib/i18n";
import { MEMBER_NOTIFICATION_CENTER_QUERY_KEY } from "@/lib/memberNotificationQueryKeys";
import { getMemberNotificationCenter } from "@/lib/memberNotifications.functions";
import {
  isMemberPushInviteDismissed,
  memberPushOnboardingDecision,
  memberPushRegistrationDecision,
  MEMBER_PUSH_INVITE_DISMISSED_AT_KEY,
} from "@/lib/memberPushInvite";

const COPY: Record<
  Lang,
  {
    eyebrow: string;
    title: string;
    body: string;
    previewTitle: string;
    previewBody: string;
    previewTime: string;
    benefits: [string, string, string];
    privacy: string;
    enable: string;
    later: string;
    error: string;
  }
> = {
  en: {
    eyebrow: "Your studio, in step with you",
    title: "Never miss the moment",
    body: "Get the updates that matter—right when they matter.",
    previewTitle: "Pilates Sculpt starts tomorrow",
    previewBody: "Your mat is reserved for 18:30.",
    previewTime: "now",
    benefits: ["Class reminders", "Schedule changes", "Waitlist openings"],
    privacy: "Only useful studio updates. You stay in control.",
    enable: "Turn on notifications",
    later: "Maybe later",
    error: "We could not turn on notifications. Please try again.",
  },
  he: {
    eyebrow: "הסטודיו איתך, בכל רגע",
    title: "לא לפספס את הרגע",
    body: "לקבלת העדכונים החשובים בדיוק בזמן הנכון.",
    previewTitle: "Pilates Sculpt מתחיל מחר",
    previewBody: "המזרן שלך שמור לשעה 18:30.",
    previewTime: "עכשיו",
    benefits: ["תזכורות לשיעורים", "שינויים במערכת", "מקום שהתפנה"],
    privacy: "רק עדכונים שימושיים מהסטודיו. השליטה נשארת אצלך.",
    enable: "הפעלת התראות",
    later: "אולי אחר כך",
    error: "לא הצלחנו להפעיל התראות. אפשר לנסות שוב.",
  },
  ar: {
    eyebrow: "الاستوديو معكِ في كل لحظة",
    title: "لا تفوّتي اللحظة",
    body: "احصلي على التحديثات المهمة في الوقت المناسب تماماً.",
    previewTitle: "تبدأ حصة Pilates Sculpt غداً",
    previewBody: "بساطكِ محجوز للساعة 18:30.",
    previewTime: "الآن",
    benefits: ["تذكيرات الحصص", "تغييرات الجدول", "أماكن قائمة الانتظار"],
    privacy: "تحديثات مفيدة من الاستوديو فقط. أنتِ المتحكمة دائماً.",
    enable: "تفعيل الإشعارات",
    later: "ربما لاحقاً",
    error: "تعذر تفعيل الإشعارات. حاولي مرة أخرى.",
  },
};

const getMemberPushDeviceState = createClientOnlyFn(async () => {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { isNativeIos: false, permission: "unsupported" as const };
  }
  const memberPush = await import("@/lib/memberPush.client");
  return {
    isNativeIos: true,
    permission: await memberPush.getMemberPushPermissionStatus(),
    hasRegisteredToken: Boolean(memberPush.getCurrentMemberPushToken()),
  };
});

const startMemberPushRegistration = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.startMemberPushRegistration();
});

const bootstrapMemberPushRegistration = createClientOnlyFn(async () => {
  const memberPush = await import("@/lib/memberPush.client");
  return memberPush.bootstrapMemberPushRegistration();
});

export function MemberPushOnboarding() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getMemberNotificationCenter);
  const [open, setOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const query = useQuery({
    queryKey: MEMBER_NOTIFICATION_CENTER_QUERY_KEY,
    queryFn: () => getCenter(),
    staleTime: 30_000,
  });

  const pushEnabled = query.data?.preferences.pushEnabled === true;

  useEffect(() => {
    if (query.isLoading || !pushEnabled) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    void getMemberPushDeviceState()
      .then(async (device) => {
        if (cancelled || !device.isNativeIos) return;

        const dismissed = isMemberPushInviteDismissed(
          window.localStorage.getItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY),
        );
        const decision = memberPushOnboardingDecision({
          pushEnabled,
          isLoading: query.isLoading,
          isNativeIos: device.isNativeIos,
          permission: device.permission,
          hasRegisteredToken: device.hasRegisteredToken,
          dismissed,
        });
        if (decision === "bootstrap") {
          await bootstrapMemberPushRegistration();
          return;
        }
        if (decision === "invite") {
          setOpen(true);
        }
      })
      .catch((error) => console.warn("member_push_onboarding_check_failed", error));

    return () => {
      cancelled = true;
    };
  }, [pushEnabled, query.isLoading]);

  function dismiss() {
    if (isEnabling) return;
    window.localStorage.setItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY, String(Date.now()));
    setOpen(false);
  }

  async function enablePush() {
    if (isEnabling) return;
    setIsEnabling(true);
    setErrorMessage("");

    try {
      const result = await startMemberPushRegistration();
      const decision = memberPushRegistrationDecision(result);
      if (decision === "enabled") {
        window.localStorage.removeItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY);
        setOpen(false);
        void queryClient.invalidateQueries({ queryKey: MEMBER_NOTIFICATION_CENTER_QUERY_KEY });
        return;
      }
      if (decision === "dismissed") {
        window.localStorage.setItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY, String(Date.now()));
        setOpen(false);
        return;
      }
      setErrorMessage(copy.error);
    } catch (error) {
      console.warn("member_push_onboarding_registration_failed", error);
      setErrorMessage(copy.error);
    } finally {
      setIsEnabling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[27rem] gap-0 overflow-hidden rounded-[28px] border-gold/25 bg-ivory p-0 shadow-[0_28px_90px_rgba(11,29,58,0.28)] [&>button:last-child]:text-white/75 [&>button:last-child:hover]:bg-white/10 [&>button:last-child:hover]:text-white">
        <div className="relative overflow-hidden bg-navy px-7 pb-11 pt-10 text-center text-white">
          <span
            aria-hidden
            className="absolute -start-16 -top-24 h-56 w-56 rounded-full border border-gold/15"
          />
          <span
            aria-hidden
            className="absolute -end-12 top-16 h-40 w-40 rounded-full bg-gold/8 blur-2xl"
          />
          <img
            src="/brand/cloud-core-app-icon.svg"
            alt=""
            aria-hidden="true"
            className="relative mx-auto h-[4.5rem] w-[4.5rem] rounded-[20px] shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
          />
          <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            {copy.eyebrow}
          </p>
          <DialogTitle className="relative mt-2 text-[1.75rem] font-semibold leading-[1.12] text-white">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="relative mx-auto mt-2 max-w-xs text-sm leading-6 text-white/72">
            {copy.body}
          </DialogDescription>
        </div>

        <div className="relative px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <div className="-mt-6 flex items-start gap-3 rounded-[20px] border border-gold/20 bg-white p-4 text-start shadow-[0_12px_34px_rgba(11,29,58,0.11)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-navy text-white">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold leading-5 text-navy">
                  {copy.previewTitle}
                </span>
                <span className="shrink-0 text-[10px] text-slate/70">{copy.previewTime}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-slate">{copy.previewBody}</span>
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2" aria-label={copy.body}>
            {[
              { icon: CalendarCheck2, label: copy.benefits[0] },
              { icon: Clock3, label: copy.benefits[1] },
              { icon: Users, label: copy.benefits[2] },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-[16px] border border-gold/15 bg-white/60 px-2 text-center"
              >
                <Icon className="h-[18px] w-[18px] text-gold" />
                <span className="text-[11px] font-medium leading-4 text-navy">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />
            {copy.privacy}
          </p>

          <button
            type="button"
            onClick={enablePush}
            disabled={isEnabling}
            aria-busy={isEnabling}
            className="cta-navy mt-5 min-h-12 w-full px-5 py-3 text-sm shadow-[0_12px_26px_rgba(11,29,58,0.18)] disabled:cursor-wait disabled:opacity-60"
          >
            {copy.enable}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={isEnabling}
            className="mt-1 min-h-11 w-full rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium text-slate transition-colors hover:bg-white hover:text-navy disabled:opacity-50"
          >
            {copy.later}
          </button>
          {errorMessage && (
            <p className="mt-2 text-center text-xs text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
