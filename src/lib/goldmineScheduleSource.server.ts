import { createHash, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isTestRecord } from "@/lib/test-records";

export type GoldmineClassType = "aerial_adults" | "hot_pilates" | "mat_pilates";

const CLASS_TYPES: readonly GoldmineClassType[] = ["aerial_adults", "hot_pilates", "mat_pilates"];
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const RFC3339_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export type ScheduleSourceRow = {
  external_session_id: string;
  title: string;
  program_type_slug: string;
  starts_at: string;
  ends_at: string;
  status: string;
  member_visible: boolean;
  program_type_active: boolean;
  age_groups: string[];
  capacity: number | null;
  confirmed_booking_count: number | string;
};

export type PublicScheduleSession = {
  external_session_id: string;
  class_type: GoldmineClassType;
  starts_at: string;
  ends_at: string;
  status: "scheduled";
  published: true;
  private: false;
  audience: "adults";
  booking_enabled: boolean;
  capacity: number | null;
  confirmed_booking_count: number;
  remaining_capacity: number | null;
};

export type GoldmineScheduleConfig = {
  enabled: boolean;
  audience: string;
  allowedCallers: ReadonlySet<string>;
  programMap: ReadonlyMap<string, GoldmineClassType>;
  queryTimeoutMs: number;
  maxSessions: number;
  maxResponseBytes: number;
};

type VerifiedClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  email?: string;
  email_verified?: boolean;
};

type ScheduleHandlerDependencies = {
  config: GoldmineScheduleConfig;
  now: () => Date;
  verifyIdToken: (token: string, audience: string) => Promise<VerifiedClaims>;
  listRows: (input: ScheduleRowsQuery) => Promise<ScheduleSourceRow[]>;
  log: (record: Record<string, unknown>) => void;
};

type ScheduleRowsQuery = {
  startAt: string;
  endAt: string;
  limit: number;
  signal: AbortSignal;
};

type ParsedWindow = {
  startAt: Date;
  endAt: Date;
  classType: GoldmineClassType | null;
};

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(reason);
  }
}

function jsonResponse(body: unknown, status: number, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-request-id": requestId,
    },
  });
}

