# Password reset URL config fix report

## Root cause

The app had a canonical `/reset-password` recovery handler, but the legacy `/auth/reset` URL was not registered as an independent route. TanStack nested the first attempted route under `/auth`; because the `/auth` page does not render an outlet, `/auth/reset` continued to render the normal auth form instead of processing recovery tokens.

The checked-in Supabase auth config also did not include `/auth/reset` or the requested local reset callback URLs in `additional_redirect_urls`.

## Canonical route chosen

- Canonical reset route: `/reset-password`
- Production canonical URL: `https://cloudandcorestudio.com/reset-password`
- Forgot-password submit continues to use `window.location.origin` plus `/reset-password`, so custom domain and local dev stay aligned.

## Files changed

- `src/lib/password-reset-flow.ts`
- `src/routes/auth_.reset.tsx`
- `src/routeTree.gen.ts`
- `tests/unit/passwordResetFlow.test.mjs`
- `supabase/config.toml`
- `docs/password-reset-url-config-fix-report.md`

## Supabase URL config required

Site URL:

- `https://cloudandcorestudio.com`

Allowed redirect URLs now documented in `supabase/config.toml`:

- `https://cloudandcorestudio.com`
- `https://cloudandcorestudio.com/auth`
- `https://cloudandcorestudio.com/reset-password`
- `https://cloudandcorestudio.com/auth/reset`
- `https://cloudandcorestudio.web.app`
- `https://cloudandcorestudio.web.app/auth`
- `https://cloudandcorestudio.web.app/reset-password`
- `https://cloudandcorestudio.web.app/auth/reset`
- `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app/auth`
- `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app/reset-password`
- `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app/auth/reset`
- `https://cloud-core-studio-190584124070.me-west1.run.app`
- `https://cloud-core-studio-190584124070.me-west1.run.app/auth`
- `https://cloud-core-studio-190584124070.me-west1.run.app/reset-password`
- `https://cloud-core-studio-190584124070.me-west1.run.app/auth/reset`
- `http://localhost:5173`
- `http://localhost:5173/auth`
- `http://localhost:5173/reset-password`
- `http://localhost:5173/auth/reset`
- `http://127.0.0.1:4174`
- `http://127.0.0.1:4174/auth`
- `http://127.0.0.1:4174/reset-password`
- `http://127.0.0.1:4174/auth/reset`

`https://cloudandcorestudio.web.app/auth` returned `200`, so the Firebase fallback remains a valid deployed frontend and was kept.

## `/auth/reset` support

`/auth/reset` is supported by `src/routes/auth_.reset.tsx`.

It redirects in the browser to `/reset-password` while preserving the full query string and hash. This avoids losing recovery values such as:

- `code`
- `type`
- `access_token`
- `refresh_token`
- URL hash values

## Supabase config push

Ran:

```bash
supabase config push --project-ref banjmspemvzrqckajvwo --yes
```

The first push applied the auth redirect diff, then the CLI failed while reading Storage config:

```text
LegacyConfigPushStorageReadNetworkError: failed to read Storage config: SchemaError(Missing key at ["databasePoolMode"])
```

A debug re-run reported:

```text
Remote Auth config is up to date.
```

No migrations were run and no database schema was changed.

## Real email link test result

Automated real inbox testing was not completed. This production project blocks mutating E2E flows, and a true password-reset completion would mutate a real auth user’s recovery/password state.

Browser QA used a mocked successful Supabase PKCE exchange for `/auth/reset?code=legacy-code`; the app redirected to `/reset-password`, showed exactly two LTR password fields, cleared the URL token, and logged no console/page errors.

Manual production check still required with a safe account:

1. Request a reset email from `https://cloudandcorestudio.com/auth`.
2. Click the email link.
3. Confirm the app lands on `/reset-password`.
4. Confirm the new-password form appears.
5. Update the password.
6. Confirm the app returns to login.
7. Confirm the new password signs in.

## Custom SMTP recommendation

The sender currently appears as Supabase Auth because Supabase default SMTP is used.

To send from Cloud & Core, configure Supabase Custom SMTP. Recommended sender:

`Cloud & Core Studio <no-reply@cloudandcorestudio.com>`

Do not use personal Gmail long-term. Use Resend, Postmark, SendGrid, Brevo, or AWS SES when ready.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/passwordResetFlow.test.mjs
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bun run lint
```

Results:

- Password reset flow unit test passed.
- Typecheck passed.
- Build passed.
- i18n test passed.
- Lint passed with existing warnings only: `0 errors, 440 warnings`.

## Browser QA

- `/auth/reset` without token redirects to `/reset-password` and shows invalid/expired state.
- `/auth/reset?code=legacy-code` redirects to `/reset-password`, exchanges the code when Supabase confirms it, and shows the new-password form.
- Password inputs are `ltr/left`.
- Mobile `390 x 844` had no horizontal overflow.
- Console errors: `0`
- Page errors: `0`

## Production deployment

- Deployed: yes
- Image: `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260629214236`
- Cloud Build: `1ad0b7d4-b57c-42a8-93a3-d9b09768d6f5`
- Cloud Run service: `cloud-core-studio`
- Region: `me-west1`
- Revision: `cloud-core-studio-00142-bph`
- Traffic: `100%`
- Service URL: `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- Regional URL: `https://cloud-core-studio-190584124070.me-west1.run.app`

Production smoke checks:

- Stable `/auth`: `200`
- Stable `/reset-password`: `200`
- Stable `/auth/reset?code=smoke`: `200`
- Stable `/admin`: `307` redirect to `/auth`
- Regional `/auth/reset?code=smoke`: `200`

Production browser smoke:

- Stable `/auth/reset?code=prod-smoke` redirected to `/reset-password`.
- Mocked Supabase PKCE exchange showed the reset form with exactly two password fields.
- Stable direct `/auth/reset` redirected to `/reset-password` and showed invalid/expired link state.
- Password inputs were `ltr/left`.
- Console errors: `0`
- Page errors: `0`

## Remaining manual steps

- Complete a real email-link reset on a safe account.
- Confirm the new password signs in.
- Configure Supabase Custom SMTP before relying on branded sender identity.
