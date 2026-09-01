# Local Supabase QA environment contract

| Runtime | URL variable read | Key variable read | Source | Required for |
| --- | --- | --- | --- | --- |
| Browser bundle | `VITE_SUPABASE_URL` | `VITE_SUPABASE_PUBLISHABLE_KEY` | ignored `.env.qa.local`, injected only while building the QA bundle | real local sign-in and browser Supabase queries |
| Member server functions / route guards | `SUPABASE_URL` | `SUPABASE_PUBLISHABLE_KEY` | guarded mapping in `scripts/qa/serve-member-ui-ux-qa.mjs` | authenticated loaded-data queries |
| Server admin helper | `SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` | local QA environment only | existing server-only helpers; never mapped to browser/public aliases |

The original harness passed `SUPABASE_URL` and the server-only alias but omitted `SUPABASE_PUBLISHABLE_KEY`. TanStack server functions resolve `process.env` at bundle import time, so route shells could load while `getMyPackages` and related authenticated data requests returned an environment error.

The QA adapter accepts only `localhost`, `127.0.0.1`, and `::1`; rejects remote URLs and remote browser aliases; requires a public key distinct from the service-role key; and maps it to `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_ANON_KEY`. No values are recorded here.
