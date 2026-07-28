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
});
