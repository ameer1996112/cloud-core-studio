import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { LogOut, Save, Trash2 } from "lucide-react";
import { getMyPackages, requestMyAccountDeletion, updateMyProfile } from "@/lib/member.functions";
import { supabase } from "@/integrations/supabase/client";
import { flushSync } from "react-dom";
import { applyLang, labelForStatus, t, useI18n, getLocale, type Lang } from "@/lib/i18n";
import { studioImages, localizedAlt } from "@/lib/image-assets";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LtrInline } from "@/components/ui/bidi";

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

export const Route = createFileRoute("/_authenticated/member/account")({
  component: MemberAccount,
});

function MemberAccount() {
  const { lang, dir } = useI18n();
  useDocumentTitle("page.profile.title");
  const fetchPkg = useServerFn(getMyPackages);
  const updateFn = useServerFn(updateMyProfile);
  const deleteFn = useServerFn(requestMyAccountDeletion);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["member-packages"], queryFn: () => fetchPkg() });
  const me = data?.member as MemberProfile | undefined;

  const [form, setForm] = useState<ProfileForm>({});
  const [deletionReason, setDeletionReason] = useState("");
  const [signingOut, setSigningOut] = useState(false);

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
    onSuccess: (result: DeletionResult) => {
      setDeletionReason("");
      toast.success(
        result?.duplicate ? t("profile.deleteAlreadyRequested") : t("profile.deleteRequestSent"),
      );
    },
    onError: (e) => toast.error(friendlyErrorMessage(e, t("profile.deleteRequestError"))),
  });

  const val = <K extends keyof ProfileForm>(k: K) =>
    form[k] !== undefined ? form[k] : (me?.[k] ?? "");
  const set = <K extends keyof ProfileForm>(k: K, v: NonNullable<ProfileForm[K]>) =>
    setForm((f) => ({ ...f, [k]: v }));
  const selectedLanguage = (form.preferred_language ?? lang) as Lang;

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

  return (
    <section dir={dir} className="member-page w-full space-y-6 sm:space-y-8 pb-10">
      <div className="member-page-panel grid overflow-hidden md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="member-page-copy p-5 sm:p-8">
          <p className="member-eyebrow">{t("member.account.kicker")}</p>
          <h1 className="member-page-title mt-3 capitalize">{me?.name ?? t("nav.profile")}</h1>
          <p className="member-page-body mt-3">
            {me?.email ? (
              <LtrInline className="inline-block">{me.email}</LtrInline>
            ) : (
              t("member.account.body")
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="member-chip">{labelForStatus(me?.status ?? "active")}</span>
            <span className="member-chip">{selectedLanguage.toUpperCase()}</span>
          </div>
        </div>
        <div className="relative min-h-[150px] sm:min-h-[180px] md:min-h-[190px] border-t border-gold/20 bg-sand/60 md:border-s md:border-t-0">
          <img
            src={studioImages.logoWall.src}
            alt={localizedAlt(studioImages.logoWall, getLocale())}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-navy/10"
          />
        </div>
      </div>

      <div className="member-card p-5 sm:p-6 space-y-4">
        <div className="member-section-heading flex flex-row justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="member-section-title">{t("profile.details")}</h2>
          </div>
          {me?.created_at && (
            <div className="text-xs bg-gold/10 text-gold border border-gold/20 px-3 py-1 rounded-full font-medium tracking-wide">
              {t("profile.memberSince")}{" "}
              <span className="font-semibold">
                {new Date(me.created_at).toLocaleDateString(getLocale() === "he" ? "he-IL" : "en-GB", {
                  year: "numeric",
                  month: "long",
                })}
              </span>
            </div>
          )}
        </div>

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

        <div className="pt-3 border-t hairline flex justify-start">
          <button
            disabled={update.isPending || Object.keys(form).length === 0}
            onClick={() => update.mutate()}
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> {update.isPending ? t("common.saving") : t("profile.save")}
          </button>
        </div>
      </div>

      <div className="member-card p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-xl text-navy">{t("shell.signOut")}</p>
          <p className="text-xs text-slate mt-1">{t("profile.endSession")}</p>
        </div>
        <button onClick={signOut} disabled={signingOut} className="btn-outline hover:btn-outline-hover">
          <LogOut className="h-3 w-3" /> {t("shell.signOut")}
        </button>
      </div>

      <div className="member-card p-5 sm:p-6 space-y-4">
        <div className="member-section-heading">
          <div>
            <p className="member-eyebrow">{t("profile.privacyKicker")}</p>
            <h2 className="member-section-title mt-1">{t("profile.privacyTitle")}</h2>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate">{t("profile.privacyBody")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
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
          <div className="mt-3 flex justify-start">
            <button
              disabled={deletion.isPending}
              onClick={() => deletion.mutate()}
              className="btn-ghost hover:btn-ghost-hover border-destructive/30 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              {deletion.isPending ? t("common.saving") : t("profile.deleteRequest")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
