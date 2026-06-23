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

export const Route = createFileRoute("/_authenticated/admin/members/")({
  head: () => ({ meta: [{ title: "Members — Studio Admin" }] }),
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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "first_timer", label: "First timers" },
  { key: "low_credits", label: "Low credits" },
  { key: "expiring_soon", label: "Expiring soon" },
  { key: "no_upcoming", label: "No upcoming" },
  { key: "inactive", label: "Inactive" },
];

function Page() {
  const fn = useServerFn(listMembers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-members", search, filter],
    queryFn: () => fn({ data: { search, filter } }),
  });

  return (
    <div className="space-y-6">
      <SectionTitle>Members</SectionTitle>

      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
          <input
            className="editorial-input pl-11"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] rounded-[2px] border transition-colors ${
                filter === f.key
                  ? "bg-navy border-navy text-ivory"
                  : "border-gold/30 text-slate hover:border-gold hover:text-navy"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <CardSkeleton rows={4} />}
      {!isLoading && (data?.length ?? 0) === 0 && <Empty>No members match these filters.</Empty>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.map((m: any) => (
          <MemberCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ m }: { m: any }) {
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate">
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
        <div className="text-right shrink-0">
          <p className="font-display text-[28px] leading-none font-light">{m.remaining_credits}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate mt-0.5">credits</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {m.status === "inactive" && <Badge tone="muted">Inactive</Badge>}
        {m.is_first_timer && (
          <Badge tone="gold">
            <Sparkles className="h-2.5 w-2.5" /> First-timer
          </Badge>
        )}
        {m.remaining_credits <= 1 && m.status !== "inactive" && (
          <Badge tone="amber">Low credits</Badge>
        )}
        {expiringSoon && <Badge tone="amber">Plan expiring</Badge>}
        {m.has_care_notes && (
          <Badge tone="amber">
            <AlertTriangle className="h-2.5 w-2.5" /> Care notes
          </Badge>
        )}
        {m.active_plan && <Badge tone="quiet">{m.active_plan.name}</Badge>}
        {(m.tags ?? []).slice(0, 3).map((t: string) => (
          <Badge key={t} tone="quiet">
            {t}
          </Badge>
        ))}
      </div>

      <div className="pt-3 border-t border-gold/15 grid grid-cols-2 gap-2 text-[11px] text-slate">
        <div>
          <p className="uppercase tracking-[0.15em] text-[10px]">Last visit</p>
          <p className="text-navy mt-0.5">
            {lastVisit
              ? lastVisit.toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "—"}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.15em] text-[10px]">Next</p>
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
          <p className="uppercase tracking-[0.15em] text-[10px]">Visits</p>
          <p className="text-navy mt-0.5">{m.attendance_count ?? 0}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.15em] text-[10px]">Spent</p>
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
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-[2px] border ${cls}`}
    >
      {children}
    </span>
  );
}
