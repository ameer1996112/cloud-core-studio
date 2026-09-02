# Local Supabase QA environment contract

| Runtime                                | URL variable read      | Key variable read               | Source                                                              | Required for                                                         |
| -------------------------------------- | ---------------------- | ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Browser bundle                         | `VITE_SUPABASE_URL`    | `VITE_SUPABASE_PUBLISHABLE_KEY` | ignored `.env.qa.local`, injected only while building the QA bundle | real local sign-in and browser Supabase queries                      |
| Member server functions / route guards | `SUPABASE_URL`         | `SUPABASE_PUBLISHABLE_KEY`      | guarded mapping in `scripts/qa/serve-member-ui-ux-qa.mjs`           | authenticated loaded-data queries                                    |
| Server admin helper                    | `SUPABASE_URL`         | `SUPABASE_SERVICE_ROLE_KEY`     | local QA environment only                                           | existing server-only helpers; never mapped to browser/public aliases |
| Fixture seed                           | `API_URL` and `DB_URL` | `SERVICE_ROLE_KEY`              | ignored local QA environment only                                   | PostgREST fixture settings/plans and local PostgreSQL auth fixture   |
| Fixture reset                          | `API_URL`              | `SERVICE_ROLE_KEY`              | ignored local QA environment only                                   | fixture-owned record removal and studio-settings restoration         |

The original harness passed `SUPABASE_URL` and the server-only alias but omitted `SUPABASE_PUBLISHABLE_KEY`. TanStack server functions resolve `process.env` at bundle import time, so route shells could load while `getMyPackages` and related authenticated data requests returned an environment error.

The QA adapter accepts only `localhost`, `127.0.0.1`, and `::1`; rejects remote URLs and remote browser aliases; requires a public key distinct from the service-role key; and maps it to `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_ANON_KEY`. No values are recorded here.

## Fixture settings lifecycle and legacy recovery

The original fixture seed changed the shared local `studio_settings` row without saving its prior values. After that legacy seed/reset cycle, the historical pre-seed values could not be reconstructed. On 2026-09-02, the local-only row was placed into a documented safe recovery baseline: payments disabled, provider `none`, mode `test`, email disabled, and WhatsApp disabled. No production or staging service was contacted.

Future seeds snapshot the exact five settings they change before any mutation. The versioned snapshot is stored beside the configured QA env file, ends in `.snapshot.local`, is ignored by Git, and is created with owner-only permissions. Repeated seeds preserve the original snapshot. Reset restores those exact values and removes the snapshot only after the database confirms the restoration. If fixture records exist without a valid snapshot, reset fails closed instead of guessing shared settings.

The seed guard validates `API_URL` and the independently used PostgreSQL `DB_URL` before creating a snapshot, password, auth user, plan, or settings update. Both targets must parse successfully and resolve explicitly to `localhost`, `127.0.0.1`, or `::1`; the database URL must use the PostgreSQL protocol. Database query options are rejected entirely because libpq options such as `host`, `hostaddr`, or `service` can override the URI authority that was validated. Errors use fixed identifiers and do not echo URLs, passwords, or keys. Reset does not require `DB_URL` because it never invokes PostgreSQL directly, but it retains the same explicit opt-in, local API, and service-key checks.

Fixture procedure:

1. Start repository-local Supabase and generate the ignored local QA environment file.
2. Seed only with `APP_ENV=test` and `ALLOW_MEMBER_UI_UX_FIXTURE=true`.
3. Run the reset script after evidence capture, including after an interrupted test run.
4. Confirm the snapshot is removed after reset; if reset reports a missing or invalid snapshot while fixture records remain, stop and investigate rather than deleting records manually.
