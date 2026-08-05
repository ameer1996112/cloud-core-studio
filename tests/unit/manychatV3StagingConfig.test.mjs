import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const deployScript = join(repoRoot, "scripts/deploy-manychat-v3-staging.sh");
const smokeScript = join(repoRoot, "scripts/smoke-manychat-v3-staging.sh");
const manifestPath = join(repoRoot, "cloudbuild.staging.yaml");
const envExamplePath = join(repoRoot, ".env.staging.example");

const stagingRef = "stagingabcdefghijkl";
const safeEnv = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  APP_ENV: "staging",
  GCP_PROJECT_ID: "cloud-core-staging-project",
  GCP_REGION: "me-west1",
  CLOUD_RUN_SERVICE: "cloud-core-studio-staging",
  STAGING_SERVICE_ACCOUNT: "manychat-v3-staging@cloud-core-staging-project.iam.gserviceaccount.com",
  STAGING_IMAGE:
    "me-west1-docker.pkg.dev/cloud-core-staging-project/staging/cloud-core-studio-staging",
  SUPABASE_PROJECT_ID: stagingRef,
  SUPABASE_URL: `https://${stagingRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test_only",
  VITE_SUPABASE_PROJECT_ID: stagingRef,
  VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test_only",
  SUPABASE_SERVICE_ROLE_SECRET: "manychat-v3-staging-supabase-service-role",
  MANYCHAT_BEARER_SECRET: "manychat-v3-staging-bearer",
  TEST_NOTIFICATION_CONFIG_SECRET: "manychat-v3-staging-test-notification-config",
};

function run(script, args = [], env = safeEnv) {
  return spawnSync("bash", [script, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
}

function installFakeTools() {
  const root = mkdtempSync(join(tmpdir(), "manychat-v3-staging-test-"));
  const bin = join(root, "bin");
  const gcloudLog = join(root, "gcloud.log");
  const curlLog = join(root, "curl.log");

  spawnSync("mkdir", ["-p", bin]);
  writeFileSync(
    join(bin, "gcloud"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'gcloud' >> "$GCLOUD_LOG"
printf ' <%s>' "$@" >> "$GCLOUD_LOG"
printf '\\n' >> "$GCLOUD_LOG"
if [[ "\${1:-}" == "secrets" && "\${2:-}" == "describe" && "\${3:-}" == "\${FAKE_MISSING_SECRET:-}" ]]; then
  exit 1
fi
if [[ "\${1:-}" == "iam" && "\${2:-}" == "service-accounts" && "\${3:-}" == "describe" && "\${4:-}" == "\${FAKE_MISSING_SERVICE_ACCOUNT:-}" ]]; then
  exit 1
fi
if [[ "\${1:-}" == "run" && "\${2:-}" == "services" && "\${3:-}" == "describe" ]]; then
  printf '%s\\t%s\\t%s\\n' \
    "\${FAKE_SERVICE_NAME:-cloud-core-studio-staging}" \
    "\${FAKE_SERVICE_URL:-https://cloud-core-studio-staging-abc-me.a.run.app}" \
    "\${FAKE_SERVICE_ACCOUNT:-manychat-v3-staging@cloud-core-staging-project.iam.gserviceaccount.com}"
fi
if [[ "\${1:-}" == "auth" && "\${2:-}" == "print-identity-token" ]]; then
  printf '%s\\n' 'fake-identity-token'
fi
`,
  );
  writeFileSync(
    join(bin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'curl' >> "$CURL_LOG"
printf ' <%s>' "$@" >> "$CURL_LOG"
printf '\\n' >> "$CURL_LOG"
if [[ " $* " != *" --config - "* ]]; then
  exit 2
fi
CURL_CONFIG="$(cat)"
if [[ "$CURL_CONFIG" != *"Authorization: Bearer fake-identity-token"* ]]; then
  exit 3
fi
exit "\${FAKE_CURL_STATUS:-0}"
`,
  );
  chmodSync(join(bin, "gcloud"), 0o755);
  chmodSync(join(bin, "curl"), 0o755);

  return {
    env: {
      ...safeEnv,
      PATH: `${bin}:${safeEnv.PATH}`,
      GCLOUD_LOG: gcloudLog,
      CURL_LOG: curlLog,
    },
    gcloudLog,
    curlLog,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function logContents(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("ManyChat V3 staging deploy safety", () => {
  test("--check accepts a complete staging-only configuration without calling gcloud", () => {
    const tools = installFakeTools();
    try {
      const result = run(deployScript, ["--check"], tools.env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("staging configuration is valid");
      expect(logContents(tools.gcloudLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });

  test("--check reports the staging service and me-west1 defaults when overrides are absent", () => {
    const tools = installFakeTools();
    try {
      const defaultedEnv = { ...tools.env };
      delete defaultedEnv.CLOUD_RUN_SERVICE;
      delete defaultedEnv.GCP_REGION;

      const result = run(deployScript, ["--check"], defaultedEnv);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("service=cloud-core-studio-staging");
      expect(result.stdout).toContain("region=me-west1");
      expect(logContents(tools.gcloudLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });

  test("accepts dedicated staging resources inside an existing GCP project", () => {
    const tools = installFakeTools();
    try {
      const result = run(deployScript, ["--check"], {
        ...tools.env,
        GCP_PROJECT_ID: "cloudandcorestudio",
        STAGING_SERVICE_ACCOUNT: "manychat-v3-staging@cloudandcorestudio.iam.gserviceaccount.com",
        STAGING_IMAGE:
          "me-west1-docker.pkg.dev/cloudandcorestudio/staging/cloud-core-studio-staging",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("staging configuration is valid");
      expect(logContents(tools.gcloudLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });

  test("rejects the production Cloud Run service before any external command", () => {
    const tools = installFakeTools();
    try {
      const result = run(deployScript, ["--check"], {
        ...tools.env,
        CLOUD_RUN_SERVICE: "cloud-core-studio",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("refuses production Cloud Run service");
      expect(logContents(tools.gcloudLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });

  test("rejects both protected Supabase refs when they appear directly or inside a URL", () => {
    const cases = [
      { SUPABASE_PROJECT_ID: "banjmspemvzrqckajvwo" },
      { SUPABASE_PROJECT_ID: "iuxxebonaamwpgiwqkeq" },
      { SUPABASE_URL: "https://banjmspemvzrqckajvwo.supabase.co" },
      { VITE_SUPABASE_URL: "https://iuxxebonaamwpgiwqkeq.supabase.co" },
    ];

    for (const unsafe of cases) {
      const result = run(deployScript, ["--check"], { ...safeEnv, ...unsafe });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("protected Supabase project ref");
    }
  });

  test("requires matching non-placeholder staging Supabase public configuration", () => {
    const cases = [
      { SUPABASE_PROJECT_ID: "your-staging-project-ref" },
      { SUPABASE_URL: "https://different-staging-ref.supabase.co" },
      { SUPABASE_PUBLISHABLE_KEY: "" },
      { VITE_SUPABASE_PROJECT_ID: "anotherstagingref" },
      { VITE_SUPABASE_PUBLISHABLE_KEY: "your-staging-publishable-key" },
    ];

    for (const unsafe of cases) {
      const result = run(deployScript, ["--check"], { ...safeEnv, ...unsafe });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("staging Supabase");
    }
  });

  test("requires a dedicated staging service account", () => {
    const result = run(deployScript, ["--check"], {
      ...safeEnv,
      STAGING_SERVICE_ACCOUNT: "123456789-compute@developer.gserviceaccount.com",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dedicated staging service account");
  });

  test("requires three distinct staging Secret Manager resource names", () => {
    const result = run(deployScript, ["--check"], {
      ...safeEnv,
      MANYCHAT_BEARER_SECRET: safeEnv.SUPABASE_SERVICE_ROLE_SECRET,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("distinct staging Secret Manager");
  });

  test("rejects raw server secret values and VITE-prefixed secret variables", () => {
    const cases = [
      { SUPABASE_SERVICE_ROLE_KEY: "server-secret-value" },
      { MANYCHAT_BEARER_TOKEN: "server-secret-value" },
      { TEST_NOTIFICATION_CONFIG: "server-secret-value" },
      { VITE_MANYCHAT_BEARER_TOKEN: "server-secret-value" },
    ];

    for (const unsafe of cases) {
      const result = run(deployScript, ["--check"], { ...safeEnv, ...unsafe });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("raw server secrets are forbidden");
    }
  });

  test("verifies infrastructure by name and submits only the staging manifest", () => {
    const tools = installFakeTools();
    try {
      const result = run(deployScript, [], tools.env);
      const gcloudLog = logContents(tools.gcloudLog);

      expect(result.status).toBe(0);
      expect(gcloudLog).toContain(
        `gcloud <iam> <service-accounts> <describe> <${safeEnv.STAGING_SERVICE_ACCOUNT}>`,
      );
      expect(gcloudLog).toContain(
        `gcloud <secrets> <describe> <${safeEnv.SUPABASE_SERVICE_ROLE_SECRET}>`,
      );
      expect(gcloudLog).toContain(
        `gcloud <secrets> <describe> <${safeEnv.MANYCHAT_BEARER_SECRET}>`,
      );
      expect(gcloudLog).toContain(
        `gcloud <secrets> <describe> <${safeEnv.TEST_NOTIFICATION_CONFIG_SECRET}>`,
      );
      expect(gcloudLog).toContain("gcloud <builds> <submit> <--config> <cloudbuild.staging.yaml>");
      expect(gcloudLog).not.toContain("server-secret-value");
      expect(gcloudLog).not.toContain("<cloud-core-studio>");
    } finally {
      tools.cleanup();
    }
  });

  test("fails closed before build submission when a named secret resource is missing", () => {
    const tools = installFakeTools();
    try {
      const result = run(deployScript, [], {
        ...tools.env,
        FAKE_MISSING_SECRET: safeEnv.MANYCHAT_BEARER_SECRET,
      });
      const gcloudLog = logContents(tools.gcloudLog);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        `missing Secret Manager resource: ${safeEnv.MANYCHAT_BEARER_SECRET}`,
      );
      expect(gcloudLog).not.toContain("gcloud <builds> <submit>");
    } finally {
      tools.cleanup();
    }
  });
});

describe("ManyChat V3 staging Cloud Build manifest", () => {
  test("deploys only the staging service with disabled delivery and runtime secret mounts", () => {
    const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
    const parsed = manifest ? Bun.YAML.parse(manifest) : { steps: [] };
    const deployArgs =
      parsed.steps?.find((step) => step.id === "deploy-staging-service")?.args ?? [];
    const envFlagIndex = deployArgs.indexOf("--set-env-vars");
    const envTokens = envFlagIndex >= 0 ? deployArgs[envFlagIndex + 1].split(",") : [];
    const secretsFlagIndex = deployArgs.indexOf("--set-secrets");
    const secretTokens = secretsFlagIndex >= 0 ? deployArgs[secretsFlagIndex + 1].split(",") : [];
    const allArgs = parsed.steps?.flatMap((step) => step.args ?? []) ?? [];

    expect(deployArgs).toContain("cloud-core-studio-staging");
    expect(deployArgs).not.toContain("cloud-core-studio");
    expect(deployArgs).toContain("--set-env-vars");
    expect(deployArgs).not.toContain("--update-env-vars");
    expect(envTokens).toContain("APP_ENV=staging");
    expect(envTokens).toContain("MESSAGING_SCHEDULER_ENABLED=false");
    expect(envTokens).toContain("MESSAGING_DELIVERY_MODE=disabled");
    expect(envTokens).toContain("MANYCHAT_V3_ENABLED=false");
    expect(deployArgs).toContain("--project");
    expect(deployArgs).toContain("$PROJECT_ID");
    expect(deployArgs).toContain("--no-allow-unauthenticated");
    expect(deployArgs).not.toContain("--allow-unauthenticated");
    expect(envTokens).toContain("SUPABASE_PROJECT_ID=${_VITE_SUPABASE_PROJECT_ID}");
    expect(envTokens).toContain("SUPABASE_URL=${_VITE_SUPABASE_URL}");
    expect(envTokens).toContain("SUPABASE_PUBLISHABLE_KEY=${_VITE_SUPABASE_PUBLISHABLE_KEY}");
    expect(deployArgs).toContain("--set-secrets");
    expect(secretTokens).toContain(
      "SUPABASE_SERVICE_ROLE_KEY=${_SUPABASE_SERVICE_ROLE_SECRET}:latest",
    );
    expect(secretTokens).toContain("MANYCHAT_BEARER_TOKEN=${_MANYCHAT_BEARER_SECRET}:latest");
    expect(secretTokens).toContain(
      "TEST_NOTIFICATION_CONFIG=${_TEST_NOTIFICATION_CONFIG_SECRET}:latest",
    );
    expect(allArgs).not.toContain("update-traffic");
    expect(allArgs).not.toContain("--to-latest");
  });

  test("uses only public Supabase build args and never promotes server secrets to VITE variables", () => {
    const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
    const parsed = manifest ? Bun.YAML.parse(manifest) : { steps: [] };
    const buildArgs = parsed.steps?.find((step) => step.id === "build-staging-image")?.args ?? [];
    const serializedBuildArgs = buildArgs.join("\n");

    expect(buildArgs).toContain("VITE_SUPABASE_PROJECT_ID=${_VITE_SUPABASE_PROJECT_ID}");
    expect(buildArgs).toContain("VITE_SUPABASE_URL=${_VITE_SUPABASE_URL}");
    expect(buildArgs).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=${_VITE_SUPABASE_PUBLISHABLE_KEY}");
    expect(serializedBuildArgs).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serializedBuildArgs).not.toContain("MANYCHAT_BEARER");
    expect(serializedBuildArgs).not.toContain("TEST_NOTIFICATION_CONFIG");
    expect(manifest).not.toMatch(/VITE_[A-Z0-9_]*(?:SECRET|TOKEN|SERVICE_ROLE)/);
  });
});

describe("ManyChat V3 staging smoke checks", () => {
  test("rejects the production service before inspecting Cloud Run", () => {
    const tools = installFakeTools();
    try {
      const result = run(smokeScript, [], {
        ...tools.env,
        CLOUD_RUN_SERVICE: "cloud-core-studio",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("refuses production Cloud Run service");
      expect(logContents(tools.gcloudLog)).toBe("");
      expect(logContents(tools.curlLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });

  test("read-only inspection verifies identity and requests the existing public support route", () => {
    const tools = installFakeTools();
    try {
      const result = run(smokeScript, [], tools.env);
      const gcloudLog = logContents(tools.gcloudLog);
      const curlLog = logContents(tools.curlLog);

      expect(result.status).toBe(0);
      expect(gcloudLog).toContain("gcloud <run> <services> <describe> <cloud-core-studio-staging>");
      expect(gcloudLog).toContain("gcloud <auth> <print-identity-token>");
      expect(gcloudLog).not.toMatch(/<(?:deploy|update|delete|replace|update-traffic)>/);
      expect(curlLog).toContain("<--config> <->");
      expect(curlLog).not.toContain("fake-identity-token");
      expect(result.stdout).toContain("staging smoke check passed");
    } finally {
      tools.cleanup();
    }
  });

  test("fails without an HTTP request when the deployed identity is not the dedicated staging account", () => {
    const tools = installFakeTools();
    try {
      const result = run(smokeScript, [], {
        ...tools.env,
        FAKE_SERVICE_ACCOUNT: "wrong@cloud-core-staging-project.iam.gserviceaccount.com",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unexpected Cloud Run service account");
      expect(logContents(tools.curlLog)).toBe("");
    } finally {
      tools.cleanup();
    }
  });
});

describe("ManyChat V3 staging environment template", () => {
  test("documents placeholders and staging-safe defaults without customer or secret values", () => {
    const template = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8") : "";

    expect(template).toContain('CLOUD_RUN_SERVICE="cloud-core-studio-staging"');
    expect(template).toContain('GCP_REGION="me-west1"');
    expect(template).toContain('MESSAGING_DELIVERY_MODE="disabled"');
    expect(template).toContain('MANYCHAT_V3_ENABLED="false"');
    expect(template).toContain("SUPABASE_SERVICE_ROLE_SECRET=");
    expect(template).toContain("MANYCHAT_BEARER_SECRET=");
    expect(template).toContain("TEST_NOTIFICATION_CONFIG_SECRET=");
    expect(template).not.toContain("banjmspemvzrqckajvwo");
    expect(template).not.toContain("iuxxebonaamwpgiwqkeq");
    expect(template).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });
});
