/**
 * Creates the disposable, local-only member fixture for milestone-2 browser QA.
 *
 * Required invocation:
 *   APP_ENV=test ALLOW_MEMBER_UI_UX_FIXTURE=true bun scripts/qa/seed-member-ui-ux-fixture.mjs
 *
 * Credentials are read from the ignored .env.qa.local file created by `supabase status -o env`.
 * The shared studio settings changed for QA are snapshotted beside that ignored file and restored
 * by the reset script. This script deliberately reports no credentials, IDs, or remote endpoints.
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  captureStudioSettingsSnapshot,
  resolveFixtureEnvPath,
  snapshotPathForEnvPath,
} from "./member-ui-ux-fixture-lifecycle.mjs";

const ENV_PATH = resolveFixtureEnvPath(process.cwd(), process.env.ENV_PATH);
const STUDIO_SETTINGS_SNAPSHOT_PATH = snapshotPathForEnvPath(ENV_PATH);
const FIXTURE_EMAIL = "qa-member-ui@cloudcore.test";
const FIXTURE_MARKERS = [
  "member_ui_ux_milestone_2_primary",
  "member_ui_ux_milestone_2_optional_metadata_absent",
];

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1);
        return [line.slice(0, index), value.replace(/^(["'])(.*)\1$/, "$2")];
      }),
  );
}

function requireLocalTarget(env) {
  if (process.env.APP_ENV !== "test" || process.env.ALLOW_MEMBER_UI_UX_FIXTURE !== "true") {
    throw new Error("fixture_requires_explicit_test_opt_in");
  }
  if (!env.API_URL || !env.SERVICE_ROLE_KEY) throw new Error("fixture_local_credentials_missing");
  const host = new URL(env.API_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("fixture_refuses_non_local_supabase_target");
  }
}

async function fixturePassword(env) {
  if (env.QA_MEMBER_UI_UX_PASSWORD) return env.QA_MEMBER_UI_UX_PASSWORD;
  const password = randomBytes(24).toString("base64url");
  await appendFile(ENV_PATH, `\nQA_MEMBER_UI_UX_PASSWORD=${password}\n`, "utf8");
  return password;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function seedLocalAuthUser(env, password) {
  const sql = `
    BEGIN;
    SET LOCAL session_replication_role = replica;
    WITH fixture_user AS (
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${sqlLiteral(FIXTURE_EMAIL)},
        crypt(${sqlLiteral(password)}, gen_salt('bf')), now(),
        '', '', '', '', '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"name":"Member QA","preferred_language":"en","marketing_updates_enabled":false}'::jsonb,
        now(), now()
      )
      ON CONFLICT (email) WHERE is_sso_user = false DO UPDATE SET
        instance_id = EXCLUDED.instance_id,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        confirmation_token = EXCLUDED.confirmation_token,
        recovery_token = EXCLUDED.recovery_token,
        email_change_token_new = EXCLUDED.email_change_token_new,
        email_change = EXCLUDED.email_change,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now()
      RETURNING id, email
    ), identity AS (
      INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      SELECT id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now()
      FROM fixture_user
      ON CONFLICT (provider_id, provider) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        identity_data = EXCLUDED.identity_data,
        updated_at = now()
      RETURNING user_id
    ), profile AS (
      INSERT INTO public.profiles (id, role)
      SELECT id, 'member'::public.app_role FROM fixture_user
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
      RETURNING id
    )
    INSERT INTO public.members (
      id, name, email, preferred_language, remaining_credits, attendance_count, status, tags
    )
    SELECT id, 'Member QA', ${sqlLiteral(FIXTURE_EMAIL)}, 'en', 0, 0, 'active', ARRAY[]::text[]
    FROM profile
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      preferred_language = EXCLUDED.preferred_language,
      remaining_credits = EXCLUDED.remaining_credits,
      attendance_count = EXCLUDED.attendance_count,
      status = EXCLUDED.status,
      tags = EXCLUDED.tags;
    COMMIT;
  `;
  const result = spawnSync(
    "psql",
    [env.DB_URL, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet"],
    {
      input: sql,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    const detail = String(result.stderr || "")
      .replaceAll(FIXTURE_EMAIL, "[fixture-email]")
      .replaceAll(password, "[fixture-password]")
      .replace(/\s+/g, " ")
      .slice(0, 300);
    throw new Error(`fixture_auth_seed_failed:${detail || "unknown"}`);
  }
}

async function upsertPlan(supabase, plan) {
  const { data: existing, error: readError } = await supabase
    .from("plans")
    .select("id")
    .eq("description", plan.description)
    .maybeSingle();
  if (readError) throw new Error(`plan_read:${readError.message || readError.code || "failed"}`);
  const result = existing
    ? await supabase.from("plans").update(plan).eq("id", existing.id)
    : await supabase.from("plans").insert(plan);
  if (result.error)
    throw new Error(`plan_upsert:${result.error.message || result.error.code || "failed"}`);
}

async function main() {
  const env = parseEnv(await readFile(ENV_PATH, "utf8"));
  requireLocalTarget(env);
  const supabase = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  await captureStudioSettingsSnapshot(STUDIO_SETTINGS_SNAPSHOT_PATH, async () => {
    const { data, error } = await supabase
      .from("studio_settings")
      .select("payments_enabled,payments_provider,payments_mode,email_enabled,whatsapp_enabled")
      .eq("id", 1)
      .single();
    if (error || !data) {
      throw new Error(
        `fixture_studio_settings_snapshot_read:${error?.message || error?.code || "missing"}`,
      );
    }
    return data;
  });
  const password = await fixturePassword(env);
  seedLocalAuthUser(env, password);
  for (const result of [
    await supabase
      .from("studio_settings")
      .update({
        payments_enabled: true,
        payments_provider: "hyp",
        payments_mode: "test",
        email_enabled: false,
        whatsapp_enabled: false,
      })
      .eq("id", 1),
  ]) {
    if (result.error)
      throw new Error(
        `fixture_record_upsert:${result.error.message || result.error.code || "failed"}`,
      );
  }

  await upsertPlan(supabase, {
    name: "Member package · 10 credits",
    description: FIXTURE_MARKERS[0],
    credits: 10,
    duration_days: 30,
    price_cents: 19900,
    currency: "ILS",
    active: true,
  });
  await upsertPlan(supabase, {
    name: "Member flexible package · 3 credits",
    description: FIXTURE_MARKERS[1],
    credits: 3,
    duration_days: null,
    price_cents: 7900,
    currency: "ILS",
    active: true,
  });

  console.log("member-ui-ux-local-fixture-ready");
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : error?.message || error?.code || "unknown";
  console.error(`member-ui-ux-local-fixture-failed:${message}`);
  process.exit(1);
});
