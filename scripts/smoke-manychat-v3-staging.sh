#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCTION_SERVICE="cloud-core-studio"
readonly STAGING_SERVICE="cloud-core-studio-staging"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-me-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-$STAGING_SERVICE}"
EXPECTED_SERVICE_ACCOUNT="${STAGING_SERVICE_ACCOUNT:-}"
EXPECTED_IMAGE="${STAGING_IMAGE:-}"

[[ -n "$PROJECT_ID" ]] || fail "GCP_PROJECT_ID is required"
[[ "$SERVICE" != "$PRODUCTION_SERVICE" ]] || fail "this script refuses production Cloud Run service $PRODUCTION_SERVICE"
[[ "$SERVICE" == "$STAGING_SERVICE" ]] || fail "CLOUD_RUN_SERVICE must be $STAGING_SERVICE"
[[ -n "$REGION" ]] || fail "GCP_REGION is required"
[[ -n "$EXPECTED_SERVICE_ACCOUNT" ]] || fail "STAGING_SERVICE_ACCOUNT is required"
[[ -n "$EXPECTED_IMAGE" ]] || fail "STAGING_IMAGE is required"
case "$EXPECTED_IMAGE" in
  "${REGION}-docker.pkg.dev/${PROJECT_ID}/"*"/${STAGING_SERVICE}") ;;
  *) fail "STAGING_IMAGE must be a staging Artifact Registry image in $PROJECT_ID and $REGION" ;;
esac
case "$EXPECTED_IMAGE" in
  *[[:space:],]*|*:*|*@*) fail "STAGING_IMAGE must be an untagged image path without spaces or commas" ;;
esac
[[ -n "${SUPABASE_PROJECT_ID:-}" ]] || fail "SUPABASE_PROJECT_ID is required"
[[ -n "${SUPABASE_URL:-}" ]] || fail "SUPABASE_URL is required"
[[ -n "${SUPABASE_PUBLISHABLE_KEY:-}" ]] || fail "SUPABASE_PUBLISHABLE_KEY is required"
[[ -n "${SUPABASE_SERVICE_ROLE_SECRET:-}" ]] || fail "SUPABASE_SERVICE_ROLE_SECRET is required"
[[ -n "${MANYCHAT_BEARER_SECRET:-}" ]] || fail "MANYCHAT_BEARER_SECRET is required"
[[ -n "${TEST_NOTIFICATION_CONFIG_SECRET:-}" ]] || fail "TEST_NOTIFICATION_CONFIG_SECRET is required"

command -v gcloud >/dev/null 2>&1 || fail "gcloud is required for the read-only inspection"
command -v curl >/dev/null 2>&1 || fail "curl is required for the HTTP smoke request"
command -v node >/dev/null 2>&1 || fail "node is required to parse the Cloud Run inspection"

SERVICE_JSON="$(gcloud run services describe "$STAGING_SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format=json)" || \
  fail "unable to describe staging Cloud Run service"

if ! SERVICE_SELECTION="$(
  printf '%s' "$SERVICE_JSON" | node -e '
const fs = require("node:fs");

function stop(message) {
  process.stderr.write("ERROR: " + message + "\n");
  process.exit(1);
}

let service;
try {
  service = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  stop("invalid Cloud Run service description JSON");
}

const serviceName = service?.metadata?.name;
if (serviceName !== "cloud-core-studio-staging") {
  stop("unexpected Cloud Run service identity");
}

const serviceUrl = service?.status?.url;
if (
  typeof serviceUrl !== "string" ||
  !/^https:\/\/cloud-core-studio-staging-[a-z0-9.-]+\.run\.app$/.test(serviceUrl)
) {
  stop("unexpected staging Cloud Run URL");
}

const traffic = service?.status?.traffic;
if (
  !Array.isArray(traffic) ||
  traffic.length !== 1 ||
  traffic[0]?.percent !== 100 ||
  traffic[0]?.tag !== undefined ||
  typeof traffic[0]?.revisionName !== "string" ||
  !/^cloud-core-studio-staging-[a-z0-9-]+$/.test(traffic[0].revisionName)
) {
  stop("unexpected staging serving traffic");
}

process.stdout.write(serviceUrl + "\t" + traffic[0].revisionName);
'
)"; then
  fail "staging service boundary validation failed"
fi

unset SERVICE_JSON

IFS=$'\t' read -r SERVICE_URL SERVING_REVISION <<< "$SERVICE_SELECTION"
unset SERVICE_SELECTION

[[ -n "$SERVICE_URL" && -n "$SERVING_REVISION" ]] || fail "incomplete staging service selection"

REVISION_JSON="$(gcloud run revisions describe "$SERVING_REVISION" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format=json)" || \
  fail "unable to describe staging serving revision"

if ! printf '%s' "$REVISION_JSON" | SERVING_REVISION="$SERVING_REVISION" node -e '
const fs = require("node:fs");

function stop(message) {
  process.stderr.write("ERROR: " + message + "\n");
  process.exit(1);
}

let revision;
try {
  revision = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  stop("invalid Cloud Run revision description JSON");
}

if (revision?.metadata?.name !== process.env.SERVING_REVISION) {
  stop("unexpected serving revision identity");
}

const revisionSpec = revision?.spec;
if (revisionSpec?.serviceAccountName !== process.env.STAGING_SERVICE_ACCOUNT) {
  stop("unexpected Cloud Run service account");
}

if (!Array.isArray(revisionSpec?.containers) || revisionSpec.containers.length !== 1) {
  stop("unexpected serving revision container layout");
}

