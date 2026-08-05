# ManyChat V3 staging runbook (Stage 1)

This runbook covers repository setup and deployment of an inert staging service only. Stage 1 does
not create a database schema, booking behavior, APIs, ManyChat automations, Meta/CAPI resources, V2
changes, or production changes.

## Safety boundary

| Concern                 | Required staging boundary                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Cloud Run               | `cloud-core-studio-staging` in `me-west1` by default                                          |
| Production Cloud Run    | `cloud-core-studio` is rejected and must never be passed to these scripts                     |
| Supabase                | A distinct staging project containing synthetic/test data only                                |
| Protected Supabase refs | `banjmspemvzrqckajvwo` and `iuxxebonaamwpgiwqkeq` are rejected, including inside URLs         |
| Runtime identity        | A dedicated service account whose name includes `staging`                                     |
| Runtime secrets         | Three distinct staging Secret Manager resources; values are never CLI arguments or build args |
| Messaging               | Scheduler, ManyChat V3, outbound delivery, and every external channel remain disabled         |
| Smoke test              | Read-only Cloud Run inspection plus `GET /support`; it creates or changes nothing             |

Never copy production data into the staging Supabase project. Use synthetic identities, test-only
notification destinations, and test provider configuration. Never use either protected project ref,
even temporarily.

## Prerequisites

- `gcloud` is installed and authenticated to the intended GCP project. The staging service may live
  in the existing GCP project or a separate staging GCP project; isolation comes from the literal
  staging service, dedicated identity, staging image, distinct secrets, and distinct Supabase project.
- Cloud Build, Cloud Run, Artifact Registry, IAM, and Secret Manager are already enabled by an
  authorized platform administrator. These scripts do not provision infrastructure.
- The Artifact Registry repository named in `STAGING_IMAGE` already exists.
- A distinct staging Supabase project exists and contains no production/customer data.
- The operator can submit builds and describe the dedicated service account and secrets.
- The Cloud Build identity can deploy only the staging service and act as the staging runtime service
  account. Do not grant it permission to change `cloud-core-studio`.

## Prepare the local staging environment

Create the ignored local file and replace every `your-*` placeholder with staging-only values:

```bash
cp .env.staging.example .env.staging
${EDITOR:-vi} .env.staging
```

The file must contain only public Supabase values, infrastructure identifiers, and Secret Manager
resource names. It must not contain the Supabase service-role key, ManyChat bearer value, test
notification JSON/value, customer data, or any other server secret.

Load it into the current shell and clear raw secret variables that could have been inherited from
another environment:

```bash
set -a
source ./.env.staging
set +a
unset SUPABASE_SERVICE_ROLE_KEY MANYCHAT_BEARER_TOKEN TEST_NOTIFICATION_CONFIG
unset VITE_SUPABASE_SERVICE_ROLE_KEY VITE_MANYCHAT_BEARER_TOKEN VITE_TEST_NOTIFICATION_CONFIG
```

Validate locally. `--check` does not call `gcloud`:

```bash
bash scripts/deploy-manychat-v3-staging.sh --check
```

The check fails closed unless the service is exactly `cloud-core-studio-staging`, the public Supabase
values match, the service account and secret names are staging-specific, and all three secret resource
names are distinct. The GCP project ID is explicit but does not need to contain the word `staging`.

## Service account and Secret Manager setup

The deployment script verifies that resources exist; it does not create them. The following setup
commands identify resources by name only. Run them only in the intended GCP project and keep every
target scoped to the dedicated staging resources.

Create the dedicated identity if an administrator has not already created it:

```bash
STAGING_SERVICE_ACCOUNT_NAME="${STAGING_SERVICE_ACCOUNT%%@*}"
gcloud iam service-accounts create "$STAGING_SERVICE_ACCOUNT_NAME" \
  --display-name="ManyChat V3 staging runtime" \
  --project="$GCP_PROJECT_ID"
```

Create the three distinct secret resources if they do not already exist:

```bash
for STAGING_SECRET_NAME in \
  "$SUPABASE_SERVICE_ROLE_SECRET" \
  "$MANYCHAT_BEARER_SECRET" \
  "$TEST_NOTIFICATION_CONFIG_SECRET"; do
  gcloud secrets describe "$STAGING_SECRET_NAME" --project="$GCP_PROJECT_ID" >/dev/null 2>&1 || \
    gcloud secrets create "$STAGING_SECRET_NAME" \
      --replication-policy="automatic" \
      --project="$GCP_PROJECT_ID"
done
```

