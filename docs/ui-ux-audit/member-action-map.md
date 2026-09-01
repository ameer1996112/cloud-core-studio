# Member action map

Only read-only actions were executed live. Mutation paths below were traced from the client and server-function call sites; they were not invoked.

| Journey | Start → action → feedback → next state | Failure / recovery | Audit |
|---|---|---|---|
| Choose language | Any public page → visible HE / AR / English control → `applyLang` updates `html[lang]`, `dir`, cookie and local storage → same page re-renders | No error feedback for failed preference persistence; member shell separately syncs profile language | Live checked HE→EN→AR on landing; state stayed on page |
| Browse schedule | Landing/auth → **View schedule** → guest schedule → search/date/filter/card → class detail sheet | Empty schedule supplies an explanatory empty state; guest CTA keeps user in a safe sign-in flow | Live checked |
| Inspect a class as a guest | Guest schedule → class card → sheet → **Sign in to book** | Close button returns to schedule and preserves browsing context | Live checked; source has a full guest CTA branch |
| Sign in | `/auth` → required email/password + Enter → busy state → role home / `returnTo` | Field errors are associated and announced; credential/network errors are translated | Empty form and language variants checked; credentials not used |
| Register | `/auth?mode=signup` or **Create account** → details/notifications → submit → completion toast → sign in | Duplicate, rate-limit, email confirmation, validation and network messages are mapped | Source audited; no account created |
| Recover password | `/auth` → **Forgot password?** → email → success information → email token → `/auth_/reset` → reset form | Expired reset page provides **Send a new link** and **Back to sign in** | Live expired state checked; valid link blocked |
| Buy from public checkout | `/checkout` → choose plan + required fields + terms → button enables → draft stored → `/auth` | Native validation prevents empty submission | **P1:** `cloud-core-checkout-draft` is written only in `checkout.tsx`; no consumer was found, and no return destination is supplied |
| Buy/top up as member | Packages → plan → payment method → loading/redirect or request confirmation | Duplicate active package, card/manual error and pending payment copy exist | Source audited; no payment touched |
| Book a class | Member schedule/home → open detail → **Book with credit** → pending label → success Cloud Card + toast + calendar / bookings CTAs | Already-booked, full, insufficient-credit and generic failure have translated feedback | Source audited; no booking created |
| Join / leave waitlist | Full class → join → pending → position toast; bookings tab → leave → toast | Join error has a toast; recovery is to retry/open package/schedule as relevant | Source audited; no waitlist mutation |
| Cancel booking | Bookings → upcoming card → **Cancel** → confirmation dialog explaining credit impact → result toast and query refresh | Window-passed and error states remain on the list | Source audited; no cancellation performed |
| Manage profile | Account → edit field/language → save → pending/translated toast | Save errors use `friendlyErrorMessage`; sign out shows a full-screen state | Source audited |
| Cancel recurring subscription | Packages → **Cancel subscription** → immediate mutation → toast | Error toast only | **P1:** no confirm/undo step before an impactful recurring-payment action |
| Delete-account request | Account → optional reason → **Request deletion** → toast | Error toast only; request is not a deletion | Source audited; confirmation/status history should be made explicit |

Important action-quality findings: native buttons/links generally give good semantics, booking mutations guard repeated clicks with `isPending`, and the guest schedule makes authentication boundaries clear. The language popover is custom and lacks documented Escape/arrow-key behavior; see AX-02.
