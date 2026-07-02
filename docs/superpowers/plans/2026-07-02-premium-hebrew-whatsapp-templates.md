# Premium Hebrew WhatsApp Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six highest-visibility member-facing Hebrew WhatsApp notification templates with the approved premium boutique copy while leaving all other languages, channels, and events unchanged.

**Architecture:** Keep the change inside the shared notification template source of truth in `src/lib/notificationTemplates.ts`. Extend the existing unit test in `tests/unit/notificationTemplates.test.mjs` so it proves the new Hebrew WhatsApp copy renders correctly and that non-scoped templates still behave as before. Avoid touching the unrelated local OpenWA work already present in the checkout.

**Tech Stack:** Bun, TypeScript, TanStack Start, Node `assert` tests

---

## File Structure

- Modify: `src/lib/notificationTemplates.ts`
  - Update the Hebrew WhatsApp defaults/fallbacks for `payment_confirmed`, `booking_confirmed`, `class_reminder_24h`, `waitlist_spot_available`, `class_cancelled_by_admin`, and `class_time_changed`
- Modify: `tests/unit/notificationTemplates.test.mjs`
  - Add coverage for the new premium Hebrew WhatsApp bodies and a guard that an unscoped template remains unchanged

### Task 1: Lock the expected premium Hebrew outputs in tests

**Files:**
- Modify: `tests/unit/notificationTemplates.test.mjs`
- Reference: `src/lib/notificationTemplates.ts`

- [ ] **Step 1: Add a focused Hebrew WhatsApp rendering fixture**

Insert this block after the existing `booking_confirmed` render assertion so the test file has reusable member/class/package variables for the premium assertions:

```js
const premiumHebrewVariables = {
  member_name: "נועה",
  class_name: "Core Flow",
  class_date: "29/06/2026",
  class_time: "18:00",
  instructor_name: "Maya",
  studio_name: "Cloud & Core",
  package_name: "מינוי חודשי",
};
```

- [ ] **Step 2: Write the failing assertions for the six scoped events**

Add these assertions near the end of `tests/unit/notificationTemplates.test.mjs`:

```js
const premiumBookingTemplate = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumBookingTemplate, premiumHebrewVariables).body,
  "🕊️ ההזמנה שלך אושרה\nCore Flow · 29/06/2026 · 18:00\nעם Maya\nנשמח לראות אותך ב-Cloud & Core",
);

const premiumPaymentTemplate = findNotificationTemplate({
  eventKey: "payment_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumPaymentTemplate, premiumHebrewVariables).body,
  "✨ התשלום שלך אושר\nעבור מינוי חודשי\nנשמח להמשיך לארח אותך ב-Cloud & Core",
);

const premiumReminderTemplate = findNotificationTemplate({
  eventKey: "class_reminder_24h",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumReminderTemplate, premiumHebrewVariables).body,
  "⏰ תזכורת עדינה לקראת השיעור שלך\nCore Flow · 29/06/2026 · 18:00\nעם Maya\nנשמח לראות אותך ב-Cloud & Core",
);

const premiumWaitlistTemplate = findNotificationTemplate({
  eventKey: "waitlist_spot_available",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumWaitlistTemplate, premiumHebrewVariables).body,
  "🤍 התפנה מקום עבורך\nCore Flow · 29/06/2026 · 18:00\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו",
);

const premiumCancelledTemplate = findNotificationTemplate({
  eventKey: "class_cancelled_by_admin",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumCancelledTemplate, premiumHebrewVariables).body,
  "עדכון לגבי השיעור שלך\nCore Flow בתאריך 29/06/2026 בשעה 18:00 לא יתקיים\nנעדכן אותך בכל אפשרות חלופית רלוונטית",
);

const premiumTimeChangedTemplate = findNotificationTemplate({
  eventKey: "class_time_changed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumTimeChangedTemplate, premiumHebrewVariables).body,
  "השעה של השיעור שלך עודכנה\nCore Flow · 29/06/2026 · 18:00\nנשמח לראות אותך ב-Cloud & Core",
);
```

- [ ] **Step 3: Add a guard that unscoped templates stay unchanged**

Add this assertion immediately after the premium assertions so the test proves the rewrite is narrowly scoped:

```js
const englishEmailTemplate = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "email",
  language: "en",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(englishEmailTemplate, premiumHebrewVariables).body,
  "Hi נועה, your spot is saved for Core Flow on 29/06/2026 at 18:00. See you at Cloud & Core.",
);
```

- [ ] **Step 4: Run the test file and confirm it fails before implementation**

Run:

```bash
bun test tests/unit/notificationTemplates.test.mjs
```

Expected: `FAIL` because the current Hebrew WhatsApp templates still return the old plain copy.

- [ ] **Step 5: Commit only the failing test if you are working in an isolated implementation branch**

Run:

```bash
git add tests/unit/notificationTemplates.test.mjs
git commit -m "test: cover premium Hebrew WhatsApp templates"
```

Expected: one commit containing only the test change. If the checkout still contains unrelated `src/lib/openwa.server.ts`, `src/lib/messageTemplate.ts`, or `tests/unit/openwaClient.test.mjs` edits, do not stage them with this commit.

### Task 2: Update the shared Hebrew WhatsApp template source of truth

**Files:**
- Modify: `src/lib/notificationTemplates.ts`
- Test: `tests/unit/notificationTemplates.test.mjs`

- [ ] **Step 1: Replace the default Hebrew WhatsApp booking confirmation body**

In `DEFAULT_NOTIFICATION_TEMPLATES`, replace the `booking_confirmed` / `whatsapp` / `he` body with:

