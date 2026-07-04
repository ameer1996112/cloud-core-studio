# Yareen WhatsApp Template Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite member-facing WhatsApp notification copy so Hebrew WhatsApp messages feel like warm personal messages from Yareen.

**Architecture:** The app already centralizes notification copy in `src/lib/notificationTemplates.ts`, so implementation stays there and updates only Hebrew WhatsApp member fallback bodies. Existing rendering and delivery functions remain unchanged; tests verify rendered copy and guard email/admin behavior.

**Tech Stack:** TypeScript, TanStack Start server functions, Supabase-backed notification logs, Bun test runner, existing `renderNotificationCopy` helper.

## Global Constraints

- Modify WhatsApp member-facing templates only.
- Keep email templates unchanged except tests that verify they remain unchanged.
- Keep admin notification copy unchanged.
- Do not change queueing, OpenWA delivery behavior, worker behavior, database schema, or UI.
- Preserve existing template variable names exactly: `{{member_name}}`, `{{class_name}}`, `{{class_date}}`, `{{class_time}}`, `{{instructor_name}}`, `{{studio_name}}`, `{{package_name}}`, `{{credits_remaining}}`, `{{expires_on}}`, `{{receipt_number}}`.
- WhatsApp member copy must be warm, personal, concise, and from Yareen.
- Hebrew WhatsApp copy may end with `ירין` when it improves the personal feel.
- Avoid system-like phrasing, excessive emojis, pressure-heavy sales language, and unnecessary English.

---

## File Structure

- Modify `src/lib/notificationTemplates.ts`
  - Responsibility: central notification template definitions and fallback bodies.
  - Change only `FALLBACK_BODIES` Hebrew (`he`) strings for member-facing WhatsApp events.
  - Leave `DEFAULT_NOTIFICATION_TEMPLATES`, `EMAIL_SUBJECTS`, admin fallback bodies, idempotency helpers, staff visibility, and rendering helpers unchanged unless an existing test proves a duplicate WhatsApp template must be aligned.

- Modify `tests/unit/notificationTemplates.test.mjs`
  - Responsibility: exact rendering coverage for notification template helpers.
  - Update existing exact assertions for Hebrew WhatsApp copy.
  - Add exact assertions for lifecycle events not currently exact-checked.
  - Keep existing email/admin assertions to catch accidental scope creep.

No new runtime modules are required. No database or delivery files should be modified for this template-only change.

---

### Task 1: Update Tests For Yareen Hebrew WhatsApp Voice

**Files:**
- Modify: `tests/unit/notificationTemplates.test.mjs`

**Interfaces:**
- Consumes:
  - `findNotificationTemplate({ eventKey, channel, language, audience })`
  - `renderNotificationCopy(template, variables)`
- Produces:
  - Exact expected strings that Task 2 must satisfy.

- [ ] **Step 1: Update the shared test variables**

In `tests/unit/notificationTemplates.test.mjs`, extend `premiumHebrewVariables` so lifecycle tests have all required variables:

```js
const premiumHebrewVariables = {
  member_name: "נועה",
  class_name: "Core Flow",
  class_date: "29/06/2026",
  class_time: "18:00",
  instructor_name: "Maya",
  studio_name: "Cloud & Core",
  package_name: "מינוי חודשי",
  credits_remaining: 2,
  expires_on: "20/07/2026",
  receipt_number: "R-1001",
};
```

- [ ] **Step 2: Update the simple rendered smoke assertion**

Change the existing booking smoke assertion from:

```js
assert.ok(rendered.body.includes("ההזמנה שלך נשמרה"));
```

to:

```js
assert.ok(rendered.body.includes("איזה כיף שהמקום שלך נשמר"));
```

Keep these existing assertions unchanged:

```js
assert.ok(rendered.body.includes("Core Flow"));
assert.equal(rendered.subject, null);
```

- [ ] **Step 3: Replace exact assertions for already-covered key WhatsApp templates**

Replace the expected body for `premiumBookingTemplate` with:

```js
"נועה, איזה כיף שהמקום שלך נשמר 🤍\n\nCore Flow\n29/06/2026 · 18:00\nעם Maya\n\nמחכה לראות אותך בסטודיו\nירין"
```

Replace the expected body for `premiumPaymentTemplate` with:

