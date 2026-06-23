import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { SectionTitle } from "@/components/admin-shared";
import {
  listMessageTemplates,
  upsertMessageTemplate,
  duplicateMessageTemplate,
  setTemplateActive,
  buildAudience,
  logNotification,
  listNotificationLogs,
  markNotificationSent,
  listPackageRequests,
  updatePackageRequest,
} from "@/lib/messages.functions";
import { getPublicStudioSettings } from "@/lib/studioSettings.functions";
import { listClasses } from "@/lib/admin.functions";
import {
  CHANNELS,
  LANGUAGES,
  TRIGGER_TYPES,
  SUPPORTED_VARIABLES,
  renderTemplate,
  waUrl,
  formatClassDate,
  formatClassTime,
} from "@/lib/messageTemplate";
import {
  Plus,
  Copy,
  Send,
  MessageCircle,
  Mail,
  Check,
  X,
  Sparkles,
  Pencil,
  Power,
  ChevronRight,
  ListChecks,
  Users,
  Phone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({ meta: [{ title: "Messages — Studio Admin" }] }),
  component: Page,
});

type Tab = "templates" | "composer" | "logs" | "requests";

function Page() {
  const [tab, setTab] = useState<Tab>("composer");
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Messages center</SectionTitle>
        <p className="text-sm text-slate mt-2 max-w-xl">
          Prepare WhatsApp- and email-ready messages from real studio data. Every message you
          generate is logged for the studio record.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gold/30 overflow-x-auto">
        {(
          [
            { k: "composer", l: "Compose" },
            { k: "templates", l: "Templates" },
            { k: "requests", l: "Package requests" },
            { k: "logs", l: "Activity log" },
          ] as { k: Tab; l: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.22em] -mb-px border-b-2 transition ${
              tab === t.k
                ? "border-gold text-navy"
                : "border-transparent text-slate hover:text-navy"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "composer" && <ComposerTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "requests" && <RequestsTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

/* ---------------- Composer ---------------- */

type AudienceKind =
  | "class_roster"
  | "class_waitlist"
  | "low_credits"
  | "package_expiring"
  | "first_timers"
  | "no_show_recent"
  | "inactive_60d"
  | "no_upcoming_booking";

const AUDIENCE_OPTIONS: { k: AudienceKind; l: string; needsClass?: boolean; trigger?: string }[] = [
  { k: "class_roster", l: "Class roster", needsClass: true, trigger: "class_reminder" },
  { k: "class_waitlist", l: "Class waitlist", needsClass: true, trigger: "waitlist_spot" },
  { k: "low_credits", l: "Low credits (≤2)", trigger: "low_credits" },
  { k: "package_expiring", l: "Package expiring (7d)", trigger: "package_expiring" },
  { k: "first_timers", l: "First-time visitors", trigger: "trial_followup" },
  { k: "no_show_recent", l: "Recent no-shows", trigger: "no_show_followup" },
  { k: "inactive_60d", l: "Inactive 60+ days", trigger: "manual" },
  { k: "no_upcoming_booking", l: "No upcoming booking", trigger: "manual" },
];

function ComposerTab() {
  const tplFn = useServerFn(listMessageTemplates);
  const audFn = useServerFn(buildAudience);
  const classesFn = useServerFn(listClasses);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const logFn = useServerFn(logNotification);

  const { data: templates } = useQuery({ queryKey: ["msg-templates"], queryFn: () => tplFn() });
  const { data: classes } = useQuery({
    queryKey: ["admin-classes-min"],
    queryFn: () => classesFn(),
  });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });

  const [audienceKind, setAudienceKind] = useState<AudienceKind>("class_roster");
  const [classId, setClassId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const needsClass = AUDIENCE_OPTIONS.find((a) => a.k === audienceKind)?.needsClass;
  const canBuild = !needsClass || !!classId;

  const audience = useQuery({
    queryKey: ["audience", audienceKind, classId],
    queryFn: () => audFn({ data: { kind: audienceKind, classId: classId || undefined } }),
    enabled: canBuild,
  });

  // Auto-pick template that matches audience trigger and active
  const matchingTriggerType = AUDIENCE_OPTIONS.find((a) => a.k === audienceKind)?.trigger;
  const sortedTemplates = useMemo(() => {
    const list = (templates ?? []).filter((t: any) => t.active);
    return [
      ...list.filter((t: any) => t.trigger_type === matchingTriggerType),
      ...list.filter((t: any) => t.trigger_type !== matchingTriggerType),
    ];
  }, [templates, matchingTriggerType]);

  const tpl = (templates ?? []).find((t: any) => t.id === templateId) ?? sortedTemplates[0];
  const effectiveTemplateId = templateId || tpl?.id;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <aside className="space-y-5">
        <div className="editorial-panel p-5 space-y-3">
          <p className="eyebrow text-[10px]">Audience</p>
          <select
            className="editorial-input"
            value={audienceKind}
            onChange={(e) => {
              setAudienceKind(e.target.value as AudienceKind);
              setTemplateId("");
            }}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.k} value={o.k}>
                {o.l}
              </option>
            ))}
          </select>
          {needsClass && (
            <select
              className="editorial-input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Choose a class…</option>
              {(classes ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.starts_at).toLocaleDateString()}{" "}
                  {new Date(c.starts_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {c.title}
                </option>
              ))}
            </select>
          )}
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate mt-2 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-gold" /> {audience.data?.members.length ?? 0}{" "}
            recipient(s)
          </p>
        </div>

        <div className="editorial-panel p-5 space-y-3">
          <p className="eyebrow text-[10px]">Template</p>
          <select
            className="editorial-input"
            value={effectiveTemplateId ?? ""}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {sortedTemplates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.channel === "whatsapp" ? "WA" : t.channel === "email" ? "Email" : "App"} ·{" "}
                {t.label} ({t.language})
              </option>
            ))}
          </select>
          {tpl && (
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate">
              Trigger:{" "}
              {TRIGGER_TYPES.find((x) => x.key === tpl.trigger_type)?.label ?? tpl.trigger_type}
            </p>
          )}
        </div>

        <VariableHelp />
      </aside>

      <main className="space-y-4">
        {!canBuild && <Empty>Select a class to build the audience.</Empty>}
        {canBuild && audience.isLoading && <div className="skeleton-brand h-32 rounded-[8px]" />}
        {canBuild && audience.data && audience.data.members.length === 0 && (
          <Empty>No members match this audience right now.</Empty>
        )}
        {canBuild &&
          tpl &&
          audience.data?.members.map((m: any) => (
            <PreviewRow
              key={m.id}
              member={m}
              template={tpl}
              settings={settings ?? null}
              cls={audience.data?.cls}
              onLogged={async (status, text) => {
                await logFn({
                  data: {
                    templateId: tpl.id,
                    templateKey: tpl.key,
                    triggerType: tpl.trigger_type,
                    channel: tpl.channel,
                    recipientMemberId: m.id,
                    generatedText: text,
                    subject: tpl.subject ?? null,
                    status,
                    relatedClassId: audience.data?.cls?.id ?? null,
                    relatedBookingId: null,
                    relatedMemberPlanId: null,
                  },
                });
              }}
            />
          ))}
      </main>
    </div>
  );
}

