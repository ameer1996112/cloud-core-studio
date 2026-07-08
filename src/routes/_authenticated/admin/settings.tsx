import { createFileRoute } from "@tanstack/react-router";
import { createClientOnlyFn, useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudioSettingsFull, updateStudioSettings } from "@/lib/studioSettings.functions";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeader, CardSkeleton } from "@/components/admin-shared";
import { LANGUAGES } from "@/lib/messageTemplate";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: Page,
});

type FormState = any;

const registerAdminPushFromSettings = createClientOnlyFn(() =>
  import("@/lib/adminPush.client").then(({ maybeRegisterAdminPushNotifications }) =>
    maybeRegisterAdminPushNotifications(),
  ),
);

const technicalTextProps = {
  dir: "ltr" as const,
  autoCapitalize: "none" as const,
  autoCorrect: "off" as const,
  spellCheck: false,
};

function formFromSettings(data: any): FormState {
  return {
    ...data,
    rooms: (data.rooms ?? []).join(", "),
    energy_labels: (data.energy_labels ?? []).join(", "),
    supported_languages: (data.supported_languages ?? ["he", "ar", "en"]).join(","),
    payments_provider: ["manual", "none", "hyp"].includes(data.payments_provider)
      ? data.payments_provider
      : "manual",
    payments_enabled: !!data.payments_enabled,
  };
}

function payloadFromForm(f: FormState) {
  return {
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
      .map((value: string) => value.trim())
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
      .map((value: string) => value.trim())
      .filter(Boolean),
    energy_labels: f.energy_labels
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean),
    payments_enabled: f.payments_provider === "hyp" ? true : !!f.payments_enabled,
    payments_provider: ["manual", "none", "hyp"].includes(f.payments_provider)
      ? f.payments_provider
      : "none",
    payments_mode: f.payments_mode || "test",
    payments_success_url: f.payments_success_url || null,
    payments_cancel_url: f.payments_cancel_url || null,
    receipt_prefix: f.receipt_prefix || "CC",
    receipt_footer_note: f.receipt_footer_note || null,
    invoice_provider: f.invoice_provider || "none",
  };
}

/* ---------- validation helpers ---------- */
const isEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => !v || /^\+?[0-9][0-9\s-]{5,}$/.test(v.trim());
const isUrl = (v: string) => !v || /^https?:\/\/.+\..+/.test(v.trim());
const waDigits = (v?: string | null) => (v ?? "").replace(/[^0-9]/g, "");

