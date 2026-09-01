# Critical journey audit

Scores are out of 5 for discoverability, clarity, feedback, recovery and mobile usability.

| Journey | Evidence and result | Scores | Status |
|---|---|---|---|
| New visitor understands offering | Landing gives a concise activity/location message, price cue, image and schedule CTA. The 390px hierarchy remains legible. | 5 / 4 / 4 / 4 / 5 | Passed |
| Language choice | Landing and auth show all three languages at the top; live change retained the page. | 5 / 5 / 4 / 5 / 5 | Passed |
| Sign-up/sign-in | Auth uses a distinct sign-in/register mode and visible labels. Empty form yields inline errors in English. | 5 / 5 / 4 / 4 / 5 | Passed for validation; registration not submitted |
| Password recovery | Expired-token outcome is clear and has recovery links. Valid reset and mail-delivery timing were unavailable. | 4 / 4 / 4 / 4 / 5 | Partially checked |
| Discover a class | Guest schedule states why booking requires sign-in, exposes filters and opens a detailed sheet. | 5 / 5 / 4 / 5 / 5 | Passed |
| Understand class before booking | Sheet contains date/time/duration, instructor, availability, media, notes and a guest next step. At 390px the location is truncated. | 4 / 4 / 4 / 5 / 4 | Passed with P1-04 |
| Book with credit / no credit | Clear state branching is present in `ClassDetailSheet`, including credit and package routes. | 4 / 4 / 4 / 4 / 4 | Source audited only |
| Purchase package | Member package flow is comprehensive, but public checkout creates an unconsumed draft and moves to generic sign-in. | 3 / 3 / 3 / 3 / 4 | P1-01 |
| Success after payment | Production pending screen is calm and tells the user not to pay again. All status variants are modelled. Local source diverges from the observed production localization. | 4 / 5 / 5 / 4 / 5 | Source/live parity risk |
| Booking cancellation | Confirmation dialog and cancellation-window messaging exist. Actual server outcomes were not triggered. | 4 / 4 / 4 / 4 / 4 | Source audited only |
| Waitlist | CTA/state mapping and position feedback are clear in source. | 4 / 4 / 4 / 4 / 4 | Source audited only |
| View wallet/history | Packages, payment history and receipt route states exist; no member receipt could be safely opened. | 4 / 4 / 4 / 4 / 4 | Source audited only |
| Profile/language/support | Profile centralizes details, preferences, legal and deletion-request affordances; support is direct and well structured. | 4 / 4 / 4 / 4 / 4 | Source audited only / support live checked |

No booking, cancellation, waitlist, package purchase, account creation, outbound WhatsApp, or payment action was performed.
