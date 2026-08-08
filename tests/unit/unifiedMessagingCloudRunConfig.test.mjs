import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(
  new URL("../../scripts/configure-unified-messaging-cloud-run.sh", import.meta.url),
  "utf8",
);

describe("Unified Messaging Cloud Run job configuration", () => {
  test("requires an immutable image digest so scheduled sweeps cannot lose their image", () => {
    expect(script).toContain('if [[ "$IMAGE" != *@sha256:* ]]');
    expect(script).toContain("Use an immutable @sha256: digest");
  });

  test("creates one Cloud Monitoring incident after two failed job executions", () => {
    expect(script).toContain("run.googleapis.com/job/completed_execution_count");
    expect(script).toContain('metric.labels.result=\\"failed\\"');
    expect(script).toContain('"alignmentPeriod":"120s"');
    expect(script).toContain('--if="> 1"');
    expect(script).toContain("UNIFIED_MESSAGING_ALERT_NOTIFICATION_CHANNELS");
    expect(script).toContain("gcloud monitoring policies list");
  });
});
