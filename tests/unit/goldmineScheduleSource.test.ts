import { describe, expect, test } from "bun:test";
import {
  createGoldmineScheduleHandler,
  loadGoldmineScheduleConfig,
  type GoldmineScheduleConfig,
  type ScheduleSourceRow,
} from "../../src/lib/goldmineScheduleSource.server.ts";

const caller = "goldmine-schedule-pub-stg@cloudandcorestudio.iam.gserviceaccount.com";
const audience = "https://cloud-core-studio-staging.example.run.app";
const now = new Date("2026-08-19T10:00:00.000Z");

const config: GoldmineScheduleConfig = {
  enabled: true,
  audience,
  allowedCallers: new Set([caller]),
  programMap: new Map([
    ["aerial-yoga", "aerial_adults"],
    ["hot-pilates-program", "hot_pilates"],
    ["mat-pilates", "mat_pilates"],
  ]),
  queryTimeoutMs: 5_000,
  maxSessions: 100,
  maxResponseBytes: 128_000,
};

const aerialRow: ScheduleSourceRow = {
  external_session_id: "16c931b4-45a5-4c9f-b209-c41017073592",
  title: "Aerial Yoga",
  program_type_slug: "aerial-yoga",
  starts_at: "2026-08-20T15:30:00.000Z",
  ends_at: "2026-08-20T16:30:00.000Z",
  status: "scheduled",
  member_visible: true,
  program_type_active: true,
  age_groups: ["adults", "teens"],
  capacity: 8,
  confirmed_booking_count: 5,
};