function Page() {
  const { t, dir } = useI18n();
  useDocumentTitle("page.settings.title");
  const getFn = useServerFn(getStudioSettingsFull);
  const upFn = useServerFn(updateStudioSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["studio-settings-full"], queryFn: () => getFn() });
  const [f, setF] = useState<FormState>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const originalPayload = useMemo(
    () => (data ? payloadFromForm(formFromSettings(data)) : null),
    [data],
  );

  useEffect(() => {
    if (data && !f) setF(formFromSettings(data));
  }, [data, f]);

  const errors = useMemo(() => {
    if (!f) return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!f.studio_name?.trim()) e.studio_name = t("settings.requiredStudioName");
    if (f.contact_email && !isEmail(f.contact_email)) e.contact_email = t("settings.invalidEmail");
    if (f.public_phone && !isPhone(f.public_phone)) e.public_phone = t("settings.invalidPhone");
    if (f.whatsapp_number && !isPhone(f.whatsapp_number))
      e.whatsapp_number = t("settings.invalidPhone");
    if (f.instagram_url && !isUrl(f.instagram_url)) e.instagram_url = t("settings.invalidUrl");
    if (f.website_url && !isUrl(f.website_url)) e.website_url = t("settings.invalidUrl");
    if (f.logo_url && !isUrl(f.logo_url)) e.logo_url = t("settings.invalidUrl");
    if (f.fallback_image_url && !isUrl(f.fallback_image_url))
      e.fallback_image_url = t("settings.invalidUrl");
    return e;
  }, [f, t]);

  const currentPayload = useMemo(() => (f ? payloadFromForm(f) : null), [f]);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = Boolean(
    originalPayload &&
    currentPayload &&
    JSON.stringify(originalPayload) !== JSON.stringify(currentPayload),
  );

  const save = useMutation({
    mutationFn: () => upFn({ data: currentPayload }),
    onSuccess: () => {
      toast.success(t("settings.saved"));
      qc.invalidateQueries({ queryKey: ["studio-settings-full"] });
      qc.invalidateQueries({ queryKey: ["public-studio-settings"] });
    },
    onError: (e: any) => toast.error(friendlyErrorMessage(e, t("settings.saveError"))),
  });

  if (!f) return <CardSkeleton rows={4} />;

  const set = (patch: Partial<FormState>) => setF({ ...f, ...patch });

  const waNumberPreview = f.whatsapp_number || f.public_phone || "";
  const waLink = waDigits(waNumberPreview) ? "https://wa.me/" + waDigits(waNumberPreview) : "";
  const packageMsg = t("settings.packageMsg", { studio: f.studio_name || "the studio" });

  async function enableAdminPushNotifications() {
    setPushBusy(true);
    setPushStatus("");
    try {
      const result = await registerAdminPushFromSettings();
      if (!result) {
        const message = "Open the installed iPhone app, not Safari or the browser.";
        setPushStatus(message);
        toast.error(message);
        return;
      }
      if (result.ok) {
        const message = "iPhone notification registration started. If iOS asks, tap Allow.";
        setPushStatus(message);
        toast.success(message);
        return;
      }

      const message =
        result.skipped === "not_native"
          ? "Open the installed iPhone app, not Safari or the browser."
          : result.skipped === "no_session"
            ? "Log in as admin first, then try again."
            : result.skipped === "not_admin"
              ? "This account is not an admin."
              : result.skipped === "permission_denied"
                ? "Notifications are denied. Enable them in iPhone Settings > Cloud & Core > Notifications."
                : result.skipped === "already_started"
                  ? "Registration already started. Close and reopen the app if no prompt appears."
                  : `Notifications were not granted (${result.permission ?? "unknown"}).`;
      setPushStatus(message);
      toast.error(message);
    } catch (error) {
      const message = friendlyErrorMessage(error, "Could not start iPhone notifications.");
      setPushStatus(message);
      toast.error(message);
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <AdminPageShell className="settings-page" dir={dir}>
      <AdminPageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.studioConfig")}
        description={t("settings.headerBody")}
      />
      <form
        className="space-y-5 sm:space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!hasErrors && isDirty) save.mutate();
        }}
      >
        <Section title={t("settings.identity.title")} helper={t("settings.identity.helper")}>
          <Grid>
            <FieldRow label={t("settings.studioName")} required error={errors.studio_name}>
              <input
                className="settings-input"
                value={f.studio_name ?? ""}
                onChange={(e) => set({ studio_name: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label={t("settings.publicPhone")}
              error={errors.public_phone}
              hint={t("settings.publicPhoneHint")}
            >
              <TechnicalInput
                inputMode="tel"
                value={f.public_phone ?? ""}
                onChange={(value) => set({ public_phone: value })}
                placeholder="+972 50 000 0000"
              />
            </FieldRow>
            <FieldRow
              label={t("settings.whatsappNumber")}
              error={errors.whatsapp_number}
              hint={t("settings.whatsappHint")}
            >
              <TechnicalInput
                inputMode="tel"
                value={f.whatsapp_number ?? ""}
                onChange={(value) => set({ whatsapp_number: value })}
                placeholder="+972 50 000 0000"
              />
            </FieldRow>
            <FieldRow label={t("settings.contactEmail")} error={errors.contact_email}>
              <TechnicalInput
                type="email"
                inputMode="email"
                value={f.contact_email ?? ""}
                onChange={(value) => set({ contact_email: value })}
                placeholder="hello@cloudandcore.studio"
              />
            </FieldRow>
            <FieldRow label={t("settings.address")} full>
              <input
                className="settings-input"
                value={f.address ?? ""}
                onChange={(e) => set({ address: e.target.value })}
              />
            </FieldRow>
          </Grid>
        </Section>

        <Section title={t("settings.branding.title")} helper={t("settings.branding.helper")}>
          <Grid>
            <FieldRow label={t("settings.logoUrl")} error={errors.logo_url}>
              <TechnicalInput
                inputMode="url"
                value={f.logo_url ?? ""}
                onChange={(value) => set({ logo_url: value })}
                placeholder="https://example.com/logo.png"
              />
            </FieldRow>
            <FieldRow
              label={t("settings.fallbackImage")}
              error={errors.fallback_image_url}
              hint={t("settings.fallbackImageHint")}
            >
              <TechnicalInput
                inputMode="url"
                value={f.fallback_image_url ?? ""}
                onChange={(value) => set({ fallback_image_url: value })}
                placeholder="https://example.com/class-image.jpg"
              />
            </FieldRow>
            <FieldRow label={t("settings.welcomeText")} full hint={t("settings.welcomeTextHint")}>
              <textarea
                rows={2}
                className="settings-input min-h-[96px] resize-y"
                value={f.welcome_text ?? ""}
                onChange={(e) => set({ welcome_text: e.target.value })}
              />
            </FieldRow>
            <FieldRow label={t("settings.announcement")} full hint={t("settings.announcementHint")}>
              <textarea
                rows={2}
                className="settings-input min-h-[96px] resize-y"
                value={f.announcement_text ?? ""}
                onChange={(e) => set({ announcement_text: e.target.value })}
              />
            </FieldRow>
          </Grid>
        </Section>

        <Section title={t("settings.links.title")} helper={t("settings.links.helper")}>
          <Grid>
            <FieldRow label={t("settings.instagramUrl")} error={errors.instagram_url}>
              <TechnicalInput
                inputMode="url"
                value={f.instagram_url ?? ""}
                onChange={(value) => set({ instagram_url: value })}
                placeholder="https://instagram.com/cloudandcore"
              />
            </FieldRow>
            <FieldRow label={t("settings.websiteUrl")} error={errors.website_url}>
              <TechnicalInput
                inputMode="url"
                value={f.website_url ?? ""}
                onChange={(value) => set({ website_url: value })}
                placeholder="https://example.com"
              />
            </FieldRow>
          </Grid>
        </Section>

        <Section title={t("settings.system.title")} helper={t("settings.system.helper")}>
          <Grid>
            <FieldRow label={t("settings.currency")}>
              <TechnicalInput
                value={f.currency ?? "ILS"}
                onChange={(value) => set({ currency: value.toUpperCase() })}
                placeholder="ILS"
              />
            </FieldRow>
            <FieldRow label={t("settings.timezone")}>
              <TechnicalInput
                value={f.timezone ?? "Asia/Jerusalem"}
                onChange={(value) => set({ timezone: value })}
                placeholder="Asia/Jerusalem"
              />
            </FieldRow>
            <FieldRow
              label={t("settings.supportedLanguages")}
              hint={t("settings.supportedLanguagesHint")}
            >
              <TechnicalInput
                value={f.supported_languages}
                onChange={(value) => set({ supported_languages: value })}
                placeholder="he, ar, en"
              />
            </FieldRow>
            <FieldRow label={t("settings.defaultMessageLanguage")}>
              <select
                dir="ltr"
                className="settings-input settings-input-ltr"
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

        <Section title={t("settings.payments.title")} helper={t("settings.payments.helper")}>
          <div className="settings-payment-state">
            <div>
              <p className="settings-payment-title">{t("settings.creditCardComingSoon")}</p>
              <p className="settings-payment-copy">{t("settings.manualPaymentsActive")}</p>
            </div>
            <span className="settings-status-pill">
              {f.payments_provider === "hyp"
                ? t("settings.payment.hyp")
                : f.payments_provider === "none"
                  ? t("settings.payment.none")
                  : t("settings.payment.manual")}
            </span>
          </div>
          <Grid>
            <FieldRow
              label={t("settings.paymentsProvider")}
              hint={t("settings.paymentsProviderHint")}
            >
              <select
                dir={dir}
                className="settings-input"
                value={
                  ["manual", "none", "hyp"].includes(f.payments_provider)
                    ? f.payments_provider
                    : "none"
                }
                onChange={(e) => set({ payments_provider: e.target.value })}
              >
                <option value="none">{t("settings.payment.none")}</option>
                <option value="manual">{t("settings.payment.manual")}</option>
                <option value="hyp">{t("settings.payment.hyp")}</option>
              </select>
            </FieldRow>
            <FieldRow label={t("settings.receiptPrefix")} hint={t("settings.receiptPrefixHint")}>
              <TechnicalInput
                maxLength={8}
                value={f.receipt_prefix ?? "CC"}
                onChange={(value) => set({ receipt_prefix: value.toUpperCase() })}
                placeholder="CC"
              />
            </FieldRow>
            <FieldRow
              label={t("settings.invoiceProvider")}
              hint={t("settings.invoiceProviderHint")}
            >
              <select
                dir={dir}
                className="settings-input"
                value={f.invoice_provider ?? "none"}
                onChange={(e) => set({ invoice_provider: e.target.value })}
              >
                <option value="none">{t("settings.invoice.none")}</option>
                <option value="greeninvoice" disabled>
                  {t("settings.invoice.greeninvoice")}
                </option>
                <option value="icount" disabled>
                  {t("settings.icount")}
                </option>
                <option value="ezcount" disabled>
                  {t("settings.invoice.ezcount")}
                </option>
              </select>
            </FieldRow>
            <FieldRow
              label={t("settings.receiptFooter")}
              full
              hint={t("settings.receiptFooterHint")}
            >
              <textarea
                rows={2}
                className="settings-input min-h-[96px] resize-y"
                value={f.receipt_footer_note ?? ""}
                onChange={(e) => set({ receipt_footer_note: e.target.value })}
                placeholder={t("settings.receiptFooterPlaceholder")}
              />
            </FieldRow>
          </Grid>
        </Section>

        <Section title={t("settings.booking.title")} helper={t("settings.booking.helper")} compact>
          <Grid>
            <FieldRow
              label={t("settings.cancellationDeadline")}
              hint={t("settings.cancellationHint")}
            >
              <NumberInput
                value={f.default_cancellation_window_hours}
                onChange={(v) => set({ default_cancellation_window_hours: v })}
                min={0}
              />
            </FieldRow>
            <FieldRow label={t("settings.bookingWindow")} hint={t("settings.bookingWindowHint")}>
              <NumberInput
                value={f.booking_window_days}
                onChange={(v) => set({ booking_window_days: v })}
                min={1}
                max={180}
              />
            </FieldRow>
            <FieldRow
              label={t("settings.registrationCloses")}
              hint={t("settings.registrationClosesHint")}
            >
              <NumberInput
                value={f.registration_closes_minutes}
                onChange={(v) => set({ registration_closes_minutes: v })}
                min={0}
              />
            </FieldRow>
            <FieldRow label={t("settings.defaultCapacity")}>
              <NumberInput
                value={f.default_capacity}
                onChange={(v) => set({ default_capacity: v })}
                min={1}
              />
            </FieldRow>
            <FieldRow
              label={t("settings.defaultCreditCost")}
              hint={t("settings.defaultCreditCostHint")}
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
              label={t("settings.trialAllowed")}
              hint={t("settings.trialAllowedHint")}
              checked={f.trial_class_allowed}
              onChange={(v) => set({ trial_class_allowed: v })}
            />
          </Toggles>
        </Section>

        <Section
          title={t("settings.waitlist.title")}
          helper={t("settings.waitlist.helper")}
          compact
        >
          <Grid>
            <FieldRow label={t("settings.claimWindow")} hint={t("settings.claimWindowHint")}>
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
              label={t("settings.waitlistEnabled")}
              hint={t("settings.waitlistEnabledHint")}
              checked={f.allow_waitlist}
              onChange={(v) => set({ allow_waitlist: v })}
            />
            <Toggle
              label={t("settings.autoPrepareWaitlist")}
              hint={t("settings.autoPrepareWaitlistHint")}
              checked={f.auto_promote_waitlist}
              onChange={(v) => set({ auto_promote_waitlist: v })}
            />
          </Toggles>
        </Section>

        <Section
          title={t("settings.communications.title")}
          helper={t("settings.communications.helper")}
          compact
        >
          <Toggles>
            <Toggle
              label={t("settings.whatsappChannel")}
              hint={t("settings.whatsappChannelHint")}
              checked={f.whatsapp_enabled}
              onChange={(v) => set({ whatsapp_enabled: v })}
            />
            <Toggle
              label={t("settings.emailChannel")}
              hint={t("settings.emailChannelHint")}
              checked={f.email_enabled}
              onChange={(v) => set({ email_enabled: v })}
            />
          </Toggles>
          <Divider />
          <div className="rounded-xl border border-gold/18 bg-ivory/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="settings-toggle-label">iPhone admin notifications</p>
                <p className="settings-toggle-hint">
                  Enable alerts for new member signups on this admin device.
                </p>
              </div>
              <button
                type="button"
                disabled={pushBusy}
                onClick={enableAdminPushNotifications}
                className="settings-save-button w-full sm:w-auto"
              >
                {pushBusy ? "Checking..." : "Enable on this iPhone"}
              </button>
            </div>
            {pushStatus ? (
              <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate">
                {pushStatus}
              </p>
            ) : null}
          </div>
        </Section>

        <Section title={t("settings.legacy.title")} helper={t("settings.legacy.helper")} compact>
          <FieldRow label={t("settings.studioRooms")} full hint={t("settings.studioRoomsHint")}>
            <input
              className="settings-input"
              value={f.rooms}
              onChange={(e) => set({ rooms: e.target.value })}
            />
          </FieldRow>
          <FieldRow label={t("settings.energyLabels")} full hint={t("settings.commaSeparated")}>
            <input
              className="settings-input"
              value={f.energy_labels}
              onChange={(e) => set({ energy_labels: e.target.value })}
            />
          </FieldRow>
        </Section>

        <Section title={t("settings.preview.title")} helper={t("settings.preview.helper")} compact>
          <div className="grid gap-3 md:grid-cols-3">
            <PreviewCard label={t("settings.preview.whatsapp")}>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="block text-start text-navy underline decoration-gold/60 underline-offset-4 break-all text-sm"
                >
                  {waLink}
                </a>
              ) : (
                <span className="text-slate text-sm">{t("settings.preview.noWhatsapp")}</span>
              )}
            </PreviewCard>
            <PreviewCard label={t("settings.preview.announcement")}>
              {f.announcement_text ? (
                <p className="text-sm text-navy leading-relaxed">{f.announcement_text}</p>
              ) : (
                <span className="text-slate text-sm">{t("settings.preview.noAnnouncement")}</span>
              )}
            </PreviewCard>
            <PreviewCard label={t("settings.preview.packageMessage")}>
              <p className="text-sm text-navy leading-relaxed whitespace-pre-wrap">{packageMsg}</p>
            </PreviewCard>
          </div>
        </Section>

        <div className="settings-save-bar">
          <div className="settings-save-inner">
            <p className="settings-save-note">
              {hasErrors
                ? Object.keys(errors).length === 1
                  ? t("settings.fieldNeedAttention")
                  : t("settings.fieldsNeedAttention", { count: Object.keys(errors).length })
                : isDirty
                  ? t("settings.unsavedChanges")
                  : t("settings.noChanges")}
            </p>
            <button
              type="submit"
              disabled={save.isPending || hasErrors || !isDirty}
              className="settings-save-button"
            >
              {save.isPending ? t("common.saving") : t("settings.saveButton")}
            </button>
          </div>
        </div>
      </form>
    </AdminPageShell>
  );
}

