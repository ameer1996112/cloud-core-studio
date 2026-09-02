const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function parsedLoopbackUrl(value, missingError, invalidError, remoteError, protocols) {
  if (!value) throw new Error(missingError);

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(invalidError);
  }

  if (!protocols.has(parsed.protocol)) throw new Error(invalidError);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!LOOPBACK_HOSTS.has(hostname)) throw new Error(remoteError);
  return parsed;
}

export function requireLocalFixtureTarget(
  env,
  runtimeEnv = process.env,
  { requireDatabase = false } = {},
) {
  if (runtimeEnv.APP_ENV !== "test" || runtimeEnv.ALLOW_MEMBER_UI_UX_FIXTURE !== "true") {
    throw new Error("fixture_requires_explicit_test_opt_in");
  }
  if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
    throw new Error("fixture_local_credentials_missing");
  }

  parsedLoopbackUrl(
    env.API_URL,
    "fixture_local_credentials_missing",
    "fixture_local_api_url_invalid",
    "fixture_refuses_non_local_supabase_target",
    new Set(["http:", "https:"]),
  );

  if (requireDatabase) {
    const databaseUrl = parsedLoopbackUrl(
      env.DB_URL,
      "fixture_local_database_url_missing",
      "fixture_local_database_url_invalid",
      "fixture_refuses_non_local_database_target",
      new Set(["postgres:", "postgresql:"]),
    );
    if ([...databaseUrl.searchParams].length > 0) {
      throw new Error("fixture_database_url_options_not_allowed");
    }
  }
}
