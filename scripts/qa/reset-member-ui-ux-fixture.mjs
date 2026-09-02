/** Removes only the local milestone-2 fixture and restores its saved studio settings. */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  loadStudioSettingsSnapshot,
  requireSnapshotForReset,
  resolveFixtureEnvPath,
  restoreStudioSettingsSnapshot,
  snapshotPathForEnvPath,
} from "./member-ui-ux-fixture-lifecycle.mjs";
import { requireLocalFixtureTarget } from "./member-ui-ux-local-target.mjs";

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

async function main() {
  const env = parseEnv(await readFile(ENV_PATH, "utf8"));
  requireLocalFixtureTarget(env);
  const supabase = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: users, error: userListError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (userListError) throw userListError;
  const fixtureUser = users.users.find((user) => user.email === FIXTURE_EMAIL);

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id")
    .in("description", FIXTURE_MARKERS);
  if (plansError) throw plansError;
  const snapshot = requireSnapshotForReset(
    await loadStudioSettingsSnapshot(STUDIO_SETTINGS_SNAPSHOT_PATH),
    Boolean(fixtureUser || plans.length > 0),
  );

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
  if (snapshot) {
    await restoreStudioSettingsSnapshot(STUDIO_SETTINGS_SNAPSHOT_PATH, async (settings) => {
      const { data, error } = await supabase
        .from("studio_settings")
        .update(settings)
        .eq("id", 1)
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(
          `fixture_studio_settings_restore:${error?.message || error?.code || "missing"}`,
        );
      }
    });
  }
  console.log("member-ui-ux-local-fixture-reset");
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : error?.message || error?.code || "unknown";
  console.error(`member-ui-ux-local-fixture-reset-failed:${message}`);
  process.exit(1);
});
