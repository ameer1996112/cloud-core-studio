# Member notification operations

The iPhone notification queue must be swept by a hosted process. It must not depend on the local
OpenWA Mac worker.

## Railway cron service

Create a second Railway service from this repository and set its config-as-code path to
`/railway.notifications.json`. Give the cron service these variables:

- `CLOUD_CORE_BASE_URL`: the public HTTPS origin of the main app, without a trailing slash.
- `NOTIFICATION_AUTOMATION_TOKEN`: a long random secret shared with the main app service.
- `NOTIFICATION_SWEEP_LIMIT`: optional; defaults to `50` and is capped at `100`.

The committed Railway config executes `scripts/member-notification-cron.mjs` every 15 minutes and
exits after one authenticated sweep. Configure Railway alerts for failed cron executions.

The local OpenWA worker intentionally defaults `OPENWA_WORKER_LIFECYCLE_SWEEP` to `0`. It remains
responsible for OpenWA delivery only. Set it to `1` only for temporary manual recovery.

## APNs

Configure the main app service with the APNs key, key ID, team ID, bundle ID, and production/sandbox
environment expected by `src/lib/apns.server.ts`. Test on a real iPhone before enabling campaigns.

## Official WhatsApp

Create and obtain Meta approval for every JSON definition under `whatsapp/templates/he`,
`whatsapp/templates/ar`, and `whatsapp/templates/en`. Do not enable the official provider for a
language until its template variants show as approved.
