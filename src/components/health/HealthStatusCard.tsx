import { ReviewSurface } from "@/components/member/design/VisualSystem";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { healthRequest } from "@/lib/health.functions";
import { healthCopy } from "@/lib/health-copy";
import { useI18n } from "@/lib/i18n";
import type { HealthResponse } from "@/lib/health-contract";
export function HealthStatusCard({
  participantId,
  staff = false,
}: {
  participantId: string;
  staff?: boolean;
}) {
  const { lang } = useI18n();
  const c = healthCopy[lang];
  const request = useServerFn(healthRequest);
  const [status, setStatus] = useState<HealthResponse>();
  useEffect(() => {
    let current = true;
    setStatus(undefined);
    void request({
      data: {
        action: staff ? "staff_status" : "status",
        payload: { kind: "member", participantId },
      },
    })
      .then((r) => {
        if (current) setStatus(r);
      })
      .catch(() => {
        if (current) setStatus({ status: "error" });
      });
    return () => {
      current = false;
    };
  }, [participantId, request, staff]);
  return (
    <ReviewSurface as="aside" className="cc-health-status p-5 space-y-2">
      <h2>{c.title}</h2>
      <p>
        {!status
          ? c.loading
          : status.error || status.status === "error"
            ? c.unavailable
            : (c[status.status as keyof typeof c] ?? c.unavailable)}
      </p>
      <a
        className="cc-button cc-button--secondary"
        href={staff ? "/admin/health" : "/member/health"}
      >
        {staff ? c.review : c.title}
      </a>
    </ReviewSurface>
  );
}