```ts
body: "🕊️ ההזמנה שלך אושרה\n{{class_name}} · {{class_date}} · {{class_time}}\nעם {{instructor_name}}\nנשמח לראות אותך ב-{{studio_name}}",
```

- [ ] **Step 2: Replace the six scoped Hebrew fallback bodies**

In `FALLBACK_BODIES`, update only these `he` entries:

```ts
booking_confirmed: {
  he: "🕊️ ההזמנה שלך אושרה\n{{class_name}} · {{class_date}} · {{class_time}}\nעם {{instructor_name}}\nנשמח לראות אותך ב-{{studio_name}}",
  ar: "مرحباً {{member_name}}، تم تأكيد حجزك لحصة {{class_name}}.",
  en: "Hi {{member_name}}, your booking for {{class_name}} is confirmed.",
},
waitlist_spot_available: {
  he: "🤍 התפנה מקום עבורך\n{{class_name}} · {{class_date}} · {{class_time}}\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו",
  ar: "مرحباً {{member_name}}، أصبح هناك مكان متاح في حصة {{class_name}}.",
  en: "Hi {{member_name}}, a spot is available in {{class_name}}.",
},
payment_confirmed: {
  he: "✨ התשלום שלך אושר\nעבור {{package_name}}\nנשמח להמשיך לארח אותך ב-{{studio_name}}",
  ar: "مرحباً {{member_name}}، تم تأكيد الدفع مقابل {{package_name}}.",
  en: "Hi {{member_name}}, your payment for {{package_name}} is confirmed.",
},
class_cancelled_by_admin: {
  he: "עדכון לגבי השיעור שלך\n{{class_name}} בתאריך {{class_date}} בשעה {{class_time}} לא יתקיים\nנעדכן אותך בכל אפשרות חלופית רלוונטית",
  ar: "مرحباً {{member_name}}، تم إلغاء حصة {{class_name}} بتاريخ {{class_date}} الساعة {{class_time}} من قبل الاستوديو.",
  en: "Hi {{member_name}}, {{class_name}} on {{class_date}} at {{class_time}} was cancelled by the studio.",
},
class_time_changed: {
  he: "השעה של השיעור שלך עודכנה\n{{class_name}} · {{class_date}} · {{class_time}}\nנשמח לראות אותך ב-{{studio_name}}",
  ar: "مرحباً {{member_name}}، تم تحديث موعد حصة {{class_name}}. الموعد الجديد: {{class_date}} الساعة {{class_time}}.",
  en: "Hi {{member_name}}, the time for {{class_name}} has changed. New time: {{class_date}} at {{class_time}}.",
},
class_reminder_24h: {
  he: "⏰ תזכורת עדינה לקראת השיעור שלך\n{{class_name}} · {{class_date}} · {{class_time}}\nעם {{instructor_name}}\nנשמח לראות אותך ב-{{studio_name}}",
  ar: "مرحباً {{member_name}}، تذكير بحصة {{class_name}} غداً الساعة {{class_time}}.",
  en: "Hi {{member_name}}, reminder: {{class_name}} is tomorrow at {{class_time}}.",
},
```

- [ ] **Step 3: Leave every non-scoped template and every email subject untouched**

Do not modify:

```ts
const EMAIL_SUBJECTS = { ... }
const ADMIN_FALLBACK_BODIES = { ... }
const ADMIN_EMAIL_SUBJECTS = { ... }
```

Expected result: Arabic, English, admin, and email behavior stays stable.

- [ ] **Step 4: Run the notification template test again and confirm it passes**

Run:

```bash
bun test tests/unit/notificationTemplates.test.mjs
```

Expected: `PASS` with `notification template helpers OK`.

- [ ] **Step 5: Commit the implementation without unrelated OpenWA edits**

Run:

```bash
git add src/lib/notificationTemplates.ts tests/unit/notificationTemplates.test.mjs
git commit -m "feat: premium Hebrew WhatsApp notification templates"
```

Expected: one commit containing only the template copy update and its test coverage.

### Task 3: Run repo verification for a meaningful app change

**Files:**
- Modify: none
- Verify: `src/lib/notificationTemplates.ts`, `tests/unit/notificationTemplates.test.mjs`

- [ ] **Step 1: Run lint**

Run:

```bash
bun run lint
```

Expected: exit code `0`.

- [ ] **Step 2: Run the production build**

Run:

```bash
bun run build
```

Expected: successful application build with no template-related errors.

- [ ] **Step 3: Review the final diff for scope**

Run:

```bash
git diff -- src/lib/notificationTemplates.ts tests/unit/notificationTemplates.test.mjs
```

Expected: only the six Hebrew WhatsApp copy bodies and the matching test assertions changed.

- [ ] **Step 4: If you need one final checkpoint commit after verification, create it only if files changed during verification**

Run:

```bash
git status --short
```

Expected: no new changes from lint/build. If there are no file changes, skip the extra commit. If a formatter or build artifact changed tracked files, inspect them, keep only intended changes, then commit with:

```bash
git add <intended-files-only>
git commit -m "chore: finalize premium Hebrew WhatsApp templates"
```

## Self-Review

- Spec coverage check: the plan updates only the six approved Hebrew WhatsApp member-facing events, preserves all non-goals, and verifies unchanged English email behavior.
- Placeholder scan: no `TODO`, `TBD`, or vague “handle later” steps remain.
- Type consistency check: every event key, function name, and file path matches the current repo (`findNotificationTemplate`, `renderNotificationCopy`, `src/lib/notificationTemplates.ts`, `tests/unit/notificationTemplates.test.mjs`).
