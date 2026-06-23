import * as React from "react";

/* Editorial empty state — gold hairline frame, italic display copy */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="editorial-panel py-10 px-6 text-center">
      <div className="h-px w-10 bg-gold/60 mx-auto mb-5" />
      <p className="font-display italic text-lg text-slate leading-relaxed">{children}</p>
    </div>
  );
}

/* Section heading with gold underline */
export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h2 className="section-title">{children}</h2>
      {action}
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
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="font-display text-[40px] leading-none font-light mt-2">{value}</p>
      <div className="h-px w-full bg-gold/30 mt-3" />
      {hint && <p className="text-[11px] text-slate mt-2">{hint}</p>}
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
