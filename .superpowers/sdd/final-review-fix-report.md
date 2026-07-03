# Final Review Fix Report

## Scope

Fixed the final whole-branch review findings for the Mac OpenWA worker operational work in:

- `docs/openwa-mac-worker-operations.md`
- `scripts/openwa-launchd-worker.sh`
- `scripts/openwa-launchd-worker-smoke.sh`

## Fixes Applied

1. Safety-first first-time setup
   - Changed the runbook so the first wrapper execution is `OPENWA_WORKER_DRY_RUN=1`.
   - Added an explicit `OPENWA_WORKER_TEST_PHONE_ONLY=1` wrapper pass before any normal send.
   - Moved the normal wrapper run to the end of setup, after the safety checks.

2. Direct Node invocation safety
   - Removed unsafe examples that passed `OPENWA_WORKER_ENV_FILE` directly to `node`.
   - Replaced them with wrapper-based dry-run commands.
   - Added one optional advanced direct-Node example that explicitly sources the env file first.

3. Launchd Node binary handling
   - Added `OPENWA_NODE_BIN` support in the wrapper, defaulting to `node`.
   - The wrapper now validates the configured binary before launch.
   - Updated the runbook env-file example and launchd notes to recommend an absolute Node path such as `/opt/homebrew/bin/node`.

4. Shell-level smoke verification
   - Added `scripts/openwa-launchd-worker-smoke.sh`.
   - The smoke script creates a temp env file and a temp `OPENWA_NODE_BIN` shim that records arguments and environment, then exits `0`.
   - The verification proves:
     - the wrapper sourced the env file
     - the wrapper invoked the worker entrypoint
     - `--dry-run` reached the worker invocation

## Verification

- `bash scripts/openwa-launchd-worker-smoke.sh` -> passed
- `bun install` -> passed, no dependency changes
- `bun run lint` -> passed with pre-existing warnings only
- `bun run build` -> passed

## Notes

- No local env files or secrets were added to git.
- Unrelated dirty worktree changes were left untouched.
