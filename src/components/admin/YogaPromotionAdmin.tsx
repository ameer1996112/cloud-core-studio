import { useI18n, type MESSAGES } from "@/lib/i18n";
import { StaffFormDialog } from "@/components/admin/StaffFormDialog";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adjustYogaPromotionEntitlement,
  getYogaPromotionAdmin,
  updateYogaPromotionAdmin,
  type YogaPromotionAdminData,
} from "@/lib/yogaPromo.functions";

const queryKey = ["admin", "promotion", "yoga-lina-launch"] as const;
const ADMIN_TIME_ZONE = "Asia/Jerusalem";

type PromotionAdminForm = {
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  creditExpiresAt: string;
  claimLimit: number | string;
  programTypeIds: string[];
};

export function YogaPromotionAdmin() {
  const { t, lang, locale } = useI18n();
  const getPromotion = useServerFn(getYogaPromotionAdmin);
  const updatePromotion = useServerFn(updateYogaPromotionAdmin);
  const adjustEntitlement = useServerFn(adjustYogaPromotionEntitlement);
  const qc = useQueryClient();
  const {
    data: response,
    isError,
    refetch,
  } = useQuery({ queryKey, queryFn: () => getPromotion() });
  const data = response as YogaPromotionAdminData | undefined;
  const [form, setForm] = useState<PromotionAdminForm | null>(null);
  const [adjustment, setAdjustment] = useState<{
    entitlementId: string;
    action: "revoke" | "restore";
  } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!data || form) return;
    setForm({
      enabled: data.campaign.enabled,
      startsAt: toJerusalemInput(data.campaign.starts_at),
      endsAt: toJerusalemInput(data.campaign.ends_at),
      creditExpiresAt: toJerusalemInput(data.campaign.credit_expires_at),
      claimLimit: data.campaign.claim_limit,
      programTypeIds: data.eligibleProgramTypeIds,
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error(t("promoAdmin.saveError"));
      return updatePromotion({
        data: {
          enabled: Boolean(form.enabled),
          startsAt: jerusalemInputToIso(form.startsAt),
          endsAt: jerusalemInputToIso(form.endsAt),
          creditExpiresAt: jerusalemInputToIso(form.creditExpiresAt),
          claimLimit: Number(form.claimLimit),
          programTypeIds: form.programTypeIds,
        },
      });
    },
    onSuccess: async () => {
      toast.success(t("promoAdmin.saved"));
      await qc.invalidateQueries({ queryKey });
      setForm(null);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("promoAdmin.saveError")),
  });
  const adjust = useMutation({
    mutationFn: (input: {
      entitlementId: string;
      action: "revoke" | "restore";
      reason: string;
    }) => {
      if (!input.reason.trim()) throw new Error(t("promoAdmin.reasonRequired"));
      return adjustEntitlement({ data: input });
    },
    onSuccess: () => {
      setAdjustment(null);
      setReason("");
      return qc.invalidateQueries({ queryKey });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("promoAdmin.adjustError")),
  });

  if (isError)
    return (
      <section className="settings-card p-5" role="alert">
        <p>{t("staff.loadError")}</p>
        <button className="btn-outline mt-3" onClick={() => refetch()}>
          {t("common.retry")}
        </button>
      </section>
    );
  if (!data || !form)
    return (
      <div
        className="settings-card h-48 animate-pulse"
        role="status"
        aria-label={t("common.loading")}
      />
    );
  return (
    <section className="settings-card" data-testid="yoga-promo-admin">
      {adjustment && (
        <StaffFormDialog
          title={t(`promoAdmin.${adjustment.action}`)}
          onClose={() => {
            setAdjustment(null);
            setReason("");
          }}
        >
          <form
            className="p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              adjust.mutate({ ...adjustment, reason });
            }}
          >
            <h2 className="cc-section-title">{t(`promoAdmin.${adjustment.action}`)}</h2>
            <p className="text-sm text-slate">{t("promoAdmin.reasonHelp")}</p>
            <label className="grid gap-2">
              <span className="settings-label">{t("promoAdmin.auditReason")}</span>
              <textarea
                className="editorial-input min-h-24"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="btn-navy"
                disabled={adjust.isPending || !reason.trim()}
              >
                {t(`promoAdmin.${adjustment.action}`)}
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setAdjustment(null);
                  setReason("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </StaffFormDialog>
      )}
      <header className="settings-card-header">
        <h2 className="settings-card-title">{t("promoAdmin.title")}</h2>
        <p className="settings-card-helper">{t("promoAdmin.timezoneHelp")}</p>
      </header>
      <div className="settings-card-body space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Object.entries(data.metrics).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gold/20 bg-ivory/65 p-3">
              <p className="text-xs uppercase tracking-wider text-slate">
                {t(`promoAdmin.metric.${label}` as keyof typeof MESSAGES.en)}
              </p>
              <p className="mt-1 font-display text-2xl text-navy">{String(value)}</p>
            </div>
          ))}
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          />
          <span className="settings-toggle-copy">
            <span className="settings-toggle-label">{t("promoAdmin.enabled")}</span>
            <span className="settings-toggle-hint">{t("promoAdmin.enabledHelp")}</span>
          </span>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label={t("promoAdmin.starts")}
            value={form.startsAt}
            onChange={(value) => setForm({ ...form, startsAt: value })}
          />
          <DateField
            label={t("promoAdmin.ends")}
            value={form.endsAt}
            onChange={(value) => setForm({ ...form, endsAt: value })}
          />
          <DateField
            label={t("promoAdmin.expires")}
            value={form.creditExpiresAt}
            onChange={(value) => setForm({ ...form, creditExpiresAt: value })}
          />
          <label className="settings-field">
            <span className="settings-label">{t("promoAdmin.limit")}</span>
            <input
              className="settings-input"
              type="number"
              min={data.campaign.claimed_count}
              value={form.claimLimit}
              onChange={(event) => setForm({ ...form, claimLimit: event.target.value })}
            />
          </label>
        </div>
        <div>
          <p className="settings-label">{t("promoAdmin.eligible")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {data.programTypes.map((type) => (
              <label
                key={type.id}
                className="flex items-center gap-2 rounded-xl border border-gold/20 p-3 text-sm text-navy"
              >
                <input
                  type="checkbox"
                  checked={form.programTypeIds.includes(type.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      programTypeIds: event.target.checked
                        ? [...form.programTypeIds, type.id]
                        : form.programTypeIds.filter((id: string) => id !== type.id),
                    })
                  }
                />
                <bdi>{type[`name_${lang}`] || type.name_he}</bdi>
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="settings-save-button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t("promoAdmin.saving") : t("promoAdmin.save")}
        </button>
        {data.entitlements.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-slate">
                  <th className="p-2">{t("promoAdmin.issued")}</th>
                  <th className="p-2">{t("promoAdmin.status")}</th>
                  <th className="p-2">{t("promoAdmin.memberId")}</th>
                  <th className="p-2">{t("promoAdmin.action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.entitlements.map((entitlement) => (
                  <tr key={entitlement.id} className="border-t border-gold/15">
                    <td className="p-2" dir="ltr">
                      {new Date(entitlement.issued_at).toLocaleString(locale, {
                        timeZone: ADMIN_TIME_ZONE,
                      })}
                    </td>
                    <td className="p-2">
                      {t(`promoAdmin.status.${entitlement.status}` as keyof typeof MESSAGES.en)}
                    </td>
                    <td className="p-2 font-mono text-xs" dir="ltr">
                      {entitlement.member_id}
                    </td>
                    <td className="p-2">
                      <button
                        className="btn-outline text-xs"
                        onClick={() =>
                          setAdjustment({
                            entitlementId: entitlement.id,
                            action: entitlement.status === "revoked" ? "restore" : "revoke",
                          })
                        }
                      >
                        {entitlement.status === "revoked"
                          ? t("promoAdmin.restore")
                          : t("promoAdmin.revoke")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-navy">
            {t("promoAdmin.audit", { count: data.audit.length })}
          </summary>
          <ul className="mt-3 space-y-2 text-xs text-slate">
            {data.audit.map((row) => (
              <li key={row.id}>
                {new Date(row.created_at).toLocaleString(locale, {
                  timeZone: ADMIN_TIME_ZONE,
                })}{" "}
                · {row.action} · {row.reason ?? "—"}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field">
      <span className="settings-label">{label}</span>
      <input
        className="settings-input"
        type="datetime-local"
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function toJerusalemInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function jerusalemInputToIso(value: string) {
  if (!value) return null;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = desiredWallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const displayed = toJerusalemInput(new Date(instant).toISOString());
    const [shownDate, shownTime] = displayed.split("T");
    const [shownYear, shownMonth, shownDay] = shownDate.split("-").map(Number);
    const [shownHour, shownMinute] = shownTime.split(":").map(Number);
    instant +=
      desiredWallClock - Date.UTC(shownYear, shownMonth - 1, shownDay, shownHour, shownMinute);
  }
  return new Date(instant).toISOString();
}
