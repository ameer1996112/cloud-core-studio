# Hebrew WhatsApp Automation Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing OpenWA automation pipeline so Hebrew member WhatsApp notifications for the approved premium event set are auto-queued and auto-sent, while all non-Hebrew, email, and admin behavior stays unchanged.

**Architecture:** Keep the current queue-based design. Extend automation eligibility in `src/lib/notificationDelivery.ts`, route Hebrew member WhatsApp rows to `queued` in `src/lib/notificationDrafts.ts`, and widen the current OpenWA worker in `src/lib/notificationQueue.server.ts` so it processes the approved event set instead of only `payment_confirmed`. Prove behavior with focused unit coverage in the draft and queue tests.

**Tech Stack:** Bun, TypeScript, Supabase server helpers, Node `assert`, Bun test

---

## File Structure

- Modify: `src/lib/notificationDelivery.ts`
  - Define the approved automatic Hebrew WhatsApp event set and expose reusable eligibility helpers
- Modify: `src/lib/notificationDrafts.ts`
  - Auto-queue only Hebrew member WhatsApp rows for approved events after timing checks pass
- Modify: `src/lib/notificationQueue.server.ts`
  - Expand the worker from `payment_confirmed`-only to the approved automatic event set
- Modify: `tests/unit/notificationDrafts.test.mjs`
  - Add coverage for approved Hebrew rows queuing and disallowed rows staying draft
- Modify: `tests/unit/notificationQueueServer.test.mjs`
  - Add worker coverage for multiple allowed events and disallowed event/language cases

### Task 1: Lock the automation eligibility rules in unit tests

**Files:**
- Modify: `tests/unit/notificationDrafts.test.mjs`
- Reference: `src/lib/notificationDrafts.ts`

- [ ] **Step 1: Add a Hebrew booking confirmation queue expectation**

Append this test fixture near the existing `autoPaymentRows` assertions:

```js
const autoBookingRows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-booking-he",
    name: "Noa",
    phone: "+972501111111",
    email: "noa@example.com",
    preferred_language: "he",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-he-1",
    classId: "class-he-1",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "03/07/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
  delivery: {
    scheduledFor: "2026-07-03T09:00:00.000Z",
    classStartsAt: "2026-07-03T15:00:00.000Z",
  },
});

assert.equal(autoBookingRows[0].status, "queued");
assert.equal(autoBookingRows[0].provider, "openwa");
```

- [ ] **Step 2: Add the other approved Hebrew events**

Add four more expectations for `class_reminder_24h`, `waitlist_spot_available`, `class_cancelled_by_admin`, and `class_time_changed` using the same structure and assert `status === "queued"`.

Use these event-specific related ids and variables:

```js
relatedIds: { bookingId: "booking-he-2", classId: "class-he-2" }
variables: {
  class_name: "Aerial Yoga",
  class_date: "04/07/2026",
  class_time: "10:00",
  instructor_name: "Dana",
}
delivery: {
  scheduledFor: "2026-07-03T09:00:00.000Z",
  classStartsAt: "2026-07-04T10:00:00.000Z",
  waitlistExpiresAt: "2026-07-03T18:00:00.000Z",
}
```

For `waitlist_spot_available`, include `waitlistEntryId: "wait-he-1"` in `relatedIds`.

- [ ] **Step 3: Add negative coverage for non-Hebrew and admin rows**

Add these assertions after the approved-event checks:

```js
const englishBookingRows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-booking-en",
    name: "Aline",
    phone: "+972502222222",
    email: "aline@example.com",
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-en-1",
    classId: "class-en-1",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "03/07/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
  delivery: {
    scheduledFor: "2026-07-03T09:00:00.000Z",
    classStartsAt: "2026-07-03T15:00:00.000Z",
  },
});

assert.equal(englishBookingRows[0].status, "draft");

const adminCancellationRows = buildNotificationDraftRows({
  eventKey: "class_cancelled_by_admin",
  channels: ["whatsapp"],
  audience: "admin",
  member: {
    id: "admin-row-1",
    name: "Admin",
    phone: "+972503333333",
    email: "admin@example.com",
    preferred_language: "he",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-admin-1",
    classId: "class-admin-1",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "03/07/2026",
    class_time: "18:00",
  },
  delivery: {
    scheduledFor: "2026-07-03T09:00:00.000Z",
    classStartsAt: "2026-07-03T15:00:00.000Z",
  },
});

assert.equal(adminCancellationRows[0].status, "draft");
```

- [ ] **Step 4: Run the draft test to prove it fails before implementation**

Run:

```bash
bun test tests/unit/notificationDrafts.test.mjs
```

Expected: `FAIL` because only `payment_confirmed` currently auto-queues.

