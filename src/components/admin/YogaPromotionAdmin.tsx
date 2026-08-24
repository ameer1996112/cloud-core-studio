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
  classIds: string[];
};

export function YogaPromotionAdmin() {
  const getPromotion = useServerFn(getYogaPromotionAdmin);
  const updatePromotion = useServerFn(updateYogaPromotionAdmin);
  const adjustEntitlement = useServerFn(adjustYogaPromotionEntitlement);
  const qc = useQueryClient();
  const { data: response } = useQuery({ queryKey, queryFn: () => getPromotion() });
  const data = response as YogaPromotionAdminData | undefined;
  const [form, setForm] = useState<PromotionAdminForm | null>(null);

  useEffect(() => {
    if (!data || form) return;
    setForm({
      enabled: data.campaign.enabled,
      startsAt: toJerusalemInput(data.campaign.starts_at),
      endsAt: toJerusalemInput(data.campaign.ends_at),
      creditExpiresAt: toJerusalemInput(data.campaign.credit_expires_at),
      claimLimit: data.campaign.claim_limit,
      programTypeIds: data.eligibleProgramTypeIds,
      classIds: data.eligibleClassIds,
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: () =>
      updatePromotion({
        data: {
          enabled: Boolean(form.enabled),
          startsAt: jerusalemInputToIso(form.startsAt),
          endsAt: jerusalemInputToIso(form.endsAt),
          creditExpiresAt: jerusalemInputToIso(form.creditExpiresAt),
          claimLimit: Number(form.claimLimit),
          programTypeIds: form.programTypeIds,
          classIds: form.classIds,
        },
      }),
    onSuccess: async () => {
      toast.success("Promotion configuration saved");
      await qc.invalidateQueries({ queryKey });
      setForm(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Save failed"),
  });
  const adjust = useMutation({
    mutationFn: (input: { entitlementId: string; action: "revoke" | "restore" }) => {
      const reason = window.prompt("Required audit reason");
      if (!reason) throw new Error("A reason is required");
      return adjustEntitlement({ data: { ...input, reason } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adjustment failed"),
  });

  if (!data || !form) return null;
  return (
    <section className="settings-card" data-testid="yoga-promo-admin">
      <header className="settings-card-header">
        <h2 className="settings-card-title">Yoga with Lina launch promotion</h2>
        <p className="settings-card-helper">
          Asia/Jerusalem · production remains off until you explicitly enable it.
        </p>
      </header>
      <div className="settings-card-body space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(data.metrics).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gold/20 bg-ivory/65 p-3">
              <p className="text-xs uppercase tracking-wider text-slate">{label}</p>
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
            <span className="settings-toggle-label">Campaign enabled</span>
            <span className="settings-toggle-hint">
              Keep this off until staging verification and approval.
            </span>
          </span>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label="Starts at"
            value={form.startsAt}
            onChange={(value) => setForm({ ...form, startsAt: value })}
          />
          <DateField
            label="Ends at"
            value={form.endsAt}
            onChange={(value) => setForm({ ...form, endsAt: value })}
          />
          <DateField
            label="Credit expires at"
            value={form.creditExpiresAt}
            onChange={(value) => setForm({ ...form, creditExpiresAt: value })}
          />
          <label className="settings-field">
            <span className="settings-label">Claim limit</span>
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
          <p className="settings-label">Eligible class type</p>
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
                {type.name_he} · {type.name_ar} · {type.name_en}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="settings-label">Eligible exact class</p>
          <p className="mt-1 text-xs text-slate">
            When selected, the gift credit cannot be used for any other session—even another session
            of the same Yoga class type.
          </p>
          <div className="mt-2 grid gap-2">
            {data.classes.map((cls) => (
              <label
                key={cls.id}
                className="flex items-center gap-3 rounded-xl border border-gold/20 p-3 text-sm text-navy"
              >
                <input
                  type="radio"
                  name="yoga-promotion-class"
                  checked={form.classIds.includes(cls.id)}
                  onChange={() => setForm({ ...form, classIds: [cls.id] })}
                />
                <span>
                  <span className="font-semibold">{cls.title}</span>
                  <span className="ms-2" dir="ltr">
                    {new Date(cls.starts_at).toLocaleString(undefined, {
                      timeZone: ADMIN_TIME_ZONE,
                    })}
                  </span>
                </span>
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
          {save.isPending ? "Saving…" : "Save promotion"}
        </button>
        {data.entitlements.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-slate">
                  <th className="p-2">Issued</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Member ID</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.entitlements.map((entitlement) => (
                  <tr key={entitlement.id} className="border-t border-gold/15">
                    <td className="p-2" dir="ltr">
                      {new Date(entitlement.issued_at).toLocaleString(undefined, {
                        timeZone: ADMIN_TIME_ZONE,
                      })}
                    </td>
                    <td className="p-2">{entitlement.status}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">
                      {entitlement.member_id}
                    </td>
                    <td className="p-2">
                      <button
                        className="btn-outline text-xs"
                        onClick={() =>
                          adjust.mutate({
                            entitlementId: entitlement.id,
                            action: entitlement.status === "revoked" ? "restore" : "revoke",
                          })
                        }
                      >
                        {entitlement.status === "revoked" ? "Restore" : "Revoke"}
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
            Audit trail ({data.audit.length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs text-slate">
            {data.audit.map((row) => (
              <li key={row.id}>
                {new Date(row.created_at).toLocaleString(undefined, {
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
