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
import { applyLang, labelForStatus, LANG_META, t, useI18n, getLocale, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BidiValue } from "@/components/ui/bidi";
import { bidiDirectionFor } from "@/lib/bidi-format";
import { MemberField, MemberProfileSaveStatus } from "@/components/member/MemberField";
import { MemberFeedbackPanel } from "@/components/member/MemberFeedbackPanel";
import { MemberPageIntro, MemberSection } from "@/components/member/MemberPage";
import { MemberRouteError, MemberRouteSkeleton } from "@/components/member/MemberRouteSkeleton";
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
import {
  getMemberProfileQueryView,
  shouldResetMemberProfileSaveOnEdit,
} from "@/lib/memberProfileState";

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
  ok?: boolean;
  status?: string;
  duplicate?: boolean;
};

type DeletionFeedback = "submitted" | "already-requested" | "error" | null;

export const Route = createFileRoute("/_authenticated/member/account")({
  component: MemberAccount,
});

function MemberAccount() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.profile.title");
  const fetchPkg = useServerFn(getMyPackages);
  const updateFn = useServerFn(updateMyProfile);
  const deleteFn = useServerFn(requestMyAccountDeletion);
  const fetchConcierge = useServerFn(getMyPersonalConcierge);
  const saveConciergePreference = useServerFn(saveMyPersonalConciergePreference);
  const setConciergePause = useServerFn(setMyPersonalConciergePause);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isPending, isError, isSuccess, refetch } = useQuery({
    queryKey: ["member-packages"],
    queryFn: () => fetchPkg(),
  });
  const { data: concierge } = useQuery({
    queryKey: ["personal-concierge"],
    queryFn: () => fetchConcierge(),
  });
  const me = data?.member as MemberProfile | undefined;
  const hasProfileData = Boolean(me);
  const profileQueryView = getMemberProfileQueryView({
    hasProfileData,
    isPending,
    isError,
    isSuccess,
  });

  const [form, setForm] = useState<ProfileForm>({});
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionDialogOpen, setDeletionDialogOpen] = useState(false);
  const [deletionFeedback, setDeletionFeedback] = useState<DeletionFeedback>(null);
  const deletionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deletionFeedbackRef = useRef<HTMLElement | null>(null);
  const deletionRequestInFlightRef = useRef(false);
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
      if (result?.ok !== true || typeof result.status !== "string") {
        setDeletionDialogOpen(false);
        setDeletionFeedback("error");
        return;
      }
      setDeletionReason("");
      setDeletionDialogOpen(false);
      setDeletionFeedback(result?.duplicate ? "already-requested" : "submitted");
    },
    onError: () => {
      setDeletionDialogOpen(false);
      setDeletionFeedback("error");
    },
    onSettled: () => {
      deletionRequestInFlightRef.current = false;
    },
  });

  useEffect(() => {
    if (!deletionFeedback) return;
    const frame = requestAnimationFrame(() => deletionFeedbackRef.current?.focus());
    return () => cancelAnimationFrame(frame);
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
  const {
    isSuccess: profileSaveSucceeded,
    isError: profileSaveFailed,
    reset: resetProfileSave,
  } = update;

  useEffect(() => {
    if (!profileSaveSucceeded && !profileSaveFailed) return;

    const timeout = window.setTimeout(() => resetProfileSave(), 4_000);
    return () => window.clearTimeout(timeout);
  }, [profileSaveSucceeded, profileSaveFailed, resetProfileSave]);

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
  const set = <K extends keyof ProfileForm>(k: K, v: NonNullable<ProfileForm[K]>) => {
    if (shouldResetMemberProfileSaveOnEdit(update)) update.reset();
    setForm((f) => ({ ...f, [k]: v }));
  };
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

  function submitDeletionRequest() {
    if (deletion.isPending || deletionRequestInFlightRef.current) return;
    deletionRequestInFlightRef.current = true;
    deletion.mutate();
  }

  return (
    <section dir={dir} className="member-page member-account-page w-full pb-10">
      {profileQueryView === "loading" ? <MemberRouteSkeleton route="account" /> : null}

      {profileQueryView === "error" ? <MemberRouteError onRetry={() => void refetch()} /> : null}

      {profileQueryView === "content" && me ? (
        <div className="member-account-page__content">
          <MemberPageIntro
            eyebrow={t("member.account.kicker")}
            title={me.name?.trim() || t("nav.profile")}
            body={
              me.email ? (
                <BidiValue kind="email" className="inline-block">
                  {me.email}
                </BidiValue>
              ) : (
                t("member.account.body")
              )
            }
            aside={
              <div className="member-account-summary" aria-label={t("profile.details")}>
                {me.status ? (
                  <span className="member-chip">{labelForStatus(me.status)}</span>
                ) : null}
                <span className="member-chip">{LANG_META[selectedLanguage].label}</span>
              </div>
            }
          />

          <MemberSection
            id="profile-details"
            title={t("profile.details")}
            action={
              me.created_at ? (
                <span className="member-account-since">
                  {t("profile.memberSince")}{" "}
                  <BidiValue kind="localized-date" className="font-semibold">
                    {new Date(me.created_at).toLocaleDateString(
                      getLocale() === "he" ? "he-IL" : "en-GB",
                      { year: "numeric", month: "long" },
                    )}
                  </BidiValue>
                </span>
              ) : undefined
            }
          >
            <div className="member-account-fields">
              <MemberField id="profile-name" label={t("profile.name")}>
                <input
                  className="editorial-input"
                  dir={val("name") ? "auto" : undefined}
                  value={val("name")}
                  onChange={(event) => set("name", event.target.value)}
                />
              </MemberField>
              <MemberField id="profile-phone" label={t("profile.phone")}>
                <input
                  className="editorial-input"
                  dir={bidiDirectionFor("phone")}
                  inputMode="tel"
                  autoComplete="tel"
                  value={val("phone") ?? ""}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </MemberField>
              <MemberField id="profile-language" label={t("profile.language")}>
                <select
                  className="editorial-input"
                  value={selectedLanguage}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="he">עברית</option>
                  <option value="ar">العربية</option>
                </select>
              </MemberField>
              <MemberField id="profile-emergency-contact" label={t("profile.emergency")}>
                <input
                  className="editorial-input"
                  dir={val("emergency_contact") ? "auto" : undefined}
                  value={val("emergency_contact") ?? ""}
                  onChange={(event) => set("emergency_contact", event.target.value)}
                  placeholder={t("profile.emergencyPlaceholder")}
                />
              </MemberField>
              <MemberField id="profile-energy-preference" label={t("profile.energy")}>
                <input
                  className="editorial-input"
                  dir={val("energy_preference") ? "auto" : undefined}
                  value={val("energy_preference") ?? ""}
                  onChange={(event) => set("energy_preference", event.target.value)}
                  placeholder={t("profile.energyPlaceholder")}
                />
              </MemberField>
            </div>

            <div className="member-account-save-row">
              <button
                id="profile-save"
                type="button"
                disabled={update.isPending || Object.keys(form).length === 0}
                onClick={() => update.mutate()}
                className="btn-navy member-account-action member-account-save-action hover:btn-navy-hover"
                aria-describedby="profile-save-status"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {update.isPending ? t("common.saving") : t("profile.save")}
              </button>
              <MemberProfileSaveStatus
                id="profile-save-status"
                pending={update.isPending}
                succeeded={update.isSuccess}
                failed={update.isError}
              />
            </div>
          </MemberSection>

          {concierge?.available ? (
            <MemberSection
              id="between-us"
              eyebrow={conciergeCopy.eyebrow}
              title={conciergeCopy.title}
            >
              <p className="member-page-body member-account-section-copy max-w-2xl">
                {conciergeCopy.body}
              </p>
              <div className="member-account-fields member-account-fields--concierge">
                <MemberField id="concierge-pace" label={conciergeCopy.pace}>
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
                </MemberField>
                <MemberField id="concierge-intention" label={conciergeCopy.intention}>
                  <input
                    className="editorial-input"
                    dir="auto"
                    value={conciergeIntention}
                    onChange={(event) => setConciergeIntention(event.target.value)}
                    placeholder={conciergeCopy.intentionPlaceholder}
                    maxLength={120}
                  />
                </MemberField>
              </div>
              <div className="member-account-save-row">
                <div className="member-toggle-row">
                  <input
                    id="concierge-paused"
                    type="checkbox"
                    checked={concierge?.relationship?.personalization_paused === true}
                    onChange={(event) => pauseBetweenUs.mutate(event.target.checked)}
                    disabled={pauseBetweenUs.isPending}
                  />
                  <label htmlFor="concierge-paused">{conciergeCopy.pause}</label>
                </div>
                <button
                  id="concierge-save"
                  type="button"
                  className="btn-navy member-account-action member-account-save-action hover:btn-navy-hover"
                  disabled={
                    saveBetweenUs.isPending || (!conciergePace && !conciergeIntention.trim())
                  }
                  onClick={() => saveBetweenUs.mutate()}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {conciergeCopy.save}
                </button>
              </div>
            </MemberSection>
          ) : null}

          <MemberSection id="session" title={t("shell.signOut")}>
            <div className="member-account-session">
              <p className="member-account-section-copy text-sm leading-6 text-slate">
                {t("profile.endSession")}
              </p>
              <button
                id="account-sign-out"
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="btn-outline member-account-action hover:btn-outline-hover"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("shell.signOut")}
              </button>
            </div>
          </MemberSection>

          <MemberSection
            id="privacy"
            eyebrow={t("profile.privacyKicker")}
            title={t("profile.privacyTitle")}
          >
            <p className="member-account-section-copy text-sm leading-6 text-slate">
              {t("profile.privacyBody")}
            </p>
            <nav className="member-account-legal-links" aria-label={t("profile.privacyTitle")}>
              <Link
                to="/privacy"
                className="btn-outline member-account-action hover:btn-outline-hover"
              >
                {t("legal.privacy")}
              </Link>
              <Link
                to="/terms"
                className="btn-outline member-account-action hover:btn-outline-hover"
              >
                {t("legal.terms")}
              </Link>
              <Link
                to="/support"
                className="btn-outline member-account-action hover:btn-outline-hover"
              >
                {t("legal.support")}
              </Link>
            </nav>
            <div className="member-danger-zone">
              <p className="member-danger-zone__explanation text-sm leading-6 text-slate">
                {t("profile.deleteRequestExplanation")}
              </p>
              <MemberField id="delete-reason" label={t("profile.deleteReason")}>
                <textarea
                  className="editorial-input min-h-24 resize-y"
                  dir="auto"
                  value={deletionReason}
                  onChange={(event) => setDeletionReason(event.target.value)}
                  placeholder={t("profile.deleteReasonPlaceholder")}
                />
              </MemberField>
              {deletionFeedback === "submitted" ? (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="success"
                  title={t("profile.deleteRequestSubmittedTitle")}
                  live="polite"
                >
                  {t("profile.deleteRequestSubmittedBody")}
                </MemberFeedbackPanel>
              ) : null}
              {deletionFeedback === "already-requested" ? (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="info"
                  title={t("profile.deleteAlreadyRequested")}
                  live="polite"
                >
                  {t("profile.deleteAlreadyRequestedBody")}
                </MemberFeedbackPanel>
              ) : null}
              {deletionFeedback === "error" ? (
                <MemberFeedbackPanel
                  ref={deletionFeedbackRef}
                  variant="error"
                  title={t("profile.deleteRequestError")}
                  live="assertive"
                >
                  <p>{t("profile.deleteRequestErrorBody")}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setDeletionDialogOpen(true)}
                      className="btn-outline min-h-11"
                    >
                      {t("common.retry")}
                    </button>
                    <Link
                      to="/support"
                      className="inline-flex min-h-11 items-center font-semibold text-navy underline underline-offset-2"
                    >
                      {t("profile.deleteRequestSupport")}
                    </Link>
                  </div>
                </MemberFeedbackPanel>
              ) : null}
              <button
                ref={deletionTriggerRef}
                id="account-delete-request"
                type="button"
                disabled={
                  deletion.isPending ||
                  deletionFeedback === "submitted" ||
                  deletionFeedback === "already-requested"
                }
                onClick={() => setDeletionDialogOpen(true)}
                className="btn-ghost member-account-action member-danger-zone__action border-destructive/30 text-destructive hover:btn-ghost-hover hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deletion.isPending
                  ? t("profile.deleteRequestSubmitting")
                  : t("profile.deleteRequest")}
              </button>
            </div>
          </MemberSection>
        </div>
      ) : null}

      <AlertDialog
        open={deletionDialogOpen}
        onOpenChange={(open) => {
          if (!open && deletion.isPending) return;
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
                submitDeletionRequest();
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