function VariableHelp() {
  return (
    <details className="editorial-panel p-5">
      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.22em] text-slate">
        Available variables
      </summary>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUPPORTED_VARIABLES.map((v) => (
          <code
            key={v}
            className="text-[10px] px-1.5 py-0.5 bg-sand/60 border border-gold/20 rounded-[2px] text-navy"
          >{`{{${v}}}`}</code>
        ))}
      </div>
    </details>
  );
}

function buildVars(member: any, settings: any, cls: any): Record<string, any> {
  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const cancellationHours = cls?.cancellation_window_hours ?? 4;
  return {
    member_name: member.name?.split(" ")[0] ?? member.name ?? "there",
    studio_name: settings?.studio_name ?? "the studio",
    studio_phone: settings?.public_phone ?? "",
    studio_whatsapp: settings?.whatsapp_number ?? "",
    credits_remaining: member.remaining_credits ?? 0,
    class_name: cls?.title ?? "your class",
    class_date: cls ? formatClassDate(cls.starts_at, tz) : "",
    class_time: cls ? formatClassTime(cls.starts_at, tz) : "",
    room_name: cls?.room_ref?.name ?? cls?.room ?? "",
    instructor_name: cls?.instructor?.name ?? "your instructor",
    cancellation_deadline: `${cancellationHours}h`,
    package_name: member.context?.package_name ?? "",
    package_expiry: member.context?.package_expiry
      ? new Date(member.context.package_expiry).toLocaleDateString()
      : "",
    waitlist_position: member.context?.waitlist_position ?? "",
  };
}