```js
"נועה, התשלום אושר והחבילה שלך פעילה ✨\n\nמינוי חודשי\n\nתוכלי לבחור שיעור ולהמשיך בקצב שמתאים לך.\nירין"
```

Replace the expected body for `premiumReminderTemplate` with:

```js
"נועה, תזכורת קטנה למחר 🤍\n\nCore Flow\n29/06/2026 · 18:00\nעם Maya\n\nמחכה לראות אותך בסטודיו\nירין"
```

Replace the expected body for `premiumWaitlistTemplate` with:

```js
"נועה, התפנה לך מקום 🤍\n\nCore Flow\n29/06/2026 · 18:00\n\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו.\nירין"
```

Replace the expected body for `premiumCancelledTemplate` with:

```js
"נועה, עדכון מהסטודיו\n\nCore Flow\n29/06/2026 · 18:00\n\nהשיעור לא יתקיים הפעם.\nאם תרצי, אעזור לך למצוא שיעור חלופי.\nירין"
```

Replace the expected body for `premiumTimeChangedTemplate` with:

```js
"נועה, עדכון קטן לשעת השיעור\n\nCore Flow\n29/06/2026 · 18:00\n\nאם השעה החדשה לא מסתדרת לך, כתבי לי.\nירין"
```

Replace the expected body for `registeredNoActionTemplate` with:

```js
"נועה, ברוכה הבאה ל-Cloud & Core 🤍\n\nראיתי שפתחת חשבון ועדיין לא בחרת שיעור.\nאם תרצי, אעזור לך למצוא התחלה שמתאימה לקצב שלך.\n\nירין"
```

- [ ] **Step 4: Replace first lesson follow-up partial assertion with an exact assertion**

Replace:

```js
assert.ok(
  renderNotificationCopy(firstLessonFollowupTemplate, premiumHebrewVariables).body.includes(
    "שמחנו לפגוש אותך היום בסטודיו",
  ),
);
```

with:

```js
assert.equal(
  renderNotificationCopy(firstLessonFollowupTemplate, premiumHebrewVariables).body,
  "נועה, שמחתי לראות אותך היום בסטודיו 🤍\n\nמקווה שהשיעור הרגיש נעים וטוב בגוף.\nכשתרצי להמשיך, אעזור לך לבחור את השיעור הבא.\n\nירין",
);
```

- [ ] **Step 5: Add exact assertions for remaining lifecycle WhatsApp templates**

Append these tests before `console.log("notification template helpers OK");`:

```js
const packageApprovedNoBookingTemplate = findNotificationTemplate({
  eventKey: "package_approved_no_booking",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(packageApprovedNoBookingTemplate, premiumHebrewVariables).body,
  "נועה, החבילה שלך כבר מחכה לך ✨\n\nמינוי חודשי\n\nנשאר רק לבחור שיעור ראשון. אם תרצי עזרה להתחיל, אני כאן.\nירין",
);

const lowCreditsTemplate = findNotificationTemplate({
  eventKey: "low_credits",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(lowCreditsTemplate, premiumHebrewVariables).body,
  "נועה, נשארו לך 2 כניסות בחבילה\n\nאם תרצי לשמור על רצף, אפשר לבחור את החבילה הבאה בזמן שנוח לך.\nאני כאן אם תרצי עזרה.\nירין",
);

const packageExpiringTemplate = findNotificationTemplate({
  eventKey: "package_expiring_soon",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(packageExpiringTemplate, premiumHebrewVariables).body,
  "נועה, החבילה שלך מסתיימת בקרוב\n\nמינוי חודשי\nבתוקף עד 20/07/2026\n\nאם תרצי להמשיך ברצף, אני כאן לעזור.\nירין",
);

const noUpcomingBookingTemplate = findNotificationTemplate({
  eventKey: "no_upcoming_booking_14d",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(noUpcomingBookingTemplate, premiumHebrewVariables).body,
  "נועה, התגעגענו אלייך בסטודיו 🤍\n\nאם מתאים לך לחזור השבוע, אעזור לך למצוא שיעור שמתאים לקצב שלך.\nירין",
);
```

- [ ] **Step 6: Add exact assertions for draft/manual WhatsApp member templates**

Append these exact checks after the lifecycle assertions:

