# Cloud Run cost optimization

## Target configuration

| Setting                     | Before audit                            | Target                                                 |
| --------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Cloud Run minimum instances | current and tagged revisions held at 1  | 0 at service and revision level                        |
| Maximum instances           | not the primary guard                   | 3                                                      |
| CPU/memory                  | inspect per revision                    | 1 vCPU / 512 MiB initially                             |
| Concurrency                 | inspect per revision                    | 20                                                     |
| CPU billing                 | idle-capable configuration              | request-based CPU throttling                           |
| Notification trigger        | Cloud Run Job every minute              | post-commit kick + Cloud Tasks + 15-minute maintenance |
| Task dispatch               | inline batch polling                    | max 10/s, max 5 concurrent                             |
| Revision tags               | two old tagged revisions with min scale | remove after rollback decision                         |

For an app with roughly five users, scale-to-zero and event-driven delivery should put application compute near the Cloud Run free tier in quiet periods. It cannot guarantee a zero invoice: database, networking, Artifact Registry, Secret Manager, provider fees, and genuine traffic can still cost money.

## Safe workflow

1. Run `scripts/gcp/audit-cloud-run-cost-config.sh` and save the output privately.
2. Review the dry-run plan from `scripts/gcp/configure-notification-infrastructure.sh`.
3. Deploy the application code with every new flag false and `NOTIFICATIONS_DRY_RUN=true`.
4. Follow the rollout runbook. Do not run `--apply` directly from an unreviewed checkout.
5. Create billing budgets/alerts in the billing account (for example at ₪20 and ₪40); budget alerts notify but do not cap spend.
6. Inspect billing by SKU after 24–48 hours. Forecasts based on one partial day are noisy; compare actual daily cost.

The staging GoldMine Sheets worker also runs every five minutes. If that staging integration is not actively being tested, pause its scheduler separately after confirming ownership; it is outside the production notification rollout and the provided script intentionally does not alter it.

The configuration script is idempotent in intent, defaults to dry-run, leaves all feature flags false, and requires an explicit `--apply`. It does not deploy application code or run migrations.

The script clears both service-level (`--min=0`) and new-revision (`--min-instances=0`) minimums, following [Google Cloud's scaling flag definitions](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update). Old tagged revisions are immutable and can still retain paid minimums. Tag removal is opt-in through `CLOUD_RUN_REMOVE_REVISION_TAGS`; review the exact tags after the rollback window before using it.
