# Route and State Matrix

**Audit date:** 2026-08-28
**Scope:** User-facing UI routes. API/webhook/internal data endpoints are inventoried separately because they do not render UI.

## Legend

- **V**: visually inspected in this audit with screenshot evidence.
- **S**: statically inspected in source only.
- **R**: redirect/guard verified.
- **—**: state does not apply to the route.
- **Blocked**: requires a safe authenticated fixture/session.

Requested viewports: `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1440×900`. All six were captured on the auth route; representative public routes were additionally captured at mobile and desktop sizes. HE, AR, and EN were visually checked on auth, guest schedule, and app marketing. A row marked S is not a visual claim.

## Guest and public routes

| Route | Role | Language | Viewport | Default | Loading | Empty | Error | Disabled | Success | Permission denied | Screenshot status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Guest | HE | 390 | R | — | — | S | — | — | — | V: redirect to auth |
| `/auth` | Guest | HE/AR/EN | all six | V | S | — | S | S | S | — | V: default + keyboard focus |
| `/auth?mode=signup` | Guest | HE; AR/EN S | 390 | V | S | — | S | V notification-disabled | S | — | V: registration |
| `/auth?mode=forgot` | Guest | HE; AR/EN S | 390 | V | S | — | S | S | S | — | V: recovery |
| `/auth_/reset` | Guest | HE/AR/EN S | responsive S | S | S | — | S | — | S | — | No current screenshot |
| `/reset-password` | Guest | HE; AR/EN S | 390 | S | S | — | V no-token | S | S | — | V: error/recovery |
| `/member/schedule` | Guest/public | HE/AR/EN | 390 + HE 1440 | V | S | V | S | S | S | — | V: empty in all languages |
| `/privacy` | Guest | HE V; AR/EN S | 390 | V | — | — | S | — | — | — | V: default |
| `/terms` | Guest | HE V; AR/EN S | 390 | V | — | — | S | — | — | — | V: default |
| `/support` | Guest | HE V; AR/EN S | 390 | V | — | — | S | — | — | — | V: default |
| `/checkout` | Guest/member handoff | HE/AR/EN S | responsive S | S | S | S | S | S | S | R signed out | No payment submission |
| `/payment-result?status=success` | Guest/member | HE V; AR/EN S | 390 | — | — | — | — | — | V | — | V: success |
| `/payment-result?status=failed` | Guest/member | HE V; AR/EN S | 390 | — | — | — | V | — | — | — | V: failure |
| `/payment-result?status=pending` | Guest/member | HE/AR/EN S | responsive S | — | S | — | — | S | S | — | Static only |
| `/payment-result?status=cancelled` | Guest/member | HE/AR/EN S | responsive S | — | — | — | S | — | — | — | Static only |
| `/app` | Guest marketing | HE/AR/EN | 390/430/1440 | V | S | — | S | — | — | — | V: three languages |
| `/download` | Guest | HE | 390 | V | S | — | S | S | S | — | V: default |
| `/downalod` | Guest alias | inherited | responsive S | R | — | — | S | — | — | — | Redirect static only |
| `/instagram` | Guest | HE | 390 | V | S | — | S | — | — | — | V: default |
| `/promo/yoga-lina` | Guest/promo | HE V; AR/EN S | 390 | V | S | S | S | S | S | — | V: current default |

## Authenticated shared and legacy routes