```js
const waitlistJoinedTemplate = findNotificationTemplate({
  eventKey: "waitlist_joined",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(waitlistJoinedTemplate, premiumHebrewVariables).body,
  "נועה, נכנסת לרשימת ההמתנה\n\nCore Flow\n\nאם יתפנה מקום, אעדכן אותך.",
);

const reminder2hTemplate = findNotificationTemplate({
  eventKey: "class_reminder_2h",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(reminder2hTemplate, premiumHebrewVariables).body,
  "נועה, תזכורת קטנה להיום\n\nCore Flow מתחיל ב-18:00.\nנתראה ממש בקרוב.\nירין",
);

const noShowTemplate = findNotificationTemplate({
  eventKey: "no_show_followup",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(noShowTemplate, premiumHebrewVariables).body,
  "נועה, התגעגענו אלייך בשיעור 🤍\n\nCore Flow\n\nמקווה שהכול בסדר. כשתרצי לחזור, אני כאן לעזור לבחור שיעור מתאים.\nירין",
);

const bookingCancelledByMemberTemplate = findNotificationTemplate({
  eventKey: "booking_cancelled_by_member",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(bookingCancelledByMemberTemplate, premiumHebrewVariables).body,
  "נועה, הביטול נקלט\n\nCore Flow\n\nאם מגיע לך זיכוי, הוא עודכן בחשבון שלך.\nירין",
);

const bookingCancelledTemplate = findNotificationTemplate({
  eventKey: "booking_cancelled",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(bookingCancelledTemplate, premiumHebrewVariables).body,
  "נועה, ההזמנה בוטלה\n\nCore Flow\n\nאם תרצי לבחור שיעור אחר, אני כאן.",
);

const receiptIssuedTemplate = findNotificationTemplate({
  eventKey: "receipt_issued",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(receiptIssuedTemplate, premiumHebrewVariables).body,
  "נועה, הקבלה הונפקה\n\nR-1001\nאפשר לצפות בה באזור האישי.",
);

const paymentRequestReceivedTemplate = findNotificationTemplate({
  eventKey: "payment_request_received",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(paymentRequestReceivedTemplate, premiumHebrewVariables).body,
  "נועה, ראיתי את בקשת התשלום שלך\n\nמינוי חודשי\nאאשר אותה בהקדם ואעדכן אותך כשהחבילה תהיה פעילה.\nירין",
);
```

- [ ] **Step 7: Run the focused test and verify it fails**

Run:

```bash
bun test tests/unit/notificationTemplates.test.mjs
```

Expected result:

```text
fail
```

The first failure should be an assertion mismatch showing the old copy from `src/lib/notificationTemplates.ts`.

- [ ] **Step 8: Commit the failing tests**

Run:

```bash
git add tests/unit/notificationTemplates.test.mjs
git commit -m "test: define Yareen WhatsApp template voice"
```

Expected result:

```text
[main <sha>] test: define Yareen WhatsApp template voice
```

---

### Task 2: Implement The Yareen Hebrew WhatsApp Copy

**Files:**
- Modify: `src/lib/notificationTemplates.ts`

**Interfaces:**
- Consumes:
  - Exact expected strings from Task 1.
- Produces:
  - Updated `FALLBACK_BODIES[eventKey].he` strings used by `findNotificationTemplate` for Hebrew WhatsApp member templates.

- [ ] **Step 1: Update `FALLBACK_BODIES.booking_confirmed.he`**

Replace the Hebrew body for `booking_confirmed` with:

```ts
he: "{{member_name}}, איזה כיף שהמקום שלך נשמר 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nעם {{instructor_name}}\n\nמחכה לראות אותך בסטודיו\nירין",
```

- [ ] **Step 2: Update cancellation and waitlist bodies**

Replace these Hebrew bodies:

