# Cloud & Core Staging QA Execution Report

## Verdict

- Release ready: NO
- Reason: clean staging QA could not start because no confirmed disposable
  staging Supabase target is configured.
- Main blockers:
  - `.env.staging` is missing.
  - `.env` points to `banjmspemvzrqckajvwo`, the current regular dev/production-like
    Cloud & Core database.
  - `supabase/config.toml` is linked to `banjmspemvzrqckajvwo`.
  - The only other visible Supabase project, `iuxxebonaamwpgiwqkeq`, was previously
    classified as an unsafe unrelated backend.

## Phase 1 Target Confirmation

| Field                     | Value                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Supabase project ref      | `banjmspemvzrqckajvwo` from `.env` / `supabase/config.toml`    |
| Project name              | `ameer1996112's Project`                                       |
| Environment name          | Not clean staging; current regular Cloud & Core DB             |
| DB URL hostname/ref       | `db.banjmspemvzrqckajvwo.supabase.co` / `banjmspemvzrqckajvwo` |
| Disposable staging        | NO                                                             |
| Destructive tests allowed | NO                                                             |

Decision: STOP. Clean staging was not confirmed, so no mutating release-gate work
was run.

## Environment

- Supabase project ref: `banjmspemvzrqckajvwo`
- Clean staging confirmed: NO
- Destructive tests allowed: NO
- Migrations from zero passed: NO, not attempted because target is unsafe

Visible Supabase projects:

| Ref                    | Name                     | Region           | Linked | Classification                                          |
| ---------------------- | ------------------------ | ---------------- | ------ | ------------------------------------------------------- |
| `banjmspemvzrqckajvwo` | `ameer1996112's Project` | `ap-southeast-2` | YES    | Current regular Cloud & Core DB, not disposable staging |
| `iuxxebonaamwpgiwqkeq` | `ameer1996112's Project` | `ap-southeast-1` | NO     | Unsafe unrelated existing backend                       |

## Commands Run

| Command                                | Result       | Notes                                                                          |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `source .env.staging` target check     | PASS / empty | `.env.staging` does not exist, so no staging env is configured.                |
| `source .env` target check             | PASS         | Current env points to `banjmspemvzrqckajvwo`.                                  |
| `sed -n '1,80p' supabase/config.toml`  | PASS         | Local Supabase config is linked to `banjmspemvzrqckajvwo`.                     |
| `supabase projects list --output json` | PASS         | Only visible projects are the blocked regular DB and unsafe unrelated backend. |

## E2E Results

| Suite                                        | Result  | Notes                                                         |
| -------------------------------------------- | ------- | ------------------------------------------------------------- |
| `node scripts/e2e-seed.mjs`                  | NOT RUN | Would mutate current regular DB; clean staging not confirmed. |
| `node tests/e2e/core_balance_slice.spec.mjs` | NOT RUN | Mutating suite requires disposable staging.                   |
| `node tests/e2e/payments_receipts.spec.mjs`  | NOT RUN | Mutating suite requires disposable staging.                   |
| `node tests/e2e/rpc.spec.mjs`                | NOT RUN | Mutating suite requires disposable staging.                   |

## Browser QA Results

| Flow                          | Role                          | Language | Device          | Result  | Notes                                                    |
| ----------------------------- | ----------------------------- | -------- | --------------- | ------- | -------------------------------------------------------- |
| Full clean staging browser QA | guest/member/instructor/admin | HE/AR/EN | Required matrix | NOT RUN | Requires clean staging DB and seeded staging users/data. |

## Bugs Found

### QA-BLOCKER-001

- Severity: Critical
- Route: N/A
- Role: N/A
- Language: N/A
- Device: N/A
- Steps to reproduce: Start clean staging release gate with current repo env.
- Expected: `.env.staging` targets a confirmed disposable Supabase project.
- Actual: no `.env.staging`; current env and Supabase config target `banjmspemvzrqckajvwo`.
- Evidence/screenshot: this report, plus `supabase projects list`.
- Suggested fix: create/provide a clean staging Supabase project, then create
  `.env.staging` from `.env.staging.example` and rerun this release gate.

## Release Blockers

- No confirmed clean staging/disposable Supabase database.
- Migrations from zero have not been proven.
- Safe staging seed has not been run.
- Mutating E2E suites have not passed on clean staging.
- Full browser QA has not run on clean staging.

## Security/RLS Results

| Test                                       | Expected                                                                | Actual  | Result  |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------- | ------- |
| Clean staging RLS verification             | Policies exist and enforce admin/member/instructor boundaries from zero | Not run | BLOCKED |
| Receipt ownership RLS on clean staging     | Member sees own receipt only                                            | Not run | BLOCKED |
| Instructor payment access on clean staging | Instructor cannot access payments                                       | Not run | BLOCKED |

## Responsive Results

| Route                               | Viewport              | Overflow    | Offending element | Result  |
| ----------------------------------- | --------------------- | ----------- | ----------------- | ------- |
| Required clean staging route matrix | 390/430/820/1024/1440 | Not checked | Unknown           | BLOCKED |

## Language Results

| Route                      | Hebrew  | Arabic  | English | Issues                            |
| -------------------------- | ------- | ------- | ------- | --------------------------------- |
| Clean staging route matrix | Not run | Not run | Not run | BLOCKED by missing staging target |

## Data Cleanup

- Records created: none during this clean staging execution attempt.
- Cleanup performed: NO.
- Cleanup safe: N/A.

## Final Recommendation

Not ready.

Create or provide a clean disposable Supabase staging project, then rerun the
release gate from Phase 1. Do not run the mutating seed/E2E suites against
`banjmspemvzrqckajvwo` or `iuxxebonaamwpgiwqkeq`.
