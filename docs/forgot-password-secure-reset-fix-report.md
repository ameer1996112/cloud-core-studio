# Forgot password secure reset fix report

## Root cause

`/reset-password` previously unlocked the new-password form whenever `supabase.auth.getSession()` returned any session. That made a normal existing session enough to reach password update UI, instead of requiring a recovery token/session from the password-reset email flow.

## Files changed

- `src/lib/password-reset-flow.ts`
- `src/routes/auth.tsx`
- `src/routes/reset-password.tsx`
- `src/lib/i18n.ts`
- `src/styles.css`
- `tests/unit/passwordResetFlow.test.mjs`
- `docs/forgot-password-secure-reset-fix-report.md`

## Secure flow implemented

1. `/auth` forgot-password mode accepts only an email.
2. Submit calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
3. The user sees a generic check-email state.
4. Password fields are never shown from the forgot-password request state.
5. `/reset-password` starts in a validating state.
6. Password fields appear only after a provider-backed recovery validation succeeds.
7. Invalid, expired, missing, or manually typed links show the invalid-link state.
8. Successful password update signs out, clears the access-token cookie, clears reset URL tokens, and returns to `/auth`.

## States implemented

- Login
- Forgot password request
- Check email
- Validating reset link
- Set new password
- Invalid/expired link

## Supabase/Auth method used

- Reset email request: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- PKCE callback: `supabase.auth.exchangeCodeForSession(code)`
- Token hash callback: `supabase.auth.verifyOtp({ type: "recovery", token_hash })`
- Implicit hash callback: `supabase.auth.setSession({ access_token, refresh_token })`
- Recovery event support: `supabase.auth.onAuthStateChange` with `PASSWORD_RECOVERY`
- Password update: `supabase.auth.updateUser({ password })`

The app uses `@supabase/supabase-js` `^2.108.2`.

## Redirect URL requirements

Current configured reset URLs in `supabase/config.toml`:

- Local dev: add the active localhost origin plus `/reset-password` when testing email links locally.
- Production custom domain: `https://cloudandcorestudio.com/reset-password`
- Firebase hosting: `https://cloudandcorestudio.web.app/reset-password`
- Cloud Run stable URL: `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app/reset-password`
- Cloud Run regional URL: `https://cloud-core-studio-190584124070.me-west1.run.app/reset-password`

No Supabase config push was run in this task.

## Tests added

- `tests/unit/passwordResetFlow.test.mjs`
  - Direct reset route without token is invalid.
  - Query `type=recovery` alone is invalid.
  - Invalid code exchange is invalid.
  - Successful code exchange unlocks recovery.
  - Successful `token_hash` + `type=recovery` unlocks recovery.
  - Successful implicit hash recovery session unlocks recovery.
  - Password mismatch and weak-password validation are blocked.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/passwordResetFlow.test.mjs
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bun run lint
```

Results:

- Reset-flow unit test passed.
- Typecheck passed.
- Build passed.
- i18n test passed.
- Lint passed with existing warnings only: `0 errors, 440 warnings`.

## Browser QA result

- Local dev server: `http://127.0.0.1:5178`
- Browser: system Google Chrome through Playwright.
- Forgot-password request was tested with the Supabase recover endpoint mocked to `200`, so no real email was sent.
- Hebrew mobile `390 x 844`: generic check-email message appeared; password fields stayed hidden after forgot submit; direct `/reset-password` showed invalid-link state; `?type=recovery` alone stayed blocked; email input was `ltr/left`; no horizontal overflow; `0` console errors; `0` page errors.
- Arabic mobile `390 x 844`: same result; page direction `rtl`; email input `ltr/left`; `0` console errors; `0` page errors.
- English desktop `1440 x 900`: same result; page direction `ltr`; email input `ltr/left`; `0` console errors; `0` page errors.
- Mocked valid recovery callback: `/reset-password?code=valid-code` showed exactly two password fields only after mocked `exchangeCodeForSession` succeeded, both password inputs were `ltr/left`, the `code` was removed from the URL, and there were `0` console/page errors.
- Mocked successful update: strong matching password called Supabase `updateUser`, then `signOut`, and returned to `/auth` with `0` console/page errors.

## Remaining manual checks

- Real email-link validation should be tested against a safe account because automated tests do not receive real reset emails.
- Confirm any future custom domain is present in Supabase additional redirect URLs before using it for reset emails.

## Production deployment

- Deployed: yes
- Image: `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260629212400`
- Cloud Build: `f20df195-d30e-4bd3-9996-f24a0982ff52`
- Cloud Run service: `cloud-core-studio`
- Region: `me-west1`
- Revision: `cloud-core-studio-00141-qb9`
- Traffic: `100%`
- Service URL: `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- Regional URL: `https://cloud-core-studio-190584124070.me-west1.run.app`

Production smoke checks:

- Stable `/auth`: `200`
- Stable `/reset-password`: `200`
- Stable `/admin`: `307` redirect to `/auth`
- Regional `/auth`: `200`
- Regional `/reset-password`: `200`
- Regional `/admin`: `307` redirect to `/auth`