function PreviewRow({
  member,
  template,
  settings,
  cls,
  onLogged,
}: {
  member: any;
  template: any;
  settings: any;
  cls: any;
  onLogged: (status: "copied" | "opened" | "marked_sent", text: string) => Promise<void>;
}) {
  const ctxCls = cls ?? member.context?.class;
  const vars = buildVars(member, settings, ctxCls);
  const text = renderTemplate(template.body ?? "", vars);
  const subject = template.subject ? renderTemplate(template.subject, vars) : null;

  const channel = template.channel as "whatsapp" | "email" | "in_app";

  async function copy(kind: "copied" | "marked_sent") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(kind === "marked_sent" ? "Copied & marked sent" : "Copied to clipboard");
      await onLogged(kind, text);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function openWa() {
    const url = waUrl({ to: member.phone, text });
    window.open(url, "_blank", "noopener");
    await onLogged("opened", text);
  }

  return (
    <article className="editorial-panel p-5 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-navy truncate">{member.name}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate mt-0.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <ChannelIcon c={channel} />
              {channel}
            </span>
            {member.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {member.phone}
              </span>
            )}
            {!member.phone && channel === "whatsapp" && (
              <span className="text-navy">No phone on file</span>
            )}
            <span>· {member.remaining_credits} credits</span>
          </p>
        </div>
      </header>
      {subject && (
        <p className="text-xs text-slate">
          <span className="uppercase tracking-[0.18em]">Subject</span> · {subject}
        </p>
      )}
      <pre className="text-sm text-navy whitespace-pre-wrap font-sans bg-sand/40 border border-gold/15 rounded-[2px] p-3 leading-relaxed">
        {text}
      </pre>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => copy("copied")}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.15em] text-navy hover:bg-gold/10"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
        {channel === "whatsapp" && (
          <button
            onClick={openWa}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.15em] text-navy hover:bg-gold/10"
          >
            <MessageCircle className="h-3 w-3" /> Open WhatsApp
          </button>
        )}
        {channel === "email" && member.email && (
          <a
            href={`mailto:${member.email}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(text)}`}
            onClick={() => onLogged("opened", text)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.15em] text-navy hover:bg-gold/10"
          >
            <Mail className="h-3 w-3" /> Open email
          </a>
        )}
        <button
          onClick={() => copy("marked_sent")}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-navy text-ivory rounded-[2px] text-[11px] uppercase tracking-[0.15em] hover:bg-transparent hover:text-navy border border-navy"
        >
          <Send className="h-3 w-3" /> Mark sent
        </button>
      </div>
    </article>
  );
}

function ChannelIcon({ c }: { c: string }) {
  if (c === "whatsapp") return <MessageCircle className="h-3 w-3 text-gold" />;
  if (c === "email") return <Mail className="h-3 w-3 text-gold" />;
  return <Sparkles className="h-3 w-3 text-gold" />;
}

/* ---------------- Templates ---------------- */

function TemplatesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMessageTemplates);
  const upFn = useServerFn(upsertMessageTemplate);
  const dupFn = useServerFn(duplicateMessageTemplate);
  const togFn = useServerFn(setTemplateActive);
  const { data, isLoading } = useQuery({ queryKey: ["msg-templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | "new" | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["msg-templates"] });

  const save = useMutation({
    mutationFn: (v: any) => upFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Duplicated");
      invalidate();
    },
  });
  const tog = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => togFn({ data: v }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing("new")}
          className="btn-navy hover:bg-transparent hover:text-navy"
        >
          <Plus className="h-3 w-3" /> New template
        </button>
      </div>

      {isLoading && <div className="skeleton-brand h-24 rounded-[8px]" />}
      {data && data.length === 0 && <Empty>No templates yet.</Empty>}

      <div className="grid md:grid-cols-2 gap-4">
        {(data ?? []).map((t: any) => (
          <article
            key={t.id}
            className={`editorial-panel p-5 space-y-3 ${!t.active ? "opacity-60" : ""}`}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg text-navy">{t.label}</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate mt-0.5">
                  {t.channel} · {t.language} ·{" "}
                  {TRIGGER_TYPES.find((x) => x.key === t.trigger_type)?.label ?? t.trigger_type}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <IconBtn title="Edit" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Duplicate" onClick={() => dup.mutate(t.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  title={t.active ? "Disable" : "Enable"}
                  onClick={() => tog.mutate({ id: t.id, active: !t.active })}
                >
                  <Power className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </header>
            <p className="text-sm text-slate whitespace-pre-wrap line-clamp-4">{t.body}</p>
          </article>
        ))}
      </div>

      {editing && (
        <TemplateEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(v: any) => save.mutate(v)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function TemplateEditor({ initial, onClose, onSave, saving }: any) {
  const [f, setF] = useState({
    id: initial?.id,
    key: initial?.key ?? `tpl_${Date.now().toString(36)}`,
    label: initial?.label ?? "",
    channel: initial?.channel ?? "whatsapp",
    trigger_type: initial?.trigger_type ?? "manual",
    language: initial?.language ?? "en",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
    description: initial?.description ?? "",
    active: initial?.active ?? true,
  });
  return (
    <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-2xl bg-ivory border border-gold/30 rounded-[4px] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-display italic text-2xl text-navy">
            {initial ? "Edit template" : "New template"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gold/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <L label="Label">
            <input
              className="editorial-input"
              value={f.label}
              onChange={(e) => setF({ ...f, label: e.target.value })}
            />
          </L>
          <L label="Key">
            <input
              className="editorial-input"
              value={f.key}
              onChange={(e) => setF({ ...f, key: e.target.value })}
            />
          </L>
          <L label="Channel">
            <select
              className="editorial-input"
              value={f.channel}
              onChange={(e) => setF({ ...f, channel: e.target.value })}
            >
              {CHANNELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Language">
            <select
              className="editorial-input"
              value={f.language}
              onChange={(e) => setF({ ...f, language: e.target.value })}
            >
              {LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Trigger">
            <select
              className="editorial-input"
              value={f.trigger_type}
              onChange={(e) => setF({ ...f, trigger_type: e.target.value })}
            >
              {TRIGGER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </L>
          {f.channel === "email" && (
            <L label="Subject">
              <input
                className="editorial-input"
                value={f.subject ?? ""}
                onChange={(e) => setF({ ...f, subject: e.target.value })}
              />
            </L>
          )}
        </div>
        <L label="Body">
          <textarea
            rows={6}
            className="editorial-input"
            value={f.body}
            onChange={(e) => setF({ ...f, body: e.target.value })}
          />
        </L>
        <p className="text-[11px] text-slate">
          Use variables like {`{{member_name}}`}, {`{{class_name}}`}, {`{{class_date}}`},{" "}
          {`{{studio_name}}`}…
        </p>
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
            className="accent-gold"
          />{" "}
          Active
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-ghost hover:btn-ghost-hover">
            Cancel
          </button>
          <button
            disabled={saving || !f.label || !f.body}
            onClick={() =>
              onSave({
                ...f,
                subject: f.subject || null,
                description: f.description || null,
              })
            }
            className="btn-navy hover:bg-transparent hover:text-navy disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow text-[10px]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function IconBtn({ children, ...rest }: any) {
  return (
    <button
      {...rest}
      className="h-8 w-8 inline-flex items-center justify-center border border-gold/30 rounded-[2px] text-slate hover:text-navy hover:bg-gold/10"
    >
      {children}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-panel p-10 text-center font-display italic text-slate">
      {children}
    </div>
  );
}

/* ---------------- Logs ---------------- */

function LogsTab() {
  const fn = useServerFn(listNotificationLogs);
  const markFn = useServerFn(markNotificationSent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notification-logs"],
    queryFn: () => fn({ data: { limit: 100 } }),
  });
  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked sent");
      qc.invalidateQueries({ queryKey: ["notification-logs"] });
    },
  });
  if (isLoading) return <div className="skeleton-brand h-24 rounded-[8px]" />;
  if (!data?.length)
    return <Empty>No messages yet. Open the Compose tab to prepare your first one.</Empty>;
  return (
    <ol className="relative border-l border-gold/30 pl-5 space-y-4">
      {data.map((l: any) => (
        <li key={l.id} className="relative">
          <span className="absolute -left-[26px] top-2 h-2.5 w-2.5 rounded-full bg-gold" />
          <article className="editorial-panel p-4">
            <header className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base text-navy">{l.member?.name ?? "—"}</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate mt-0.5">
                  {new Date(l.created_at).toLocaleString()} · {l.channel} ·{" "}
                  {l.trigger_type ?? l.template_key ?? "manual"}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-[2px] ${
                  l.status === "marked_sent"
                    ? "bg-navy text-ivory"
                    : l.status === "opened" || l.status === "copied"
                      ? "bg-powder text-navy"
                      : l.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-sand text-slate"
                }`}
              >
                {l.status}
              </span>
            </header>
            {l.generated_text && (
              <pre className="text-xs text-slate whitespace-pre-wrap font-sans mt-2 line-clamp-4">
                {l.generated_text}
              </pre>
            )}
            {l.status !== "marked_sent" && (
              <button
                onClick={() => mark.mutate(l.id)}
                className="mt-2 text-[10px] uppercase tracking-[0.2em] text-gold hover:text-navy"
              >
                Mark as sent →
              </button>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Package Requests ---------------- */

function RequestsTab() {
  const listFn = useServerFn(listPackageRequests);
  const upFn = useServerFn(updatePackageRequest);
  const settingsFn = useServerFn(getPublicStudioSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["package-requests"], queryFn: () => listFn() });
  const { data: settings } = useQuery({
    queryKey: ["public-studio-settings"],
    queryFn: () => settingsFn(),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: any }) => upFn({ data: { id: v.id, status: v.status } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["package-requests"] });
    },
  });

  if (isLoading) return <div className="skeleton-brand h-24 rounded-[8px]" />;
  if (!data?.length) return <Empty>No package requests yet.</Empty>;

  return (
    <div className="space-y-3">
      {data.map((r: any) => {
        const wa = waUrl({
          to: r.member?.phone,
          text: `Hi ${r.member?.name?.split(" ")[0] ?? ""}, this is ${settings?.studio_name ?? "the studio"} about your ${r.plan?.name ?? "package"} request.`,
        });
        return (
          <article
            key={r.id}
            className="editorial-panel p-5 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-display text-lg text-navy">
                {r.member?.name ?? "—"}{" "}
                <span className="text-slate text-sm">· {r.plan?.name ?? "Package"}</span>
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate mt-0.5">
                {new Date(r.created_at).toLocaleString()} · {r.member?.phone ?? "no phone"}
              </p>
              {r.message_text && (
                <p className="text-sm text-navy mt-2 italic">"{r.message_text}"</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-[2px] ${
                  r.status === "paid"
                    ? "bg-navy text-ivory"
                    : r.status === "contacted"
                      ? "bg-powder text-navy"
                      : r.status === "cancelled"
                        ? "bg-sand text-slate"
                        : "bg-gold/20 text-navy"
                }`}
              >
                {r.status}
              </span>
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gold/40 rounded-[2px] text-[11px] uppercase tracking-[0.15em] text-navy hover:bg-gold/10"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
              {r.status === "requested" && (
                <button
                  onClick={() => update.mutate({ id: r.id, status: "contacted" })}
                  className="text-[10px] uppercase tracking-[0.2em] text-gold hover:text-navy"
                >
                  Contacted
                </button>
              )}
              {r.status === "contacted" && (
                <button
                  onClick={() => update.mutate({ id: r.id, status: "paid" })}
                  className="text-[10px] uppercase tracking-[0.2em] text-gold hover:text-navy"
                >
                  Paid
                </button>
              )}
              {r.status !== "cancelled" && r.status !== "paid" && (
                <button
                  onClick={() => update.mutate({ id: r.id, status: "cancelled" })}
                  className="text-[10px] uppercase tracking-[0.2em] text-slate hover:text-destructive"
                >
                  Cancel
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
