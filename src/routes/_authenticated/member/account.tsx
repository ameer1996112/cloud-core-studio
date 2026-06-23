import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { LogOut, Save } from "lucide-react";
import { getMyPackages, updateMyProfile } from "@/lib/member.functions";
import { supabase } from "@/integrations/supabase/client";
import { flushSync } from "react-dom";
import { t, useI18n, getLocale } from "@/lib/i18n";
import { studioImages, localizedAlt } from "@/lib/image-assets";

export const Route = createFileRoute("/_authenticated/member/account")({
  head: () => ({ meta: [{ title: "פרופיל — Cloud & Core" }] }),
  component: MemberAccount,
});

function MemberAccount() {
  useI18n();
  const fetchPkg = useServerFn(getMyPackages);
  const updateFn = useServerFn(updateMyProfile);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["member-packages"], queryFn: () => fetchPkg() });
  const me = data?.member as any;

  const [form, setForm] = useState<any>({});
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

  const val = (k: string) => (form[k] !== undefined ? form[k] : (me?.[k] ?? ""));
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function signOut() {
    flushSync(() => setSigningOut(true));
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <section className="space-y-8 max-w-2xl mx-auto pb-10">
      {/* Studio identity card */}
      <div className="member-profile-banner rounded-[20px] border border-gold/30 bg-sand/60">
        <img
          src={studioImages.logoWall.src}
          alt={localizedAlt(studioImages.logoWall, getLocale())}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="member-card member-panel-sand p-6">
        <p className="member-eyebrow">{t("profile.memberSince")}</p>
        <p className="font-display italic text-2xl text-navy mt-2 capitalize">{me?.name ?? "—"}</p>
        <p className="text-sm text-slate mt-1">{me?.email ?? ""}</p>
        <div className="mt-3 flex gap-3">
          <span className="member-chip">{me?.status ?? "active"}</span>
          {me?.preferred_language && (
            <span className="member-chip">{me.preferred_language.toUpperCase()}</span>
          )}
        </div>
      </div>

      <div className="member-card p-6 space-y-4">
        <h2 className="font-display italic text-2xl text-navy">{t("profile.details")}</h2>

        <Field label={t("profile.name")}>
          <input
            className="editorial-input"
            value={val("name")}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label={t("profile.phone")}>
          <input
            className="editorial-input"
            value={val("phone") ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label={t("profile.language")}>
          <select
            className="editorial-input"
            value={val("preferred_language") || "he"}
            onChange={(e) => set("preferred_language", e.target.value)}
          >
            <option value="en">English</option>
            <option value="he">עברית</option>
            <option value="ar">العربية</option>
          </select>
        </Field>
        <Field label={t("profile.emergency")}>
          <input
            className="editorial-input"
            value={val("emergency_contact") ?? ""}
            onChange={(e) => set("emergency_contact", e.target.value)}
            placeholder={t("profile.emergencyPlaceholder")}
          />
        </Field>
        <Field label={t("profile.energy")}>
          <input
            className="editorial-input"
            value={val("energy_preference") ?? ""}
            onChange={(e) => set("energy_preference", e.target.value)}
            placeholder={t("profile.energyPlaceholder")}
          />
        </Field>

        <div className="pt-3 border-t hairline flex justify-end">
          <button
            disabled={update.isPending || Object.keys(form).length === 0}
            onClick={() => update.mutate()}
            className="btn-navy hover:btn-navy-hover disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> {update.isPending ? t("common.saving") : t("profile.save")}
          </button>
        </div>
      </div>

      <div className="member-card p-6 flex items-center justify-between">
        <div>
          <p className="font-display italic text-xl text-navy">{t("shell.signOut")}</p>
          <p className="text-xs text-slate mt-1">{t("profile.endSession")}</p>
        </div>
        <button onClick={signOut} disabled={signingOut} className="btn-ghost hover:btn-ghost-hover">
          <LogOut className="h-3 w-3" /> {t("shell.signOut")}
        </button>
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
