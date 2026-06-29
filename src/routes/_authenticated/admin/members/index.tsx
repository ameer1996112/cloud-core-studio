import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMembers } from "@/lib/members.functions";
import { useState } from "react";
import { Empty, SectionTitle, CardSkeleton } from "@/components/admin-shared";
import {
  Search,
  Sparkles,
  AlertTriangle,
  Phone,
  Mail,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getPlanDisplay } from "@/lib/planDisplay";

export const Route = createFileRoute("/_authenticated/admin/members/")({
  component: Page,
});

type FilterKey =
  | "all"
  | "active"
  | "first_timer"
  | "low_credits"
  | "expiring_soon"
  | "no_upcoming"
  | "inactive";

const FILTERS: { key: FilterKey; labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0] }[] = [
  { key: "all", labelKey: "admin.members.filter.all" },
  { key: "active", labelKey: "admin.members.filter.active" },
  { key: "first_timer", labelKey: "admin.members.filter.firstTimer" },
  { key: "low_credits", labelKey: "admin.members.filter.lowCredits" },
  { key: "expiring_soon", labelKey: "admin.members.filter.expiringSoon" },
  { key: "no_upcoming", labelKey: "admin.members.filter.noUpcoming" },
  { key: "inactive", labelKey: "admin.members.filter.inactive" },
];

function Page() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.members.title");
  const fn = useServerFn(listMembers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-members", search, filter],
    queryFn: () => fn({ data: { search, filter } }),
  });

  return (
    <div className="space-y-6">
      <SectionTitle>{t("admin.membersTitle")}</SectionTitle>

      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
          <input
            className="editorial-input ps-11"
            placeholder={t("admin.members.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-navy border-navy text-ivory"
                  : "border-gold/30 text-slate hover:border-gold hover:text-navy"
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <CardSkeleton rows={4} />}
      {!isLoading && (data?.length ?? 0) === 0 && <Empty>{t("admin.noMembersFilter")}</Empty>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.map((m: any) => (
          <MemberCard key={m.id} m={m} lang={lang} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ m, lang }: { m: any; lang: "en" | "he" | "ar" }) {
  const { t } = useI18n();
  const lastVisit = m.last_visit_at ? new Date(m.last_visit_at) : null;
  const next = m.next_booking ? new Date(m.next_booking.starts_at) : null;
  const expiringSoon =
    m.active_plan?.expires_at &&
    new Date(m.active_plan.expires_at).getTime() - Date.now() < 14 * 86400000;

  return (
    <Link
      to="/admin/members/$id"
      params={{ id: m.id }}
      className="editorial-card p-5 hover:editorial-card-hover group flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg truncate group-hover:text-gold transition-colors">
            {m.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
            {m.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {m.phone}
              </span>
            )}
            {m.email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />
                {m.email}
              </span>
            )}
          </div>
        </div>
        <div className="text-end shrink-0">
          <p className="font-display text-[28px] leading-none font-light">{m.remaining_credits}</p>
          <p className="mt-0.5 text-xs font-medium text-slate">{t("common.credits")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {m.status === "inactive" && <Badge tone="muted">{t("admin.statusInactive")}</Badge>}
        {m.is_first_timer && (
          <Badge tone="gold">
            <Sparkles className="h-2.5 w-2.5" /> {t("admin.members.badgeFirstTimer")}
          </Badge>
        )}
        {m.remaining_credits <= 1 && m.status !== "inactive" && (
          <Badge tone="amber">{t("admin.badgeLowCredits")}</Badge>
        )}
        {expiringSoon && <Badge tone="amber">{t("admin.badgeExpiring")}</Badge>}
        {m.has_care_notes && (
          <Badge tone="amber">
            <AlertTriangle className="h-2.5 w-2.5" /> {t("admin.members.badgeCareNotes")}
          </Badge>
        )}
        {m.active_plan && <Badge tone="quiet">{getPlanDisplay(m.active_plan, lang).name}</Badge>}
        {(m.tags ?? []).slice(0, 3).map((t: string) => (
          <Badge key={t} tone="quiet">
            {t}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-gold/15 pt-3 text-xs text-slate">
        <div>
          <p className="text-xs font-medium">{t("admin.members.lastVisit")}</p>
          <p className="text-navy mt-0.5">
            {lastVisit
              ? lastVisit.toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium">{t("admin.members.next")}</p>
          <p className="text-navy mt-0.5 truncate">
            {next ? (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {next.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium">{t("admin.members.visits")}</p>
          <p className="text-navy mt-0.5">{m.attendance_count ?? 0}</p>
        </div>
        <div>
          <p className="text-xs font-medium">{t("admin.members.spent")}</p>
          <p className="text-navy mt-0.5">₪{Math.round(m.total_spend ?? 0)}</p>
        </div>
      </div>
    </Link>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "gold" | "amber" | "quiet" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "gold"
      ? "text-gold border-gold/40"
      : tone === "amber"
        ? "text-navy border-gold/50 bg-gold/10"
        : tone === "muted"
          ? "text-slate border-slate/30 bg-slate/5"
          : "text-slate border-gold/25";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
