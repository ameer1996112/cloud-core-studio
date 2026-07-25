# Safe rollout

1. Reconcile historical queues; mark old promotional work historical/cancelled and never replay.
2. Apply the migration in a disposable environment and test only allowlisted owner/staff
   recipients.
3. Run every journey in shadow and review suppression, locale, guardian, and frequency results.
4. Activate transactional booking/class/payment journeys one by one in test-only, then live
   only after explicit business approval.
5. Activate weekly schedule with an initial preview and deterministic week key.
6. Activate renewal and credit journeys, then recommendations.
7. Activate retention only after episode and first-person template approval.
8. Connect and activate lead journeys only after official inbound provider verification.
9. Activate daily briefing last and keep lock-screen content non-sensitive.
10. Review delivery, conversion, suppression, failure, and opt-out metrics weekly.
11. Roll back with journey pause and channel kill switch; do not delete audit evidence.

At every stage, retain an immediate global push/email/WhatsApp kill switch. In-app remains
available unless it is explicitly in maintenance.
