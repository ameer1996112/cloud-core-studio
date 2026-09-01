# Milestone 2 headed manual QA

Use only the local fixture and local QA server. In one terminal, seed the fixture, build with local public-key aliases, and start `scripts/qa/serve-member-ui-ux-qa.mjs` using a loopback `SUPABASE_URL`. Then run, for example:

```sh
MANUAL_QA_CASE=deletion-dialog \
APP_BASE_URL=http://127.0.0.1:4176 \
node tests/e2e/member-ui-ux-milestone-2-manual.spec.mjs
```

Supported cases: `packages-loaded`, `payment-summary`, `payment-error`, `deletion-dialog`, `deletion-success`, and `deletion-error`. The harness uses the normal `/auth` password flow and intercepts every POST server-function request at the browser boundary, so it must not be used against a non-loopback server.

Use the headed Chrome window for actual browser 200% zoom and VoiceOver. These checks are intentionally not inferred from automation.