function requestIdFor(request: Request) {
  const candidate = request.headers.get("x-request-id")?.trim() ?? "";
  return SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

function parseAwareTimestamp(value: string | null, field: string) {
  if (!value || !RFC3339_WITH_TIMEZONE.test(value)) {
    throw new RequestFailure(400, `${field}_must_be_timezone_aware_rfc3339`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new RequestFailure(400, `${field}_must_be_timezone_aware_rfc3339`);
  }
  return parsed;
}

function parseWindow(url: URL): ParsedWindow {
  const startAt = parseAwareTimestamp(url.searchParams.get("start_at"), "start_at");
  const endAt = parseAwareTimestamp(url.searchParams.get("end_at"), "end_at");
  const duration = endAt.getTime() - startAt.getTime();
  if (duration <= 0) throw new RequestFailure(400, "end_at_must_be_after_start_at");
  if (duration > MAX_WINDOW_MS) throw new RequestFailure(400, "window_exceeds_14_days");

  const rawClassType = url.searchParams.get("class_type");
  if (rawClassType && !CLASS_TYPES.includes(rawClassType as GoldmineClassType)) {
    throw new RequestFailure(400, "invalid_class_type");
  }
  return {
    startAt,
    endAt,
    classType: rawClassType as GoldmineClassType | null,
  };
}

function readBearerToken(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function audienceMatches(claim: string | string[] | undefined, expected: string) {
  return typeof claim === "string" ? claim === expected : claim?.includes(expected) === true;
}

async function authorize(
  request: Request,
  config: GoldmineScheduleConfig,
  verifyIdToken: ScheduleHandlerDependencies["verifyIdToken"],
  now: Date,
) {
  const token = readBearerToken(request);
  if (!token) throw new RequestFailure(401, "unauthorized");

  let claims: VerifiedClaims;
  try {
    claims = await verifyIdToken(token, config.audience);
  } catch {
    throw new RequestFailure(401, "unauthorized");
  }

  if (
    !GOOGLE_ISSUERS.has(claims.iss ?? "") ||
    !audienceMatches(claims.aud, config.audience) ||
    typeof claims.exp !== "number" ||
    claims.exp <= Math.floor(now.getTime() / 1_000) ||
    claims.email_verified !== true ||
    typeof claims.email !== "string"
  ) {
    throw new RequestFailure(401, "unauthorized");
  }

  const caller = claims.email.trim().toLowerCase();
  if (!config.allowedCallers.has(caller)) {
    throw new RequestFailure(403, "forbidden");
  }
  return caller;
}

function nonNegativeInteger(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizedSession(
  row: ScheduleSourceRow,
  programMap: ReadonlyMap<string, GoldmineClassType>,
): PublicScheduleSession | null {
  const classType = programMap.get(row.program_type_slug);
  if (
    !classType ||
    row.status !== "scheduled" ||
    row.member_visible !== true ||
    row.program_type_active !== true ||
    !row.age_groups.includes("adults") ||
    isTestRecord(row.title)
  ) {
    return null;
  }

  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return null;
  }

  const confirmedBookingCount = nonNegativeInteger(row.confirmed_booking_count);
  const capacity =
    row.capacity === null || !Number.isSafeInteger(row.capacity) || row.capacity < 0
      ? null
      : row.capacity;

  const remainingCapacity =
    capacity === null ? null : Math.max(capacity - confirmedBookingCount, 0);
  return {
    external_session_id: `class_${row.external_session_id}`,
    class_type: classType,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "scheduled",
    published: true,
    private: false,
    audience: "adults",
    booking_enabled: remainingCapacity === null || remainingCapacity > 0,
    capacity,
    confirmed_booking_count: confirmedBookingCount,
    remaining_capacity: remainingCapacity,
  };
}

function stableSessionState(session: PublicScheduleSession) {
  return {
    external_session_id: session.external_session_id,
    class_type: session.class_type,
    starts_at: session.starts_at,
    ends_at: session.ends_at,
    status: session.status,
    published: session.published,
    private: session.private,
    audience: session.audience,
    booking_enabled: session.booking_enabled,
    capacity: session.capacity,
    confirmed_booking_count: session.confirmed_booking_count,
    remaining_capacity: session.remaining_capacity,
  };
}

export function computeScheduleRevision(sessions: readonly PublicScheduleSession[]) {
  const stable = sessions.map(stableSessionState).sort((left, right) => {
    const leftKey = `${left.external_session_id}\u0000${left.starts_at}`;
    const rightKey = `${right.external_session_id}\u0000${right.starts_at}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return createHash("sha256").update(JSON.stringify(stable), "utf8").digest("hex");
}

export function createGoldmineScheduleHandler(dependencies: ScheduleHandlerDependencies) {
  return async (request: Request) => {
    const startedAt = performance.now();
    const requestId = requestIdFor(request);
    let caller: string | null = null;
    let status = 500;
    let sessionCount = 0;
    let unmappedCount = 0;
    let revisionPrefix: string | null = null;
    let windowDurationSeconds: number | null = null;

    try {
      if (!dependencies.config.enabled) throw new RequestFailure(404, "not_found");
      if (!dependencies.config.audience || dependencies.config.allowedCallers.size === 0) {
        throw new RequestFailure(503, "schedule_source_not_configured");
      }

      const now = dependencies.now();
      caller = await authorize(request, dependencies.config, dependencies.verifyIdToken, now);
      const window = parseWindow(new URL(request.url));
      windowDurationSeconds = (window.endAt.getTime() - window.startAt.getTime()) / 1_000;
      const effectiveStartAt = new Date(Math.max(window.startAt.getTime(), now.getTime()));

      const rows = await dependencies.listRows({
        startAt: effectiveStartAt.toISOString(),
        endAt: window.endAt.toISOString(),
        limit: dependencies.config.maxSessions + 1,
        signal: AbortSignal.timeout(dependencies.config.queryTimeoutMs),
      });
      if (rows.length > dependencies.config.maxSessions) {
        throw new RequestFailure(503, "session_limit_exceeded");
      }

      const sessions: PublicScheduleSession[] = [];
      for (const row of rows) {
        if (!dependencies.config.programMap.has(row.program_type_slug)) unmappedCount += 1;
        const session = normalizedSession(row, dependencies.config.programMap);
        if (!session || (window.classType && session.class_type !== window.classType)) continue;
        if (
          new Date(session.starts_at) < effectiveStartAt ||
          new Date(session.starts_at) >= window.endAt
        ) {
          continue;
        }
        sessions.push(session);
      }
      sessions.sort(
        (left, right) =>
          new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime() ||
          left.external_session_id.localeCompare(right.external_session_id),
      );

      const sourceRevision = computeScheduleRevision(sessions);
      revisionPrefix = sourceRevision.slice(0, 12);
      sessionCount = sessions.length;
      const body = {
        generated_at: now.toISOString(),
        window_start: window.startAt.toISOString(),
        window_end: window.endAt.toISOString(),
        source_revision: sourceRevision,
        sessions,
      };
      const serialized = JSON.stringify(body);
      if (Buffer.byteLength(serialized, "utf8") > dependencies.config.maxResponseBytes) {
        throw new RequestFailure(503, "response_size_limit_exceeded");
      }
      status = 200;
      return jsonResponse(body, status, requestId);
    } catch (error) {
      const failure =
        error instanceof RequestFailure ? error : new RequestFailure(503, "unavailable");
      status = failure.status;
      const headers = status === 401 ? { "www-authenticate": "Bearer" } : undefined;
      const response = jsonResponse({ ok: false, reason: failure.reason }, status, requestId);
      if (headers) response.headers.set("www-authenticate", headers["www-authenticate"]);
      return response;
    } finally {
      dependencies.log({
        event: "goldmine_schedule_source_request",
        request_id: requestId,
        authorized_caller: caller,
        window_duration_seconds: windowDurationSeconds,
        session_count: sessionCount,
        unmapped_class_types_count: unmappedCount,
        source_revision_prefix: revisionPrefix,
        status_code: status,
        latency_ms: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    }
  };
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function parseProgramMap(raw: string | undefined) {
  const map = new Map<string, GoldmineClassType>();
  if (!raw?.trim()) return map;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_schedule_program_map");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_schedule_program_map");
  }
  for (const [source, canonical] of Object.entries(parsed)) {
    if (!source.trim() || !CLASS_TYPES.includes(canonical as GoldmineClassType)) {
      throw new Error("invalid_schedule_program_map");
    }
    map.set(source, canonical as GoldmineClassType);
  }
  return map;
}

export function loadGoldmineScheduleConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GoldmineScheduleConfig {
  const enabled = environment.GOLDMINE_SCHEDULE_SOURCE_ENABLED?.trim().toLowerCase() === "true";
  const programMap = parseProgramMap(environment.GOLDMINE_SCHEDULE_PROGRAM_MAP_JSON);
  const allowedCallers = new Set(
    (environment.GOLDMINE_SCHEDULE_ALLOWED_CALLERS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const config: GoldmineScheduleConfig = {
    enabled,
    audience: environment.GOLDMINE_SCHEDULE_SOURCE_AUDIENCE?.trim() ?? "",
    allowedCallers,
    programMap,
    queryTimeoutMs: positiveInteger(environment.GOLDMINE_SCHEDULE_QUERY_TIMEOUT_MS, 5_000, 30_000),
    maxSessions: positiveInteger(environment.GOLDMINE_SCHEDULE_MAX_SESSIONS, 200, 500),
    maxResponseBytes: positiveInteger(
      environment.GOLDMINE_SCHEDULE_MAX_RESPONSE_BYTES,
      256_000,
      1_000_000,
    ),
  };

  if (enabled) {
    const configuredTypes = new Set(programMap.values());
    if (
      !config.audience ||
      allowedCallers.size === 0 ||
      CLASS_TYPES.some((classType) => !configuredTypes.has(classType))
    ) {
      throw new Error("incomplete_schedule_source_configuration");
    }
  }
  return config;
}

const googleTokenClient = new OAuth2Client();

async function verifyGoogleIdToken(token: string, audience: string): Promise<VerifiedClaims> {
  const ticket = await googleTokenClient.verifyIdToken({ idToken: token, audience });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("missing_token_payload");
  return payload;
}

async function listScheduleRows(input: ScheduleRowsQuery): Promise<ScheduleSourceRow[]> {
  const query = supabaseAdmin.rpc(
    "goldmine_schedule_source_rows" as never,
    {
      p_start_at: input.startAt,
      p_end_at: input.endAt,
      p_limit: input.limit,
    } as never,
  ) as unknown as {
    abortSignal: (signal: AbortSignal) => Promise<{
      data: ScheduleSourceRow[] | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await query.abortSignal(input.signal);
  if (error) throw new Error("schedule_source_query_failed");
  return data ?? [];
}

export async function handleGoldmineScheduleRequest(request: Request) {
  const requestId = requestIdFor(request);
  let config: GoldmineScheduleConfig;
  try {
    config = loadGoldmineScheduleConfig();
  } catch {
    console.info(
      JSON.stringify({
        event: "goldmine_schedule_source_request",
        request_id: requestId,
        status_code: 503,
        reason: "schedule_source_not_configured",
      }),
    );
    return jsonResponse({ ok: false, reason: "schedule_source_not_configured" }, 503, requestId);
  }

  return createGoldmineScheduleHandler({
    config,
    now: () => new Date(),
    verifyIdToken: verifyGoogleIdToken,
    listRows: listScheduleRows,
    log: (record) => console.info(JSON.stringify(record)),
  })(request);
}
