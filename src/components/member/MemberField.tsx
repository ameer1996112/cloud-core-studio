import { ReviewSurface } from "@/components/member/design/VisualSystem";
import { cloneElement, type ReactElement } from "react";
import { t } from "@/lib/i18n";

type MemberFieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
};

export function MemberField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactElement<MemberFieldControlProps>;
}) {
  return (
    <ReviewSurface className="member-field cc-field cc-field-surface">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {cloneElement(children, { id })}
    </ReviewSurface>
  );
}

export function MemberProfileSaveStatus({
  id,
  pending,
  succeeded,
  failed,
}: {
  id: string;
  pending: boolean;
  succeeded: boolean;
  failed: boolean;
}) {
  const message = pending
    ? t("common.saving")
    : succeeded
      ? t("profile.saved")
      : failed
        ? t("profile.saveError")
        : null;

  return (
    <span id={id} className="member-account-save-status" role="status" aria-atomic="true">
      {message}
    </span>
  );
}