const container = revisionSpec.containers[0];
const image = container?.image;
const expectedImage = process.env.STAGING_IMAGE || "";
if (
  typeof image !== "string" ||
  !(
    image.startsWith(expectedImage + ":") ||
    image.startsWith(expectedImage + "@sha256:")
  )
) {
  stop("unexpected staging image");
}

if (!Array.isArray(container?.env)) {
  stop("missing Cloud Run runtime env configuration");
}

const envByName = new Map();
for (const entry of container.env) {
  if (!entry || typeof entry.name !== "string" || entry.name.length === 0) {
    stop("invalid Cloud Run runtime env entry");
  }
  if (envByName.has(entry.name)) {
    stop("duplicate Cloud Run runtime env: " + entry.name);
  }
  envByName.set(entry.name, entry);
}

const expectedPublic = new Map([
  ["SUPABASE_PROJECT_ID", process.env.SUPABASE_PROJECT_ID || ""],
  ["SUPABASE_URL", process.env.SUPABASE_URL || ""],
  ["SUPABASE_PUBLISHABLE_KEY", process.env.SUPABASE_PUBLISHABLE_KEY || ""],
]);
for (const [name, expected] of expectedPublic) {
  if (expected.length === 0) {
    stop("missing expected staging public env: " + name);
  }
}

const protectedRefs = ["banjmspemvzrqckajvwo", "iuxxebonaamwpgiwqkeq"];
const publicCandidates = [...expectedPublic.values()];
for (const name of expectedPublic.keys()) {
  const deployed = envByName.get(name);
  if (typeof deployed?.value === "string") {
    publicCandidates.push(deployed.value);
  }
}
if (
  publicCandidates.some((candidate) =>
    protectedRefs.some((projectRef) => candidate.includes(projectRef)),
  )
) {
  stop("protected Supabase project ref detected in expected or deployed public configuration");
}

for (const [name, expected] of expectedPublic) {
  const deployed = envByName.get(name);
  if (deployed?.value !== expected || deployed?.valueFrom !== undefined) {
    stop("deployed staging public env mismatch: " + name);
  }
}

const fixedRuntime = new Map([
  ["APP_ENV", "staging"],
  ["ALLOW_E2E_MUTATION", "false"],
  ["APNS_ENV", "sandbox"],
  ["MANYCHAT_V3_ENABLED", "false"],
  ["MANYCHAT_V3_OUTBOUND_ENABLED", "false"],
  ["MESSAGING_SCHEDULER_ENABLED", "false"],
  ["MESSAGING_IMMEDIATE_DISPATCH_ENABLED", "false"],
  ["MESSAGING_CANONICAL_READS_ENABLED", "false"],
  ["MESSAGING_DELIVERY_MODE", "disabled"],
  ["MESSAGING_WHATSAPP_ENABLED", "false"],
  ["MESSAGING_EMAIL_ENABLED", "false"],
  ["MESSAGING_PUSH_ENABLED", "false"],
  ["OPENWA_LEGACY_DELIVERY_ENABLED", "false"],
  ["OFFICIAL_WHATSAPP_LEGACY_DELIVERY_ENABLED", "false"],
  ["LEGACY_MEMBER_NOTIFICATION_DELIVERY_ENABLED", "false"],
]);
for (const [name, expected] of fixedRuntime) {
  const deployed = envByName.get(name);
  if (deployed?.value !== expected || deployed?.valueFrom !== undefined) {
    stop("unsafe runtime env: " + name);
  }
}

const expectedSecrets = new Map([
  ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_SECRET || ""],
  ["MANYCHAT_BEARER_TOKEN", process.env.MANYCHAT_BEARER_SECRET || ""],
  ["TEST_NOTIFICATION_CONFIG", process.env.TEST_NOTIFICATION_CONFIG_SECRET || ""],
]);
for (const [name, deployed] of envByName) {
  if (deployed?.valueFrom !== undefined && !expectedSecrets.has(name)) {
    stop("unexpected staging secret binding");
  }
}
const expectedEnvNames = new Set([
  ...expectedPublic.keys(),
  ...fixedRuntime.keys(),
  ...expectedSecrets.keys(),
]);
for (const name of envByName.keys()) {
  if (!expectedEnvNames.has(name)) {
    stop("unexpected Cloud Run runtime env: " + name);
  }
}
const expectedSecretNames = [...expectedSecrets.values()];
if (
  expectedSecretNames.some((name) => name.length === 0) ||
  new Set(expectedSecretNames).size !== expectedSecretNames.length
) {
  stop("expected staging secret resource names must be present and distinct");
}
for (const [name, expectedSecretName] of expectedSecrets) {
  const deployed = envByName.get(name);
  if (
    deployed?.value !== undefined ||
    deployed?.valueFrom?.secretKeyRef?.name !== expectedSecretName ||
    deployed?.valueFrom?.secretKeyRef?.key !== "latest"
  ) {
    stop("staging secret binding mismatch: " + name);
  }
}
'; then
  fail "staging runtime boundary validation failed"
fi

unset REVISION_JSON

echo "Validated deployed runtime boundaries for: $STAGING_SERVICE"
echo "Serving revision: $SERVING_REVISION"
echo "Service account: $EXPECTED_SERVICE_ACCOUNT"
echo "Staging URL: $SERVICE_URL"

IDENTITY_TOKEN="$(gcloud auth print-identity-token)" || fail "unable to obtain an identity token for staging smoke"
[[ -n "$IDENTITY_TOKEN" ]] || fail "gcloud returned an empty identity token"

curl --config - <<EOF
url = "${SERVICE_URL}/support"
header = "Authorization: Bearer ${IDENTITY_TOKEN}"
fail
silent
show-error
location
max-time = 20
output = "/dev/null"
EOF

unset IDENTITY_TOKEN

echo "ManyChat V3 staging smoke check passed: GET /support returned success."
