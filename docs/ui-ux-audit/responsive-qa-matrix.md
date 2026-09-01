# Responsive QA matrix

Legend: **Pass** means inspected live or from deterministic layout source; **Source** means source inspected but authenticated data/state was unavailable; **Blocked** means an approved test account or real record is required. “No horizontal overflow” was confirmed at 320px for public schedule, auth, and checkout (`scrollWidth 320`, viewport client width 305 with scrollbar).

| Route                                                                | 320     | 360    | 390             | 430    | Tablet 768 | Laptop 1366 | Desktop 1440 | RTL    | LTR    | Status / notes                                                                   |
| -------------------------------------------------------------------- | ------- | ------ | --------------- | ------ | ---------- | ----------- | ------------ | ------ | ------ | -------------------------------------------------------------------------------- |
| `/`                                                                  | Source  | Source | Pass HE/AR/EN   | Source | Source     | Source      | Pass HE      | Pass   | Pass   | Hero stacks cleanly; mobile header has three language controls plus sign-in      |
| `/auth`                                                              | Pass EN | Source | Pass AR/EN      | Source | Source     | Source      | Source       | Pass   | Pass   | Inline errors at 390 EN; valid submit blocked                                    |
| `/member/schedule` guest                                             | Pass EN | Source | Pass EN         | Source | Pass EN    | Pass EN     | Pass EN      | Source | Pass   | No horizontal scroll; cards/details checked at 390                               |
| `/checkout`                                                          | Pass EN | Source | Pass EN         | Source | Source     | Source      | Source       | Source | Pass   | Selection card density becomes long on mobile, but no clipping found             |
| `/support`                                                           | Source  | Source | Source          | Source | Source     | Source      | Pass EN      | Source | Pass   | Professional two-column desktop use                                              |
| `/reset-password`                                                    | Source  | Source | Pass expired EN | Source | Source     | Source      | Source       | Source | Pass   | Valid-token form blocked                                                         |
| `/payment-result`                                                    | Source  | Source | Pass pending EN | Source | Source     | Source      | Source       | Source | Pass   | Only simulated pending presentation reviewed                                     |
| `/member`, `/member/bookings`, `/member/packages`, `/member/account` | Source  | Source | Pass EN loaded | Source | Source     | Source      | Source       | Source | Pass   | Local fixture visibly loaded on packages/account at 390; full matrix remains open |
| Receipt, promo claim, legal, app install, Instagram                  | Source  | Source | Source          | Source | Source     | Source      | Source       | Source | Source | Source review; campaign/payment records not exercised                            |

Unperformed required variants: 360×800, 430×932, tablet landscape, browser zoom 125%/200%, authenticated content and keyboard with a screen reader. They are test-plan blockers, not claims of a pass.

## Milestone 2 checkout and deletion matrix

| Flow/state                                            | 320×720 | 360×800 | 390×844 | 430×932 | 768×1024 | 1366×768 | 1440×900 | EN / HE / AR | Evidence status                                                                                              |
| ----------------------------------------------------- | ------- | ------- | ------- | ------- | -------- | -------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| Public checkout, no selection                         | Pass HE | Source | Pass EN/HE/AR | Source | Source  | Source  | Pass EN/HE/AR  | All required | No payment action was submitted.                                            |
| Public checkout, selected authoritative package price | Pass EN/HE/AR | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN  | Pass EN  | Pass EN/HE/AR  | All required | Screenshots captured locally; no horizontal overflow.                                      |
| Authenticated package route                           | Source | Source | Pass EN | Source | Source | Source | Source | EN only | Real local fixture/login and 390px route screenshot; checkout-session states remain unverified. |
| Authenticated account route                           | Source | Source | Pass EN | Source | Source | Source | Source | EN only | Real local fixture/login and 390px route screenshot; deletion dialog/result states remain unverified. |

The fixture/access blocker is resolved locally, but the authenticated state matrix remains **incomplete**, not passed. No production member, payment, or deletion interaction has been used.
