# Guest Public Access Design

## Summary

Resolve the App Review issues dated July 1, 2026 without changing the app's core private-member model.

The approved direction is:

- keep `/auth` as the first screen and perceived entry point
- add a premium guest CTA from `/auth`
- allow guests to browse the public schedule
- allow guests to open public class detail previews
- keep support public and clearly functional
- keep booking, packages, payments, profile, and member history behind authentication

This creates a review-safe public discovery layer while preserving the studio's private account-based workflows.

## Goals

- Satisfy App Review Guideline 5.1.1 by removing mandatory registration for non-account-based features
- Keep the auth screen as the app's entry point
- Preserve a premium boutique-studio feel across auth, guest schedule, and support
- Let guests browse real studio schedule data and class previews without exposing personal data
- Keep protected member/admin/instructor flows unchanged

## Non-Goals

- No changes to booking rules or package rules
- No changes to payments
- No changes to Supabase schema, RLS, or auth model
- No changes to admin route structure
- No changes to member-only business logic
- No alternate guest-only app shell or duplicated public microsite

## Product Decision

Guests can access:

- `/auth`
- `/member/schedule`
- public class detail previews opened from the schedule
- `/support`
- existing public legal and password-reset routes

Guests cannot access:

- booking completion
- waitlist actions
- packages
- personal bookings
- profile or account management
- any authenticated member, admin, or instructor route

Protected actions should redirect to `/auth` and preserve enough context to return the user to the same schedule/detail surface after sign-in.

## Approaches Considered

### Recommended: Keep `/auth` as the entry point and add a premium guest path into the existing public schedule

This keeps the current app framing while exposing the non-account-based features Apple expects.

Pros:

- Matches the user's requirement that auth remains the first screen
- Minimizes route churn
- Reuses the premium public schedule and detail work already present in the repo
- Gives App Review an obvious public path without weakening private flows

Cons:

- Requires careful hierarchy so the guest CTA feels intentional, not secondary clutter
- Requires premium copy so the public path feels curated rather than limited

### Alternative: Make `/member/schedule` the unauthenticated home route

Pros:

- Simplest App Review story
- Public content is immediately visible

Cons:

- Conflicts with the approved product direction
- Makes the auth screen feel demoted

### Rejected: Create a separate `/guest` or marketing-style discovery route

Pros:

- Full creative freedom for a dedicated landing page

Cons:

- Duplicates public discovery logic
- Adds maintenance cost
- Not necessary to resolve review

## Route Design

Public entry behavior should be:

- `/auth` remains the first screen users land on
- `/auth` presents sign-in/sign-up as the primary action set
- `/auth` also presents a premium guest CTA such as `Browse Schedule`
- that guest CTA routes to `/member/schedule`

Public routes:

- `/auth`
- `/member/schedule`
- `/support`
- existing public legal and password-reset routes

Protected routes remain under the current authenticated guards. The review fix comes from allowing public discovery, not from weakening route protection.

## Auth Screen Design

The auth screen remains the brand-first front door.

### Structure

- Keep the current premium hero, imagery, and account form structure
- Preserve sign-in and sign-up as the dominant actions
- Add a branded secondary guest CTA below or alongside the account actions
- Add short copy clarifying that users can browse the schedule before signing in

### Premium direction

The guest CTA should not look like a fallback text link. It should feel designed:

- clear button or card treatment
- premium spacing and typography
- consistent ivory, navy, and restrained gold palette
- warm studio language instead of utilitarian product wording

### Copy direction

Preferred phrasing:

- `Browse Schedule`
- `See today's classes`
- `Sign in to book`

Avoid:

- `Guest mode`
- `Limited access`
- `Continue without account`

The public path should feel like a polished studio preview, not a degraded anonymous mode.

## Guest Schedule And Class Detail Experience

The existing public `/member/schedule` route becomes the guest discovery surface reached from `/auth`.

### Schedule surface

- Keep the premium visual class-card system
- Keep filters and grouping visible to guests
- Keep the guest-specific premium header and discovery framing
- Keep support access visible

### Class detail previews

Guests should be able to open class detail previews from schedule cards.

The detail surface can include:

- class title
- schedule timing
- instructor context
- room/context already considered public studio information
- descriptive class copy already used in the schedule/detail system

The detail surface must not expose:

- personal booking state
- user-specific package status
- member history
- any private operational data

### Protected action handoff

When a guest attempts a protected action such as booking:

- route to `/auth`
- preserve the selected class/detail context
- return the user to the same schedule/detail surface after successful sign-in

This should feel seamless and premium, not punitive.

## Support Page Design

`/support` remains public and should continue to satisfy the App Store Connect Support URL requirement.

Required characteristics:

- visible direct contact information above the fold
- support email
- working WhatsApp or direct-chat path if maintained by the studio
- short guidance for bookings, packages, payments, and account help
- account deletion guidance
- links back to schedule browsing and auth

The support page should stay premium and branded, but its primary job is clarity and usefulness for users and App Review.

## Data And Privacy Guardrails

- Guests only see public studio/catalog information
- No member-specific data is exposed without authentication
- Guest and authenticated cache keys remain separated
- Existing authenticated route guards remain intact
- Any action that needs identity or personal state must require auth

This preserves the boutique studio's privacy model while allowing public discovery of non-personal information.

## Components And Files

Prefer targeted edits in the current public surfaces rather than new parallel systems.

Primary touch points:

- `src/routes/auth.tsx`
- `src/routes/member.schedule.tsx`
- `src/routes/support.tsx`

Avoid:

- a new guest-only route family
- a separate guest card component system
- business-logic changes in booking or member flows

## Error Handling And Edge Cases

- If schedule data is empty, show a premium empty state with support access, not a login wall
- If a guest deep-links directly to `/member/schedule`, allow browsing normally
- If a guest taps a protected CTA, route to `/auth` with preserved context
- If a session already exists, the existing member schedule path should continue to work without exposing guest-only copy in the wrong state

## Testing

Code verification:

- `bun run lint`
- `bun run build`
- targeted tests around guest schedule browsing, public detail access, support access, and auth handoff

Manual QA:

- app entry reaches `/auth`
- `/auth` shows a premium guest CTA
- guest can move from `/auth` to `/member/schedule`
- guest can open class detail previews
- guest cannot complete booking without auth
- signing in returns the user to the selected class context
- `/support` is public and clearly functional
- Hebrew, Arabic, and English remain correct
- desktop and mobile layouts remain premium

## Acceptance Criteria

- The app still presents `/auth` as the first screen
- Users can browse schedule and class detail previews without registration
- Support remains public and clearly useful
- Booking and other account-based actions still require sign-in
- The guest path feels premium and branded
- No private member data is exposed to guests
- No account-based business logic is weakened