```ts
booking_cancelled: {
  he: "{{member_name}}, ההזמנה בוטלה\n\n{{class_name}}\n\nאם תרצי לבחור שיעור אחר, אני כאן.",
  ar: "تم إلغاء الحجز\n\n{{class_name}}\nإذا احتجت مساعدة في اختيار حصة أخرى، نحن هنا.",
  en: "Your booking was cancelled\n\n{{class_name}}\nIf you need help choosing another class, we are here.",
},
booking_cancelled_by_member: {
  he: "{{member_name}}, הביטול נקלט\n\n{{class_name}}\n\nאם מגיע לך זיכוי, הוא עודכן בחשבון שלך.\nירין",
  ar: "تم استلام الإلغاء\n\n{{class_name}}\nإذا كان هناك رصيد مستحق، فقد تم تحديثه في حسابك.",
  en: "Your cancellation is confirmed\n\n{{class_name}}\nIf a credit is due, it has been returned to your account.",
},
waitlist_joined: {
  he: "{{member_name}}, נכנסת לרשימת ההמתנה\n\n{{class_name}}\n\nאם יתפנה מקום, אעדכן אותך.",
  ar: "تمت إضافتك إلى قائمة الانتظار\n\n{{class_name}}\nسنخبرك إذا توفر مكان.",
  en: "You joined the waitlist\n\n{{class_name}}\nWe will let you know if a spot opens.",
},
waitlist_spot_available: {
  he: "{{member_name}}, התפנה לך מקום 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו.\nירין",
  ar: "أصبح هناك مكان متاح لك 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nيمكنك إكمال الحجز الآن إذا كان الموعد مناسباً.",
  en: "A spot opened for you 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nYou can complete the booking now if it works for you.",
},
```

- [ ] **Step 3: Update payment and receipt bodies**

Replace these Hebrew bodies:

```ts
payment_request_received: {
  he: "{{member_name}}, ראיתי את בקשת התשלום שלך\n\n{{package_name}}\nאאשר אותה בהקדם ואעדכן אותך כשהחבילה תהיה פעילה.\nירין",
  ar: "تم استلام طلب الدفع\n\n{{package_name}}\nسيقوم الفريق بتأكيده قريباً.",
  en: "Your payment request was received\n\n{{package_name}}\nThe studio team will confirm it soon.",
},
payment_confirmed: {
  he: "{{member_name}}, התשלום אושר והחבילה שלך פעילה ✨\n\n{{package_name}}\n\nתוכלי לבחור שיעור ולהמשיך בקצב שמתאים לך.\nירין",
  ar: "تم تأكيد الدفع ✨\n\n{{package_name}}\nتم تحديث الباقة في حسابك.\n\nشكراً لاختيارك {{studio_name}}",
  en: "Payment confirmed ✨\n\n{{package_name}}\nYour package has been updated in your account.\n\nThank you for continuing with {{studio_name}}.",
},
receipt_issued: {
  he: "{{member_name}}, הקבלה הונפקה\n\n{{receipt_number}}\nאפשר לצפות בה באזור האישי.",
  ar: "تم إصدار الإيصال\n\n{{receipt_number}}\nيمكنك مشاهدته في حسابك.",
  en: "Receipt issued\n\n{{receipt_number}}\nYou can view it in your member area.",
},
```

- [ ] **Step 4: Update class operational bodies**

Replace these Hebrew bodies:

```ts
class_cancelled_by_admin: {
  he: "{{member_name}}, עדכון מהסטודיו\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nהשיעור לא יתקיים הפעם.\nאם תרצי, אעזור לך למצוא שיעור חלופי.\nירין",
  ar: "تحديث من الاستوديو\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nلن تقام الحصة.\n\nسنخبرك إذا توفر موعد بديل.",
  en: "Studio update\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nThis class will not take place.\n\nWe will let you know if an alternative opens.",
},
class_time_changed: {
  he: "{{member_name}}, עדכון קטן לשעת השיעור\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nאם השעה החדשה לא מסתדרת לך, כתבי לי.\nירין",
  ar: "تم تحديث وقت الحصة\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nننتظرك في {{studio_name}}",
  en: "Class time updated\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nSee you at {{studio_name}}",
},
class_reminder_24h: {
  he: "{{member_name}}, תזכורת קטנה למחר 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nעם {{instructor_name}}\n\nמחכה לראות אותך בסטודיו\nירין",
  ar: "تذكير لطيف للغد ⏰\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nمع {{instructor_name}}\n\nننتظرك في {{studio_name}}",
  en: "A gentle reminder for tomorrow ⏰\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nWith {{instructor_name}}\n\nSee you at {{studio_name}}",
},
class_reminder_2h: {
  he: "{{member_name}}, תזכורת קטנה להיום\n\n{{class_name}} מתחיל ב-{{class_time}}.\nנתראה ממש בקרוב.\nירין",
  ar: "تذكير قصير\n\n{{class_name}} تبدأ اليوم الساعة {{class_time}}.\nنراك قريباً.",
  en: "Quick reminder\n\n{{class_name}} starts today at {{class_time}}.\nSee you soon.",
},
no_show_followup: {
  he: "{{member_name}}, התגעגענו אלייך בשיעור 🤍\n\n{{class_name}}\n\nמקווה שהכול בסדר. כשתרצי לחזור, אני כאן לעזור לבחור שיעור מתאים.\nירין",
  ar: "افتقدناك في الحصة\n\n{{class_name}}\nنأمل أن نراك قريباً.",
  en: "We missed you in class\n\n{{class_name}}\nWe hope to see you again soon.",
},
```

