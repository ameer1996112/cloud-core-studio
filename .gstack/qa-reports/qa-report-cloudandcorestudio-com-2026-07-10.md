# Cloud & Core Production QA Report

Date: 2026-07-10
Target: https://cloudandcorestudio.com
Scope: public, member, owner/admin, mobile, iPad Air portrait, authentication, payments, receipts, WhatsApp readiness, and App Store review readiness.
Mode: report only. No production record was created, edited, cancelled, refunded, or deleted.

## Summary

Health status: not ready for App Store resubmission or regular studio operations until the high-severity issues below are resolved and verified.

Confirmed findings: 3 high, 5 medium.

## High Severity

### QA-001: Production hydration errors occur across public and authenticated pages

Every browser-tested route emitted React production error #418, including `/auth`, `/member`, `/member/schedule`, `/admin`, `/admin/payments`, and `/download`.

Impact: client rendering is unstable and can cause layout shifts, stale data, or broken interactions.

Evidence: `screenshots/initial-production.png`, browser console captured during QA.

### QA-002: Admin authentication loses the requested deep link and shows the login recovery screen

From the owner dashboard, opening `/admin/calendar` first showed the authentication recovery screen. After recovery it returned to `/admin`, not the requested calendar route. The same pattern appeared during other direct admin route checks.

Impact: owner links and reloads can discard the intended destination and make administration feel like a logout.

Evidence: `screenshots/issue-008-admin-calendar-session-loss.png`.

### QA-003: Owner class editor displays a different time from the session overview

The class overview for Aerial Yoga showed Wednesday, July 8 at 6:00 PM. Its edit form loaded the same class at 3:00 PM. No save was made.

Impact: an owner can accidentally move a lesson by three hours when saving an unrelated change. This blocks reliable kids-lesson scheduling.

Evidence: `screenshots/admin-class-detail-mobile.png` and the edit-session browser snapshot.

## Medium Severity

### QA-004: Member signup is visually clipped on a 390px mobile viewport

The English registration screen clips the heading, form controls, helper text, and submit button horizontally.

Impact: prospective members can struggle to create an account on common iPhones.

Evidence: `screenshots/signup-mobile-english.png`.

### QA-005: Admin Operations layout is unusable on mobile and iPad Air portrait

The Operations dashboard collapses key status text into a narrow column on mobile. At 820x1180, used by the iPad Air review class, the dashboard remains a narrow left column and the header logo is cropped offscreen.

Impact: owner navigation and daily operations are difficult or impossible on the review device.

Evidence: `screenshots/admin-home-mobile.png`, `screenshots/admin-ipad-820x1180.png`.

### QA-006: Review account cannot demonstrate booking or waitlist functionality

The active reviewer account has 10 credits and an active package, but its member schedule reports 0 available classes and only an empty-state message. No booking or waitlist flow can be completed.

Impact: App Review cannot access the app's full booking functionality.

Evidence: `screenshots/member-schedule-mobile.png`.

### QA-007: Production payment history still includes old HYP test records

The owner payment screen includes confirmed, pending, and failed ₪1 HYP test records, and the associated test receipt remains accessible.

Impact: staff can mistake test activity for real transactions; test data is visible in operations and receipts.

Evidence: `screenshots/admin-payments-mobile.png`, `screenshots/receipt-mobile.png`.

### QA-008: Security and compliance hardening gaps

The production response has HSTS but does not send a Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy. The privacy text does not describe separate consent or withdrawal for transactional versus marketing WhatsApp messages. The waitlist WhatsApp template is categorized as marketing.

Impact: avoidable security exposure and a privacy/App Store review risk.

## Verification Results

Passed:

- Reviewer credentials sign in successfully and reach the member area.
- A valid session restores to `/member` after reopening `/auth`.
- Member attempts to visit `/admin` and `/instructor` return to the member area.
- Phone number is optional at registration and explains its WhatsApp purpose.
- Account deletion can be initiated from the profile screen.
- Private/internal sessions are supported by the `Visible to members` control in the admin class form.
- Bit and card payment methods render in the member checkout selector. No payment was started.
- Official WhatsApp templates for booking, cancellation, reminders, payment confirmation, and waitlist are approved.
- The WhatsApp webhook rejects an unsigned verification request with HTTP 403.
- Public support, privacy, terms, and app-download pages render.
- Build and lint exit successfully. Lint reports 475 warnings.

Test suite:

- `bun test tests/unit`: 63 passing, 4 failing.
- Two auth public-entry tests fail because the expected refresh-token cookie export is missing.
- Two legacy OpenWA client tests expect `@s.whatsapp.net` while the current implementation emits `@c.us`.

## Not Verified

- A live HYP Bit or card transaction, callback, receipt, package activation, and official WhatsApp delivery. This needs explicit payment approval and user completion of the payment provider screen.
- Future private-kids-session conflict prevention. The form supports internal visibility, but the available future sample was archived, so no valid conflict case was created or tested.
- Owner reports screen. The in-app browser timed out while rendering it after the iPad layout failure; no conclusion is recorded.
- Member booking, cancellation, and waitlist, because production has no available future classes for the reviewer account.

## Recommended Release Gate

Do not submit a new App Store build until QA-001 through QA-006 are fixed and retested. Create a dedicated reviewer-visible future class with available capacity, and a separate internal kids lesson for owner-only scheduling tests. Clean up or clearly isolate all old payment test records before live operation.
