# Member notification operations

The iPhone notification queue must be swept by a hosted process. It must not depend on the local
OpenWA Mac worker.

## Google Cloud Run job and Cloud Scheduler

Production uses a short-lived Cloud Run job triggered every 15 minutes by Cloud Scheduler. The job
calls the authenticated sweep on the main `cloud-core-studio` service and exits. This keeps reminder
delivery hosted without coupling it to the web container or the studio Mac.

Create a Secret Manager secret named `notification-automation-token` with a long random value. Then
run `scripts/configure-notification-cloud-run.sh` with `NOTIFICATION_JOB_IMAGE` set to the deployed
application image. The script:

- attaches the shared secret to the main service and notification job;
- deploys the `cloud-core-notification-sweep` Cloud Run job;
- creates least-privilege runtime and scheduler service accounts; and
- creates or updates the `cloud-core-notification-sweep-15m` Cloud Scheduler job.

Optional environment overrides are documented at the top of the script. After setup, execute the
job once manually and inspect Cloud Logging before enabling member campaigns.

The local OpenWA worker intentionally defaults `OPENWA_WORKER_LIFECYCLE_SWEEP` to `0`. It remains
responsible for OpenWA delivery only. Set it to `1` only for temporary manual recovery.

## APNs

Configure the main app service with the APNs key, key ID, team ID, bundle ID, and production/sandbox
environment expected by `src/lib/apns.server.ts`. Test on a real iPhone before enabling campaigns.

## Official WhatsApp

Create and obtain Meta approval for every JSON definition under `whatsapp/templates/he`,
`whatsapp/templates/ar`, and `whatsapp/templates/en`. Do not enable the official provider for a
language until its template variants show as approved.
