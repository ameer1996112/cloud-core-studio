import {
  useId,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type ElementType,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { Check, LoaderCircle } from "lucide-react";
import "./visual-system.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function ReviewButton({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "icon";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`cc-button cc-button--${variant} ${className}`}
    >
      {loading && <LoaderCircle className="cc-spinner" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function ReviewBadge({ children }: { children: ReactNode }) {
  return <span className="cc-badge">{children}</span>;
}
export function ReviewSurface({
  children,
  className = "",
  as: Tag = "div",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return (
    <Tag {...props} className={`cc-surface ${className}`}>
      {children}
    </Tag>
  );
}
export function ReviewFeedback({
  children,
  error = false,
  loading = false,
}: {
  children: ReactNode;
  error?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`cc-feedback ${error ? "cc-feedback--error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {loading && <LoaderCircle className="cc-spinner" size={18} aria-hidden="true" />}
      {children}
    </div>
  );
}
export function ReviewFilters<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="cc-filters" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function ReviewField({
  label,
  help,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string; error?: string }) {
  const id = useId();
  return (
    <div className="cc-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={help || error ? `${id}-help` : undefined}
      />
      {(error || help) && (
        <small id={`${id}-help`} className={error ? "cc-error" : ""}>
          {error || help}
        </small>
      )}
    </div>
  );
}
export function ReviewSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="cc-field">
      <label htmlFor={id}>{label}</label>
      <select {...props} id={id}>
        {children}
      </select>
    </div>
  );
}
export function ReviewCheckbox({ children, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="cc-checkbox">
      <input {...props} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
export function ReviewMembership({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ReviewSurface className="cc-membership">
      <strong>{title}</strong>
      <div>{children}</div>
    </ReviewSurface>
  );
}
export function ReviewClassRow({
  image,
  title,
  children,
  action,
}: {
  image: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <ReviewSurface className="cc-class-row">
      <img src={image} alt="" />
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
      {action}
    </ReviewSurface>
  );
}
export function ReviewPlanCard({
  id,
  title,
  subtitle,
  price,
  features,
  note,
  disclosure,
  badge,
  highlighted,
  image,
  action,
}: {
  id: string;
  title: string;
  subtitle?: string;
  price: ReactNode;
  features: string[];
  note?: string;
  disclosure?: string;
  badge?: string;
  highlighted?: boolean;
  image: string;
  action: ReactNode;
}) {
  return (
    <article
      id={id}
      tabIndex={-1}
      data-package-plan-card="true"
      aria-labelledby={`${id}-title`}
      className={`cc-plan cc-surface ${highlighted ? "cc-plan--highlighted" : ""}`}
    >
      {badge && (
        <div className="cc-plan__badge">
          <ReviewBadge>{badge}</ReviewBadge>
        </div>
      )}
      <img className="cc-plan__image" src={image} alt="" />
      <div className="cc-plan__heading">
        <h3 id={`${id}-title`}>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="cc-plan__price">{price}</div>
      <ul className="cc-plan__features">
        {features.map((feature, i) => (
          <li key={i}>
            <Check aria-hidden="true" size={15} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {(note || disclosure) && (
        <div className="cc-plan__terms">
          {note && <p>{note}</p>}
          {disclosure && <p>{disclosure}</p>}
        </div>
      )}
      <div className="cc-plan__action">{action}</div>
    </article>
  );
}

export function ReviewTabs({
  label,
  items,
}: {
  label: string;
  items: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <Tabs defaultValue={items[0]?.value} dir="rtl">
      <TabsList className="cc-tabs" aria-label={label}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function ReviewPrice({ value }: { value: string }) {
  const parts = /^(₪)(.*)$/.exec(value);
  return (
    <bdi dir="ltr">
      {parts ? (
        <>
          <small className="cc-price-currency">{parts[1]}</small>
          {parts[2]}
        </>
      ) : (
        value
      )}
    </bdi>
  );
}

export function ReviewHero({
  image,
  children,
  action,
}: {
  image: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <ReviewSurface className="cc-hero">
      <img src={image} alt="" />
      <div className="cc-hero__copy">
        {children}
        {action}
      </div>
    </ReviewSurface>
  );
}
export function ReviewAvatar({ name }: { name: string }) {
  return (
    <span className="cc-avatar" aria-hidden="true">
      {name.trim().slice(0, 1)}
    </span>
  );
}
