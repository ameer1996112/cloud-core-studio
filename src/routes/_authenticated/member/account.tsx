import { MemberPageState } from "@/components/member/MemberPageState";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { LogOut, Save, Trash2 } from "lucide-react";
import { getMyPackages, requestMyAccountDeletion, updateMyProfile } from "@/lib/member.functions";
import { supabase } from "@/integrations/supabase/client";
import { flushSync } from "react-dom";
import { applyLang, labelForStatus, t, useI18n, getLocale, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LtrInline } from "@/components/ui/bidi";
import { MemberFeedbackPanel } from "@/components/member/MemberFeedbackPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getMyPersonalConcierge,
  saveMyPersonalConciergePreference,
  setMyPersonalConciergePause,
} from "@/lib/personalConcierge.functions";
import { resolveMemberProfileLanguage } from "@/lib/memberProfileLanguage";

type ProfileForm = {
  name?: string;
  phone?: string | null;
  preferred_language?: Lang;
  emergency_contact?: string | null;
  energy_preference?: string | null;
};

type MemberProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  preferred_language?: Lang | null;
  emergency_contact?: string | null;
  energy_preference?: string | null;
  created_at?: string | null;
};

type DeletionResult = {
  duplicate?: boolean;
};

type DeletionFeedback = "submitted" | "already-requested" | "error" | null;

export const Route = createFileRoute("/_authenticated/member/account")({
  component: MemberAccount,
});

