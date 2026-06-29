const KNOWN_BLOCKED_PROJECT_IDS = new Set(["banjmspemvzrqckajvwo", "iuxxebonaamwpgiwqkeq"]);
const ALLOWED_APP_ENVS = new Set(["staging", "test"]);

function isLocalSupabaseUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function projectIdFromUrl(url) {
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return "local";
    return host.endsWith(".supabase.co") ? host.split(".")[0] : "";
  } catch {
    return "";
  }
}

function fail(message, details = {}) {
  console.error(`\nE2E MUTATION BLOCKED: ${message}`);
  console.error(
    JSON.stringify(
      {
        appEnv: process.env.APP_ENV || "",
        allowMutation: process.env.ALLOW_E2E_MUTATION || "",
        supabaseUrl: process.env.SUPABASE_URL || "",
        supabaseProjectId:
          process.env.SUPABASE_PROJECT_ID ||
          process.env.VITE_SUPABASE_PROJECT_ID ||
          projectIdFromUrl(process.env.SUPABASE_URL),
        ...details,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

export function requireE2eMutationTarget(scriptName) {
  const appEnv = process.env.APP_ENV || "";
  const allowMutation = process.env.ALLOW_E2E_MUTATION || "";
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const projectId =
    process.env.SUPABASE_PROJECT_ID ||
    process.env.VITE_SUPABASE_PROJECT_ID ||
    projectIdFromUrl(supabaseUrl);

  if (allowMutation !== "true") {
    fail(`${scriptName} requires ALLOW_E2E_MUTATION=true.`);
  }

  if (!ALLOWED_APP_ENVS.has(appEnv)) {
    fail(`${scriptName} requires APP_ENV=staging or APP_ENV=test.`);
  }

  if (!supabaseUrl) {
    fail(`${scriptName} requires SUPABASE_URL.`);
  }

  if (!projectId) {
    fail(`${scriptName} could not determine the Supabase project id.`);
  }

  if (projectId === "local" && !isLocalSupabaseUrl(supabaseUrl)) {
    fail(`${scriptName} accepts VITE_SUPABASE_PROJECT_ID=local only for localhost Supabase URLs.`);
  }

  if (KNOWN_BLOCKED_PROJECT_IDS.has(projectId)) {
    fail(`${scriptName} refuses to run against a known blocked Supabase project.`, {
      knownBlockedProjectIds: Array.from(KNOWN_BLOCKED_PROJECT_IDS),
    });
  }

  console.log(
    JSON.stringify(
      {
        e2eMutationTarget: "accepted",
        script: scriptName,
        appEnv,
        supabaseUrl,
        supabaseProjectId: projectId,
      },
      null,
      2,
    ),
  );

  return { appEnv, supabaseUrl, projectId };
}
