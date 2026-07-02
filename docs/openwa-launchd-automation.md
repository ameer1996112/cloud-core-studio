# OpenWA Launchd Automation Runbook

This runbook covers the local macOS `launchd` worker that calls the production OpenWA queue route with a bearer token stored in Keychain.

## Production prerequisites

Cloud Run must have these environment variables configured:

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

After install, verify the agent is registered and review its logs:

```bash
launchctl list | grep cloudandcore.openwa-worker
tail -f ~/Library/Logs/CloudCoreOpenWA/worker.log
```

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

If the token matches and the Cloud Run env vars are present, the route should return an `ok: true` response with notification counters.
