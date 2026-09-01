# Member route inventory

Audit date: 2026-09-01. Status is **Audited** when source and the reachable live state were checked, **Source audited / live blocked** when authentication or a real record was required, and **Not applicable** for legacy aliases. Admin and instructor routes are excluded.

| Route / screen | Auth | Reachability and purpose | Principal actions / states | Relevant source | Status |
|---|---:|---|---|---|---|
| `/` Landing | No | Direct / brand logo; explains the studio and converts visitors | Language, schedule, App Store, sign-in, sign-up, support, legal; responsive hero and FAQ | `src/routes/index.tsx`, `src/styles/public-pages.css` | Audited |
| `/auth` Sign-in / registration | No | Landing, protected-route redirect, promo | Sign in, sign up, reset, password reveal, validation, guest schedule and support | `src/routes/auth.tsx`, `src/styles/auth.css`, `src/components/auth/SignupNotificationChoices.tsx` | Audited |
| `/auth_/reset` reset-link handoff | No | Supabase reset deep link | Validating state then canonical redirect | `src/routes/auth_.reset.tsx` | Source audited / live blocked (requires a valid reset token) |
| `/reset-password` | No, token required | Reset email | Expired-token recovery, form validation, save success/error | `src/routes/reset-password.tsx` | Audited expired state; valid-token state blocked |
| `/member/schedule` guest schedule | No | Landing and auth | Search, date filters, filters, class detail, sign-in to book, support | `src/routes/member.schedule.tsx`, `src/components/member/ClassDetailSheet.tsx`, `src/components/member/MemberScheduleFilterPanel.tsx` | Audited |
| `/member` home | Yes | Default member destination | View next/recommended class, open detail, calendar, credits, packages, concierge | `src/routes/_authenticated/member/index.tsx` | Source audited / live blocked |
| `/member/schedule` member mode | Yes | Member navigation | Filter, class detail, book, waitlist, package recovery | `src/routes/member.schedule.tsx` | Source audited / live blocked |
| `/member/bookings` | Yes | Member navigation and post-booking | Tabs, cancellation confirmation, leave waitlist, add calendar, class detail | `src/routes/_authenticated/member/bookings.tsx` | Source audited / live blocked |
| `/member/packages` | Yes | Member navigation; low-credit CTA | View credits and receipts, choose plan, manual / online payment, cancel subscription | `src/routes/_authenticated/member/packages.tsx` | Source audited / live blocked |
| `/member/account` | Yes | Member navigation | Edit profile, language, notification/concierge preferences, sign out, deletion request, legal links | `src/routes/_authenticated/member/account.tsx`, `src/components/app-shell/AppShell.tsx` | Source audited / live blocked |
| `/checkout` public pre-purchase form | No | Public links and campaigns | Select plan, complete details, consent, redirect to sign-in | `src/routes/checkout.tsx`, `src/components/legal/LegalLanguageSwitcher.tsx` | Audited; no form submitted |
| `/payment-result?status=` | No | HYP return | Success, pending, failed, cancelled and missing outcomes; return links | `src/routes/payment-result.tsx` | Audited pending presentation only |
| `/promo/yoga-lina` | No / Yes to claim | Campaign deep link | Attribution, sign-up intent, entitlement status, claim | `src/routes/promo.yoga-lina.tsx`, `src/components/member/YogaPromoBanner.tsx` | Source audited / live mutation blocked |
| `/support` | No | Footer and auth | Email, WhatsApp, schedule, sign-in, policies | `src/routes/support.tsx` | Audited |
| `/privacy` | No | Footer / account | Policy, language switch, return navigation | `src/routes/privacy.tsx` | Source audited |
| `/terms` | No | Footer / checkout / account | Terms, language switch, return navigation | `src/routes/terms.tsx` | Source audited |
| `/app` | No | App-install marketing link | Select language, install/open native app, support | `src/routes/app.tsx`, `src/components/app-marketing/AppMarketingPage.tsx` | Source audited |
| `/download` | No | Install link | Platform-specific App Store / Android guidance | `src/routes/download.tsx` | Source audited |
| `/downalod` | No | Historic misspelling | Redirect to `/download` | `src/routes/downalod.tsx` | Not applicable — redirect |
| `/instagram` | No | Social campaign landing | Plan selection and conversion | `src/routes/instagram.tsx`, `src/styles/instagram-editorial.css` | Source audited |
| `/schedule`, `/plans`, `/bookings`, `/bookings/$id`, `/studio` | Yes | Old deep links | Role/member redirect to canonical member route | corresponding files under `src/routes/_authenticated/` | Not applicable — redirects |
| `/receipts/$id` | Yes | Payment history | Loading, unavailable, not-found, print, back | `src/routes/_authenticated/receipts/$id.tsx` | Source audited / live blocked |
| root and authenticated 404/error | varies | Invalid URL or route failure | Retry/back/home | `src/routes/__root.tsx`, `src/routes/_authenticated/route.tsx` | Audited live root 404; source audited authenticated error |

Shared member surfaces: `AppShell`, `useRoleNav`, `ClassDetailSheet`, `PremiumClassCard`, `VisualClassCard`, `MemberScheduleFilterPanel`, `MemberNotificationCenter`, `MemberPushOnboarding`, `MemberWhatsappOnboarding`, `YogaPromoBanner`, `WeeklyPromoBanner`, and Radix dialog primitives.

Protected-route evidence: `/member` redirected to `/auth?returnTo=%2Fmember`; `/member/packages` redirected to `/auth?returnTo=%2Fmember%2Fpackages` without exposing member data.
