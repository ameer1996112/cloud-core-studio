import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudioSettingsFull, updateStudioSettings } from "@/lib/studioSettings.functions";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Field, SectionTitle, CardSkeleton } from "@/components/admin-shared";
import { LANGUAGES } from "@/lib/messageTemplate";
import { friendlyErrorMessage } from "@/lib/error-messages";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Studio settings — Admin" }] }),
  component: Page,
});

type FormState = any;

/* ---------- validation helpers ---------- */
const isEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => !v || /^\+?[0-9][0-9\s-]{5,}$/.test(v.trim());
const isUrl = (v: string) => !v || /^https?:\/\/.+\..+/.test(v.trim());
const waDigits = (v?: string | null) => (v ?? "").replace(/[^0-9]/g, "");

function Page() {
  const getFn = useServerFn(getStudioSettingsFull);
  const upFn = useServerFn(updateStudioSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["studio-settings-full"], queryFn: () => getFn() });
  const [f, setF] = useState<FormState>(null);

  useEffect(() => {
    if (data && !f) {
      setF({
        ...data,
        rooms: (data.rooms ?? []).join(", "),
        energy_labels: (data.energy_labels ?? []).join(", "),
        supported_languages: (data.supported_languages ?? ["he", "ar", "en"]).join(","),
      });
    }
  }, [data]);

  const errors = useMemo(() => {
    if (!f) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!f.studio_name?.trim()) e.studio_name = "Studio name is required";
    if (f.contact_email && !isEmail(f.contact_email))
      e.contact_email = "Enter a valid email address";
    if (f.public_phone && !isPhone(f.public_phone))
      e.public_phone = "Use international format, e.g. +972…";
    if (f.whatsapp_number && !isPhone(f.whatsapp_number))
      e.whatsapp_number = "Use international format, e.g. +972…";
    if (f.instagram_url && !isUrl(f.instagram_url)) e.instagram_url = "Must start with https://";
    if (f.website_url && !isUrl(f.website_url)) e.website_url = "Must start with https://";
    if (f.logo_url && !isUrl(f.logo_url)) e.logo_url = "Must start with https://";
    if (f.fallback_image_url && !isUrl(f.fallback_image_url))
      e.fallback_image_url = "Must start with https://";
    return e;
  }, [f]);

  const hasErrors = Object.keys(errors).length > 0;

  const save = useMutation({
    mutationFn: () =>
      upFn({
        data: {
          studio_name: f.studio_name,
          public_phone: f.public_phone || null,
          whatsapp_number: f.whatsapp_number || null,
          contact_email: f.contact_email || null,
          address: f.address || null,
          instagram_url: f.instagram_url || null,
          website_url: f.website_url || null,
          currency: f.currency || "ILS",
          timezone: f.timezone || "Asia/Jerusalem",
          supported_languages: f.supported_languages
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
          default_language: f.default_language || "en",
          default_cancellation_window_hours: +f.default_cancellation_window_hours,
          default_capacity: +f.default_capacity,
          default_credit_cost: +f.default_credit_cost,
          booking_window_days: +f.booking_window_days,
          registration_closes_minutes: +f.registration_closes_minutes,
          allow_waitlist: !!f.allow_waitlist,
          auto_promote_waitlist: !!f.auto_promote_waitlist,
          waitlist_claim_window_minutes: +f.waitlist_claim_window_minutes,
          trial_class_allowed: !!f.trial_class_allowed,
          whatsapp_enabled: !!f.whatsapp_enabled,
          email_enabled: !!f.email_enabled,
          logo_url: f.logo_url || null,
          fallback_image_url: f.fallback_image_url || null,
          welcome_text: f.welcome_text || null,
          announcement_text: f.announcement_text || null,
          rooms: f.rooms
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
          energy_labels: f.energy_labels
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
          payments_enabled: !!f.payments_enabled,
          payments_provider: f.payments_provider || "none",
          payments_mode: f.payments_mode || "test",
          payments_success_url: f.payments_success_url || null,
          payments_cancel_url: f.payments_cancel_url || null,
          receipt_prefix: f.receipt_prefix || "CC",
          receipt_footer_note: f.receipt_footer_note || null,
          invoice_provider: f.invoice_provider || "none",
        },
      }),
    onSuccess: () => {
      toast.success("Studio settings saved");
      qc.invalidateQueries({ queryKey: ["studio-settings-full"] });
      qc.invalidateQueries({ queryKey: ["public-studio-settings"] });
    },
    onError: (e: any) => toast.error(friendlyErrorMessage(e, "Could not save settings")),
  });

  if (!f) return <CardSkeleton rows={4} />;

  const set = (patch: Partial<FormState>) => setF({ ...f, ...patch });

  const waNumberPreview = f.whatsapp_number || f.public_phone || "";
  const waLink = waDigits(waNumberPreview) ? `https://wa.me/${waDigits(waNumberPreview)}` : "";
  const packageMsg = `Hi ${f.studio_name || "the studio"} — I'd like to renew or change my package.`;

  return (
    <div className="max-w-5xl space-y-10 pb-32">
      {/* ===== Editorial header ===== */}
      <header className="space-y-3">
        <p className="eyebrow text-[10px]">Admin · configuration</p>
        <SectionTitle>Studio configuration</SectionTitle>
        <p className="text-sm text-slate max-w-2xl leading-relaxed">
          Identity, booking rhythm, communications, and the on-brand look of the member app. Changes
          save once and cascade across the booking flow, member dashboard, and outgoing messages.
        </p>
      </header>

      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (!hasErrors) save.mutate();
        }}
      >
        {/* ============ A · STUDIO IDENTITY ============ */}
        <Section
          eyebrow="Section 01"
          title="Studio identity"
          helper="Public name, contact channels, and the languages your members can choose from. These power the member app header, share links, and message templates."
        >
          <Grid>
            <FieldRow label="Studio name" required error={errors.studio_name}>
              <input
                className="editorial-input"
                value={f.studio_name ?? ""}
                onChange={(e) => set({ studio_name: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="Public phone"
              error={errors.public_phone}
              hint="Shown on member app, used as call-back fallback."
            >
              <input
                className="editorial-input"
                inputMode="tel"
                value={f.public_phone ?? ""}
                onChange={(e) => set({ public_phone: e.target.value })}
                placeholder="+972 50 000 0000"
              />
            </FieldRow>
            <FieldRow
              label="WhatsApp number"
              error={errors.whatsapp_number}
              hint="Used by all copy-to-WhatsApp actions and member contact buttons."
            >
              <input
                className="editorial-input"
                inputMode="tel"
                value={f.whatsapp_number ?? ""}
                onChange={(e) => set({ whatsapp_number: e.target.value })}
                placeholder="+972 50 000 0000"
              />
            </FieldRow>
            <FieldRow label="Contact email" error={errors.contact_email}>
              <input
                type="email"
                className="editorial-input"
                value={f.contact_email ?? ""}
                onChange={(e) => set({ contact_email: e.target.value })}
                placeholder="hello@studio.com"
              />
            </FieldRow>
            <FieldRow label="Address" full>
              <input
                className="editorial-input"
                value={f.address ?? ""}
                onChange={(e) => set({ address: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Instagram URL" error={errors.instagram_url}>
              <input
                className="editorial-input"
                value={f.instagram_url ?? ""}
                onChange={(e) => set({ instagram_url: e.target.value })}
                placeholder="https://instagram.com/…"
              />
            </FieldRow>
            <FieldRow label="Website URL" error={errors.website_url}>
              <input
                className="editorial-input"
                value={f.website_url ?? ""}
                onChange={(e) => set({ website_url: e.target.value })}
                placeholder="https://…"
              />
            </FieldRow>
            <FieldRow label="Currency">
              <input
                className="editorial-input"
                value={f.currency ?? "ILS"}
                onChange={(e) => set({ currency: e.target.value.toUpperCase() })}
                placeholder="ILS"
              />
            </FieldRow>
            <FieldRow label="Timezone">
              <input
                className="editorial-input"
                value={f.timezone ?? "Asia/Jerusalem"}
                onChange={(e) => set({ timezone: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Supported languages" hint="Comma-separated codes — e.g. he, ar, en">
              <input
                className="editorial-input"
                value={f.supported_languages}
                onChange={(e) => set({ supported_languages: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Default message language">
              <select
                className="editorial-input"
                value={f.default_language ?? "en"}
                onChange={(e) => set({ default_language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          </Grid>
        </Section>

        {/* ============ B · BOOKING RULES ============ */}
        <Section
          eyebrow="Section 02"
          title="Booking rules"
          helper="The rhythm of how members can plan, register, and cancel. Tighter windows protect instructors; looser windows feel more generous."
        >
          <Grid>
            <FieldRow label="Cancellation deadline" hint="Hours before class.">
              <NumberInput
                value={f.default_cancellation_window_hours}
                onChange={(v) => set({ default_cancellation_window_hours: v })}
                min={0}
              />
            </FieldRow>
            <FieldRow label="Booking window" hint="Days a member can book ahead.">
              <NumberInput
                value={f.booking_window_days}
                onChange={(v) => set({ booking_window_days: v })}
                min={1}
                max={180}
              />
            </FieldRow>
            <FieldRow label="Registration closes" hint="Minutes before the class starts.">
              <NumberInput
                value={f.registration_closes_minutes}
                onChange={(v) => set({ registration_closes_minutes: v })}
                min={0}
              />
            </FieldRow>
            <FieldRow label="Default class capacity">
              <NumberInput
                value={f.default_capacity}
                onChange={(v) => set({ default_capacity: v })}
                min={1}
              />
            </FieldRow>
            <FieldRow
              label="Default credit cost"
              hint="Credits per spot when a class doesn't override it."
            >
              <NumberInput
                value={f.default_credit_cost}
                onChange={(v) => set({ default_credit_cost: v })}
                min={0}
              />
            </FieldRow>
          </Grid>
          <Divider />
          <Toggles>
            <Toggle
              label="Trial class allowed"
              hint="Members without an active package can take one introductory class."
              checked={f.trial_class_allowed}
              onChange={(v) => set({ trial_class_allowed: v })}
            />
          </Toggles>
        </Section>

        {/* ============ C · WAITLIST ============ */}
        <Section
          eyebrow="Section 03"
          title="Waitlist rules"
          helper="When a class is full, the waitlist captures interest. Auto-promote prepares offers but admin still confirms before a spot is given."
        >
          <Grid>
            <FieldRow label="Claim window" hint="Minutes a member has to confirm an offered spot.">
              <NumberInput
                value={f.waitlist_claim_window_minutes}
                onChange={(v) => set({ waitlist_claim_window_minutes: v })}
                min={0}
              />
            </FieldRow>
          </Grid>
          <Divider />
          <Toggles>
            <Toggle
              label="Waitlist enabled"
              hint="Members can join a waitlist when a class is full."
              checked={f.allow_waitlist}
              onChange={(v) => set({ allow_waitlist: v })}
            />
            <Toggle
              label="Auto-prepare waitlist offers"
              hint="As spots free up, the next member is queued as an offer — admin confirms the actual promotion."
              checked={f.auto_promote_waitlist}
              onChange={(v) => set({ auto_promote_waitlist: v })}
            />
          </Toggles>
        </Section>

        {/* ============ D · COMMUNICATIONS ============ */}
        <Section
          eyebrow="Section 04"
          title="Communications"
          helper="How reminders, confirmations, and admin nudges reach members. Today messages are prepared as copy-ready WhatsApp / email text — external sending APIs plug in here later."
        >
          <Toggles>
            <Toggle
              label="WhatsApp channel"
              hint="Enables copy-to-WhatsApp throughout the admin app."
              checked={f.whatsapp_enabled}
              onChange={(v) => set({ whatsapp_enabled: v })}
            />
            <Toggle
              label="Email channel"
              hint="Enables copy-to-email previews for confirmations and broadcasts."
              checked={f.email_enabled}
              onChange={(v) => set({ email_enabled: v })}
            />
          </Toggles>
          <Divider />
          <div className="space-y-2 rounded-md border border-gold/20 bg-sand/30 p-4">
            <p className="eyebrow text-[10px] text-navy/70">Coming later</p>
            <p className="text-xs text-slate leading-relaxed">
              Automated WhatsApp Cloud API and transactional email providers will appear in this
              section. Today every outgoing message routes through the studio's WhatsApp number
              above.
            </p>
          </div>
        </Section>

        {/* ============ E · BRANDING & MEMBER APP ============ */}
        <Section
          eyebrow="Section 05"
          title="Branding & member app"
          helper="Visual identity inside the member app and the warmth members feel when they open it."
        >
          <Grid>
            <FieldRow label="Logo URL" error={errors.logo_url}>
              <input
                className="editorial-input"
                value={f.logo_url ?? ""}
                onChange={(e) => set({ logo_url: e.target.value })}
                placeholder="https://…"
              />
            </FieldRow>
            <FieldRow
              label="Class card fallback image"
              error={errors.fallback_image_url}
              hint="Used when a class has no cover image."
            >
              <input
                className="editorial-input"
                value={f.fallback_image_url ?? ""}
                onChange={(e) => set({ fallback_image_url: e.target.value })}
                placeholder="https://…"
              />
            </FieldRow>
            <FieldRow
              label="Member welcome text"
              full
              hint="Short note that greets members on their dashboard."
            >
              <textarea
                rows={2}
                className="editorial-input"
                value={f.welcome_text ?? ""}
                onChange={(e) => set({ welcome_text: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="Studio announcement"
              full
              hint="Appears at the top of the member home. Leave blank to hide."
            >
              <textarea
                rows={2}
                className="editorial-input"
                value={f.announcement_text ?? ""}
                onChange={(e) => set({ announcement_text: e.target.value })}
              />
            </FieldRow>
          </Grid>
        </Section>

        {/* ============ F · LEGACY LISTS ============ */}
        <Section
          eyebrow="Section 06"
          title="Legacy lists"
          helper="Older free-text lists kept for the class builder. Rooms and energy labels have proper tables now — these chips remain as a fallback."
        >
          <FieldRow
            label="Studio rooms"
            full
            hint="Comma-separated — used as quick chips in older flows."
          >
            <input
              className="editorial-input"
              value={f.rooms}
              onChange={(e) => set({ rooms: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="Energy labels" full hint="Comma-separated.">
            <input
              className="editorial-input"
              value={f.energy_labels}
              onChange={(e) => set({ energy_labels: e.target.value })}
            />
          </FieldRow>
        </Section>

        {/* ============ G · PAYMENTS (provider-neutral foundation) ============ */}
        <Section
          eyebrow="Section 07"
          title="Online payments"
          helper="Online checkout is not connected yet. Manual payments (cash / Bit / card / bank transfer) and payment receipts already work through Admin → Payments."
        >
          <Grid>
            <FieldRow
              label="Payments provider"
              hint="Choose how money reaches the studio. Online providers light up once they're connected."
            >
              <select
                className="editorial-input"
                value={f.payments_provider ?? "none"}
                onChange={(e) => set({ payments_provider: e.target.value })}
              >
                <option value="none">None — request only (active)</option>
                <option value="manual">Manual — cash / Bit / transfer (active)</option>
                <option value="stripe" disabled>
                  Stripe — coming later
                </option>
                <option value="paddle" disabled>
                  Paddle — coming later
                </option>
              </select>
            </FieldRow>
            <FieldRow label="Mode">
              <select
                className="editorial-input"
                value={f.payments_mode ?? "test"}
                onChange={(e) => set({ payments_mode: e.target.value })}
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </FieldRow>
            <FieldRow
              label="Receipt number prefix"
              hint="Used as the prefix on every issued receipt, e.g. CC-2026-01001."
            >
              <input
                className="editorial-input"
                maxLength={8}
                value={f.receipt_prefix ?? "CC"}
                onChange={(e) => set({ receipt_prefix: e.target.value.toUpperCase() })}
              />
            </FieldRow>
            <FieldRow
              label="Israeli invoice provider"
              hint="A legal חשבונית מס requires an approved Israeli invoicing service. Connection wiring is coming later."
            >
              <select
                className="editorial-input"
                value={f.invoice_provider ?? "none"}
                onChange={(e) => set({ invoice_provider: e.target.value })}
              >
                <option value="none">None — payment receipts only (active)</option>
                <option value="greeninvoice" disabled>
                  Green Invoice — coming later
                </option>
                <option value="icount" disabled>
                  iCount — coming later
                </option>
                <option value="ezcount" disabled>
                  EZcount — coming later
                </option>
              </select>
            </FieldRow>
            <FieldRow
              label="Success URL"
              hint="Where members return after a successful checkout."
              full
            >
              <input
                className="editorial-input"
                value={f.payments_success_url ?? ""}
                onChange={(e) => set({ payments_success_url: e.target.value })}
                placeholder="https://app.example.com/member/packages/success"
              />
            </FieldRow>
            <FieldRow label="Cancel URL" full>
              <input
                className="editorial-input"
                value={f.payments_cancel_url ?? ""}
                onChange={(e) => set({ payments_cancel_url: e.target.value })}
                placeholder="https://app.example.com/member/packages/cancelled"
              />
            </FieldRow>
            <FieldRow
              label="Receipt footer note"
              full
              hint="Optional small text printed at the bottom of each receipt."
            >
              <textarea
                rows={2}
                className="editorial-input"
                value={f.receipt_footer_note ?? ""}
                onChange={(e) => set({ receipt_footer_note: e.target.value })}
                placeholder="Thank you for practising with us."
              />
            </FieldRow>
          </Grid>
          <Divider />
          <Toggles>
            <Toggle
              label="Online payments enabled"
              hint="Reserved for when an online provider (Stripe / Paddle) is connected. Turning this on today does not start live card payments — manual recording continues either way."
              checked={!!f.payments_enabled}
              onChange={(v) => set({ payments_enabled: v })}
            />
          </Toggles>
          <div className="space-y-2 rounded-md border border-gold/20 bg-sand/30 p-4">
            <p className="eyebrow text-[10px] text-navy/70">Heads up</p>
            <p className="text-xs text-slate leading-relaxed">
              Receipts issued by this app are <strong>payment receipts</strong>, not legal Israeli
              tax invoices (חשבונית מס). To issue compliant invoices, connect Green Invoice / iCount
              / EZcount in a future pass. Until then, your accountant should issue formal invoices
              from those records.
            </p>
          </div>
        </Section>

        {/* ============ G · MEMBER-FACING PREVIEW ============ */}
        <Section
          eyebrow="Preview"
          title="Member-facing preview"
          helper="A quick look at the public values members will see. Save the form to update them everywhere."
        >
          <div className="grid md:grid-cols-3 gap-5">
            <PreviewCard label="WhatsApp contact">
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-navy underline decoration-gold/60 underline-offset-4 break-all text-sm"
                >
                  {waLink}
                </a>
              ) : (
                <span className="text-slate text-sm italic">
                  Add a WhatsApp number to enable contact buttons.
                </span>
              )}
            </PreviewCard>
            <PreviewCard label="Studio announcement">
              {f.announcement_text ? (
                <p className="text-sm text-navy leading-relaxed">{f.announcement_text}</p>
              ) : (
                <span className="text-slate text-sm italic">
                  No announcement set — the banner is hidden on member home.
                </span>
              )}
            </PreviewCard>
            <PreviewCard label="Package request message">
              <p className="text-sm text-navy leading-relaxed whitespace-pre-wrap">{packageMsg}</p>
            </PreviewCard>
          </div>
        </Section>

        {/* ============ STICKY SAVE BAR ============ */}
        <div className="fixed inset-x-0 bottom-0 md:left-64 z-30 border-t border-gold/30 bg-ivory/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-5 md:px-12 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-slate hidden sm:block">
              {hasErrors
                ? `${Object.keys(errors).length} field${Object.keys(errors).length > 1 ? "s" : ""} need attention before saving.`
                : "All changes save together."}
            </p>
            <button
              type="submit"
              disabled={save.isPending || hasErrors}
              className="btn-navy disabled:opacity-50 disabled:cursor-not-allowed min-h-12 px-6 w-full sm:w-auto"
            >
              {save.isPending ? "Saving…" : "Save studio settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- presentational sub-components ---------- */
function Section({
  eyebrow,
  title,
  helper,
  children,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="editorial-panel p-6 md:p-9 space-y-6">
      <header className="space-y-2">
        <p className="eyebrow text-[10px] text-gold/80">{eyebrow}</p>
        <h3 className="font-display italic text-2xl md:text-3xl text-navy leading-tight">
          {title}
        </h3>
        {helper && <p className="text-sm text-slate max-w-2xl leading-relaxed">{helper}</p>}
        <div className="h-px w-10 bg-gold/50 mt-3" />
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">{children}</div>;
}

function FieldRow({
  label,
  hint,
  error,
  full,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Field label={required ? `${label} *` : label}>{children}</Field>
      {error ? (
        <p className="text-xs text-destructive mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate mt-1.5 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number | string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className="editorial-input"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Divider() {
  return <div className="h-px w-full bg-gold/20" />;
}

function Toggles({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span className="relative inline-flex h-6 w-11 shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-sand border border-gold/30 transition-colors peer-checked:bg-navy peer-checked:border-navy" />
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-ivory shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="flex-1 -mt-px">
        <span className="block text-sm text-navy">{label}</span>
        {hint && <span className="block text-xs text-slate mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gold/25 bg-ivory p-4 space-y-2 min-h-[6rem]">
      <p className="eyebrow text-[10px] text-navy/70">{label}</p>
      <div>{children}</div>
    </div>
  );
}
