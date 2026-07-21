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

## Unified messaging scheduler

The canonical Phase 1/2 worker uses a separate one-minute job so its rollout can be paused or rolled
back without changing this legacy scheduler. Configure it with
`scripts/configure-unified-messaging-cloud-run.sh`; the script deploys
`scripts/unified-messaging-cron.mjs` and creates the scheduler paused by default. Follow the staged
activation and queue checks in [Unified Messaging System](./unified-messaging-system.md) before
resuming it.

Application mutations can also request an immediate post-commit sweep when
`MESSAGING_IMMEDIATE_DISPATCH_ENABLED=true` and `MESSAGING_INTERNAL_SWEEP_URL` points at the same
protected endpoint. This is only a latency optimization. Keep the one-minute job enabled for stale
worker and failed-target recovery.

## APNs

Configure the main app service with the APNs key, key ID, team ID, bundle ID, and production/sandbox
environment expected by `src/lib/apns.server.ts`. Test on a real iPhone before enabling campaigns.
In allowlist mode, add the verified member UUID to `MESSAGING_RECIPIENT_ALLOWLIST`; a phone number
alone authorizes WhatsApp but cannot authorize an APNs delivery.
For canonical admin handoff alerts, add the literal `admin_group` and verify the specific admin
installation in `notification_staff_test_devices`. Allowlist dispatch joins this table and never
fans out to an unverified member or admin installation.

The premium native build registers actionable class, waitlist, account, and staff-reply categories.
Before a real-device allowlist test, confirm the installation appears once, its `apns_environment`
matches the build/key, and it is marked in `notification_staff_test_devices`. Do not enable draft
rich-media events until the Notification Service Extension and approved sound asset are included in
the App Store build.

Automatic `class_open_spots` alerts use the member's **New schedules and lesson openings** setting,
require an active APNs token and remaining credits, and are limited to one alert per day and three per
week. They do not use WhatsApp.

## Official WhatsApp

Use the generated v2 definitions under `whatsapp/templates/v2`. Do not enable WhatsApp for a locale
until its deployment row is approved. Missing locales are suppressed; the worker never substitutes
another language.
