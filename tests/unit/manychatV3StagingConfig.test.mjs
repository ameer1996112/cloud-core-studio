import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const defaultRevisionName = "cloud-core-studio-staging-00001-abc";
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

const safeRuntimeValues = {
  APP_ENV: "staging",
  ALLOW_E2E_MUTATION: "false",
  APNS_ENV: "sandbox",
  SUPABASE_PROJECT_ID: stagingRef,
  SUPABASE_URL: `https://${stagingRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_test_only",
  MANYCHAT_V3_ENABLED: "false",
  MANYCHAT_V3_OUTBOUND_ENABLED: "false",
  MESSAGING_SCHEDULER_ENABLED: "false",
  MESSAGING_IMMEDIATE_DISPATCH_ENABLED: "false",
  MESSAGING_CANONICAL_READS_ENABLED: "false",
  MESSAGING_DELIVERY_MODE: "disabled",
  MESSAGING_WHATSAPP_ENABLED: "false",
  MESSAGING_EMAIL_ENABLED: "false",
  MESSAGING_PUSH_ENABLED: "false",
  OPENWA_LEGACY_DELIVERY_ENABLED: "false",
  OFFICIAL_WHATSAPP_LEGACY_DELIVERY_ENABLED: "false",
  LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED: "false",
};

const safeSecretBindings = {
  SUPABASE_SERVICE_ROLE_KEY: "manychat-v3-staging-supabase-service-role",
  MANYCHAT_BEARER_TOKEN: "manychat-v3-staging-bearer",
  TEST_NOTIFICATION_CONFIG: "manychat-v3-staging-test-notification-config",
};

function serviceDescription({
  apiVersion = "serving.knative.dev/v1",
  kind = "Service",
  name = "cloud-core-studio-staging",
  url = "https://cloud-core-studio-staging-abc-me.a.run.app",
  serviceAccount = "manychat-v3-staging@cloud-core-staging-project.iam.gserviceaccount.com",
  image = `${safeEnv.STAGING_IMAGE}:build-123`,
  runtimeOverrides = {},
  missingRuntime = [],
  secretOverrides = {},
  missingSecrets = [],
  traffic = [{ latestRevision: true, percent: 100, revisionName: defaultRevisionName }],
} = {}) {
  const runtime = { ...safeRuntimeValues, ...runtimeOverrides };
  const secrets = { ...safeSecretBindings, ...secretOverrides };
  const missingRuntimeNames = new Set(missingRuntime);
  const missingSecretNames = new Set(missingSecrets);

  return {
    apiVersion,
    kind,
    metadata: {
      annotations: {
        "run.googleapis.com/ingress": "all",
      },
      labels: {
        "cloud.googleapis.com/location": "me-west1",
      },
      name,
      namespace: "123456789012",
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            "run.googleapis.com/startup-cpu-boost": "true",
          },
        },
        spec: {
          containerConcurrency: 80,
          containers: [
            {
              env: [
                ...Object.entries(runtime)
                  .filter(([envName]) => !missingRuntimeNames.has(envName))
                  .map(([envName, value]) => ({ name: envName, value })),
                ...Object.entries(secrets)
                  .filter(([envName]) => !missingSecretNames.has(envName))
                  .map(([envName, secretName]) => ({
                    name: envName,
                    valueFrom: {
                      secretKeyRef: {
                        key: "latest",
                        name: secretName,
                      },
                    },
                  })),
              ],
              image,
              ports: [{ containerPort: 8080, name: "http1" }],
              resources: { limits: { cpu: "1000m", memory: "512Mi" } },
            },
          ],
          serviceAccountName: serviceAccount,
          timeoutSeconds: 300,
        },
      },
      traffic: [{ latestRevision: true, percent: 100 }],
    },
    status: {
      conditions: [{ status: "True", type: "Ready" }],
      latestReadyRevisionName: defaultRevisionName,
      traffic,
      url,
    },
  };
}

function revisionDescription({
  apiVersion = "serving.knative.dev/v1",
  kind = "Revision",
  name = defaultRevisionName,
  annotations = { "autoscaling.knative.dev/maxScale": "3" },
  volumes,
  volumeMounts,
  ...runtimeOptions
} = {}) {
  const service = serviceDescription(runtimeOptions);
  const spec = service.spec.template.spec;
  if (volumes !== undefined) spec.volumes = volumes;
  if (volumeMounts !== undefined) spec.containers[0].volumeMounts = volumeMounts;

  return {
    apiVersion,
    kind,
    metadata: {
      annotations,
      labels: {
        "cloud.googleapis.com/location": "me-west1",
        "serving.knative.dev/service": "cloud-core-studio-staging",
      },
      name,
      namespace: "123456789012",
    },
    spec,
    status: {
      conditions: [{ status: "True", type: "Ready" }],
    },
  };
}

function withoutTopLevelField(document, field) {
  delete document[field];
  return document;
}

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
  const serviceJsonPath = join(root, "service.json");
  const revisionJsonPath = join(root, "revision.json");

  mkdirSync(bin);
  writeFileSync(serviceJsonPath, JSON.stringify(serviceDescription()));
  writeFileSync(revisionJsonPath, JSON.stringify(revisionDescription()));
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
  command cat "$FAKE_SERVICE_JSON_PATH"
fi
if [[ "\${1:-}" == "run" && "\${2:-}" == "revisions" && "\${3:-}" == "describe" ]]; then
  command cat "$FAKE_REVISION_JSON_PATH"
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
      FAKE_SERVICE_JSON_PATH: serviceJsonPath,
      FAKE_REVISION_JSON_PATH: revisionJsonPath,
    },
    gcloudLog,
    curlLog,
    setServiceDescription: (description) =>
      writeFileSync(serviceJsonPath, JSON.stringify(description)),
    setRevisionDescription: (description) =>
      writeFileSync(revisionJsonPath, JSON.stringify(description)),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function logContents(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function expectNoAuthenticatedRequest(tools) {
  expect(logContents(tools.gcloudLog)).not.toContain("gcloud <auth> <print-identity-token>");
  expect(logContents(tools.curlLog)).toBe("");
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
      expectNoAuthenticatedRequest(tools);
    } finally {
      tools.cleanup();
    }
  });

  test("rejects a non-staging expected image before inspecting Cloud Run", () => {
    const tools = installFakeTools();
    try {
      const result = run(smokeScript, [], {
        ...tools.env,
        STAGING_IMAGE:
          "me-west1-docker.pkg.dev/cloud-core-staging-project/production/cloud-core-studio",
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("STAGING_IMAGE must be a staging Artifact Registry image");
      expect(logContents(tools.gcloudLog)).toBe("");
      expectNoAuthenticatedRequest(tools);
    } finally {
      tools.cleanup();
    }
  });

  test("rejects non-staging or default service accounts before inspecting Cloud Run", () => {
    const candidates = [
      "manychat-runtime@cloud-core-staging-project.iam.gserviceaccount.com",
      "manychat-staging@other-project.iam.gserviceaccount.com",
      "123456789012-compute@developer.gserviceaccount.com",
      "cloud-core-staging-project@appspot.gserviceaccount.com",
    ];

    for (const serviceAccount of candidates) {
      const tools = installFakeTools();
      try {
        const result = run(smokeScript, [], {
          ...tools.env,
          STAGING_SERVICE_ACCOUNT: serviceAccount,
        });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("dedicated staging service account");
        expect(logContents(tools.gcloudLog)).toBe("");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("rejects every non-staging or non-simple expected secret name before inspection", () => {
    const secretVariables = [
      "SUPABASE_SERVICE_ROLE_SECRET",
      "MANYCHAT_BEARER_SECRET",
      "TEST_NOTIFICATION_CONFIG_SECRET",
    ];

    for (const secretVariable of secretVariables) {
      for (const invalidName of ["production-secret", "staging/invalid-secret"]) {
        const tools = installFakeTools();
        try {
          const result = run(smokeScript, [], {
            ...tools.env,
            [secretVariable]: invalidName,
          });

          expect(result.status).not.toBe(0);
          expect(result.stderr).toContain("staging Secret Manager resource names");
          expect(logContents(tools.gcloudLog)).toBe("");
          expectNoAuthenticatedRequest(tools);
        } finally {
          tools.cleanup();
        }
      }
    }
  });

  test("rejects every duplicate pair of expected secret names before inspection", () => {
    const duplicatePairs = [
      ["SUPABASE_SERVICE_ROLE_SECRET", "MANYCHAT_BEARER_SECRET"],
      ["SUPABASE_SERVICE_ROLE_SECRET", "TEST_NOTIFICATION_CONFIG_SECRET"],
      ["MANYCHAT_BEARER_SECRET", "TEST_NOTIFICATION_CONFIG_SECRET"],
    ];

    for (const [first, second] of duplicatePairs) {
      const tools = installFakeTools();
      try {
        const result = run(smokeScript, [], {
          ...tools.env,
          [second]: tools.env[first],
        });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("three distinct staging Secret Manager resource names");
        expect(logContents(tools.gcloudLog)).toBe("");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("read-only inspection validates deployed boundaries before requesting the support route", () => {
    const tools = installFakeTools();
    try {
      const result = run(smokeScript, [], tools.env);
      const gcloudLog = logContents(tools.gcloudLog);
      const curlLog = logContents(tools.curlLog);
      const combinedOutput = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(0);
      expect(gcloudLog).toContain("gcloud <run> <services> <describe> <cloud-core-studio-staging>");
      expect(gcloudLog).toContain("<--format=json>");
      expect(gcloudLog).toContain(`gcloud <run> <revisions> <describe> <${defaultRevisionName}>`);
      expect(gcloudLog).toContain("gcloud <auth> <print-identity-token>");
      expect(gcloudLog).not.toMatch(/<(?:deploy|update|delete|replace|update-traffic)>/);
      expect(gcloudLog.indexOf("<services> <describe>")).toBeLessThan(
        gcloudLog.indexOf("<revisions> <describe>"),
      );
      expect(gcloudLog.indexOf("<revisions> <describe>")).toBeLessThan(
        gcloudLog.indexOf("<auth> <print-identity-token>"),
      );
      expect(curlLog).toContain("<--config> <->");
      expect(curlLog).not.toContain("fake-identity-token");
      expect(combinedOutput).not.toContain(safeEnv.SUPABASE_PUBLISHABLE_KEY);
      expect(combinedOutput).not.toContain(safeEnv.SUPABASE_SERVICE_ROLE_SECRET);
      expect(combinedOutput).not.toContain(safeEnv.MANYCHAT_BEARER_SECRET);
      expect(combinedOutput).not.toContain(safeEnv.TEST_NOTIFICATION_CONFIG_SECRET);
      expect(combinedOutput).not.toContain('"spec"');
      expect(result.stdout).toContain("staging smoke check passed");
    } finally {
      tools.cleanup();
    }
  });

  test("requires Cloud Run v1 Service and Revision document identities before authentication", () => {
    const cases = [
      {
        service: withoutTopLevelField(serviceDescription(), "apiVersion"),
        error: "unexpected Cloud Run v1 Service document",
      },
      {
        service: serviceDescription({ apiVersion: "serving.knative.dev/v2" }),
        error: "unexpected Cloud Run v1 Service document",
      },
      {
        service: withoutTopLevelField(serviceDescription(), "kind"),
        error: "unexpected Cloud Run v1 Service document",
      },
      {
        service: serviceDescription({ kind: "Revision" }),
        error: "unexpected Cloud Run v1 Service document",
      },
      {
        revision: withoutTopLevelField(revisionDescription(), "apiVersion"),
        error: "unexpected Cloud Run v1 Revision document",
      },
      {
        revision: revisionDescription({ apiVersion: "serving.knative.dev/v2" }),
        error: "unexpected Cloud Run v1 Revision document",
      },
      {
        revision: withoutTopLevelField(revisionDescription(), "kind"),
        error: "unexpected Cloud Run v1 Revision document",
      },
      {
        revision: revisionDescription({ kind: "Service" }),
        error: "unexpected Cloud Run v1 Revision document",
      },
    ];

    for (const candidate of cases) {
      const tools = installFakeTools();
      try {
        if (candidate.service) tools.setServiceDescription(candidate.service);
        if (candidate.revision) tools.setRevisionDescription(candidate.revision);

        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(candidate.error);
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  }, 15_000);

  test("passes when older serving revision is safe even if latest template is unsafe", () => {
    const servingRevision = "cloud-core-studio-staging-00000-safe";
    const tools = installFakeTools();
    try {
      tools.setServiceDescription(
        serviceDescription({
          runtimeOverrides: { MESSAGING_DELIVERY_MODE: "live" },
          traffic: [{ percent: 100, revisionName: servingRevision }],
        }),
      );
      tools.setRevisionDescription(revisionDescription({ name: servingRevision }));

      const result = run(smokeScript, [], tools.env);

      expect(result.status).toBe(0);
      expect(logContents(tools.gcloudLog)).toContain(
        `gcloud <run> <revisions> <describe> <${servingRevision}>`,
      );
      expect(result.stdout).toContain("staging smoke check passed");
    } finally {
      tools.cleanup();
    }
  });

  test("rejects unsafe older serving revision even if latest template is safe", () => {
    const servingRevision = "cloud-core-studio-staging-00000-unsafe";
    const tools = installFakeTools();
    try {
      tools.setServiceDescription(
        serviceDescription({ traffic: [{ percent: 100, revisionName: servingRevision }] }),
      );
      tools.setRevisionDescription(
        revisionDescription({
          name: servingRevision,
          runtimeOverrides: { MESSAGING_DELIVERY_MODE: "live" },
        }),
      );

      const result = run(smokeScript, [], tools.env);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unsafe runtime env: MESSAGING_DELIVERY_MODE");
      expectNoAuthenticatedRequest(tools);
    } finally {
      tools.cleanup();
    }
  });

  test("rejects unexpected deployed service or serving-revision metadata before authentication", () => {
    const cases = [
      {
        service: serviceDescription({ name: "cloud-core-studio" }),
        error: "unexpected Cloud Run service identity",
      },
      {
        service: serviceDescription({
          url: "https://cloud-core-studio-abc-me.a.run.app",
        }),
        error: "unexpected staging Cloud Run URL",
      },
      {
        revision: revisionDescription({ name: "cloud-core-studio-staging-00002-wrong" }),
        error: "unexpected serving revision identity",
      },
      {
        revision: revisionDescription({
          serviceAccount: "wrong@cloud-core-staging-project.iam.gserviceaccount.com",
        }),
        error: "unexpected Cloud Run service account",
      },
      {
        revision: revisionDescription({
          image:
            "me-west1-docker.pkg.dev/cloud-core-staging-project/production/cloud-core-studio:build-123",
        }),
        error: "unexpected staging image",
      },
    ];

    for (const candidate of cases) {
      const tools = installFakeTools();
      try {
        if (candidate.service) tools.setServiceDescription(candidate.service);
        if (candidate.revision) tools.setRevisionDescription(candidate.revision);
        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(candidate.error);
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("rejects ambiguous, tagged, or non-staging serving traffic before authentication", () => {
    const cases = [
      [
        { percent: 50, revisionName: defaultRevisionName },
        { percent: 50, revisionName: "cloud-core-studio-staging-00000-old" },
      ],
      [{ percent: 100, revisionName: defaultRevisionName, tag: "candidate" }],
      [{ percent: 99, revisionName: defaultRevisionName }],
      [{ percent: 100 }],
      [{ percent: 100, revisionName: "cloud-core-studio-00035-production" }],
    ];

    for (const traffic of cases) {
      const tools = installFakeTools();
      try {
        tools.setServiceDescription(serviceDescription({ traffic }));
        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("unexpected staging serving traffic");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("rejects unsafe or missing fixed runtime boundaries before authentication", () => {
    const cases = [
      { runtimeOverrides: { APP_ENV: "production" }, errorName: "APP_ENV" },
      { runtimeOverrides: { ALLOW_E2E_MUTATION: "true" }, errorName: "ALLOW_E2E_MUTATION" },
      { missingRuntime: ["APNS_ENV"], errorName: "APNS_ENV" },
    ];

    for (const candidate of cases) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(revisionDescription(candidate));
        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`unsafe runtime env: ${candidate.errorName}`);
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("rejects staging Supabase public-value drift without printing public keys", () => {
    const cases = [
      { SUPABASE_PROJECT_ID: "differentstagingref" },
      { SUPABASE_URL: "https://differentstagingref.supabase.co" },
      { SUPABASE_PUBLISHABLE_KEY: "unexpected-public-key" },
    ];

    for (const runtimeOverrides of cases) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(revisionDescription({ runtimeOverrides }));
        const result = run(smokeScript, [], tools.env);
        const [driftedName] = Object.keys(runtimeOverrides);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`deployed staging public env mismatch: ${driftedName}`);
        expect(`${result.stdout}${result.stderr}`).not.toContain("unexpected-public-key");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  });

  test("rejects both protected Supabase refs in expected or deployed public configuration", () => {
    const cases = [
      {
        revision: revisionDescription({
          runtimeOverrides: { SUPABASE_PROJECT_ID: "banjmspemvzrqckajvwo" },
        }),
        env: {},
      },
      {
        revision: revisionDescription({
          runtimeOverrides: {
            SUPABASE_URL: "https://banjmspemvzrqckajvwo.supabase.co",
          },
        }),
        env: {},
      },
      {
        revision: revisionDescription({
          runtimeOverrides: { SUPABASE_PROJECT_ID: "iuxxebonaamwpgiwqkeq" },
        }),
        env: {},
      },
      {
        revision: revisionDescription({
          runtimeOverrides: {
            SUPABASE_URL: "https://iuxxebonaamwpgiwqkeq.supabase.co",
          },
        }),
        env: {},
      },
      {
        revision: revisionDescription(),
        env: { SUPABASE_PROJECT_ID: "banjmspemvzrqckajvwo" },
      },
      {
        revision: revisionDescription(),
        env: { SUPABASE_URL: "https://iuxxebonaamwpgiwqkeq.supabase.co" },
      },
    ];

    for (const candidate of cases) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(candidate.revision);
        const result = run(smokeScript, [], { ...tools.env, ...candidate.env });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("protected Supabase project ref");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  }, 15_000);

  test("rejects a wrong or missing resource for each runtime secret binding", () => {
    const secretEnvNames = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "MANYCHAT_BEARER_TOKEN",
      "TEST_NOTIFICATION_CONFIG",
    ];

    for (const secretEnvName of secretEnvNames) {
      for (const mode of ["wrong", "missing"]) {
        const tools = installFakeTools();
        try {
          tools.setRevisionDescription(
            revisionDescription(
              mode === "wrong"
                ? { secretOverrides: { [secretEnvName]: `wrong-staging-${secretEnvName}` } }
                : { missingSecrets: [secretEnvName] },
            ),
          );
          const result = run(smokeScript, [], tools.env);

          expect(result.status).not.toBe(0);
          expect(result.stderr).toContain(`staging secret binding mismatch: ${secretEnvName}`);
          expectNoAuthenticatedRequest(tools);
        } finally {
          tools.cleanup();
        }
      }
    }
  }, 15_000);

  test("rejects an undeclared Secret Manager binding on the serving revision", () => {
    const tools = installFakeTools();
    try {
      const revision = revisionDescription();
      revision.spec.containers[0].env.push({
        name: "UNEXPECTED_SERVER_SECRET",
        valueFrom: {
          secretKeyRef: {
            key: "latest",
            name: "unexpected-staging-secret",
          },
        },
      });
      tools.setRevisionDescription(revision);

      const result = run(smokeScript, [], tools.env);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unexpected staging secret binding");
      expectNoAuthenticatedRequest(tools);
    } finally {
      tools.cleanup();
    }
  });

  test("rejects every Cloud Run secret alias mapping before authentication", () => {
    const aliasMappings = [
      `${safeEnv.SUPABASE_SERVICE_ROLE_SECRET}:projects/999999999999/secrets/${safeEnv.SUPABASE_SERVICE_ROLE_SECRET}`,
      `${safeEnv.SUPABASE_SERVICE_ROLE_SECRET}:different-staging-secret`,
      `extra-staging-alias:unexpected-staging-secret`,
    ];

    for (const aliasMapping of aliasMappings) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(
          revisionDescription({
            annotations: {
              "autoscaling.knative.dev/maxScale": "3",
              "run.googleapis.com/secrets": aliasMapping,
            },
          }),
        );

        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("unexpected staging secret alias mapping");
        expect(`${result.stdout}${result.stderr}`).not.toContain(aliasMapping);
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  }, 15_000);

  test("rejects all serving-revision volumes and volume mounts before authentication", () => {
    const cases = [
      revisionDescription({
        volumes: [{ emptyDir: { medium: "Memory" }, name: "cache" }],
      }),
      revisionDescription({
        volumes: [
          {
            name: "secret-volume",
            secret: {
              items: [{ key: "latest", path: "provider-token" }],
              secretName: "unexpected-staging-secret",
            },
          },
        ],
      }),
      revisionDescription({
        volumeMounts: [{ mountPath: "/mnt/provider", name: "provider-config" }],
      }),
    ];

    for (const revision of cases) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(revision);

        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("unexpected serving revision volume configuration");
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  }, 15_000);

  test("rejects an undeclared plain runtime variable on the serving revision", () => {
    const tools = installFakeTools();
    try {
      const revision = revisionDescription();
      revision.spec.containers[0].env.push({
        name: "PRODUCTION_PROVIDER_CONFIG",
        value: "enabled",
      });
      tools.setRevisionDescription(revision);

      const result = run(smokeScript, [], tools.env);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unexpected Cloud Run runtime env");
      expectNoAuthenticatedRequest(tools);
    } finally {
      tools.cleanup();
    }
  });

  test("rejects every enabled messaging or delivery safety flag before authentication", () => {
    const unsafeValues = {
      MANYCHAT_V3_ENABLED: "true",
      MANYCHAT_V3_OUTBOUND_ENABLED: "true",
      MESSAGING_SCHEDULER_ENABLED: "true",
      MESSAGING_IMMEDIATE_DISPATCH_ENABLED: "true",
      MESSAGING_CANONICAL_READS_ENABLED: "true",
      MESSAGING_DELIVERY_MODE: "live",
      MESSAGING_WHATSAPP_ENABLED: "true",
      MESSAGING_EMAIL_ENABLED: "true",
      MESSAGING_PUSH_ENABLED: "true",
      OPENWA_LEGACY_DELIVERY_ENABLED: "true",
      OFFICIAL_WHATSAPP_LEGACY_DELIVERY_ENABLED: "true",
      LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED: "true",
    };

    for (const [flagName, unsafeValue] of Object.entries(unsafeValues)) {
      const tools = installFakeTools();
      try {
        tools.setRevisionDescription(
          revisionDescription({ runtimeOverrides: { [flagName]: unsafeValue } }),
        );
        const result = run(smokeScript, [], tools.env);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(`unsafe runtime env: ${flagName}`);
        expectNoAuthenticatedRequest(tools);
      } finally {
        tools.cleanup();
      }
    }
  }, 15_000);
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
