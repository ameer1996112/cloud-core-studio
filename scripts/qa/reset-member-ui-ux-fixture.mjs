/** Resets only the named local milestone-2 fixture user and its exact fixture plans. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = resolve(process.cwd(), ".env.qa.local");
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

async function main() {
  const env = parseEnv(await readFile(ENV_PATH, "utf8"));
  requireLocalTarget(env);
  const supabase = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: users, error: userListError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (userListError) throw userListError;
  const fixtureUser = users.users.find((user) => user.email === FIXTURE_EMAIL);

  if (fixtureUser) {
    for (const result of [
      await supabase.from("account_deletion_requests").delete().eq("member_id", fixtureUser.id),
      await supabase.from("member_plans").delete().eq("member_id", fixtureUser.id),
      await supabase.from("credit_transactions").delete().eq("member_id", fixtureUser.id),
      await supabase.from("payments").delete().eq("member_id", fixtureUser.id),
    ]) {
      if (result.error) throw result.error;
    }
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(fixtureUser.id);
    if (deleteUserError) throw deleteUserError;
  }

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id")
    .in("description", FIXTURE_MARKERS);
  if (plansError) throw plansError;
  if (plans.length > 0) {
    const { error: deletePlansError } = await supabase
      .from("plans")
      .delete()
      .in(
        "id",
        plans.map((plan) => plan.id),
      );
    if (deletePlansError) throw deletePlansError;
  }
  console.log("member-ui-ux-local-fixture-reset");
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : error?.message || error?.code || "unknown";
  console.error(`member-ui-ux-local-fixture-reset-failed:${message}`);
  process.exit(1);
});
