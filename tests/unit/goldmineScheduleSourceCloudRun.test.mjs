import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const configure = readFileSync(
  new URL("../../scripts/configure-phase2-8a-schedule-source-staging.sh", import.meta.url),
  "utf8",
);
const acceptance = readFileSync(
  new URL("../../scripts/run-phase2-8a-schedule-source-acceptance.sh", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../../src/routes/internal/goldmine/v1/schedule.ts", import.meta.url),
  "utf8",
);
const stagingEnv = readFileSync(new URL("../../.env.staging.example", import.meta.url), "utf8");

describe("GoldMine schedule source staging guardrails", () => {
  test("registers only the requested internal endpoint", () => {
    expect(route).toContain('createFileRoute("/internal/goldmine/v1/schedule")');
    expect(route).toContain("handleGoldmineScheduleRequest(request)");
  });

  test("base staging configuration stays disabled", () => {
    expect(stagingEnv).toContain('GOLDMINE_SCHEDULE_SOURCE_ENABLED="false"');
    expect(stagingEnv).toContain(
      'GOLDMINE_SCHEDULE_ALLOWED_CALLERS="goldmine-schedule-pub-stg@cloudandcorestudio.iam.gserviceaccount.com"',
    );
    expect(stagingEnv).not.toContain("PRIVATE KEY");
  });

  test("configuration refuses production and grants only service-level invocation", () => {
    expect(configure).toContain('[[ "$SERVICE" != "$PRODUCTION_SERVICE" ]]');
    expect(configure).toContain('[[ "$SERVICE" == "$DEFAULT_STAGING_SERVICE" ]]');
    expect(configure).toContain("GOLDMINE_SCHEDULE_SOURCE_ENABLED=true");
    expect(configure).toContain("GOLDMINE_SCHEDULE_PROGRAM_MAP_JSON");
    expect(configure).toContain("program_types.slug");
    expect(configure).toContain("--role roles/run.invoker");
    expect(configure).not.toContain("roles/owner");
    expect(configure).not.toContain("roles/editor");
    expect(configure).not.toContain("keys create");
  });

  test("acceptance mints OIDC without a key and checks rejection, stability, filters, and PII", () => {
    expect(acceptance).toContain("gcloud auth print-identity-token");
    expect(acceptance).toContain('--impersonate-service-account "$CALLER"');
    expect(acceptance).toContain('--audiences "$SERVICE_URL"');
    expect(acceptance).toContain("anonymous request was not rejected");
    expect(acceptance).toContain('[[ -n "$WRONG_CALLER" ]]');
    expect(acceptance).toContain("source_revision changed without a schedule change");
    expect(acceptance).toContain("response contains a forbidden identity or private-data field");
    expect(acceptance).toContain("Manual source-data comparison");
    expect(acceptance).not.toContain("keys create");
  });
});