- [ ] **Step 5: Commit the failing test on an isolated implementation branch**

Run:

```bash
git add tests/unit/notificationDrafts.test.mjs
git commit -m "test: cover Hebrew WhatsApp automation eligibility"
```

Expected: one test-only commit. Do not stage `tmp/latest-image-to-deploy.txt`, `tmp/latest-deploy-image.txt`, or `tmp/last-deployed-image.txt`.

### Task 2: Expand draft auto-queueing for approved Hebrew member WhatsApp events

**Files:**
- Modify: `src/lib/notificationDelivery.ts`
- Modify: `src/lib/notificationDrafts.ts`
- Test: `tests/unit/notificationDrafts.test.mjs`

- [ ] **Step 1: Replace the single-event automation set with the approved event list**

Update `src/lib/notificationDelivery.ts` so the constant becomes:

```ts
const AUTOMATED_OPENWA_EVENT_TYPES = new Set([
  "payment_confirmed",
  "booking_confirmed",
  "class_reminder_24h",
  "waitlist_spot_available",
  "class_cancelled_by_admin",
  "class_time_changed",
]);
```

- [ ] **Step 2: Make automation eligibility aware of audience and language**

Change the helper signature in `src/lib/notificationDelivery.ts` from:

```ts
export function shouldAutoQueueOpenwaNotification(eventType: string): boolean {
  return AUTOMATED_OPENWA_EVENT_TYPES.has(eventType.trim().toLowerCase());
}
```

to:

```ts
export function shouldAutoQueueOpenwaNotification(input: {
  eventType: string;
  audience: "member" | "admin";
  language: "he" | "ar" | "en";
  channel: "whatsapp" | "email";
}): boolean {
  return (
    input.channel === "whatsapp" &&
    input.audience === "member" &&
    input.language === "he" &&
    AUTOMATED_OPENWA_EVENT_TYPES.has(input.eventType.trim().toLowerCase())
  );
}
```

- [ ] **Step 3: Update draft building to call the new helper**

In `src/lib/notificationDrafts.ts`, replace the current status decision:

```ts
: shouldAutoQueueOpenwaNotification(input.eventKey)
  ? "queued"
  : "draft";
```

with:

```ts
: shouldAutoQueueOpenwaNotification({
    eventType: input.eventKey,
    audience,
    language,
    channel,
  })
  ? "queued"
  : "draft";
```

- [ ] **Step 4: Re-run the draft test and confirm it passes**

Run:

```bash
bun test tests/unit/notificationDrafts.test.mjs
```

Expected: `PASS` with the new Hebrew-member queue behavior and unchanged non-Hebrew/admin behavior.

- [ ] **Step 5: Commit the draft-queuing implementation**

Run:

```bash
git add src/lib/notificationDelivery.ts src/lib/notificationDrafts.ts tests/unit/notificationDrafts.test.mjs
git commit -m "feat: auto-queue approved Hebrew WhatsApp events"
```

Expected: one commit containing only the automation-eligibility change and its test coverage.

### Task 3: Expand the OpenWA queue worker to the approved event set

**Files:**
- Modify: `src/lib/notificationQueue.server.ts`
- Modify: `tests/unit/notificationQueueServer.test.mjs`
- Reference: `src/lib/notificationDelivery.ts`

- [ ] **Step 1: Add failing worker tests for the new allowed events**

In `tests/unit/notificationQueueServer.test.mjs`, extend the fixture maker so it can override `trigger_type` and `payload` cleanly, then add a new test like:

```js
test("processes queued Hebrew member whatsapp rows for all approved automatic events", async () => {
  const now = new Date("2026-07-02T09:00:00.000Z");
  const rows = [
    makeRow({ id: "booking-row", trigger_type: "booking_confirmed" }),
    makeRow({ id: "reminder-row", trigger_type: "class_reminder_24h" }),
    makeRow({ id: "waitlist-row", trigger_type: "waitlist_spot_available" }),
    makeRow({ id: "cancel-row", trigger_type: "class_cancelled_by_admin" }),
    makeRow({ id: "time-row", trigger_type: "class_time_changed" }),
  ];

  const deps = makeDeps({ rows });
  const result = await runApprovedHebrewOpenwaPass({ now, limit: 10 }, deps);

  assert.equal(result.claimed, 5);
  assert.equal(result.sent, 5);
});
```

Also add a negative test:

```js
test("ignores queued rows that are not Hebrew member whatsapp events", async () => {
  const now = new Date("2026-07-02T09:00:00.000Z");
  const rows = [
    makeRow({
      id: "english-row",
      trigger_type: "booking_confirmed",
      payload: { event_key: "booking_confirmed", audience: "member", variables: {}, language: "en" },
    }),
    makeRow({
      id: "admin-row",
      trigger_type: "class_cancelled_by_admin",
      payload: { event_key: "class_cancelled_by_admin", audience: "admin", variables: {}, language: "he" },
    }),
  ];

  const deps = makeDeps({ rows });
  const result = await runApprovedHebrewOpenwaPass({ now, limit: 10 }, deps);

  assert.equal(result.claimed, 0);
  assert.equal(result.sent, 0);
});
```

