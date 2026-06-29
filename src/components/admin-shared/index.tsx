import * as React from "react";

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
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="border-b border-gold/25 pb-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="font-display mt-2 text-2xl sm:text-3xl font-semibold leading-tight text-navy">
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
            {title && (
              <h3 className="font-display mt-1 text-xl font-semibold leading-tight text-navy">
                {title}
              </h3>
            )}
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
}: {
  children?: React.ReactNode;
  action?: React.ReactNode;
  title?: React.ReactNode;
  body?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  dir?: "rtl" | "ltr";
}) {
  const isRich = Boolean(title || body || primaryAction || secondaryAction);

  return (
    <div
      className={`admin-empty-state editorial-panel ${
        isRich ? "admin-empty-state-rich" : "admin-empty-state-simple"
      }`}
      dir={dir}
    >
      <div className="admin-empty-visual" aria-hidden="true">
        <StudioDayIllustration />
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

function StudioDayIllustration() {
  return (
    <div className="admin-empty-studio-day">
      <svg viewBox="0 0 210 150" focusable="false">
        <path
          className="admin-empty-studio-cloud"
          d="M48.9 83.2h87.8c15.4 0 27.9-11.6 27.9-25.9 0-13.9-11.6-25.3-26.1-25.9C133.5 15.7 117.8 4.8 99.4 4.8c-17.6 0-32.8 10.1-39.7 24.7a33.7 33.7 0 0 0-8.6-1.1c-17.2 0-31.2 13-31.2 29 0 14.3 11.1 25.8 29 25.8Z"
        />
        <path className="admin-empty-studio-accent" d="M66 101.2h61.6" />
        <rect
          className="admin-empty-studio-calendar"
          x="128"
          y="80"
          width="52"
          height="43"
          rx="14"
        />
        <path className="admin-empty-studio-calendar-line" d="M140.5 95.5h27" />
        <path className="admin-empty-studio-calendar-line" d="M140.5 106h22" />
        <path className="admin-empty-studio-calendar-line" d="M140.5 116.5h14" />
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
      <h2 className="font-display text-xl font-semibold leading-tight text-navy">{children}</h2>
      {action && <div className="shrink-0">{action}</div>}
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
      <p className="numeric-display text-3xl leading-none mt-2">{value}</p>
      <div className="h-px w-full bg-gold/25 mt-3" />
      {hint && <p className="text-slate mt-2">{hint}</p>}
    </div>
  );
}

/* Editorial form field wrapper */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
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
