# Local OpenWA Launchd Automation Design

## Summary

Enable fully automatic WhatsApp delivery by keeping OpenWA running on the user's Mac and adding a local `launchd` job that calls the production Cloud Run worker route every `15 seconds`.

This design keeps:

- Cloud Run as the control plane
- Supabase `notification_logs` as the queue and audit source of truth
- the local Mac as the OpenWA runtime host

This pass only covers the automation bridge between the local Mac and the production queue worker. It does not redesign notification templates or business rules.

## Goals

- Make queued WhatsApp notifications send automatically without manual admin action
- Start the trigger automatically after Mac reboot
- Keep the automation token out of plain text files
- Reuse the existing production route `/api/internal/notifications/openwa-run`
- Keep local operational setup simple enough for one-machine studio use

## Non-Goals

- No move to Cloud Scheduler in this pass
- No move of OpenWA hosting from the local Mac to Cloud Run
- No change to notification business rules or approved automatic event set
- No redesign of the OpenWA session bootstrap flow itself
- No broad secret-management platform rollout beyond this local sender path

## Current State

The production app now:

- creates queued automatic Hebrew WhatsApp rows for the approved member events
- exposes a protected internal worker route at `/api/internal/notifications/openwa-run`
- requires `OPENWA_AUTOMATION_TOKEN` to authorize calls to that route

The production deployment still lacks:

- `OPENWA_AUTOMATION_TOKEN`
- a recurring trigger that invokes the route

Cloud Scheduler is also disabled in the project, so there is currently no server-side recurring trigger.

## Recommended Approach

Use a local `launchd` agent on the Mac to call the production worker route every `15 seconds`.

Why this approach:

- it matches the user's decision to keep OpenWA running locally `24/7`
- it survives reboot without opening Terminal
- it avoids adding a Google Cloud scheduler dependency right now
- it keeps the sending control path explicit and easy to debug

## Architecture

### 1. Production control plane

Cloud Run remains responsible for:

- selecting eligible queued WhatsApp rows
- claiming rows safely
- enforcing the current event/language rules
- reporting sent/failed outcomes in `notification_logs`

### 2. Local automation trigger

The Mac runs a lightweight script every `15 seconds` using `launchd`.

The script:

- reads the bearer token from macOS Keychain
- sends a `POST` request to the production worker route
- uses a short timeout so one failed call does not block the next run
- writes simple local logs for success/failure visibility

### 3. Secret storage

Use one shared automation token value in two places:

- Cloud Run environment variable: `OPENWA_AUTOMATION_TOKEN`
- macOS Keychain item on the local Mac

The local script must read from Keychain at runtime rather than storing the token in a repo file, plist, or shell history.

## Data Flow

1. App logic creates a WhatsApp row in `notification_logs` with `status = queued`.
2. Local `launchd` wakes every `15 seconds`.
3. The local script reads the token from Keychain.
4. The local script calls:
   `POST https://cloud-core-studio-190584124070.me-west1.run.app/api/internal/notifications/openwa-run`
5. Cloud Run verifies the bearer token.
6. The worker claims eligible rows and sends through the configured OpenWA runtime.
7. `notification_logs` is updated to `sent`, `failed`, or requeued according to existing worker rules.

## Operational Design

### Launchd job type

Use a per-user `LaunchAgent`, not a system `LaunchDaemon`.

Why:

- OpenWA is tied to the logged-in user environment on the Mac
- Keychain access is simpler in the user session
- it avoids unnecessary root/system ownership complexity

### Trigger cadence

- interval: `15 seconds`
- execution style: periodic repeat, not a long-running while-loop

This keeps failure recovery simple and prevents a single hung process from becoming the permanent sender.

### Sender script behavior

The script should:

- fail fast if Keychain does not return the token
- call the route with `Authorization: Bearer <token>`
- optionally send a small JSON body such as `{ "limit": 10 }`
- exit cleanly on `200`
- log non-`200` responses and network failures

The script should not implement queue logic locally. All queue logic remains on the server.

### Logging

The local automation should write logs to a stable local file path so the user can inspect:

- last successful poll
- authentication failures
- network failures
- non-200 API responses

`launchd` stdout/stderr redirection should also point to stable local log files.

## Required Configuration

### Production Cloud Run

Set these production environment variables:

- `OPENWA_AUTOMATION_TOKEN`
- any already-required OpenWA runtime variables if the server-side OpenWA client depends on them in production:
  - `OPENWA_BASE_URL`
  - `OPENWA_API_KEY`
  - `OPENWA_SESSION_ID`

This design assumes the production route must be able to reach the OpenWA runtime. If the current server-side OpenWA client points to `localhost`, then production configuration must instead point to a reachable OpenWA endpoint. If the OpenWA runtime remains local-only and not network-reachable from Cloud Run, this design cannot work without an additional reachable endpoint layer.

### Local Mac

Set up:

- a Keychain item containing the token
- a sender script at a stable local path
- a `~/Library/LaunchAgents/...plist` file
- `launchctl load/bootstrap` for installation

## Preconditions and Constraint

This design only works if the production Cloud Run route can successfully reach the OpenWA API endpoint used by `createOpenwaClient(...)`.

That means one of these must already be true:

1. the OpenWA API is reachable from Cloud Run over the network, or
2. the OpenWA integration has already been adapted so the local machine performs the actual OpenWA API call itself instead of Cloud Run doing it

If neither is true, the launchd trigger alone is not sufficient. The trigger would wake the worker, but Cloud Run would still fail at the actual OpenWA send step.

## Failure Handling

### Local trigger failures

If the Mac is offline, asleep, or the script fails:

- queued rows remain queued
- delivery resumes automatically on the next successful poll

### Auth failures

If the Keychain token and Cloud Run token drift:

- route returns `401`
- sender logs must surface this clearly
- no queued rows are lost

### OpenWA runtime failures

If OpenWA is unavailable:

- the production worker's existing retry/failure policy remains the source of truth
- the local trigger should not retry inside the same process

## Security

- Do not store the bearer token in the repo
- Do not hardcode the token in the plist
- Do not print the token in logs
- Use Keychain lookup at runtime
- Keep the worker route bearer-protected even though it is an internal path

## Testing

### Configuration verification

- confirm Cloud Run has `OPENWA_AUTOMATION_TOKEN`
- confirm local Keychain returns the same token
- confirm the launch agent is loaded and scheduled

### Route verification

- manual `curl` from the Mac with the Keychain token returns `200`
- response body shows claimed/sent/failed counters

### End-to-end verification

1. create a real queued WhatsApp notification in production
2. confirm the local trigger fires within `15 seconds`
3. confirm the row transitions from `queued` to `sent` or a retry state
4. confirm the WhatsApp message arrives on the target phone

## Risks

### Reachability risk

The main risk is architectural: Cloud Run may not be able to reach the OpenWA API if OpenWA stays bound to the local Mac without a reachable network endpoint.

### Local machine dependency

If the Mac sleeps, loses power, logs out, or OpenWA stops, automatic delivery pauses.

### Keychain/session dependency

If the user session is not active or Keychain access is blocked, the launch agent can fail even though the Mac is online.

## Success Criteria

- after reboot, the local sender starts automatically without opening Terminal
- queued production WhatsApp rows are polled every `15 seconds`
- automatic member WhatsApp rows send without manual admin intervention
- the bearer token is stored in Keychain rather than plain text
- failures are visible in local logs and in `notification_logs`
