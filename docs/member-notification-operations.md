# Member notification operations

The canonical Phase 1/2 architecture, rollout flags, unified sweep endpoint, webhook security,
retention, and rollback procedure are documented in
[Unified Messaging System](./unified-messaging-system.md). The instructions below describe the
legacy hosted member-notification job retained during the non-destructive transition.

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

The local OpenWA worker remains rollback-only. New claims also require
`OPENWA_LEGACY_DELIVERY_ENABLED=true`; leave it false during canonical operation.

## APNs

Configure the main app service with the APNs key, key ID, team ID, bundle ID, and production/sandbox
environment expected by `src/lib/apns.server.ts`. Test on a real iPhone before enabling campaigns.

## Official WhatsApp

Use the generated v2 definitions under `whatsapp/templates/v2`. Do not enable WhatsApp for a locale
until its deployment row is approved. Missing locales are suppressed; the worker never substitutes
another language.
