# Route and State Matrix

**Original audit:** 2026-08-28

**Final evidence update:** 2026-08-30
**Scope:** User-facing UI routes plus an explicit disposition for every state cell. API/webhook/internal data endpoints are inventoried separately because they do not render UI.

## Legend

- **V**: production presentation rendered by the isolated fixture and visually captured.
- **S**: production source/state contract inspected without claiming the protected runtime route was opened.
- **R**: redirect/guard verified without bypassing authorization.
- **—**: state does not apply to the route.
- **Blocked**: the exact protected runtime route still requires a disposable authenticated environment; its source/state disposition remains registered and is not relabeled as a visual pass.

Every V state is captured in HE, AR, and EN at `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, and `1440×900`: 16 visual states × 3 languages × 6 viewports = 288 final captures. All 288 screenshot filenames are public/guest. The complete manifest contains 319 state dispositions: 16 visual, 77 static, 56 redirected, and 170 protected-runtime blocked. A row marked S or Blocked is not a visual claim; critical booking, cancellation, payment, attendance, destructive-action, and global-navigation journeys are additionally exercised through production-backed interaction adapters and the manual VoiceOver catalog.

Final evidence: `artifacts/ui-audit/final/manifest.json`, `artifacts/ui-audit/final/capture-manifest.json`, `artifacts/ui-audit/final/screenshots/`, `artifacts/ui-audit/final/accessibility.json`, and `artifacts/ui-audit/final/interaction-results.json`.

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
| `/admin/messages` | Admin | S | S | S | S | S | S | R | Blocked; nested `main` fixed in source, direct route not captured |
| `/admin/automations` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/settings` | Admin | S | S | S | S | S | S | R | Blocked |
| `/admin/bookings` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/schedule` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/planner` | Admin alias | R calendar | — | — | S | — | — | R | Static redirect |
| `/admin/templates` | Admin alias | R messages | — | — | S | — | — | R | Static redirect |
| `/admin/credits` | Admin alias | R members | — | — | S | — | — | R | Static redirect |
| `/admin/audit` | Admin alias | R admin | — | — | S | — | — | R | Static redirect |

## Non-UI route inventory

These routes return data, receive webhooks, or redirect provider responses and therefore do not have visual states: `/api/public/payments/hyp/return`, payment/WhatsApp/Resend webhooks, internal concierge dispatch/run, internal message media/sweep, lifecycle and WhatsApp/OpenWA jobs, and subscription sync. They require security, contract, idempotency, and operational tests rather than screenshots.

## Final evidence disposition

- The manifest accounts for every state cell and rejects missing, duplicate, mis-typed, or undocumented scenarios.
- Visual adapters import production presentation components/functions and deterministic records while forbidding Supabase, server-function, and mutation-hook dependencies.
- The 288 captures were systematically checked for hierarchy, clipping, safe areas, logical alignment, locale expansion, overlay behavior, and state clarity; see `docs/design/visual-regression-results.md`.
- The interaction artifact covers all 48 tier-A scenario/locale rows, 200%/400% reflow, reduced motion, forced colors, visible focus, native activation, dialog behavior, and representative filtering/opening latency.
- The VoiceOver transcript covers seven production-backed journeys in HE/AR/EN (21/21) and states its manual operator attribution and non-cryptographic limitation.

The 170 Blocked entries remain intentionally honest: no disposable authenticated browser environment or approved role accounts were introduced. They record exact protected runtime-route limitations, not missing manifest coverage. Their critical presentation and interaction boundaries are covered safely by the production-backed adapters; they must not be described as direct authenticated route visits.

## Release blockers outside the matrix disposition

The final score is **92/100**, with seven scored deductions:

1. The registration CTA remains below the initial 390×844 viewport.
2. The 170 protected-runtime states still lack direct role-responsive screenshots.
3. Valid local-production mobile LCP is 4,386/4,202/5,447 ms for home/auth/schedule, above 2,500 ms.
4. The full production Lighthouse run fails closed when `home-ar` resolves with Hebrew document language.
5. Axe reports 18 moderate `landmark-unique` findings on the app-marketing screens region, with zero serious/critical findings.
6. The global mobile 9/10/11 px microcopy floor remains governed compatibility debt.
7. Compatibility aliases, approved important declarations, and computed-cascade baselines remain scheduled removal work.

Separately, six real-database integration tests remain environment-gated, lint retains 748 existing warnings, and no staging run was performed.