- [ ] **Step 2: Run the worker test to confirm it fails before implementation**

Run:

```bash
bun test tests/unit/notificationQueueServer.test.mjs
```

Expected: `FAIL` because the worker still filters only `payment_confirmed`.

- [ ] **Step 3: Rename and widen the worker eligibility logic**

In `src/lib/notificationQueue.server.ts`:

1. Rename `PaymentConfirmedOpenwaRow` to something generic like `AutomatedOpenwaRow`
2. Add helpers that read row payload fields for:
   - event key
   - audience
   - language
3. Replace the current event filter:

```ts
row.trigger_type === "payment_confirmed"
```

with logic equivalent to:

```ts
shouldAutoQueueOpenwaNotification({
  eventType: row.trigger_type ?? eventKeyFromPayload,
  audience: audienceFromPayload,
  language: languageFromPayload,
  channel: row.channel,
})
```

Keep the existing `provider`, `channel`, due-ness, retry, and stale-sending rules intact.

- [ ] **Step 4: Replace payment-confirmed-specific query filters with the wider automatic-event query**

Update the list and claim queries so they no longer use:

```ts
.eq("trigger_type", "payment_confirmed")
```

Instead, fetch the candidate OpenWA WhatsApp rows and filter them in-process using the widened eligibility helper plus row payload metadata.

This avoids duplicating the approved event list in SQL fragments and keeps language/audience checks in one place.

- [ ] **Step 5: Rename the exported worker function and update tests**

Rename:

```ts
runPaymentConfirmedOpenwaPass
```

to something like:

```ts
runApprovedHebrewOpenwaPass
```

Then update every import and assertion in `tests/unit/notificationQueueServer.test.mjs` to use the new name.

- [ ] **Step 6: Run the worker test and confirm it passes**

Run:

```bash
bun test tests/unit/notificationQueueServer.test.mjs
```

Expected: `PASS`, including the new allowed-event coverage and the existing retry/failure scenarios.

- [ ] **Step 7: Commit the widened worker**

Run:

```bash
git add src/lib/notificationQueue.server.ts tests/unit/notificationQueueServer.test.mjs
git commit -m "feat: auto-send approved Hebrew WhatsApp events"
```

Expected: one commit containing the worker expansion and tests.

### Task 4: Run final verification and confirm merge-ready scope

**Files:**
- Verify: `src/lib/notificationDelivery.ts`
- Verify: `src/lib/notificationDrafts.ts`
- Verify: `src/lib/notificationQueue.server.ts`
- Verify: `tests/unit/notificationDrafts.test.mjs`
- Verify: `tests/unit/notificationQueueServer.test.mjs`

- [ ] **Step 1: Run the affected unit suites together**

Run:

```bash
bun test tests/unit/notificationDrafts.test.mjs tests/unit/notificationQueueServer.test.mjs tests/unit/notificationTemplates.test.mjs
```

Expected: all three files pass.

- [ ] **Step 2: Run the full unit suite**

Run:

```bash
bun test tests/unit
```

Expected: full unit suite passes.

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: exit code `0`, with only the repo’s pre-existing warnings.

- [ ] **Step 4: Run the production build**

Run:

```bash
bun run build
```

Expected: successful client and server build.

- [ ] **Step 5: Review the final diff for scope**

Run:

```bash
git diff -- src/lib/notificationDelivery.ts src/lib/notificationDrafts.ts src/lib/notificationQueue.server.ts tests/unit/notificationDrafts.test.mjs tests/unit/notificationQueueServer.test.mjs
```

Expected: only the Hebrew WhatsApp automation expansion and its tests are included.

- [ ] **Step 6: If no verification-generated file changes appear, stop without an extra commit**

Run:

```bash
git status --short
```

Expected: no new tracked changes beyond the intended implementation files, and no `tmp/*.txt` deploy metadata staged by accident.

## Self-Review

- Spec coverage check: the plan covers Hebrew-only member WhatsApp automation, expanded worker scope, preserved quiet-hours behavior, preserved non-Hebrew/admin/email behavior, and test coverage for both queuing and sending.
- Placeholder scan: no `TODO`, `TBD`, or vague implementation steps remain.
- Type consistency check: the same helper (`shouldAutoQueueOpenwaNotification`) drives both draft auto-queue and worker eligibility, and the widened worker uses the renamed exported function consistently.
