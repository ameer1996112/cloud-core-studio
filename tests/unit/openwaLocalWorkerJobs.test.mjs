import { describe, expect, test } from "bun:test";
import { processClaimedJobs } from "../../scripts/openwa-local-worker.mjs";

function createConfig(overrides = {}) {
  return {
    workerId: "studio-mac",
    testPhone: null,
    options: {
      dryRun: false,
      testPhoneOnly: false,
      limit: 5,
    },
    ...overrides,
  };
}

function createJob(id, overrides = {}) {
  return {
    id,
    to: "+972501234567",
    text: "Message ready",
    triggerType: "payment_confirmed",
    ...overrides,
  };
}

describe("processClaimedJobs", () => {
  test("continues after a send transport exception and reports a retryable failure", async () => {
    const sends = [];
    const reports = [];
    const errors = [];
    const infos = [];

    await processClaimedJobs(
      createConfig(),
      [createJob("job-1"), createJob("job-2")],
      {
        async sendViaOpenwa(_config, job) {
          sends.push(job.id);
          if (job.id === "job-1") {
            throw new Error("fetch rejected");
          }
          return { ok: true, providerMessageId: `provider-${job.id}` };
        },
        async reportResult(_config, body) {
          reports.push(body);
        },
        logError(message) {
          errors.push(message);
        },
        logInfo(message) {
          infos.push(message);
        },
      },
    );

    expect(sends).toEqual(["job-1", "job-2"]);
    expect(reports).toEqual([
      {
        jobId: "job-1",
        status: "failed",
        retryable: true,
        error: "send_transport_failed:fetch_rejected",
      },
      {
        jobId: "job-2",
        status: "sent",
        providerMessageId: "provider-job-2",
      },
    ]);
    expect(errors).toContain(
      "[openwa-local-worker] send transport failed job=job-1 trigger=payment_confirmed error=fetch rejected",
    );
    expect(infos).toContain(
      "[openwa-local-worker] sent job=job-2 trigger=payment_confirmed providerMessageId=provider-job-2",
    );
  });

  test("continues after report failures for failed and successful sends", async () => {
    const reports = [];
    const errors = [];
    const infos = [];

    await processClaimedJobs(
      createConfig(),
      [createJob("job-1"), createJob("job-2"), createJob("job-3")],
      {
        async sendViaOpenwa(_config, job) {
          if (job.id === "job-1") {
            return { ok: false, retryable: false, error: "bad_request" };
          }
          return { ok: true, providerMessageId: `provider-${job.id}` };
        },
        async reportResult(_config, body) {
          reports.push(body);
          if (body.jobId === "job-1" || body.jobId === "job-2") {
            throw new Error(`report offline ${body.jobId}`);
          }
        },
        logError(message) {
          errors.push(message);
        },
        logInfo(message) {
          infos.push(message);
        },
      },
    );

    expect(reports).toEqual([
      {
        jobId: "job-1",
        status: "failed",
        retryable: false,
        error: "bad_request",
      },
      {
        jobId: "job-2",
        status: "sent",
        providerMessageId: "provider-job-2",
      },
      {
        jobId: "job-3",
        status: "sent",
        providerMessageId: "provider-job-3",
      },
    ]);
    expect(errors).toContain(
      "[openwa-local-worker] HIGH_RISK report_failed job=job-1 trigger=payment_confirmed context=send_failed error=report offline job-1",
    );
    expect(errors).toContain(
      "[openwa-local-worker] HIGH_RISK report_failed job=job-2 trigger=payment_confirmed context=sent error=report offline job-2",
    );
    expect(infos).toEqual([
      "[openwa-local-worker] sent job=job-3 trigger=payment_confirmed providerMessageId=provider-job-3",
    ]);
  });
});