/* ---------- presentational sub-components ---------- */
function Section({
  title,
  helper,
  compact,
  children,
}: {
  title: string;
  helper?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`settings-card ${compact ? "settings-card-compact" : ""}`}>
      <header className="settings-card-header">
        <h3 className="settings-card-title">{title}</h3>
        {helper && <p className="settings-card-helper">{helper}</p>}
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
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
    <label className={`settings-field ${full ? "md:col-span-2" : ""}`}>
      <span className="settings-label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <span className="settings-field-error">{error}</span>
      ) : hint ? (
        <span className="settings-field-helper">{hint}</span>
      ) : null}
    </label>
  );
}

function TechnicalInput({
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      {...technicalTextProps}
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      className="settings-input settings-input-ltr"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
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
      dir="ltr"
      className="settings-input settings-input-ltr"
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
  return <div className="grid gap-3">{children}</div>;
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
    <label className="settings-toggle">
      <span className="relative inline-flex h-6 w-11 shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-sand border border-gold/30 transition-colors peer-checked:bg-navy peer-checked:border-navy" />
        <span className="settings-toggle-knob" />
      </span>
      <span className="settings-toggle-copy">
        <span className="settings-toggle-label">{label}</span>
        {hint && <span className="settings-toggle-hint">{hint}</span>}
      </span>
    </label>
  );
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[6rem] rounded-xl border border-gold/18 bg-ivory/70 p-4 shadow-[0_18px_40px_-34px_rgba(11,29,58,0.45)] space-y-2">
      <p className="settings-label settings-preview-label">{label}</p>
      <div>{children}</div>
    </div>
  );
}