- [ ] **Step 5: Update lifecycle bodies**

Replace these Hebrew bodies:

```ts
registered_no_action: {
  he: "{{member_name}}, ברוכה הבאה ל-{{studio_name}} 🤍\n\nראיתי שפתחת חשבון ועדיין לא בחרת שיעור.\nאם תרצי, אעזור לך למצוא התחלה שמתאימה לקצב שלך.\n\nירין",
  ar: "{{member_name}}، أهلاً بك في {{studio_name}} 🕊️\n\nلاحظنا أنك فتحت حساباً ولم تختاري حصة بعد.\nإذا رغبت، يسعدنا مساعدتك في اختيار بداية مناسبة لك.",
  en: "Hi {{member_name}}, welcome to {{studio_name}} 🕊️\n\nWe saw you opened an account but have not chosen a class yet.\nWhen you are ready, we can help you find the right first step.",
},
package_approved_no_booking: {
  he: "{{member_name}}, החבילה שלך כבר מחכה לך ✨\n\n{{package_name}}\n\nנשאר רק לבחור שיעור ראשון. אם תרצי עזרה להתחיל, אני כאן.\nירין",
  ar: "{{member_name}}، أصبحت باقتك فعالة ✨\n\n{{package_name}}\nتبقى فقط اختيار الحصة الأولى والبدء بالحركة.",
  en: "Hi {{member_name}}, your package is active ✨\n\n{{package_name}}\nAll that is left is choosing your first class.",
},
first_lesson_followup: {
  he: "{{member_name}}, שמחתי לראות אותך היום בסטודיו 🤍\n\nמקווה שהשיעור הרגיש נעים וטוב בגוף.\nכשתרצי להמשיך, אעזור לך לבחור את השיעור הבא.\n\nירין",
  ar: "{{member_name}}، سعدنا بلقائك اليوم في الاستوديو 🤍\n\nنتمنى أن تكون الحصة مريحة ولطيفة.\nعندما ترغبين بالاستمرار، نساعدك في اختيار الحصة التالية.",
  en: "Hi {{member_name}}, it was lovely seeing you in the studio today 🤍\n\nWe hope class felt good.\nWhen you are ready to continue, we can help you choose the next one.",
},
low_credits: {
  he: "{{member_name}}, נשארו לך {{credits_remaining}} כניסות בחבילה\n\nאם תרצי לשמור על רצף, אפשר לבחור את החבילה הבאה בזמן שנוח לך.\nאני כאן אם תרצי עזרה.\nירין",
  ar: "{{member_name}}، تبقى لديك {{credits_remaining}} دخول في الباقة\n\nإذا رغبت بالاستمرار، نساعدك في اختيار الباقة التالية.",
  en: "Hi {{member_name}}, you have {{credits_remaining}} credits left\n\nIf you want to keep your rhythm, we can help you choose the next package.",
},
package_expiring_soon: {
  he: "{{member_name}}, החבילה שלך מסתיימת בקרוב\n\n{{package_name}}\nבתוקף עד {{expires_on}}\n\nאם תרצי להמשיך ברצף, אני כאן לעזור.\nירין",
  ar: "{{member_name}}، باقتك تنتهي قريباً\n\n{{package_name}}\nصالحة حتى {{expires_on}}\n\nإذا رغبت بالاستمرار، نحن هنا للمساعدة.",
  en: "Hi {{member_name}}, your package expires soon\n\n{{package_name}}\nValid until {{expires_on}}\n\nIf you want to keep going, we are here to help.",
},
no_upcoming_booking_14d: {
  he: "{{member_name}}, התגעגענו אלייך בסטודיו 🤍\n\nאם מתאים לך לחזור השבוע, אעזור לך למצוא שיעור שמתאים לקצב שלך.\nירין",
  ar: "{{member_name}}، افتقدناك في الاستوديو 🤍\n\nإذا كان مناسباً أن تعودي هذا الأسبوع، نساعدك في إيجاد حصة تناسبك.",
  en: "Hi {{member_name}}, we missed you at the studio 🤍\n\nIf this week feels right, we can help you find a class that fits your rhythm.",
},
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test tests/unit/notificationTemplates.test.mjs tests/unit/notificationDrafts.test.mjs tests/unit/notificationDelivery.test.mjs
```

