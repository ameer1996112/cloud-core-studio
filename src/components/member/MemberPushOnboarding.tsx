import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClientOnlyFn, useServerFn } from "@tanstack/react-start";
import { BellRing, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
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
    denied: string;
    openSettings: string;
    error: string;
    successTitle: string;
    successBody: string;
  }
> = {
  en: {
    eyebrow: "Your studio, right when you need it",
    title: "Your class, right on time",
    body: "We’ll notify you only when it truly matters.",
    previewTitle: "Pilates Sculpt starts tomorrow",
    previewBody: "Your mat is reserved for 18:30.",
    previewTime: "now",
    benefits: ["Class reminders", "Schedule changes", "Waitlist openings"],
    privacy: "Only important studio updates. You stay in control.",
    enable: "Turn on notifications",
    later: "Not now",
    denied: "Notifications are off in your iPhone Settings.",
    openSettings: "Open Settings",
    error: "We couldn’t connect. Try again in a moment.",
    successTitle: "You’re all set",
    successBody: "Important studio updates will arrive right on time.",
  },
  he: {
    eyebrow: "הסטודיו איתך, בכל רגע",
    title: "השיעור שלך, בזמן הנכון",
    body: "נעדכן אותך רק כשבאמת חשוב.",
    previewTitle: "Pilates Sculpt מתחיל מחר",
    previewBody: "המזרן שלך שמור לשעה 18:30.",
    previewTime: "עכשיו",
    benefits: ["תזכורות לשיעורים", "שינויים במערכת", "מקום שהתפנה"],
    privacy: "רק עדכונים חשובים מהסטודיו. השליטה נשארת אצלך.",
    enable: "הפעלת התראות",
    later: "לא עכשיו",
    denied: "ההתראות כבויות בהגדרות ה‑iPhone.",
    openSettings: "פתיחת הגדרות",
    error: "לא הצלחנו להתחבר. נסי שוב בעוד רגע.",
    successTitle: "הכול מוכן",
    successBody: "העדכונים החשובים מהסטודיו יגיעו בדיוק בזמן.",
  },
  ar: {
    eyebrow: "الاستوديو معكِ في كل لحظة",
    title: "حصتكِ، في الوقت المناسب",
    body: "سنرسل لكِ إشعاراً فقط عندما يكون الأمر مهماً فعلاً.",
    previewTitle: "تبدأ حصة Pilates Sculpt غداً",
    previewBody: "بساطكِ محجوز للساعة 18:30.",
    previewTime: "الآن",
    benefits: ["تذكيرات الحصص", "تغييرات الجدول", "توفر مكان"],
    privacy: "تحديثات الاستوديو المهمة فقط. أنتِ المتحكمة دائماً.",
    enable: "تفعيل الإشعارات",
    later: "ليس الآن",
    denied: "الإشعارات متوقفة في إعدادات iPhone.",
    openSettings: "فتح الإعدادات",
    error: "تعذر الاتصال. حاولي مرة أخرى بعد قليل.",
    successTitle: "أصبحتِ جاهزة",
    successBody: "ستصلكِ تحديثات الاستوديو المهمة في الوقت المناسب.",
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

const openMemberPushSettings = createClientOnlyFn(() => {
  window.location.assign("app-settings:");
});

type PermissionView = "ready" | "denied" | "error" | "success";

export function MemberPushOnboarding() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const queryClient = useQueryClient();
  const getCenter = useServerFn(getMemberNotificationCenter);
  const [open, setOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [view, setView] = useState<PermissionView>("ready");
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
          setView("ready");
          setOpen(true);
        }
        if (decision === "recover") {
          setView("denied");
          setOpen(true);
        }
      })
      .catch((error) => console.warn("member_push_onboarding_check_failed", error));

    return () => {
      cancelled = true;
    };
  }, [pushEnabled, query.isLoading]);

  useEffect(() => {
    if (view !== "success") return;
    const timeoutId = window.setTimeout(() => setOpen(false), 1_100);
    return () => window.clearTimeout(timeoutId);
  }, [view]);

  useEffect(() => {
    if (!open || view !== "denied") return;

    let cancelled = false;
    let checking = false;
    let removeListener: (() => void) | undefined;

    void import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive || cancelled || checking) return;
        checking = true;
        void getMemberPushDeviceState()
          .then(async (device) => {
            if (cancelled || !device.isNativeIos || device.permission !== "granted") return;
            const result = await bootstrapMemberPushRegistration();
            if (memberPushRegistrationDecision(result) !== "enabled") {
              setView("error");
              return;
            }
            window.localStorage.removeItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY);
            setView("success");
            void queryClient.invalidateQueries({ queryKey: MEMBER_NOTIFICATION_CENTER_QUERY_KEY });
          })
          .catch((error) => {
            console.warn("member_push_onboarding_settings_check_failed", error);
            if (!cancelled) setView("error");
          })
          .finally(() => {
            checking = false;
          });
      });
      if (cancelled) {
        void listener.remove();
        return;
      }
      removeListener = () => void listener.remove();
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [open, queryClient, view]);

  function dismiss() {
    if (isEnabling || view === "success") return;
    window.localStorage.setItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY, String(Date.now()));
    setOpen(false);
  }

  async function enablePush() {
    if (isEnabling) return;
    setIsEnabling(true);
    setView("ready");

    try {
      const result = await startMemberPushRegistration();
      const decision = memberPushRegistrationDecision(result);
      if (decision === "enabled") {
        window.localStorage.removeItem(MEMBER_PUSH_INVITE_DISMISSED_AT_KEY);
        setView("success");
        void queryClient.invalidateQueries({ queryKey: MEMBER_NOTIFICATION_CENTER_QUERY_KEY });
        return;
      }
      if (decision === "denied") {
        setView("denied");
        return;
      }
      setView("error");
    } catch (error) {
      console.warn("member_push_onboarding_registration_failed", error);
      setView("error");
    } finally {
      setIsEnabling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[27rem] gap-0 overflow-hidden rounded-[28px] border-gold/25 bg-ivory p-0 shadow-[0_28px_90px_rgba(11,29,58,0.28)] [&>button:last-child]:text-white/75 [&>button:last-child:hover]:bg-white/10 [&>button:last-child:hover]:text-white">
        <div className="relative overflow-hidden bg-navy px-7 pb-10 pt-9 text-center text-white">
          <span
            aria-hidden
            className="absolute -start-16 -top-24 h-56 w-56 rounded-full border border-gold/15"
          />
          <span
            aria-hidden
            className="absolute -end-12 top-16 h-40 w-40 rounded-full bg-gold/8 blur-2xl"
          />
          {view === "success" ? (
            <span className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[20px] bg-white text-navy shadow-[0_14px_40px_rgba(0,0,0,0.24)]">
              <CheckCircle2 className="h-8 w-8" />
            </span>
          ) : (
            <img
              src="/brand/cloud-core-app-icon.svg"
              alt=""
              aria-hidden="true"
              className="relative mx-auto h-[4.5rem] w-[4.5rem] rounded-[20px] shadow-[0_14px_40px_rgba(0,0,0,0.24)]"
            />
          )}
          <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            {copy.eyebrow}
          </p>
          <DialogTitle className="relative mt-2 text-[1.75rem] font-semibold leading-[1.12] text-white">
            {view === "success" ? copy.successTitle : copy.title}
          </DialogTitle>
          <DialogDescription className="relative mx-auto mt-2 max-w-xs text-sm leading-6 text-white/72">
            {view === "success" ? copy.successBody : copy.body}
          </DialogDescription>
        </div>

        <div className="relative px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          {view === "success" ? (
            <div className="-mt-5 flex min-h-24 items-center justify-center rounded-[20px] border border-gold/20 bg-white px-5 text-center shadow-[0_12px_34px_rgba(11,29,58,0.11)]">
              <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {copy.successTitle}
              </span>
            </div>
          ) : (
            <>
              <div className="-mt-5 flex items-start gap-3 rounded-[20px] border border-gold/20 bg-white p-4 text-start shadow-[0_12px_34px_rgba(11,29,58,0.11)]">
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
                  <span className="mt-0.5 block text-xs leading-5 text-slate">
                    {copy.previewBody}
                  </span>
                </span>
              </div>

              <p className="mx-auto mt-5 max-w-sm text-center text-xs font-medium leading-5 text-navy/75">
                {copy.benefits.join(" · ")}
              </p>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />
                {copy.privacy}
              </p>

              {(view === "denied" || view === "error") && (
                <p
                  className="mx-auto mt-4 max-w-sm rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-center text-xs leading-5 text-destructive"
                  role="alert"
                >
                  {view === "denied" ? copy.denied : copy.error}
                </p>
              )}

              <button
                type="button"
                onClick={view === "denied" ? openMemberPushSettings : enablePush}
                disabled={isEnabling}
                aria-busy={isEnabling}
                className="cta-navy mt-5 flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm shadow-[0_12px_26px_rgba(11,29,58,0.18)] disabled:cursor-wait disabled:opacity-60"
              >
                {isEnabling && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                {view === "denied" ? copy.openSettings : copy.enable}
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={isEnabling}
                className="mt-1 min-h-11 w-full rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium text-slate transition-colors hover:bg-white hover:text-navy disabled:opacity-50"
              >
                {copy.later}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
