# Cloud & Core Studio

Standalone TanStack Start app for Cloud & Core Studio bookings, member self-service, instructor tools, and studio admin operations.

## Setup

```bash
bun install
cp .env.example .env
bun run dev
```

Fill `.env` with the Supabase project URL and publishable key before signing in or calling server functions.

For the public Instagram bio download route, configure the store URLs:

```bash
APP_STORE_URL="https://apps.apple.com/il/app/cloud-core/id6786035836"
GOOGLE_PLAY_URL=""
```

`GOOGLE_PLAY_URL` can stay empty until Android is released; Android visitors will see the branded fallback page.

## Optional OpenWA

The admin messages composer can send WhatsApp messages automatically through a self-hosted OpenWA instance. Without these variables, the app still falls back to the existing manual `wa.me` flow.

For local development:

```bash
bun run openwa:start
```

This clones OpenWA into the ignored `.openwa/` folder, starts its Docker stack, creates/starts a local session named `cloud-core-studio`, and writes the local OpenWA variables into `.env`.

```bash
OPENWA_BASE_URL="http://localhost:2785"
OPENWA_API_KEY="your-openwa-api-key"
OPENWA_SESSION_ID="your-openwa-session-id"
```

`OPENWA_SESSION_ID` must be the generated OpenWA session ID, not the display name. The helper handles this automatically. After startup, open the OpenWA dashboard and scan the QR code for the `cloud-core-studio` session.

Useful commands:

```bash
bun run openwa:logs
bun run openwa:stop
```

## Checks

```bash
bun test tests/unit tests/integration
bun run lint
bun run build
bun run whatsapp:templates:check
```

## Native iOS / Android Shell

This app uses TanStack Start server functions, so the native apps load the deployed HTTPS app URL through Capacitor. Do not build store apps against `localhost`.

Default native behavior:

- `bun run mobile:sync` points the app at the live production server:
  `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- the native shell is now hard-locked to that production URL in `capacitor.config.ts`
- local env vars do not override the native app target anymore

Local native project sync:

```bash
bun run mobile:sync
```

Production native sync:

```bash
bun run mobile:sync:prod
```

Then open the native projects:

```bash
bun run mobile:open:ios
bun run mobile:open:android
```

## Notes

- `.env` is intentionally ignored and must not be committed.
- The app uses TanStack Start, Vite, React, Tailwind CSS, Supabase, and Bun.
- Production builds emit `dist/client` and `dist/server`.
- The public app marketing pages are server-rendered at `/app/he`, `/app/ar`, and `/app/en`; `/app` resolves ordinary browser visitors to a localized page.
- Admins can prepare localized promotion campaigns at `/admin/promotions`; new campaigns stay disabled until audience preview, test send, and explicit activation are complete.
- Web releases update the UI loaded by installed native shells. Native assets and metadata, including the app icon and build number, still require a new TestFlight/App Store binary.
- Native build architecture is documented in `docs/mobile-release-architecture.md`.

## Google Cloud Run

The production container runs the built TanStack Start app with `scripts/serve-production.mjs`. Cloud Run provides the `PORT` environment variable, and the server binds to it.

Build and test locally:

```bash
docker build \
  --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID" \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  -t cloud-core-studio .
docker run --rm -p 8080:8080 --env-file .env cloud-core-studio
```

Deploy from this folder after creating a Google Cloud project with billing enabled and authenticating `gcloud`.

One-time Google Cloud setup:

```bash
PROJECT_ID="your-google-project-id"
REGION="me-west1"
REPOSITORY="cloud-core"
SERVICE="cloud-core-studio"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Cloud & Core containers"

printf "%s" "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
RUNTIME_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_ROLE_KEY \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"
```

Build and push with Cloud Build:

```bash
gcloud builds submit \
  --substitutions _IMAGE="$IMAGE",_VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID",_VITE_SUPABASE_URL="$VITE_SUPABASE_URL",_VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY",_VITE_APNS_ENV="$VITE_APNS_ENV"
```

Deploy to Cloud Run:

```bash
gcloud run deploy cloud-core-studio \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL="$SUPABASE_URL",SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY",APP_STORE_URL="$APP_STORE_URL",GOOGLE_PLAY_URL="$GOOGLE_PLAY_URL" \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest
```

If the secret already exists, add a new version instead of creating it:

```bash
printf "%s" "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-
```

Never commit `SUPABASE_SERVICE_ROLE_KEY` or other secrets to git.
