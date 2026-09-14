import { ReviewSurface } from "@/components/member/design/VisualSystem";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type MemberAction = {
  label: string;
  to: "/member/schedule" | "/member/bookings" | "/member/packages";
};

export function MemberPageIntro({
  eyebrow,
  title,
  body,
  action,
  aside,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  action?: MemberAction;
  aside?: ReactNode;
}) {
  return (
    <header className="member-page-intro">
      <div className="member-page-intro__copy">
        {eyebrow ? <p className="member-eyebrow">{eyebrow}</p> : null}
        <h1 className="member-page-intro__title">{title}</h1>
        {body ? <div className="member-page-intro__body">{body}</div> : null}
        {action ? (
          <Link to={action.to} className="cc-button cc-button--primary member-page-intro__action">
            {action.label}
          </Link>
        ) : null}
      </div>
      {aside ? <div className="member-page-intro__aside">{aside}</div> : null}
    </header>
  );
}

export function MemberSection({
  id,
  eyebrow,
  title,
  action,
  children,
  collapsible = false,
}: {
  collapsible?: boolean;
  id: string;
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  if (collapsible)
    return (
      <ReviewSurface as="details" id={id} className="cc-account-section">
        <summary>
          <h2 id={`${id}-title`}>{title}</h2>
          {action}
        </summary>
        <div className="member-section__content">{children}</div>
      </ReviewSurface>
    );
  return (
    <section id={id} className="member-section" aria-labelledby={`${id}-title`}>
      <div className="member-section__heading">
        <div>
          {eyebrow ? <p className="member-eyebrow">{eyebrow}</p> : null}
          <h2 id={`${id}-title`} className="member-section__title">
            {title}
          </h2>
        </div>
        {action ? <div className="member-section__action">{action}</div> : null}
      </div>
      <div className="member-section__content">{children}</div>
    </section>
  );
}

export function MemberActionBar({ children }: { children: ReactNode }) {
  return <div className="member-action-bar">{children}</div>;
}
