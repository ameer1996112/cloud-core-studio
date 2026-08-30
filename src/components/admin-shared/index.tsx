import * as React from "react";

export { AsyncState } from "@/components/ui/async-state";
export { PersistentAnnouncement } from "@/components/ui/sonner";
export { ResponsiveDataList } from "@/components/ui/responsive-data-list";
export type { AsyncViewState } from "@/components/ui/async-state";
export type { ResponsiveDataListColumn } from "@/components/ui/responsive-data-list";

/** Consistent page container for all admin routes. Enforces max-width, padding, and vertical spacing. */
export function AdminPageShell({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`admin-page-shell ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AdminPage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`space-y-6 md:space-y-8 pb-16 ${className}`}>{children}</div>;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <header className="border-b border-gold/25 pb-6 text-start">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="cc-page-title mt-2">{title}</h2>
          {description && (
            <p className="mt-3 max-w-2xl text-start text-[15px] leading-relaxed text-slate">
              {description}
            </p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0">
            {secondaryAction}
            {action}
          </div>
        )}
      </div>
    </header>
  );
}

export function AdminToolbar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`editorial-panel flex flex-wrap items-center gap-2 p-3 sm:p-4 ${className}`}>
      {children}
    </div>
  );
}

export function AdminSection({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || eyebrow || action) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-gold/20 pb-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h3 className="cc-section-title mt-1">{title}</h3>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({
  children,
  action,
  title,
  body,
  primaryAction,
  secondaryAction,
  dir,
  visual = "default",
}: {
  children?: React.ReactNode;
  action?: React.ReactNode;
  title?: React.ReactNode;
  body?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  dir?: "rtl" | "ltr";
  visual?: "default" | "attendance";
}) {
  const isRich = Boolean(title || body || primaryAction || secondaryAction);

  return (
    <div
      className={`admin-empty-state editorial-panel ${
        isRich ? "admin-empty-state-rich" : "admin-empty-state-simple"
      } ${visual === "attendance" ? "admin-empty-state-attendance" : ""}`}
      dir={dir}
    >
      <div className="admin-empty-visual" aria-hidden="true">
        {visual === "attendance" ? (
          <AttendanceEmptyIllustration />
        ) : (
          <AdminDefaultEmptyIllustration />
        )}
      </div>
      <div className="admin-empty-copy">
        {title ? (
          <h3 className="admin-empty-title">{title}</h3>
        ) : (
          <p className="admin-empty-body">{children}</p>
        )}
        {body && <p className="admin-empty-body">{body}</p>}
        {!title && body == null && children && isRich && (
          <p className="admin-empty-body">{children}</p>
        )}
        {(primaryAction || secondaryAction || action) && (
          <div className="admin-empty-actions">
            {primaryAction}
            {secondaryAction}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceEmptyIllustration() {
  return (
    <svg
      viewBox="6 0 306 204"
      focusable="false"
      className="admin-empty-attendance-illustration"
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="attendanceSoftShadow" x="-16%" y="-24%" width="132%" height="152%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="13"
            floodColor="var(--color-navy)"
            floodOpacity="0.08"
          />
        </filter>
        <linearGradient id="attendanceGold" x1="248" y1="142" x2="304" y2="198">
          <stop offset="0" stopColor="var(--cc-admin-illustration-gold-start)" />
          <stop offset="1" stopColor="var(--cc-admin-illustration-gold-end)" />
        </linearGradient>
      </defs>

      <path
        d="M85 131H52c-20 0-36-15-36-34 0-17 13-31 30-33 3-28 27-49 56-49 14 0 27 5 37 13"
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />

      <g filter="url(#attendanceSoftShadow)">
        <rect
          x="84"
          y="26"
          width="188"
          height="140"
          rx="24"
          fill="none"
          stroke="var(--color-navy)"
          strokeWidth="8"
        />
        {[0, 1, 2].map((row) => {
          const y = 64 + row * 39;
          return (
            <g key={row}>
              <circle
                cx="118"
                cy={y}
                r="13"
                fill="none"
                stroke="var(--color-navy)"
                strokeWidth="5"
              />
              <path
                d={`M146 ${y - 5}h55`}
                fill="none"
                stroke="var(--color-navy)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d={`M222 ${y - 5}h13M248 ${y - 5}h13`}
                fill="none"
                stroke="var(--color-navy)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </g>

      <circle cx="268" cy="164" r="31" fill="var(--color-surface)" />
      <circle cx="268" cy="164" r="30" fill="none" stroke="url(#attendanceGold)" strokeWidth="7" />
      <path
        d="m253 164 10 10 22-25"
        fill="none"
        stroke="url(#attendanceGold)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminDefaultEmptyIllustration() {
  return (
    <div className="admin-empty-default-visual relative flex items-center justify-center">
      <svg
        viewBox="0 0 210 150"
        focusable="false"
        className="w-full h-auto overflow-visible"
        role="img"
      >
        <defs>
          <filter id="adminDefaultEmptyShadow" x="-18%" y="-24%" width="136%" height="152%">
            <feDropShadow
              dx="0"
              dy="13"
              stdDeviation="11"
              floodColor="var(--color-navy)"
              floodOpacity="0.08"
            />
          </filter>
        </defs>

        <g filter="url(#adminDefaultEmptyShadow)">
          <path
            d="M41 40h88c12 0 22 10 22 22v54H63c-12 0-22-10-22-22V40Z"
            fill="var(--color-surface-warm)"
            stroke="var(--color-navy)"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M59 63h52M59 82h64M59 101h40"
            fill="none"
            stroke="var(--color-navy)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.86"
          />
          <circle
            cx="143"
            cy="48"
            r="23"
            fill="var(--color-surface-warm)"
            stroke="var(--color-gold)"
            strokeWidth="5"
          />
          <path
            d="m158 63 17 17"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <g fill="var(--color-surface-warm)" stroke="var(--color-navy)" strokeWidth="4">
            <circle cx="39" cy="62" r="12" />
            <circle cx="39" cy="99" r="12" />
          </g>
          <g fill="none" stroke="var(--color-gold)" strokeLinecap="round" strokeWidth="4">
            <path d="M35 62h8M39 58v8" />
            <path d="m34 98 4 4 8-10" />
          </g>
          <g transform="translate(130 96)">
            <circle
              cx="16"
              cy="16"
              r="16"
              fill="var(--color-surface-warm)"
              stroke="var(--color-gold)"
              strokeWidth="4"
            />
            <path
              d="M9 16h14M16 9v14"
              fill="none"
              stroke="var(--color-navy)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6 border-b border-gold/20 pb-3">
      <h2 className="cc-section-title">{children}</h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Consistent KPI / metric card used across admin pages */
export function AdminMetricCard({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
  accent?: boolean;
}) {
  return (
    <div className={`admin-metric-card${accent ? " admin-metric-card--accent" : ""}`}>
      <p className="admin-metric-card__label">{label}</p>
      <p className="admin-metric-card__value">{value}</p>
      {helper && <p className="admin-metric-card__helper">{helper}</p>}
    </div>
  );
}

/* Eyebrow + value pair for KPIs / inline stats */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="cc-metric-value text-3xl mt-2">{value}</p>
      <div className="h-px w-full bg-gold/25 mt-3" />
      {hint && <p className="text-slate mt-2">{hint}</p>}
    </div>
  );
}

/* Editorial form field wrapper */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-start">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/* Loading skeleton card */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="editorial-card p-4 space-y-2">
          <div className="skeleton-brand h-4 w-1/2" />
          <div className="skeleton-brand h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