function request(
  query = "start_at=2026-08-19T10%3A00%3A00Z&end_at=2026-08-26T10%3A00%3A00Z",
  token = "signed-token",
) {
  return new Request(`https://app.example/internal/goldmine/v1/schedule?${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

type HandlerDependencies = Parameters<typeof createGoldmineScheduleHandler>[0];

function dependencies(overrides: Partial<HandlerDependencies> = {}): HandlerDependencies {
  return {
    config,
    now: () => now,
    verifyIdToken: async () => ({
      iss: "https://accounts.google.com",
      aud: audience,
      exp: Math.floor(now.getTime() / 1000) + 300,
      email: caller,
      email_verified: true,
    }),
    listRows: async () => [aerialRow],
    log: () => undefined,
    ...overrides,
  };
}

describe("GoldMine schedule source HTTP contract", () => {
  test("configuration defaults disabled and requires a complete exact map before enablement", () => {
    expect(loadGoldmineScheduleConfig({}).enabled).toBe(false);
    expect(() =>
      loadGoldmineScheduleConfig({
        GOLDMINE_SCHEDULE_SOURCE_ENABLED: "true",
        GOLDMINE_SCHEDULE_SOURCE_AUDIENCE: audience,
        GOLDMINE_SCHEDULE_ALLOWED_CALLERS: caller,
      }),
    ).toThrow("incomplete_schedule_source_configuration");

    const loaded = loadGoldmineScheduleConfig({
      GOLDMINE_SCHEDULE_SOURCE_ENABLED: "true",
      GOLDMINE_SCHEDULE_SOURCE_AUDIENCE: audience,
      GOLDMINE_SCHEDULE_ALLOWED_CALLERS: ` ${caller.toUpperCase()} `,
      GOLDMINE_SCHEDULE_PROGRAM_MAP_JSON: JSON.stringify({
        "aerial-yoga": "aerial_adults",
        "hot-pilates-program": "hot_pilates",
        "mat-pilates": "mat_pilates",
      }),
    });
    expect(loaded.allowedCallers.has(caller)).toBe(true);
    expect(loaded.programMap.get("hot-pilates-program")).toBe("hot_pilates");
  });

  test("returns a normalized customer-safe seven-day schedule", async () => {
    const response = await createGoldmineScheduleHandler(dependencies())(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      generated_at: "2026-08-19T10:00:00.000Z",
      window_start: "2026-08-19T10:00:00.000Z",
      window_end: "2026-08-26T10:00:00.000Z",
      source_revision: "296fdee8c2cbaef20a8c3c9919ec17b8da71c88ba4dc665529d408c7130a45b2",
      sessions: [
        {
          external_session_id: "class_16c931b4-45a5-4c9f-b209-c41017073592",
          class_type: "aerial_adults",
          starts_at: "2026-08-20T15:30:00.000Z",
          ends_at: "2026-08-20T16:30:00.000Z",
          status: "scheduled",
          published: true,
          private: false,
          audience: "adults",
          booking_enabled: true,
          capacity: 8,
          confirmed_booking_count: 5,
          remaining_capacity: 3,
        },
      ],
    });
  });

  test("rejects missing and malformed bearer tokens without exposing them", async () => {
    const logs: Record<string, unknown>[] = [];
    const handler = createGoldmineScheduleHandler(
      dependencies({
        verifyIdToken: async () => {
          throw new Error("invalid signature signed-token");
        },
        log: (record) => logs.push(record),
      }),
    );

    expect((await handler(request(undefined, ""))).status).toBe(401);
    expect((await handler(request(undefined, "signed-token"))).status).toBe(401);
    expect(JSON.stringify(logs)).not.toContain("signed-token");
    expect(JSON.stringify(logs)).not.toContain("invalid signature");
  });

  test("rejects expired, wrong-audience, unverified-email, and unauthorized caller claims", async () => {
    const cases: Array<
      [Partial<Awaited<ReturnType<HandlerDependencies["verifyIdToken"]>>>, number]
    > = [
      [{ exp: Math.floor(now.getTime() / 1_000) }, 401],
      [{ aud: "https://wrong-audience.example" }, 401],
      [{ email_verified: false }, 401],
      [{ email: "another-service@cloudandcorestudio.iam.gserviceaccount.com" }, 403],
    ];

    for (const [claimOverride, expectedStatus] of cases) {
      const response = await createGoldmineScheduleHandler(
        dependencies({
          verifyIdToken: async () => ({
            iss: "https://accounts.google.com",
            aud: audience,
            exp: Math.floor(now.getTime() / 1_000) + 300,
            email: caller,
            email_verified: true,
            ...claimOverride,
          }),
        }),
      )(request());
      expect(response.status).toBe(expectedStatus);
    }
  });

  test("fails closed while disabled and when the caller allowlist is empty", async () => {
    let verifierCalled = false;
    const disabled = await createGoldmineScheduleHandler(
      dependencies({
        config: { ...config, enabled: false },
        verifyIdToken: async () => {
          verifierCalled = true;
          throw new Error("should not run");
        },
      }),
    )(request());
    expect(disabled.status).toBe(404);
    expect(verifierCalled).toBe(false);

    const unconfigured = await createGoldmineScheduleHandler(
      dependencies({ config: { ...config, allowedCallers: new Set() } }),
    )(request());
    expect(unconfigured.status).toBe(503);
  });

  test("validates timezone-aware ordered windows capped at fourteen days and strict class types", async () => {
    const handler = createGoldmineScheduleHandler(dependencies());
    const invalidQueries = [
      "end_at=2026-08-20T10%3A00%3A00Z",
      "start_at=2026-08-19T10%3A00%3A00&end_at=2026-08-20T10%3A00%3A00Z",
      "start_at=2026-08-20T10%3A00%3A00Z&end_at=2026-08-19T10%3A00%3A00Z",
      "start_at=2026-08-01T10%3A00%3A00Z&end_at=2026-08-16T10%3A00%3A00Z",
      "start_at=2026-08-19T10%3A00%3A00Z&end_at=2026-08-26T10%3A00%3A00Z&class_type=kids",
    ];
    for (const query of invalidQueries) {
      expect((await handler(request(query))).status).toBe(400);
    }
  });

  test("passes normalized bounds and a hard limit to the read-only source", async () => {
    let observed: Parameters<HandlerDependencies["listRows"]>[0] | null = null;
    const response = await createGoldmineScheduleHandler(
      dependencies({
        listRows: async (input) => {
          observed = input;
          return [];
        },
      }),
    )(request());
    expect(response.status).toBe(200);
    expect(observed).toMatchObject({
      startAt: "2026-08-19T10:00:00.000Z",
      endAt: "2026-08-26T10:00:00.000Z",
      limit: 101,
    });
  });

  test("excludes cancelled, private, kids, draft, inactive, unsupported, test, and outside-window rows", async () => {
    const rows: ScheduleSourceRow[] = [
      aerialRow,
      { ...aerialRow, external_session_id: "cancelled", status: "cancelled" },
      { ...aerialRow, external_session_id: "private", member_visible: false },
      { ...aerialRow, external_session_id: "kids", age_groups: ["kids"] },
      { ...aerialRow, external_session_id: "draft", status: "draft" },
      { ...aerialRow, external_session_id: "inactive", program_type_active: false },
      { ...aerialRow, external_session_id: "unknown", program_type_slug: "unknown-adult" },
      { ...aerialRow, external_session_id: "test", title: "QA_TEST hidden class" },
      {
        ...aerialRow,
        external_session_id: "outside",
        starts_at: "2026-08-27T15:30:00.000Z",
        ends_at: "2026-08-27T16:30:00.000Z",
      },
    ];
    const logs: Record<string, unknown>[] = [];
    const response = await createGoldmineScheduleHandler(
      dependencies({ listRows: async () => rows, log: (record) => logs.push(record) }),
    )(request());
    const body = (await response.json()) as { sessions: PublicSchedule[] };
    expect(body.sessions.map((session) => session.external_session_id)).toEqual([
      `class_${aerialRow.external_session_id}`,
    ]);
    expect(logs.at(-1)).toMatchObject({ unmapped_class_types_count: 1, session_count: 1 });
  });

  test("supports exact class filtering and chronological ordering", async () => {
    const hot = {
      ...aerialRow,
      external_session_id: "hot-session",
      program_type_slug: "hot-pilates-program",
      starts_at: "2026-08-20T14:30:00.000Z",
      ends_at: "2026-08-20T15:30:00.000Z",
    };
    const query =
      "start_at=2026-08-19T10%3A00%3A00Z&end_at=2026-08-26T10%3A00%3A00Z&class_type=hot_pilates";
    const response = await createGoldmineScheduleHandler(
      dependencies({ listRows: async () => [aerialRow, hot] }),
    )(request(query));
    const body = (await response.json()) as { sessions: PublicSchedule[] };
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]?.class_type).toBe("hot_pilates");
  });

  test("excludes sessions that expired after the requested window began", async () => {
    const expired = {
      ...aerialRow,
      starts_at: "2026-08-19T09:00:00.000Z",
      ends_at: "2026-08-19T09:59:00.000Z",
    };
    const query = "start_at=2026-08-18T10%3A00%3A00Z&end_at=2026-08-25T10%3A00%3A00Z";
    const response = await createGoldmineScheduleHandler(
      dependencies({ listRows: async () => [expired] }),
    )(request(query));
    expect(((await response.json()) as { sessions: PublicSchedule[] }).sessions).toEqual([]);
  });

  test("counts confirmed bookings, floors remaining capacity, and preserves unknown capacity", async () => {
    const full = {
      ...aerialRow,
      external_session_id: "full",
      capacity: 4,
      confirmed_booking_count: 9,
    };
    const unknown = {
      ...aerialRow,
      external_session_id: "unknown-capacity",
      capacity: null,
      confirmed_booking_count: 2,
    };
    const response = await createGoldmineScheduleHandler(
      dependencies({ listRows: async () => [full, unknown] }),
    )(request());
    const body = (await response.json()) as { sessions: PublicSchedule[] };
    expect(body.sessions[0]).toMatchObject({
      booking_enabled: false,
      capacity: 4,
      confirmed_booking_count: 9,
      remaining_capacity: 0,
    });
    expect(body.sessions[1]).toMatchObject({
      capacity: null,
      confirmed_booking_count: 2,
      remaining_capacity: null,
    });
  });

  test("revision is stable across row ordering and changes with time, status, capacity, or bookings", async () => {
    const second = {
      ...aerialRow,
      external_session_id: "second",
      starts_at: "2026-08-21T15:30:00.000Z",
      ends_at: "2026-08-21T16:30:00.000Z",
    };
    async function revision(rows: ScheduleSourceRow[]) {
      const response = await createGoldmineScheduleHandler(
        dependencies({ listRows: async () => rows }),
      )(request());
      return ((await response.json()) as { source_revision: string }).source_revision;
    }
    const stable = await revision([aerialRow, second]);
    expect(await revision([second, aerialRow])).toBe(stable);
    expect(await revision([{ ...aerialRow, starts_at: "2026-08-20T15:31:00Z" }, second])).not.toBe(
      stable,
    );
    expect(await revision([{ ...aerialRow, status: "cancelled" }, second])).not.toBe(stable);
    expect(await revision([{ ...aerialRow, capacity: 9 }, second])).not.toBe(stable);
    expect(await revision([{ ...aerialRow, confirmed_booking_count: 6 }, second])).not.toBe(stable);
  });

  test("public response and logs omit PII, raw booking data, and bearer tokens", async () => {
    const privateFields = {
      member_id: "member-secret-id",
      member_name: "Private Person",
      phone: "+972500000000",
      email: "private@example.com",
      booking_rows: [{ id: "booking-secret", status: "booked" }],
    };
    const logs: Record<string, unknown>[] = [];
    const response = await createGoldmineScheduleHandler(
      dependencies({
        listRows: async () => [{ ...aerialRow, ...privateFields }],
        log: (record) => logs.push(record),
      }),
    )(request(undefined, "highly-secret-token"));
    const serialized = `${await response.text()}${JSON.stringify(logs)}`;
    for (const secret of Object.values(privateFields).flatMap((value) =>
      typeof value === "string" ? [value] : ["booking-secret"],
    )) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("highly-secret-token");
  });

  test("PII changes do not affect source_revision", async () => {
    async function revision(memberName: string) {
      const response = await createGoldmineScheduleHandler(
        dependencies({
          listRows: async () => [
            {
              ...aerialRow,
              member_name: memberName,
              phone: "+972500000000",
              booking_id: `private-${memberName}`,
            },
          ],
        }),
      )(request());
      return ((await response.json()) as { source_revision: string }).source_revision;
    }
    expect(await revision("Person One")).toBe(await revision("Person Two"));
  });

  test("enforces the configured serialized response bound", async () => {
    const response = await createGoldmineScheduleHandler(
      dependencies({ config: { ...config, maxResponseBytes: 100 } }),
    )(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "response_size_limit_exceeded",
    });
  });

  test("rejects source overflow without returning a partial schedule", async () => {
    const response = await createGoldmineScheduleHandler(
      dependencies({
        config: { ...config, maxSessions: 1 },
        listRows: async () => [aerialRow, { ...aerialRow, external_session_id: "second" }],
      }),
    )(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "session_limit_exceeded" });
  });
});

type PublicSchedule = {
  external_session_id: string;
  class_type: string;
  booking_enabled: boolean;
  capacity: number | null;
  confirmed_booking_count: number;
  remaining_capacity: number | null;
};