Add each initial value through an approved stdin flow. The commands intentionally contain no value:

```bash
gcloud secrets versions add "$SUPABASE_SERVICE_ROLE_SECRET" \
  --data-file=- --project="$GCP_PROJECT_ID"
gcloud secrets versions add "$MANYCHAT_BEARER_SECRET" \
  --data-file=- --project="$GCP_PROJECT_ID"
gcloud secrets versions add "$TEST_NOTIFICATION_CONFIG_SECRET" \
  --data-file=- --project="$GCP_PROJECT_ID"
```

Grant the dedicated staging identity access to those three resources only:

```bash
for STAGING_SECRET_NAME in \
  "$SUPABASE_SERVICE_ROLE_SECRET" \
  "$MANYCHAT_BEARER_SECRET" \
  "$TEST_NOTIFICATION_CONFIG_SECRET"; do
  gcloud secrets add-iam-policy-binding "$STAGING_SECRET_NAME" \
    --member="serviceAccount:$STAGING_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$GCP_PROJECT_ID"
done
```

Never retrieve secret values merely to verify setup. Verify the resources and bindings by metadata
only:

```bash
gcloud iam service-accounts describe "$STAGING_SERVICE_ACCOUNT" \
  --project="$GCP_PROJECT_ID"
for STAGING_SECRET_NAME in \
  "$SUPABASE_SERVICE_ROLE_SECRET" \
  "$MANYCHAT_BEARER_SECRET" \
  "$TEST_NOTIFICATION_CONFIG_SECRET"; do
  gcloud secrets describe "$STAGING_SECRET_NAME" --project="$GCP_PROJECT_ID"
done
```

## Deploy

From the repository root, with `.env.staging` still loaded:

```bash
bash scripts/deploy-manychat-v3-staging.sh --check
bash scripts/deploy-manychat-v3-staging.sh
```

The deploy script submits `cloudbuild.staging.yaml`. Only public Supabase values enter Docker build
arguments and the corresponding non-secret runtime variables. Cloud Build deploys the literal service
`cloud-core-studio-staging`, attaches the dedicated identity, keeps messaging disabled, and injects
server secrets at Cloud Run runtime with `--set-secrets`. It does not run a production traffic command
or call `update-traffic`.

Do not use `cloudbuild.yaml` for this staging flow. That manifest belongs to the existing production
service.

## Smoke test

Run the read-only smoke script with the same environment:

```bash
bash scripts/smoke-manychat-v3-staging.sh
```

It describes `cloud-core-studio-staging`, verifies the returned service name, generated Cloud Run URL,
and dedicated staging service account, then obtains a short-lived caller identity token and requests
the existing `/support` route. The token is passed to curl over stdin, not in command arguments or
output. The operator therefore needs Cloud Run Invoker on the staging service. The script does not read
application secret values, add an endpoint, send a notification, mutate data, expose Cloud Run
publicly, or change Cloud Run.

## Staging-only rollback

Rollback is allowed only to a previously inspected revision of `cloud-core-studio-staging`. First list
the staging revisions:

```bash
gcloud run revisions list \
  --service="cloud-core-studio-staging" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID"
```

Choose a known-safe staging revision, validate its prefix, and inspect its configuration without
reading secret values:

```bash
STAGING_ROLLBACK_REVISION="cloud-core-studio-staging-REPLACE_WITH_REVISION"
case "$STAGING_ROLLBACK_REVISION" in
  cloud-core-studio-staging-*) ;;
  *) echo "Refusing non-staging revision" >&2; exit 1 ;;
esac

gcloud run revisions describe "$STAGING_ROLLBACK_REVISION" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID"
```

Move only staging traffic, then repeat the smoke test:

```bash
gcloud run services update-traffic "cloud-core-studio-staging" \
  --to-revisions="$STAGING_ROLLBACK_REVISION=100" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID" \
  --quiet

bash scripts/smoke-manychat-v3-staging.sh
```

Never substitute `cloud-core-studio` in any rollback command. A staging failure does not authorize a
production deploy, production traffic change, production secret change, or use of customer data.