| Route | Role | Language | Viewport | Default | Loading | Empty | Error | Disabled | Success | Permission denied | Screenshot status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/_authenticated` layout | Any signed-in role | HE/AR/EN S | responsive S | S | S | — | S | — | — | R | Signed-out guard only |
| `/studio` | Any signed-in role | HE/AR/EN S | responsive S | R role home | — | — | S | — | — | R | Static/guard only |
| `/schedule` | Member legacy | inherited | responsive S | R `/member/schedule` | — | — | S | — | — | R | Static redirect |
| `/bookings` | Member legacy | inherited | responsive S | R `/member/bookings` | — | — | S | — | — | R | Static redirect |
| `/bookings/$id` | Member legacy | inherited | responsive S | R `/member/bookings` | — | — | S | — | — | R | Static redirect |
| `/plans` | Member legacy | inherited | responsive S | R `/member/packages` | — | — | S | — | — | R | Static redirect |

## Member routes

| Route | Role | Language | Viewport | Default | Loading | Empty | Error | Disabled | Success | Permission denied | Screenshot status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/member` | Member | HE/AR/EN S | responsive S | S | S | S | S | S | S | R signed out | Blocked; redirect capture only |
| `/member/schedule` authenticated branch | Member | HE/AR/EN S | responsive S | S | S | S | S | S | S | R signed out | Guest branch V; member branch blocked |
| Class detail sheet | Member/guest | HE/AR/EN S | responsive S | S | S | S | S | S | S | R by action | No deterministic state screenshots |
| Booking confirmation | Member | HE/AR/EN S | responsive S | S | S | — | S | S | S | R | Blocked |
| Booking failure/stale seat | Member | HE/AR/EN S | responsive S | — | S | — | S | S | — | R | Blocked |
| Waitlist/full states | Member | HE/AR/EN S | responsive S | S | S | S | S | S | S | R | Blocked |
| `/member/bookings` | Member | HE/AR/EN S | responsive S | S | S | S | S | S cancellation | S | R signed out | Blocked |
| `/member/packages` | Member | HE/AR/EN S | responsive S | S | S | S | S | S checkout | S | R signed out | Blocked |
| `/member/account` | Member | HE/AR/EN S | responsive S | S | S | S | S | S deletion/profile | S | R signed out | Blocked |
| `/receipts/$id` | Member/admin | HE/AR/EN S | responsive S | S | S | S | S | S | S | S/RLS | Blocked |

## Instructor routes

| Route | Role | Language | Viewport | Default | Loading | Empty | Error | Disabled | Success | Permission denied | Screenshot status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/instructor` | Instructor | HE/AR/EN S | responsive S | S | S | S | S | S attendance | S | R signed out/role | Blocked; redirect capture only |
| Participant/attendance states | Instructor | HE/AR/EN S | responsive S | S | S | S | S | S | S | R role | Blocked |

## Admin routes

All admin routes support the global locale system in code, but no authenticated language/viewport visual claim is made.

| Route | Role | Default | Loading | Empty | Error | Disabled | Success | Permission denied | Screenshot status |
|---|---|---|---|---|---|---|---|---|---|
| `/admin` | Admin | S | S | S | S | S | S | R | Redirect capture only |
| `/admin/pulse` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/calendar` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/classes` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/classes/new` | Admin | S | S | — | S | S | S | R | Blocked |
| `/admin/classes/$id` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/attendance` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/rooms` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/members` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/members/$id` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/kids` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/instructors` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/programs` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/plans` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/payments` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/reports` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/messages` | Admin | S | S | S | S | S | S | R | Blocked; nested `main` found statically |
| `/admin/automations` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/settings` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/bookings` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/schedule` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/planner` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/templates` | Admin alias | R messages | — | — | S | — | — | R | Static redirect |
| `/admin/credits` | Admin alias | R members | — | — | S | — | — | R | Static redirect |
| `/admin/audit` | Admin alias | R admin | — | — | S | — | — | R | Static redirect |

## Non-UI route inventory

These routes return data, receive webhooks, or redirect provider responses and therefore do not have visual states: `/api/public/payments/hyp/return`, payment/WhatsApp/Resend webhooks, internal concierge dispatch/run, internal message media/sweep, lifecycle and WhatsApp/OpenWA jobs, subscription sync, and `/internal/goldmine/v1/schedule`. They require security, contract, idempotency, and operational tests rather than screenshots.

## Missing evidence required for full completion

1. Safe authenticated role fixtures for member, instructor, and admin.
2. Booking available/full/waitlist/ineligible/pending/success/failure/cancellation screenshots.
3. Membership/credit/payment pending and receipt permission states.
4. Account deletion and expired-session states.
5. Instructor attendance and participant-list states.
6. Admin table/mobile, destructive dialog, report, audit, and permission states.
7. Screen-reader, 200% zoom, reduced-motion, slow-network, offline, and focus-return recordings.

Until these exist, rows marked S or Blocked must not be described as visually inspected.
