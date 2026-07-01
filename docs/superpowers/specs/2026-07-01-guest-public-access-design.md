# Guest Public Access Design

## Goal

Resolve the App Review issues from July 1, 2026 by removing the mandatory login wall for non-account-based features and by making the support surface clearly functional for App Store review.

The app should still require authentication for account-based actions such as booking, packages, profile, and personal history. Public studio browsing should feel premium, not like a stripped-down fallback.

## Scope

In scope:

- Public guest access to class browsing.
- A premium public-facing schedule experience.
- Clear sign-in handoff for account-based actions.
- A strengthened public support page suitable for the App Store Connect Support URL.
- Preservation of existing Hebrew, Arabic, and English support.
- Preservation of existing authenticated route guards and role-based routing.

Out of scope:

- Booking rules.
- Payment flows.
- Supabase schema.
- RLS.
- Studio operations logic.
- Admin route redesign.
- Native build configuration changes unrelated to these review issues.

## Product Decision

Guests can access:

- Schedule browsing.
- Class details.
- Instructor and room context already shown in schedule cards and detail sheet.
- Support and legal pages.

Guests cannot access:

- Booking actions.
- Packages.
- Personal bookings.
- Profile or account actions.
- Any authenticated admin, member, or instructor route.

This keeps the public mode aligned with Apple’s requirement that non-account-based features remain accessible without registration while preserving authentication for personal and studio-managed workflows.

## Approaches Considered

### Recommended: Upgrade the existing public `/member/schedule` route

Use the already-public schedule route as the guest entry point and make it feel like a premium studio discovery page.

Pros:

- Smallest route-level change.
- Reuses the existing premium card system and data source.
- Keeps `/` already aligned with public discovery because unauthenticated users currently redirect there.
- Avoids duplicating schedule logic.

Cons:

- Requires careful CTA behavior so guests are encouraged to sign in without implying that browsing itself is gated.

### Alternative: Create a separate `/guest` or `/discover` route

Pros:

- Maximum freedom for a dedicated marketing-style landing page.

Cons:

- Adds another public route to maintain.
- Risks duplicating schedule and class-preview logic.
- Slower path to resolving review.

### Rejected: Keep `/auth` as the first-screen experience and embed public content there

This keeps the sign-in wall too visually dominant and is too close to the rejected behavior.

## Route Design

Keep the current authenticated guard on `/_authenticated`.

Public routes remain:

- `/`
- `/auth`
- `/member/schedule`
- `/support`
- legal and password-reset routes that are already public

Routing behavior:

- Unauthenticated `/` continues to redirect to `/member/schedule`.
- Authenticated `/` continues to redirect to the role home.
- Guests can remain on `/member/schedule` without interruption.
- Guest attempts to perform account-based actions redirect to `/auth`.

No authenticated route should be weakened. The review fix comes from broadening public browsing, not from relaxing private route protection.

## Guest Schedule Experience

The public schedule page should become the premium guest front door for the studio.

### Layout

- Keep the existing premium class-card system and class detail sheet where possible.
- Add a more intentional guest-facing header with brand, support link, and sign-in CTA.
- Add premium hero copy that frames the page as studio discovery, not as a member dashboard.
- Keep filters, search, and day-grouping visible to guests.

### Guest messaging

Guest-facing copy should clearly separate browsing from account actions:

- Browsing is open.
- Booking requires sign-in.
- Support is available without sign-in.

Examples of guest CTA behavior:

- Primary top-bar CTA: sign in or create account.
- Booking CTA inside class detail: sign in to book.
- Empty-state support CTA: support page.

### Premium direction

The page should feel editorial and boutique rather than generic SaaS:

- Soft ivory base with warm light overlays.
- Deep navy structure with restrained gold accents.
- Clear visual hierarchy around class discovery.
- Strong typography already used by the app’s premium auth and member surfaces.
- No “guest mode” language that makes the public experience feel second-class.

## Support Page Design

The existing `/support` route is already public and should be strengthened into an unmistakably valid support destination.

Required support elements:

- A clear support title and intro.
- Direct contact channels visible above the fold.
- Support email.
- WhatsApp or direct-message support path if it is real and maintained.
- Short explanation of what users can ask for help with.
- Account deletion guidance.
- Expected response framing during studio hours.

The page should also link users back to:

- Public schedule browsing.
- Authentication for account-specific help.

## Component and Copy Strategy

Prefer targeted edits over new parallel systems.

Likely touch points:

- `src/routes/member.schedule.tsx`
- `src/routes/support.tsx`
- shared styling in `src/styles.css` only if the current tokens are insufficient for the guest premium pass

Avoid introducing a separate guest card family. Continue using the current visual class-card system so public and member browsing remain part of one design language.

Guest copy must remain localized for Hebrew, Arabic, and English. Directionality must continue to follow the existing i18n system.

## Error Handling and Fallbacks

- If schedule data is empty, show a premium empty state with support access rather than a dead-end login wall.
- If a guest tries to book, route them to `/auth` with clear intent.
- If a session appears while on the guest schedule page, the page may continue to work and expose member-only data only where explicitly intended by the existing authenticated path.

## Testing

Code verification:

- `bun run lint`
- `bun run build`

Manual QA targets:

- Guest visit to `/` lands on public schedule, not `/auth`.
- Guest can browse `/member/schedule` without login.
- Guest can open class detail content without authentication.
- Guest booking/account CTAs send the user to `/auth`.
- `/support` clearly exposes working support information.
- Hebrew, Arabic, and English layouts remain aligned and readable.
- Mobile, tablet, and desktop layouts remain premium and stable.

## Acceptance Criteria

- App launch no longer forces registration before browsing public studio content.
- Guests can browse schedule content and open support without logging in.
- Account-based actions still require authentication.
- The support page is clearly functional for App Store review.
- The guest experience feels premium and consistent with the rest of the app.
- No booking, payment, schema, or role logic is changed.
