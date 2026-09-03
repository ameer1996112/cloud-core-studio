# Cloud & Core — Production Supabase Schema Metadata Audit

## A. Production project verification

Live project metadata is verified for `banjmspemvzrqckajvwo`. Current workspace mobile-release and Cloud Run configuration point to it, but deployed application artifacts could not be independently decoded here; therefore, the deployed mobile/admin same-project finding is `CANNOT_DETERMINE_WITH_DEPLOYED_ARTIFACT_CERTAINTY` rather than absolute.

## B. Production schema versus branch

`codex/premium-mobile-redesign` is unavailable both locally and on `origin`, so branch classifications are `CANNOT_DETERMINE`. Current-checkout migration drift is recorded separately and is not a substitute.

## C. Payment-model finding

Generic payment/provider, receipt, token, and provider-event structures are deployed. The Kids subscription workflow is HYP-oriented. Cash, Bit, Stripe, and Apple Pay cannot be determined from permitted structural metadata because they could be encoded through generic provider/method fields.

## D. Product/package configuration finding

All four active adult commercial combinations match the source of truth. Kids monthly matches its price/credit combination. The Kids 10-month package conflicts: production specifies 40 lessons (4 × 10), while the source of truth specifies 35.

## E. Attendance capability finding

`attendance_records` and `kid_aerial_attendance` are deployed, and `mark_attendance_v2` is available. No-show and check-in semantics cannot be established without reading rows or routine bodies.

## F. Phase-1 tables actually available

97 public tables are deployed. The JSON’s item-level Phase 1 inventory records evidence-backed `PRESENT`, `PARTIALLY_PRESENT`, `ABSENT_AS_SEPARATE_TABLE`, and `CANNOT_DETERMINE` findings for every requested area.

## G. Production-only structures discovered

Relative to the current checkout only, production has migration versions `20260824130000, 20260828133000, 20260902210000`. They are not attributed to the unavailable requested branch.

## H. Missing Phase-1 structures

No separate booking-history table was identified. Other absent-or-undetermined structures are itemized in the JSON; a generic schema model is not treated as proof that provider-specific workflows are absent.

## I. Blockers

The requested branch is unavailable. Independent inspection of the deployed app bundle is also unavailable in this environment. No customer-data access occurred.

## J. Recommended next read-only query

Do not run it yet: restore the requested branch, then compare its migration inventory and schema definitions to this manifest. Only after approval, use a separate narrow aggregation-only Phase 1 query with no identifiers or row export.
