# OpenWA Launchd Automation Runbook

This runbook covers the local macOS `launchd` worker that calls the production OpenWA queue route with a bearer token stored in Keychain.

## Production prerequisites

Cloud Run must have these environment variables configured:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWA_AUTOMATION_TOKEN`
- `OPENWA_BASE_URL`
- `OPENWA_API_KEY`
- `OPENWA_SESSION_ID`

`OPENWA_BASE_URL` must not be `localhost` unless Cloud Run can actually reach that host. In practice, `localhost` points at the Cloud Run container itself, not your Mac, so it will usually fail.

## Keychain setup

Store the worker token in the macOS Keychain with this exact command:

```bash
security add-generic-password \
  -U \
  -s cloud-core-openwa-automation \
  -a worker-token \
  -w 'REPLACE_WITH_LONG_RANDOM_TOKEN'
```

Use the same token value for `OPENWA_AUTOMATION_TOKEN` in Cloud Run.

## Install the launch agent

Install the per-user LaunchAgent with:

```bash
bash scripts/install-openwa-launchd.sh
```

## Verify the launch agent

After install, verify the agent is registered and review the relevant success and failure logs:

```bash
launchctl list | grep cloudandcore.openwa-worker
tail -f ~/Library/Logs/CloudCoreOpenWA/worker.log
tail -f ~/Library/Logs/CloudCoreOpenWA/worker-error.log
tail -f ~/Library/Logs/CloudCoreOpenWA/launchd-stdout.log
tail -f ~/Library/Logs/CloudCoreOpenWA/launchd-stderr.log
```

Use `worker.log` for successful polling runs, `worker-error.log` for script-level failures such as missing Keychain tokens or non-200 responses, and `launchd-stdout.log` plus `launchd-stderr.log` for process output from the LaunchAgent itself. The latest HTTP response body is also written to `~/Library/Logs/CloudCoreOpenWA/worker-last-response.body`.

The installer writes the plist to `~/Library/LaunchAgents/com.cloudandcore.openwa-worker.plist` and starts the job on load.

## Manual route smoke test

Use the Keychain token to call the production route directly:

```bash
TOKEN="$(security find-generic-password -s cloud-core-openwa-automation -a worker-token -w)"
curl -sS -X POST \
  'https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run' \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  --data '{"limit":10}'
```

If the route returns `ok: true`, that means the bearer token matched and the worker completed its current pass against the due `payment_confirmed.whatsapp` OpenWA rows it was able to process. Success still depends on the deployed service having valid Supabase access, a reachable `OPENWA_BASE_URL`, a valid `OPENWA_API_KEY`, a live `OPENWA_SESSION_ID`, and the OpenWA session being reachable and healthy. This route does not drain the entire notification queue; it only covers the current OpenWA worker scope.