Expected result:

```text
pass
```

If `tests/unit/notificationDrafts.test.mjs` fails because it asserts snippets from old copy, update only the asserted snippets to match the new copy. Do not change notification status, queueing, idempotency, or language expectations.

- [ ] **Step 7: Commit implementation**

Run:

```bash
git add src/lib/notificationTemplates.ts tests/unit/notificationTemplates.test.mjs tests/unit/notificationDrafts.test.mjs
git commit -m "feat: update WhatsApp templates with Yareen voice"
```

Expected result:

```text
[main <sha>] feat: update WhatsApp templates with Yareen voice
```

---

### Task 3: Verify Scope And Build Health

**Files:**
- Verify only: `src/lib/notificationTemplates.ts`
- Verify only: `tests/unit/notificationTemplates.test.mjs`
- Verify only: `tests/unit/notificationDrafts.test.mjs`
- Verify only: `tests/unit/notificationDelivery.test.mjs`

**Interfaces:**
- Consumes:
  - Passing implementation from Task 2.
- Produces:
  - Confidence that copy changed without changing delivery behavior.

- [ ] **Step 1: Confirm only intended source/test files changed**

Run:

```bash
git diff --name-only HEAD~2..HEAD
```

Expected output should include:

```text
tests/unit/notificationTemplates.test.mjs
src/lib/notificationTemplates.ts
```

It may include `tests/unit/notificationDrafts.test.mjs` if Task 2 needed snippet-only assertion updates.

It must not include:

```text
src/lib/notificationQueue.server.ts
src/lib/openwa.server.ts
scripts/openwa-local-worker.mjs
src/routes/api/internal/notifications/openwa-claim.ts
```

- [ ] **Step 2: Run notification-focused tests**

Run:

```bash
bun test tests/unit/notificationTemplates.test.mjs tests/unit/notificationDrafts.test.mjs tests/unit/notificationDelivery.test.mjs tests/unit/openwaLocalWorkerJobs.test.mjs tests/unit/openwaLocalWorkerConfig.test.mjs
```

Expected result:

```text
pass
```

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected result:

```text
no errors
```

Existing warnings are acceptable if they were present before this change. Do not refactor unrelated warnings.

- [ ] **Step 4: Run build**

Run:

```bash
bun run build
```

Expected result:

```text
build completes successfully
```

- [ ] **Step 5: Commit verification note if needed**

If Task 3 required no file changes, do not create a commit.

If Task 3 required a test-only adjustment, run:

```bash
git add tests/unit/notificationDrafts.test.mjs
git commit -m "test: align notification draft copy assertions"
```

Expected result:

```text
[main <sha>] test: align notification draft copy assertions
```

---

## Manual QA Script

Use this after implementation if the local OpenWA worker remains connected and dry-run:

1. Keep `OPENWA_WORKER_DRY_RUN=1`.
2. Use the app or a focused render script to preview generated texts for:
   - `booking_confirmed`
   - `payment_confirmed`
   - `class_reminder_24h`
   - `waitlist_spot_available`
   - `registered_no_action`
   - `first_lesson_followup`
3. Send at most one manual OpenWA reply to the known working inbound chat id.
4. Confirm delivery status becomes `delivered` or `read`.
5. Do not enable real worker sends as part of this copy-only plan.

---

## Self-Review Notes

- Spec coverage: Tasks update member WhatsApp copy, preserve email/admin behavior, avoid delivery/schema/UI changes, and test exact render output.
- Red-flag scan: no incomplete instruction markers remain.
- Type consistency: the plan uses existing `findNotificationTemplate` and `renderNotificationCopy` interfaces only; no new runtime interfaces are introduced.