function MemberAccount() {
  const { lang, dir, locale } = useI18n();
  useDocumentTitle("page.profile.title");
  const fetchPkg = useServerFn(getMyPackages);
  const updateFn = useServerFn(updateMyProfile);
  const deleteFn = useServerFn(requestMyAccountDeletion);
  const fetchConcierge = useServerFn(getMyPersonalConcierge);
  const saveConciergePreference = useServerFn(saveMyPersonalConciergePreference);
  const setConciergePause = useServerFn(setMyPersonalConciergePause);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["member-packages"],
    queryFn: () => fetchPkg(),
  });
  const { data: concierge } = useQuery({
    queryKey: ["personal-concierge"],
    queryFn: () => fetchConcierge(),
  });
  const me = data?.member as MemberProfile | undefined;

  const [form, setForm] = useState<ProfileForm>({});
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [deletionFeedback, setDeletionFeedback] = useState<DeletionFeedback>(null);
  const deletionTriggerRef = useRef<HTMLButtonElement>(null);
  const deletionFeedbackRef = useRef<HTMLElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [conciergePace, setConciergePace] = useState("");
  const [conciergeIntention, setConciergeIntention] = useState("");

  const update = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      toast.success(t("profile.saved"));
      qc.invalidateQueries({ queryKey: ["member-home"] });
      qc.invalidateQueries({ queryKey: ["member-packages"] });
      setForm({});
    },
    onError: (e) => toast.error(friendlyErrorMessage(e, t("profile.saveError"))),
  });

  const deletion = useMutation({
    mutationFn: () => deleteFn({ data: { reason: deletionReason } }),
    onMutate: () => setDeletionFeedback(null),
    onSuccess: (result: DeletionResult) => {
      setDeletionReason("");
      setDeletionDialogOpen(false);
      setDeletionFeedback(result?.duplicate ? "already-requested" : "submitted");
    },
    onError: () => {
      setDeletionDialogOpen(false);
      setDeletionFeedback("error");
    },
  });

  useEffect(() => {
    if (deletionFeedback) deletionFeedbackRef.current?.focus();
  }, [deletionFeedback]);

  const saveBetweenUs = useMutation({
    mutationFn: async () => {
      if (conciergePace) {
        await saveConciergePreference({
          data: { key: "communication_pace", value: conciergePace },
        });
      }
      if (conciergeIntention.trim()) {
        await saveConciergePreference({
          data: { key: "member_intention", value: conciergeIntention.trim() },
        });
      }
    },
    onSuccess: () => {
      toast.success(
        lang === "he" ? "ההעדפות נשמרו" : lang === "ar" ? "تم حفظ تفضيلاتك" : "Preferences saved",
      );
      qc.invalidateQueries({ queryKey: ["personal-concierge"] });
      qc.invalidateQueries({ queryKey: ["member-home"] });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e, t("profile.saveError"))),
  });

  const pauseBetweenUs = useMutation({
    mutationFn: (paused: boolean) => setConciergePause({ data: { paused } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-concierge"] });
      qc.invalidateQueries({ queryKey: ["member-home"] });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e, t("profile.saveError"))),
  });

  const conciergeCopy =
    lang === "he"
      ? {
          eyebrow: "בינינו",
          title: "הקשר האישי שלך עם ירין",
          body: "כאן אפשר לבחור מה נכון לך, לראות מה נשמר ולהחליט כמה שקט תרצי.",
          pace: "כמה תשומת לב מתאימה לך?",
          quiet: "שקט — רק כשבאמת חשוב",
          balanced: "מאוזן — הכוונה עדינה",
          attentive: "קשוב — יותר הצעות אישיות",
          intention: "מה היית רוצה להרגיש או להשיג?",
          intentionPlaceholder: "למשל: להתחזק בקצב נעים",
          pause: "השהיית התאמה אישית",
          save: "שמירת ההעדפות",
        }
      : lang === "ar"
        ? {
            eyebrow: "بيننا",
            title: "علاقتك الشخصية مع يارين",
            body: "اختاري ما يناسبك، راجعي ما نتذكره، وحددي مقدار الهدوء الذي تفضلينه.",
            pace: "ما مقدار الاهتمام المناسب لك؟",
            quiet: "هادئ — فقط عندما يكون الأمر مهماً",
            balanced: "متوازن — توجيه لطيف",
            attentive: "متابع — اقتراحات شخصية أكثر",
            intention: "بماذا ترغبين أن تشعري أو ماذا تريدين تحقيقه؟",
            intentionPlaceholder: "مثلاً: أن أصبح أقوى بوتيرة مريحة",
            pause: "إيقاف التخصيص مؤقتاً",
            save: "حفظ التفضيلات",
          }
        : {
            eyebrow: "Between us",
            title: "Your personal relationship with Yareen",
            body: "Choose what feels right, review what is remembered, and decide how quiet you want the Concierge to be.",
            pace: "How much attention suits you?",
            quiet: "Quiet — only when it truly matters",
            balanced: "Balanced — gentle guidance",
            attentive: "Attentive — more personal suggestions",
            intention: "What would you like to feel or achieve?",
            intentionPlaceholder: "For example: become stronger at a comfortable pace",
            pause: "Pause personalization",
            save: "Save preferences",
          };

  const val = <K extends keyof ProfileForm>(k: K) =>
    form[k] !== undefined ? form[k] : (me?.[k] ?? "");
  const set = <K extends keyof ProfileForm>(k: K, v: NonNullable<ProfileForm[K]>) =>
    setForm((f) => ({ ...f, [k]: v }));
  const selectedLanguage = resolveMemberProfileLanguage(
    form.preferred_language,
    me?.preferred_language,
    lang,
  );

  function setLanguage(value: string) {
    const next: Lang = value === "en" || value === "ar" || value === "he" ? value : "he";
    applyLang(next);
    set("preferred_language", next);
  }

  async function signOut() {
    flushSync(() => setSigningOut(true));
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading || isError)
    return (
      <MemberPageState title={t("nav.profile")} error={isError} onRetry={() => void refetch()} />
    );

  return (
    <section dir={dir} className="member-page aura-member-page aura-account-page">
      <header className="aura-page-heading aura-profile-heading">
        <div>
          <p className="member-eyebrow">{t("member.account.kicker")}</p>
          <h1>
            <bdi>{me?.name ?? t("nav.profile")}</bdi>
          </h1>
          <p>{me?.email ? <LtrInline>{me.email}</LtrInline> : t("member.account.body")}</p>
        </div>
        {me?.status && <span className="aura-profile-status">{labelForStatus(me.status)}</span>}
      </header>
      <div className="aura-account-layout">
        <div className="aura-account-main">
          <div className="aura-settings-section aura-profile-details">
            <div className="member-section-heading flex flex-row justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="member-section-title">{t("profile.details")}</h2>
              </div>
              {me?.created_at && (
                <div className="aura-member-since">
                  {t("profile.memberSince")}{" "}
                  <span className="font-semibold">
                    {new Date(me.created_at).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="aura-profile-fields">
              <Field label={t("profile.name")}>
                <input
                  className="editorial-input"
                  dir={val("name") ? "auto" : undefined}
                  value={val("name")}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label={t("profile.phone")}>
                <input
                  className="editorial-input"
                  inputMode="tel"
                  autoComplete="tel"
                  value={val("phone") ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label={t("profile.language")}>
                <select
                  className="editorial-input"
                  value={selectedLanguage}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="he">עברית</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
              <Field label={t("profile.emergency")}>
                <input
                  className="editorial-input"
                  dir={val("emergency_contact") ? "auto" : undefined}
                  value={val("emergency_contact") ?? ""}
                  onChange={(e) => set("emergency_contact", e.target.value)}
                  placeholder={t("profile.emergencyPlaceholder")}
                />
              </Field>
              <Field label={t("profile.energy")}>
                <input
                  className="editorial-input"
                  dir={val("energy_preference") ? "auto" : undefined}
                  value={val("energy_preference") ?? ""}
                  onChange={(e) => set("energy_preference", e.target.value)}
                  placeholder={t("profile.energyPlaceholder")}
                />
              </Field>
            </div>
            <div className="aura-form-submit">
              <button
                disabled={update.isPending || Object.keys(form).length === 0}
                onClick={() => update.mutate()}
                className="btn-navy hover:btn-navy-hover disabled:opacity-50"
              >
                <Save className="h-3 w-3" />{" "}
                {update.isPending ? t("common.saving") : t("profile.save")}
              </button>
            </div>
          </div>

          {concierge?.available && (
            <section id="between-us" className="aura-settings-section space-y-5">
              <div>
                <p className="member-eyebrow">{conciergeCopy.eyebrow}</p>
                <h2 className="member-section-title mt-2">{conciergeCopy.title}</h2>
                <p className="member-page-body mt-2 max-w-2xl">{conciergeCopy.body}</p>
              </div>
              <Field label={conciergeCopy.pace}>
                <select
                  className="editorial-input"
                  value={conciergePace}
                  onChange={(event) => setConciergePace(event.target.value)}
                >
                  <option value="">{conciergeCopy.balanced}</option>
                  <option value="quiet">{conciergeCopy.quiet}</option>
                  <option value="balanced">{conciergeCopy.balanced}</option>
                  <option value="attentive">{conciergeCopy.attentive}</option>
                </select>
              </Field>
              <Field label={conciergeCopy.intention}>
                <input
                  className="editorial-input"
                  dir="auto"
                  value={conciergeIntention}
                  onChange={(event) => setConciergeIntention(event.target.value)}
                  placeholder={conciergeCopy.intentionPlaceholder}
                  maxLength={120}
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline pt-4">
                <label className="flex items-center gap-2 text-sm text-slate">
                  <input
                    type="checkbox"
                    checked={concierge?.relationship?.personalization_paused === true}
                    onChange={(event) => pauseBetweenUs.mutate(event.target.checked)}
                    disabled={pauseBetweenUs.isPending}
                  />
                  {conciergeCopy.pause}
                </label>
                <button
                  className="btn-navy hover:btn-navy-hover disabled:opacity-50"
                  disabled={
                    saveBetweenUs.isPending || (!conciergePace && !conciergeIntention.trim())
                  }
                  onClick={() => saveBetweenUs.mutate()}
                >
                  <Save className="h-3 w-3" />
                  {conciergeCopy.save}
                </button>
              </div>
            </section>
          )}
        </div>
        <aside className="aura-account-utilities">
          <div className="aura-settings-section aura-session-section">
            <div className="min-w-0">
              <p className="font-display text-xl text-navy">{t("shell.signOut")}</p>
              <p className="text-xs text-slate mt-1">{t("profile.endSession")}</p>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              className="btn-outline hover:btn-outline-hover"
            >
              <LogOut className="h-3 w-3" /> {t("shell.signOut")}
            </button>
          </div>

          <div className="aura-settings-section space-y-4">
            <div className="member-section-heading">
              <div>
                <p className="member-eyebrow">{t("profile.privacyKicker")}</p>
                <h2 className="member-section-title mt-1">{t("profile.privacyTitle")}</h2>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate">{t("profile.privacyBody")}</p>
            <div className="aura-legal-links">
              <Link to="/privacy" className="btn-outline hover:btn-outline-hover justify-center">
                {t("legal.privacy")}
              </Link>
              <Link to="/terms" className="btn-outline hover:btn-outline-hover justify-center">
                {t("legal.terms")}
              </Link>
              <Link to="/support" className="btn-outline hover:btn-outline-hover justify-center">
                {t("legal.support")}
              </Link>
            </div>
            <div className="border-t hairline pt-4">
              <Field label={t("profile.deleteReason")}>
                <textarea
                  className="editorial-input min-h-24 resize-y"
                  dir="auto"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder={t("profile.deleteReasonPlaceholder")}
                />
              </Field>
              <p className="mt-3 text-sm leading-6 text-slate">
                {t("profile.deleteRequestExplanation")}
              </p>
              {deletionFeedback === "submitted" && (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="success"
                  title={t("profile.deleteRequestSubmittedTitle")}
                  live="polite"
                  className="mt-4"
                >
                  {t("profile.deleteRequestSubmittedBody")}
                </MemberFeedbackPanel>
              )}
              {deletionFeedback === "already-requested" && (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="info"
                  title={t("profile.deleteAlreadyRequested")}
                  live="polite"
                  className="mt-4"
                >
                  {t("profile.deleteAlreadyRequestedBody")}
                </MemberFeedbackPanel>
              )}
              {deletionFeedback === "error" && (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="error"
                  title={t("profile.deleteRequestError")}
                  live="assertive"
                  className="mt-4"
                >
                  {t("profile.deleteRequestErrorBody")}{" "}
                  <Link
                    to="/support"
                    className="font-semibold text-navy underline underline-offset-2"
                  >
                    {t("profile.deleteRequestSupport")}
                  </Link>
                </MemberFeedbackPanel>
              )}
              <div className="mt-3 flex justify-start">
                <button
                  ref={deletionTriggerRef}
                  type="button"
                  disabled={
                    deletion.isPending ||
                    deletionFeedback === "submitted" ||
                    deletionFeedback === "already-requested"
                  }
                  onClick={() => setDeletionDialogOpen(true)}
                  className="btn-ghost hover:btn-ghost-hover border-destructive/30 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  {deletion.isPending
                    ? t("profile.deleteRequestSubmitting")
                    : t("profile.deleteRequest")}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <AlertDialog
        open={deletionDialogOpen}
        onOpenChange={(open) => {
          setDeletionDialogOpen(open);
          if (!open) requestAnimationFrame(() => deletionTriggerRef.current?.focus());
        }}
      >
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("profile.deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletion.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deletion.isPending) deletion.mutate();
              }}
              className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletion.isPending
                ? t("profile.deleteRequestSubmitting")
                : t("profile.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
