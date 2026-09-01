# Milestone 2 authenticated QA report

Date: 2026-09-01
Branch: `codex/member-ui-ux-improvements`

## Safety gate

The QA target is local Supabase, not staging or production. Its running API and database endpoints are loopback-only. The repository’s configured cloud reference is treated as production-like/blocked by the existing E2E guard and was not used. The local QA server independently refuses remote Supabase URLs, uses HYP `test` mode with no usable HYP test credentials, and binds only to `127.0.0.1`.

The fixture is `qa-member-ui@cloudcore.test`, has a member profile and two deterministic ILS plans, has no telephone/billing/payment data, and has local email/WhatsApp settings disabled. The seed and reset scripts require explicit `APP_ENV=test` and `ALLOW_MEMBER_UI_UX_FIXTURE=true`, refuse non-local targets, and scope reset to the fixture user and exact fixture-plan markers.

## Verified

- Final-pass update: after the guarded QA alias repair, `/member/packages` visibly rendered both deterministic local plans and `/member/account` visibly rendered the fake member profile through normal authenticated data paths.
- Real local password authentication through `/auth`.
- Authenticated protected-route access to `/member/packages` and `/member/account`.
- Authenticated `/checkout` rendering.
- The previous missing-alias limitation is superseded by `validation/local-supabase-env-contract.md`; the remaining mutation, language, zoom, axe, and VoiceOver matrix is still incomplete.
- 390 × 844 English screenshots for the three routes.
- No real payment, deletion request, remote database operation, outbound notification, deployment, or payment-provider call.

## Verification incomplete

The following required closure evidence is still missing: intercepted payment/deletion state matrix; rapid-activation counts; error/retry flows; Arabic/Hebrew authenticated states; 320/desktop responsive matrix; keyboard dialog pass; 200% browser zoom; automated accessibility scan; and manual VoiceOver output.

**P2-02: IMPLEMENTED — VERIFICATION INCOMPLETE.**

**P2-03: IMPLEMENTED — VERIFICATION INCOMPLETE.**

**P2-04: PARTIALLY RESOLVED.** Only `MemberFeedbackPanel` consolidation is in scope; broad component consolidation remains open.
