# Core Balance Slice — Manual QA Checklist

Use this checklist before declaring the slice release-candidate ready.
Run `node scripts/e2e-seed.mjs` first to ensure E2E users/classes exist.

## Accounts (from seed)

- Admin: `e2e_admin@test.local` / `E2ePass!23`
- Instructor: `e2e_instructor@test.local` / `E2ePass!23`
- Member: `e2e_member@test.local` / `E2ePass!23`

## 1. Member booking → Cloud Card

- [ ] Sign in as member. `/member/schedule` shows "E2E Open Class" (the Core Balance stand-in).
- [ ] Open the class card. Detail sheet shows time, room, instructor, credit cost, spots.
- [ ] Click **Book**. Cloud Card replaces the detail body:
  - [ ] Eyebrow "Cloud Card", heading "Your spot is saved."
  - [ ] Class name, When (date · time), Duration, Room, With (instructor).
  - [ ] Code chip (6 chars from booking id, uppercase, mono).
  - [ ] Cancellation window text matches `cancellation_window_hours`.
  - [ ] Credits-left counter matches new balance.
- [ ] Click **View my bookings** → lands on `/member/bookings` with the new entry.
- [ ] Back on `/member/schedule` the card shows **You're in** badge.
- [ ] Re-open the same class → primary CTA is **View my booking**; no second debit.
- [ ] Sign in as a member with 0 credits → card shows **Top up credits** state; book CTA replaced with **Choose a package first** linking to `/member/packages`.

## 2. Credits & capacity correctness

- [ ] Booking decrements `members.remaining_credits` by `credit_cost` exactly once.
- [ ] Booking increments `classes.booked_count` by 1.
- [ ] When `booked_count === capacity`, the card flips to **Full** with **Waitlist open**.
- [ ] Friendly errors (toast):
  - Insufficient credits → "Not enough credits. Check your package."
  - Full → "This class just filled. Try the waitlist."

Automated coverage: `node tests/e2e/core_balance_slice.spec.mjs` (8/8 pass).

## 3. Studio Pulse — admin

- [ ] Sign in as admin → `/admin/pulse`. "Updated HH:MM" updates on each refetch.
- [ ] Core Balance card visible with capacity bar, signal chips, roster preview pills.
- [ ] After member books (other tab), within 30s the booked count and preview update.
- [ ] Triggering an admin add/cancel in the roster drawer refreshes the Pulse immediately (no flicker — previous data is kept until new data arrives).
- [ ] First-timer chip, care chip (gold dot on initials), low-credit chip render when applicable.

## 4. Studio Pulse — instructor (`/instructor`)

- [ ] Sign in as instructor. Pulse heading: "Welcome, <name>." Subheading mentions "your upcoming classes".
- [ ] Only classes where this instructor is assigned appear (mineOnly filter active).
- [ ] Falls back to **all** classes only if the instructor has no `instructors.user_id` record (known limitation).

## 5. Roster drawer permissions

Open the roster drawer from Pulse.

- Admin:
  - [ ] Sees **Full class editor →** link.
  - [ ] Sees **Prepare reminders**, **Add member**, **Remove + refund**, waitlist Offer/Promote/Remove/WhatsApp.
  - [ ] Attendance buttons work.
- Instructor:
  - [ ] Sees **Read-only view** badge in place of editor link.
  - [ ] **Prepare reminders** is hidden.
  - [ ] **Add member to class** section is hidden.
  - [ ] Booked rows: attendance buttons (Check in / Attended / No show) visible. **Prepare reminder** and **Remove + refund** are hidden.
  - [ ] Waitlist rows: Offer / Promote / Remove / WhatsApp are hidden.

## 6. Mobile (375 / 390 / 430 px)

- [ ] `/member/schedule` cards don't overflow; long class titles wrap or truncate.
- [ ] Cloud Card content stays within dialog (`max-w-xl`); code chip and field grid don't bleed past edges.
- [ ] `/admin/pulse` cards stack 1-col, capacity bar full width, signal chips wrap.
- [ ] Roster drawer is full-width (`w-full sm:max-w-2xl`), scrolls, all action buttons reachable above the bottom nav.
- [ ] Bottom nav doesn't cover the bottom of any sheet/dialog (Dialog/Sheet portal above nav).

## 7. RTL / LTR (English / Hebrew / Arabic)

Switch language via the language menu.

- [ ] Cloud Card mirrors: eyebrow on the start side, code chip on the end side. Times, codes, credit counts remain readable (Latin digits).
- [ ] Studio Pulse cards mirror: capacity bar fills from the start side; preview pills wrap correctly.
- [ ] Roster drawer header uses `text-start` (no left-stuck text in RTL).
- [ ] Switching language mid-flow does not crash or blank the page.

Known: the roster drawer Sheet opens from the right in all languages (`side="right"` on `<SheetContent>`). Acceptable for this slice; tracked as a limitation.

## 8. Build quality

| Command                                      | Expected               | Notes                                                                          |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `bunx tsc --noEmit`                          | 0 errors               | enforced                                                                       |
| `bun run lint`                               | passes for slice files | preexisting `no-explicit-any` / `prettier` errors in the wider codebase remain |
| `node tests/e2e/core_balance_slice.spec.mjs` | 8/8 pass               | requires seed                                                                  |
| `node tests/e2e/rpc.spec.mjs`                | 27/28 pass             | 1 preexisting failure, not slice-related                                       |
| `node tests/e2e/payments_receipts.spec.mjs`  | 14/14 pass             | regression check                                                               |
