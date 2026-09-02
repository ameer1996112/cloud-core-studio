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
| `/member/packages`, `/member/account` milestone-2 states            | Pass AR | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN | Pass EN | Pass EN/HE/AR | Pass | Pass | Real local fixture; payment/deletion mutations intercepted; zero horizontal overflow |
| Receipt, promo claim, legal, app install, Instagram                  | Source  | Source | Source          | Source | Source     | Source      | Source       | Source | Source | Source review; campaign/payment records not exercised                            |

Milestone-2 authenticated states passed 320/360/390/430/768/1366/1440 responsive coverage and actual Chrome 200% zoom. Manual VoiceOver remains pending and is not inferred from automation.

## Milestone 2 authenticated package-payment and deletion matrix

| Flow/state                                            | 320×720 | 360×800 | 390×844 | 430×932 | 768×1024 | 1366×768 | 1440×900 | EN / HE / AR | Evidence status                                                                                              |
| ----------------------------------------------------- | ------- | ------- | ------- | ------- | -------- | -------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| Authenticated packages, loaded data                   | Pass AR/HE | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN | Pass EN | Pass EN/HE/AR | Pass | Fixture data visibly rendered; no overflow. |
| Payment sheet summary/loading/error                   | Pass AR/HE | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN | Pass EN | Pass EN/HE/AR | Pass | Intercepted mutations, exact counts, bidi isolation and in-bounds sheet verified. |
| Authenticated account, loaded data                    | Pass AR/HE | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN | Pass EN | Pass EN/HE/AR | Pass | Fixture member visibly rendered; no overflow. |
| Deletion dialog/loading/success/error                 | Pass AR/HE | Pass EN | Pass EN/HE/AR | Pass EN | Pass EN | Pass EN | Pass EN/HE/AR | Pass | Dialog, persistent feedback, exact counts and focus behavior verified. |

The authenticated milestone-2 matrix passed against local-only fixture data. Public `/checkout` remains P1-01 baseline context rather than P2-02 evidence. No production member, real payment, or real deletion interaction was used.
