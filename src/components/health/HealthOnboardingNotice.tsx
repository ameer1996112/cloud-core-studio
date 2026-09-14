import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { healthOnboardingRequest } from "@/lib/health-onboarding.functions";
import type { HealthOnboarding } from "@/lib/health-onboarding";
import { HealthNoticeCard } from "./HealthNoticeCard";

export function HealthOnboardingNotice() {
  const request = useServerFn(healthOnboardingRequest);
  const [state, setState] = useState<HealthOnboarding>();
  useEffect(() => {
    let current = true;
    void request({ data: { action: "status" } })
      .then((s) => {
        if (current) setState(s);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [request]);
  if (
    !state?.enabled ||
    (!state.required &&
      !state.needsNotice &&
      !state.graceEndsAt &&
      !state.renewalDue &&
      !state.parentRenewalDue)
  )
    return null;
  return <HealthNoticeCard state={state} />;
}
