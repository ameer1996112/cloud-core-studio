import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const configure = readFileSync(
  new URL("../../scripts/gcp/configure-notification-infrastructure.sh", import.meta.url),
  "utf8",
);
const audit = readFileSync(
  new URL("../../scripts/gcp/audit-cloud-run-cost-config.sh", import.meta.url),
  "utf8",
);

describe("durable notification infrastructure scripts", () => {
  test("requires an explicit apply flag and configures scale-to-zero request billing", () => {
    expect(configure).toContain("--apply");
    expect(configure).toContain("APPLY=false");
    expect(configure).toContain("--min-instances=0");
    expect(configure).toContain("--max-instances=3");
    expect(configure).toContain("--cpu=1");
    expect(configure).toContain("--memory=512Mi");
    expect(configure).toContain("--concurrency=20");
    expect(configure).toContain("--cpu-throttling");
  });

  test("creates one bounded Cloud Tasks queue and a 15-minute OIDC maintenance request", () => {
    expect(configure).toContain("cc-notification-delivery");
    expect(configure).toContain("--max-dispatches-per-second=10");
    expect(configure).toContain("--max-concurrent-dispatches=5");
    expect(configure).toContain("--max-attempts=100");
    expect(configure).toContain("--min-backoff=10s");
    expect(configure).toContain("--max-backoff=3600s");
    expect(configure).toContain("--max-retry-duration=86400s");
    expect(configure).toContain("cc-notification-maintenance-15m");
    expect(configure).toContain("--schedule=*/15 * * * *");
    expect(configure).toContain("--oidc-service-account-email");
  });

  test("the cost audit is read-only and reports the expensive execution surfaces", () => {
    expect(audit).toContain("gcloud run services list");
    expect(audit).toContain("gcloud run revisions list");
    expect(audit).toContain("gcloud run jobs list");
    expect(audit).toContain("gcloud scheduler jobs list");
    expect(audit).toContain("gcloud tasks queues list");
    expect(audit).not.toMatch(/\b(delete|deploy|update|create|pause|resume)\b/);
  });
});
