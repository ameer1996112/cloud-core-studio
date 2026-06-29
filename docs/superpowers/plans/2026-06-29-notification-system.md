# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Cloud & Core V1 notification system as draft-first, localized, idempotent notification preparation with admin review, manual send marking, and V2-ready provider metadata.

**Architecture:** Extend the existing `notification_logs` table and admin Messages flow rather than creating a parallel notification subsystem. Add pure template/language helpers first, then server-side idempotent draft preparation, then wire existing successful domain operations to create drafts without blocking business state. Keep V1 manual: no real email sends and no WhatsApp API sends by default.

**Tech Stack:** Bun, Vite, React 19, TanStack Start server functions, Supabase/Postgres migrations and RLS, Zod, existing Node assert-style unit tests run through `bunx tsx`.

## Global Constraints

- V1 must not send real email automatically.
- V1 must not send WhatsApp Business API messages.
- V1 WhatsApp actions must use deep links only.
- Opening a WhatsApp deep link must not mark a notification as sent.
- Staff must explicitly mark notifications as `manually_sent`.
- Email notifications in V1 are copyable drafts.
- Notification preparation must never block booking, cancellation, waitlist, payment, receipt, package request, or attendance flows.
- Language fallback order is: member preference, current app language, studio default, Hebrew.
- Admins see all notification logs.
- Instructors see operational logs only.
- Payment, receipt, and package-payment logs are admin-only.
- Members do not get notification history in V1.
- Use `bun install`, `bun run lint`, and `bun run build` before pushing meaningful implementation changes.

---

## File Structure

- Create `supabase/migrations/20260629120000_notification_logs_v1.sql`
  - Adds V1 notification metadata columns, idempotency index, relation indexes, and split visibility RLS.
- Modify `src/integrations/supabase/types.ts`
  - Updates `notification_logs` generated type block manually to match the migration until Supabase types are regenerated.
- Create `src/lib/notificationTemplates.ts`
  - Pure event keys, languages, channels, default localized templates, fallback resolution, template rendering, idempotency key helper, and staff visibility helper.
- Create `tests/unit/notificationTemplates.test.mjs`
  - Tests pure notification template helpers without Supabase.
- Create `src/lib/notificationDrafts.ts`
  - Pure conversion from prepared notification drafts into `notification_logs` insert rows.
- Create `tests/unit/notificationDrafts.test.mjs`
  - Tests status mapping, skipped contact handling, staff visibility, relation fields, and idempotency fields.
- Modify `src/lib/messages.functions.ts`
  - Adds V1 statuses and log fields, stops using real OpenWA as the default V1 send path, adds `prepareNotificationDrafts`, adds richer log filters, and renames manual mark behavior to `manually_sent`.
- Modify `src/lib/cloud-core.functions.ts`
  - Prepares booking-confirmed drafts after `bookClass` returns a successful `booking_id`.
- Modify `src/lib/member.functions.ts`
  - Prepares cancellation and waitlist-joined drafts after successful RPCs.
- Modify `src/lib/admin.functions.ts`
  - Prepares admin booking, admin cancellation, waitlist add/promote, manual reminder, and no-show drafts after successful operations.
- Modify `src/lib/memberRequests.functions.ts`
  - Prepares member confirmation and admin action drafts for package requests and manual Cash/Bit payment requests.
- Modify `src/lib/receipts.functions.ts`
  - Prepares admin-only payment-confirmed and receipt-issued drafts after `confirmPaymentAndIssueReceipt`.
- Modify `src/routes/_authenticated/admin/messages.tsx`
  - Updates composer/log UI to copy/open/mark drafts without real provider sends, adds filters and preview fields for new statuses and metadata.
- Modify member success-copy call sites only where they overclaim sending:
  - `src/components/member/ClassDetailSheet.tsx`
  - `src/routes/_authenticated/member/bookings.tsx`
  - Package request surface that calls `createMyPackageRequest` / `createManualPackagePayment`

---

### Task 1: Add Notification Log Migration And Types

**Files:**

- Create: `supabase/migrations/20260629120000_notification_logs_v1.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**

- Consumes: existing `notification_logs`, `payments`, `receipts`, `package_requests`, and `public.has_role`.
- Produces: `notification_logs.language`, `provider`, `provider_message_id`, `related_payment_id`, `related_receipt_id`, `related_package_request_id`, `sent_at`, `error_message`, `idempotency_key`, `staff_visibility`.

- [ ] **Step 1: Add the migration file**

Create `supabase/migrations/20260629120000_notification_logs_v1.sql`:

```sql
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_package_request_id uuid REFERENCES public.package_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS staff_visibility text NOT NULL DEFAULT 'operational';

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_staff_visibility_check
  CHECK (staff_visibility IN ('operational', 'admin_only')) NOT VALID;

ALTER TABLE public.notification_logs
  VALIDATE CONSTRAINT notification_logs_staff_visibility_check;

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_logs_payment_idx
  ON public.notification_logs(related_payment_id);

CREATE INDEX IF NOT EXISTS notification_logs_receipt_idx
  ON public.notification_logs(related_receipt_id);

CREATE INDEX IF NOT EXISTS notification_logs_package_request_idx
  ON public.notification_logs(related_package_request_id);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx
  ON public.notification_logs(status, created_at DESC);

DROP POLICY IF EXISTS "notif logs staff read" ON public.notification_logs;

CREATE POLICY "notif logs split staff read" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'instructor')
      AND staff_visibility = 'operational'
    )
  );
```

- [ ] **Step 2: Update Supabase TypeScript types**

In `src/integrations/supabase/types.ts`, update `Database["public"]["Tables"]["notification_logs"]` `Row`, `Insert`, and `Update` blocks to include:

```ts
error_message: string | null;
idempotency_key: string | null;
language: string | null;
provider: string | null;
provider_message_id: string | null;
related_package_request_id: string | null;
related_payment_id: string | null;
related_receipt_id: string | null;
sent_at: string | null;
staff_visibility: string;
```

For `Insert` and `Update`, every field above should be optional and nullable except `staff_visibility?: string`.

Add relationships for `related_payment_id`, `related_receipt_id`, and `related_package_request_id` using the same relationship shape as existing booking/class/member plan foreign keys.

- [ ] **Step 3: Verify migration and type references**

Run:

```bash
rg -n "staff_visibility|idempotency_key|related_payment_id|related_receipt_id|related_package_request_id" supabase/migrations/20260629120000_notification_logs_v1.sql src/integrations/supabase/types.ts
```

Expected: matches in both the migration and the Supabase type file.

- [ ] **Step 4: Type-check**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
```

Expected: PASS. If unrelated existing repo errors appear, record them exactly and continue only after confirming they are unrelated to this task.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260629120000_notification_logs_v1.sql src/integrations/supabase/types.ts
git commit -m "feat: extend notification log schema"
```

---

### Task 2: Add Pure Notification Template Helpers

**Files:**

- Create: `src/lib/notificationTemplates.ts`
- Create: `tests/unit/notificationTemplates.test.mjs`

**Interfaces:**

- Produces:
  - `type NotificationLanguage = "he" | "ar" | "en"`
  - `type NotificationChannel = "whatsapp" | "email"`
  - `type NotificationEventKey`
  - `type NotificationAudience = "member" | "admin"`
  - `resolveNotificationLanguage(input): NotificationLanguage`
  - `findNotificationTemplate(input): NotificationTemplateDefinition`
  - `renderNotificationCopy(template, variables): { subject: string | null; body: string }`
  - `notificationStaffVisibility(eventKey): "operational" | "admin_only"`
  - `buildNotificationIdempotencyKey(input): string`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/unit/notificationTemplates.test.mjs`:

```js
import { strict as assert } from "node:assert";
import {
  buildNotificationIdempotencyKey,
  findNotificationTemplate,
  notificationStaffVisibility,
  renderNotificationCopy,
  resolveNotificationLanguage,
} from "../../src/lib/notificationTemplates.ts";

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: "ar",
    appLanguage: "en",
    studioDefaultLanguage: "he",
  }),
  "ar",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: null,
    appLanguage: "en",
    studioDefaultLanguage: "he",
  }),
  "en",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: "fr",
    appLanguage: null,
    studioDefaultLanguage: "en",
  }),
  "en",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: undefined,
    appLanguage: "fr",
    studioDefaultLanguage: undefined,
  }),
  "he",
);

const template = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

const rendered = renderNotificationCopy(template, {
  member_name: "נועה",
  class_name: "Core Flow",
  class_date: "29/06/2026",
  class_time: "18:00",
  instructor_name: "Maya",
  studio_name: "Cloud & Core",
});

assert.ok(rendered.body.includes("נועה"));
assert.ok(rendered.body.includes("Core Flow"));
assert.equal(rendered.subject, null);

assert.equal(notificationStaffVisibility("payment_confirmed"), "admin_only");
assert.equal(notificationStaffVisibility("receipt_issued"), "admin_only");
assert.equal(notificationStaffVisibility("booking_confirmed"), "operational");

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "package_request_received",
    channel: "email",
    audience: "admin",
    relatedIds: { packageRequestId: "pkg-1" },
  }),
  "package_request:pkg-1:package_request_received:email:admin",
);

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    audience: "member",
    relatedIds: { bookingId: "book-1" },
  }),
  "booking:book-1:booking_confirmed:whatsapp",
);

console.log("notification template helpers OK");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs
```

Expected: FAIL with a module-not-found error for `src/lib/notificationTemplates.ts`.

- [ ] **Step 3: Implement `src/lib/notificationTemplates.ts`**

Create `src/lib/notificationTemplates.ts`:

```ts
import { renderTemplate } from "@/lib/messageTemplate";

export type NotificationLanguage = "he" | "ar" | "en";
export type NotificationChannel = "whatsapp" | "email";
export type NotificationAudience = "member" | "admin";

export type NotificationEventKey =
  | "booking_confirmed"
  | "booking_cancelled"
  | "waitlist_joined"
  | "waitlist_spot_available"
  | "package_request_received"
  | "payment_confirmed"
  | "receipt_issued"
  | "class_reminder_24h"
  | "no_show_followup";

export type NotificationTemplateDefinition = {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  audience: NotificationAudience;
  subject: string | null;
  body: string;
};

export type NotificationVariables = Record<string, string | number | null | undefined>;

const LANGUAGES: NotificationLanguage[] = ["he", "ar", "en"];

function normalizeNotificationLanguage(value?: string | null): NotificationLanguage | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return LANGUAGES.includes(normalized as NotificationLanguage)
    ? (normalized as NotificationLanguage)
    : null;
}

export function resolveNotificationLanguage(input: {
  memberPreferredLanguage?: string | null;
  appLanguage?: string | null;
  studioDefaultLanguage?: string | null;
}): NotificationLanguage {
  return (
    normalizeNotificationLanguage(input.memberPreferredLanguage) ??
    normalizeNotificationLanguage(input.appLanguage) ??
    normalizeNotificationLanguage(input.studioDefaultLanguage) ??
    "he"
  );
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "he",
    audience: "member",
    subject: null,
    body: "שלום {{member_name}}, ההרשמה שלך לשיעור {{class_name}} אושרה.\nתאריך: {{class_date}}\nשעה: {{class_time}}\nמדריכה: {{instructor_name}}\nנתראה ב-{{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "he",
    audience: "member",
    subject: "ההרשמה שלך אושרה · {{class_name}}",
    body: "שלום {{member_name}}, המקום שלך נשמר לשיעור {{class_name}} בתאריך {{class_date}} בשעה {{class_time}}. נתראה ב-{{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "ar",
    audience: "member",
    subject: null,
    body: "مرحباً {{member_name}}، تم تأكيد حجزك لحصة {{class_name}}.\nالتاريخ: {{class_date}}\nالساعة: {{class_time}}\nالمدربة: {{instructor_name}}\nنراك في {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "ar",
    audience: "member",
    subject: "تم تأكيد حجزك · {{class_name}}",
    body: "مرحباً {{member_name}}، تم حفظ مكانك في حصة {{class_name}} بتاريخ {{class_date}} الساعة {{class_time}}. نراك في {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "en",
    audience: "member",
    subject: null,
    body: "Hi {{member_name}}, your booking for {{class_name}} is confirmed.\nDate: {{class_date}}\nTime: {{class_time}}\nInstructor: {{instructor_name}}\nSee you at {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "en",
    audience: "member",
    subject: "Your class booking is confirmed · {{class_name}}",
    body: "Hi {{member_name}}, your spot is saved for {{class_name}} on {{class_date}} at {{class_time}}. See you at {{studio_name}}.",
  },
];

const FALLBACK_BODIES: Record<NotificationEventKey, Record<NotificationLanguage, string>> = {
  booking_confirmed: {
    he: "שלום {{member_name}}, ההרשמה שלך לשיעור {{class_name}} אושרה.",
    ar: "مرحباً {{member_name}}، تم تأكيد حجزك لحصة {{class_name}}.",
    en: "Hi {{member_name}}, your booking for {{class_name}} is confirmed.",
  },
  booking_cancelled: {
    he: "שלום {{member_name}}, ההזמנה שלך לשיעור {{class_name}} בוטלה.",
    ar: "مرحباً {{member_name}}، تم إلغاء حجزك لحصة {{class_name}}.",
    en: "Hi {{member_name}}, your booking for {{class_name}} was cancelled.",
  },
  waitlist_joined: {
    he: "שלום {{member_name}}, הצטרפת לרשימת ההמתנה לשיעור {{class_name}}.",
    ar: "مرحباً {{member_name}}، تمت إضافتك إلى قائمة الانتظار لحصة {{class_name}}.",
    en: "Hi {{member_name}}, you joined the waitlist for {{class_name}}.",
  },
  waitlist_spot_available: {
    he: "שלום {{member_name}}, התפנה מקום בשיעור {{class_name}}.",
    ar: "مرحباً {{member_name}}، أصبح هناك مكان متاح في حصة {{class_name}}.",
    en: "Hi {{member_name}}, a spot is available in {{class_name}}.",
  },
  package_request_received: {
    he: "שלום {{member_name}}, בקשת החבילה {{package_name}} התקבלה וממתינה לאישור הסטודיו.",
    ar: "مرحباً {{member_name}}، تم استلام طلب باقة {{package_name}} وهو بانتظار تأكيد الاستوديو.",
    en: "Hi {{member_name}}, your {{package_name}} package request was received and is pending studio confirmation.",
  },
  payment_confirmed: {
    he: "שלום {{member_name}}, התשלום עבור {{package_name}} אושר.",
    ar: "مرحباً {{member_name}}، تم تأكيد الدفع مقابل {{package_name}}.",
    en: "Hi {{member_name}}, your payment for {{package_name}} is confirmed.",
  },
  receipt_issued: {
    he: "שלום {{member_name}}, הקבלה {{receipt_number}} הונפקה וזמינה באזור האישי.",
    ar: "مرحباً {{member_name}}، تم إصدار الإيصال {{receipt_number}} وهو متاح في حسابك.",
    en: "Hi {{member_name}}, receipt {{receipt_number}} was issued and is available in your account.",
  },
  class_reminder_24h: {
    he: "שלום {{member_name}}, תזכורת לשיעור {{class_name}} מחר בשעה {{class_time}}.",
    ar: "مرحباً {{member_name}}، تذكير بحصة {{class_name}} غداً الساعة {{class_time}}.",
    en: "Hi {{member_name}}, reminder: {{class_name}} is tomorrow at {{class_time}}.",
  },
  no_show_followup: {
    he: "שלום {{member_name}}, ראינו שלא הגעת לשיעור {{class_name}}. נשמח לראות אותך שוב בקרוב.",
    ar: "مرحباً {{member_name}}، لاحظنا أنك لم تحضر حصة {{class_name}}. نأمل أن نراك قريباً.",
    en: "Hi {{member_name}}, we noticed you missed {{class_name}}. We hope to see you again soon.",
  },
};

const EMAIL_SUBJECTS: Record<NotificationEventKey, Record<NotificationLanguage, string>> = {
  booking_confirmed: {
    he: "ההרשמה שלך אושרה · {{class_name}}",
    ar: "تم تأكيد حجزك · {{class_name}}",
    en: "Your class booking is confirmed · {{class_name}}",
  },
  booking_cancelled: {
    he: "ההזמנה לשיעור בוטלה · {{class_name}}",
    ar: "تم إلغاء حجز الحصة · {{class_name}}",
    en: "Your class booking was cancelled · {{class_name}}",
  },
  waitlist_joined: {
    he: "הצטרפת לרשימת ההמתנה · {{class_name}}",
    ar: "تمت إضافتك إلى قائمة الانتظار · {{class_name}}",
    en: "You joined the waitlist · {{class_name}}",
  },
  waitlist_spot_available: {
    he: "התפנה מקום בשיעור · {{class_name}}",
    ar: "أصبح هناك مكان متاح · {{class_name}}",
    en: "A class spot is available · {{class_name}}",
  },
  package_request_received: {
    he: "בקשת החבילה התקבלה · {{package_name}}",
    ar: "تم استلام طلب الباقة · {{package_name}}",
    en: "Package request received · {{package_name}}",
  },
  payment_confirmed: {
    he: "התשלום אושר · {{package_name}}",
    ar: "تم تأكيد الدفع · {{package_name}}",
    en: "Payment confirmed · {{package_name}}",
  },
  receipt_issued: {
    he: "הקבלה הונפקה · {{receipt_number}}",
    ar: "تم إصدار الإيصال · {{receipt_number}}",
    en: "Receipt issued · {{receipt_number}}",
  },
  class_reminder_24h: {
    he: "תזכורת לשיעור הקרוב · {{class_name}}",
    ar: "تذكير بالحصة القادمة · {{class_name}}",
    en: "Reminder for your upcoming class · {{class_name}}",
  },
  no_show_followup: {
    he: "נשמח לראות אותך שוב · {{class_name}}",
    ar: "نأمل أن نراك قريباً · {{class_name}}",
    en: "We hope to see you again · {{class_name}}",
  },
};

export function findNotificationTemplate(input: {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  audience?: NotificationAudience;
}): NotificationTemplateDefinition {
  const audience = input.audience ?? "member";
  const existing = DEFAULT_NOTIFICATION_TEMPLATES.find(
    (template) =>
      template.eventKey === input.eventKey &&
      template.channel === input.channel &&
      template.language === input.language &&
      template.audience === audience,
  );
  if (existing) return existing;

  return {
    eventKey: input.eventKey,
    channel: input.channel,
    language: input.language,
    audience,
    subject: input.channel === "email" ? EMAIL_SUBJECTS[input.eventKey][input.language] : null,
    body: FALLBACK_BODIES[input.eventKey][input.language],
  };
}

export function renderNotificationCopy(
  template: NotificationTemplateDefinition,
  variables: NotificationVariables,
): { subject: string | null; body: string } {
  return {
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    body: renderTemplate(template.body, variables),
  };
}

export function notificationStaffVisibility(
  eventKey: NotificationEventKey,
): "operational" | "admin_only" {
  return eventKey === "payment_confirmed" ||
    eventKey === "receipt_issued" ||
    eventKey === "package_request_received"
    ? "admin_only"
    : "operational";
}

export function buildNotificationIdempotencyKey(input: {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  audience?: NotificationAudience;
  relatedIds: {
    bookingId?: string | null;
    waitlistEntryId?: string | null;
    packageRequestId?: string | null;
    paymentId?: string | null;
    receiptId?: string | null;
  };
}): string {
  const audience = input.audience ?? "member";
  if (input.eventKey === "package_request_received") {
    return `package_request:${input.relatedIds.packageRequestId}:package_request_received:${input.channel}:${audience}`;
  }
  if (input.eventKey === "payment_confirmed") {
    return `payment:${input.relatedIds.paymentId}:payment_confirmed:${input.channel}`;
  }
  if (input.eventKey === "receipt_issued") {
    return `receipt:${input.relatedIds.receiptId}:receipt_issued:${input.channel}`;
  }
  if (input.eventKey === "waitlist_joined" || input.eventKey === "waitlist_spot_available") {
    return `waitlist:${input.relatedIds.waitlistEntryId}:${input.eventKey}:${input.channel}`;
  }
  return `booking:${input.relatedIds.bookingId}:${input.eventKey}:${input.channel}`;
}
```

- [ ] **Step 4: Run the helper test**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs
```

Expected: PASS with `notification template helpers OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationTemplates.ts tests/unit/notificationTemplates.test.mjs
git commit -m "feat: add notification template helpers"
```

---

### Task 3: Add Pure Draft Row Builder

**Files:**

- Create: `src/lib/notificationDrafts.ts`
- Create: `tests/unit/notificationDrafts.test.mjs`

**Interfaces:**

- Consumes: Task 2 helpers.
- Produces:
  - `type NotificationDraftInput`
  - `type NotificationLogInsertRow`
  - `buildNotificationDraftRows(input): NotificationLogInsertRow[]`

- [ ] **Step 1: Write the failing draft-row test**

Create `tests/unit/notificationDrafts.test.mjs`:

```js
import { strict as assert } from "node:assert";
import { buildNotificationDraftRows } from "../../src/lib/notificationDrafts.ts";

const rows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp", "email"],
  audience: "member",
  member: {
    id: "member-1",
    name: "Noa",
    phone: "+972501234567",
    email: "noa@example.com",
    preferred_language: "en",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: "+972400000000",
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-1",
    classId: "class-1",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "29/06/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
});

assert.equal(rows.length, 2);
assert.equal(rows[0].status, "draft");
assert.equal(rows[0].language, "en");
assert.equal(rows[0].staff_visibility, "operational");
assert.equal(rows[0].related_booking_id, "booking-1");
assert.equal(rows[0].related_class_id, "class-1");
assert.equal(rows[0].idempotency_key, "booking:booking-1:booking_confirmed:whatsapp");
assert.ok(rows[0].generated_text?.includes("Noa"));
assert.equal(rows[1].channel, "email");
assert.equal(rows[1].status, "draft");
assert.ok(rows[1].subject?.includes("Core Flow"));

const skipped = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp", "email"],
  audience: "member",
  member: {
    id: "member-2",
    name: "Dana",
    phone: null,
    email: null,
    preferred_language: null,
  },
  appLanguage: null,
  studioSettings: {
    default_language: null,
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-2",
    classId: "class-2",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "29/06/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
});

assert.equal(skipped[0].status, "skipped");
assert.equal(skipped[0].error_message, "missing_whatsapp_phone");
assert.equal(skipped[1].status, "skipped");
assert.equal(skipped[1].error_message, "missing_email");
assert.equal(skipped[0].language, "he");

const paymentRows = buildNotificationDraftRows({
  eventKey: "payment_confirmed",
  channels: ["email"],
  audience: "member",
  member: {
    id: "member-3",
    name: "Mira",
    phone: null,
    email: "mira@example.com",
    preferred_language: "he",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "en",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    paymentId: "payment-1",
  },
  variables: {
    package_name: "Ten Classes",
  },
});

assert.equal(paymentRows[0].staff_visibility, "admin_only");
assert.equal(paymentRows[0].related_payment_id, "payment-1");

console.log("notification draft rows OK");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationDrafts.test.mjs
```

Expected: FAIL with module-not-found for `src/lib/notificationDrafts.ts`.

- [ ] **Step 3: Implement `src/lib/notificationDrafts.ts`**

Create `src/lib/notificationDrafts.ts`:

```ts
import {
  buildNotificationIdempotencyKey,
  findNotificationTemplate,
  notificationStaffVisibility,
  renderNotificationCopy,
  resolveNotificationLanguage,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationVariables,
} from "@/lib/notificationTemplates";

type DraftMember = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language?: string | null;
};

type DraftStudioSettings = {
  default_language?: string | null;
  studio_name?: string | null;
  public_phone?: string | null;
  whatsapp_number?: string | null;
  timezone?: string | null;
};

type RelatedIds = {
  bookingId?: string | null;
  classId?: string | null;
  memberPlanId?: string | null;
  packageRequestId?: string | null;
  paymentId?: string | null;
  receiptId?: string | null;
  waitlistEntryId?: string | null;
};

export type NotificationDraftInput = {
  eventKey: NotificationEventKey;
  channels: NotificationChannel[];
  audience?: NotificationAudience;
  member: DraftMember;
  appLanguage?: string | null;
  studioSettings: DraftStudioSettings | null;
  relatedIds: RelatedIds;
  variables: NotificationVariables;
};

export type NotificationLogInsertRow = {
  template_key: string;
  channel: NotificationChannel;
  recipient_member_id: string;
  payload: Record<string, unknown>;
  status: "draft" | "skipped";
  trigger_type: NotificationEventKey;
  related_class_id: string | null;
  related_booking_id: string | null;
  related_member_plan_id: string | null;
  related_package_request_id: string | null;
  related_payment_id: string | null;
  related_receipt_id: string | null;
  generated_text: string | null;
  subject: string | null;
  language: string;
  provider: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  idempotency_key: string;
  staff_visibility: "operational" | "admin_only";
};

function skipReason(channel: NotificationChannel, member: DraftMember): string | null {
  if (channel === "whatsapp" && !member.phone) return "missing_whatsapp_phone";
  if (channel === "email" && !member.email) return "missing_email";
  return null;
}

export function buildNotificationDraftRows(
  input: NotificationDraftInput,
): NotificationLogInsertRow[] {
  const language = resolveNotificationLanguage({
    memberPreferredLanguage: input.member.preferred_language,
    appLanguage: input.appLanguage,
    studioDefaultLanguage: input.studioSettings?.default_language,
  });
  const audience = input.audience ?? "member";
  const variables: NotificationVariables = {
    studio_name: input.studioSettings?.studio_name ?? "Cloud & Core",
    studio_phone: input.studioSettings?.public_phone ?? "",
    studio_whatsapp: input.studioSettings?.whatsapp_number ?? "",
    member_name: input.member.name ?? "",
    ...input.variables,
  };

  return input.channels.map((channel) => {
    const template = findNotificationTemplate({
      eventKey: input.eventKey,
      channel,
      language,
      audience,
    });
    const rendered = renderNotificationCopy(template, variables);
    const reason = skipReason(channel, input.member);
    return {
      template_key: `${input.eventKey}.${channel}.${language}.${audience}`,
      channel,
      recipient_member_id: input.member.id,
      payload: {
        event_key: input.eventKey,
        audience,
        variables,
      },
      status: reason ? "skipped" : "draft",
      trigger_type: input.eventKey,
      related_class_id: input.relatedIds.classId ?? null,
      related_booking_id: input.relatedIds.bookingId ?? null,
      related_member_plan_id: input.relatedIds.memberPlanId ?? null,
      related_package_request_id: input.relatedIds.packageRequestId ?? null,
      related_payment_id: input.relatedIds.paymentId ?? null,
      related_receipt_id: input.relatedIds.receiptId ?? null,
      generated_text: rendered.body,
      subject: rendered.subject,
      language,
      provider: null,
      provider_message_id: null,
      sent_at: null,
      error_message: reason,
      idempotency_key: buildNotificationIdempotencyKey({
        eventKey: input.eventKey,
        channel,
        audience,
        relatedIds: input.relatedIds,
      }),
      staff_visibility: notificationStaffVisibility(input.eventKey),
    };
  });
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationDrafts.test.mjs
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificationDrafts.ts tests/unit/notificationDrafts.test.mjs
git commit -m "feat: build notification draft rows"
```

---

### Task 4: Add Server-Side Draft Preparation Functions

**Files:**

- Modify: `src/lib/messages.functions.ts`

**Interfaces:**

- Consumes: `buildNotificationDraftRows(input)`.
- Produces:
  - `prepareNotificationDrafts`
  - richer `logNotification` input schema
  - `markNotificationSent` writes `status = "manually_sent"`
  - `listNotificationLogs({ limit, channel, status, triggerType, visibility })`

- [ ] **Step 1: Update imports and schemas**

In `src/lib/messages.functions.ts`, add:

```ts
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
```

Extend `logSchema` with:

```ts
status: z
  .enum(["draft", "queued", "sent", "failed", "manually_sent", "skipped", "generated", "copied", "opened", "marked_sent"])
  .default("draft"),
language: z.string().nullable().optional(),
provider: z.string().nullable().optional(),
providerMessageId: z.string().nullable().optional(),
relatedPaymentId: z.string().uuid().nullable().optional(),
relatedReceiptId: z.string().uuid().nullable().optional(),
relatedPackageRequestId: z.string().uuid().nullable().optional(),
errorMessage: z.string().nullable().optional(),
idempotencyKey: z.string().nullable().optional(),
staffVisibility: z.enum(["operational", "admin_only"]).default("operational"),
```

Add this helper near the logging section:

```ts
function normalizeLogStatus(status: string) {
  if (status === "generated" || status === "copied" || status === "opened") return "draft";
  if (status === "marked_sent") return "manually_sent";
  return status;
}
```

- [ ] **Step 2: Update `logNotification` insert payload**

Inside `logNotification`, compute:

```ts
const status = normalizeLogStatus(data.status);
```

Insert the new fields:

```ts
status,
language: data.language ?? null,
provider: data.provider ?? null,
provider_message_id: data.providerMessageId ?? null,
related_payment_id: data.relatedPaymentId ?? null,
related_receipt_id: data.relatedReceiptId ?? null,
related_package_request_id: data.relatedPackageRequestId ?? null,
sent_at: status === "sent" || status === "manually_sent" ? new Date().toISOString() : null,
error_message: data.errorMessage ?? null,
idempotency_key: data.idempotencyKey ?? null,
staff_visibility: data.staffVisibility,
marked_sent_at: status === "manually_sent" ? new Date().toISOString() : null,
```

- [ ] **Step 3: Add `prepareNotificationDrafts` server function**

Add this schema and server function after `logNotification`:

```ts
const draftSchema = z.object({
  eventKey: z.enum([
    "booking_confirmed",
    "booking_cancelled",
    "waitlist_joined",
    "waitlist_spot_available",
    "package_request_received",
    "payment_confirmed",
    "receipt_issued",
    "class_reminder_24h",
    "no_show_followup",
  ]),
  channels: z.array(z.enum(["whatsapp", "email"])).default(["whatsapp", "email"]),
  audience: z.enum(["member", "admin"]).default("member"),
  memberId: z.string().uuid(),
  appLanguage: z.string().nullable().optional(),
  relatedIds: z
    .object({
      bookingId: z.string().uuid().nullable().optional(),
      classId: z.string().uuid().nullable().optional(),
      memberPlanId: z.string().uuid().nullable().optional(),
      packageRequestId: z.string().uuid().nullable().optional(),
      paymentId: z.string().uuid().nullable().optional(),
      receiptId: z.string().uuid().nullable().optional(),
      waitlistEntryId: z.string().uuid().nullable().optional(),
    })
    .default({}),
  variables: z.record(z.union([z.string(), z.number(), z.null()])).default({}),
});

export const prepareNotificationDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => draftSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const [memberRes, settingsRes] = await Promise.all([
      context.supabase
        .from("members")
        .select("id,name,phone,email,preferred_language")
        .eq("id", data.memberId)
        .maybeSingle(),
      context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (memberRes.error) throw memberRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (!memberRes.data) return { inserted: 0, skipped: 0 };

    const rows = buildNotificationDraftRows({
      eventKey: data.eventKey,
      channels: data.channels,
      audience: data.audience,
      member: memberRes.data,
      appLanguage: data.appLanguage ?? null,
      studioSettings: settingsRes.data ?? null,
      relatedIds: data.relatedIds,
      variables: data.variables,
    });

    const { error } = await context.supabase
      .from("notification_logs")
      .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (error) throw error;
    return {
      inserted: rows.filter((row) => row.status === "draft").length,
      skipped: rows.filter((row) => row.status === "skipped").length,
    };
  });
```

- [ ] **Step 4: Replace V1 real WhatsApp send behavior**

Keep `sendWhatsAppMessage` exported for compatibility, but make it return a clear error instead of attempting OpenWA in V1:

```ts
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendWhatsAppSchema.parse(d))
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    throw new Error(
      "Direct WhatsApp sending is disabled in V1. Use Open WhatsApp, then Mark manually sent.",
    );
  });
```

Leave the old OpenWA helper functions in place only if no lint errors occur. If lint flags them as unused, remove `openWaConfig`, `getOpenWaSessionStatus`, and `openWaConnectionMessage`.

- [ ] **Step 5: Update manual mark and log listing**

Change `markNotificationSent` update to:

```ts
.update({
  status: "manually_sent",
  marked_sent_at: new Date().toISOString(),
  sent_at: new Date().toISOString(),
})
```

Change `listNotificationLogs` validator to:

```ts
z.object({
  limit: z.number().int().positive().max(200).default(50),
  channel: z.enum(["all", "whatsapp", "email", "in_app"]).default("all"),
  status: z
    .enum(["all", "draft", "queued", "sent", "failed", "manually_sent", "skipped"])
    .default("all"),
  triggerType: z.string().default("all"),
  visibility: z.enum(["all", "operational", "admin_only"]).default("all"),
}).parse(d ?? {});
```

Apply filters before `.limit(data.limit)`:

```ts
let query = context.supabase
  .from("notification_logs")
  .select("*, member:members(id,name,phone,email)")
  .order("created_at", { ascending: false });
if (data.channel !== "all") query = query.eq("channel", data.channel);
if (data.status !== "all") query = query.eq("status", data.status);
if (data.triggerType !== "all") query = query.eq("trigger_type", data.triggerType);
if (data.visibility !== "all") query = query.eq("staff_visibility", data.visibility);
const { data: rows } = await query.limit(data.limit);
```

- [ ] **Step 6: Type-check and lint**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/messages.functions.ts
git commit -m "feat: prepare notification drafts on server"
```

---

### Task 5: Wire Booking, Cancellation, Waitlist, Attendance, Package, Payment, And Receipt Events

**Files:**

- Modify: `src/lib/cloud-core.functions.ts`
- Modify: `src/lib/member.functions.ts`
- Modify: `src/lib/admin.functions.ts`
- Modify: `src/lib/memberRequests.functions.ts`
- Modify: `src/lib/receipts.functions.ts`

**Interfaces:**

- Consumes: `buildNotificationDraftRows`.
- Produces: domain functions create idempotent notification drafts after successful operations.

- [ ] **Step 1: Add a local helper in each touched server module**

In each modified file, import:

```ts
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
```

Use this helper shape in each module, adjusted only for selected relation queries:

```ts
async function insertNotificationDraftRows(supabase: any, rows: any[]) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("notification_draft_insert_failed", error.message);
}
```

- [ ] **Step 2: Wire `bookClass` in `src/lib/cloud-core.functions.ts`**

After `book_class_v2` succeeds and before returning `result`, add logic equivalent to:

```ts
const bookingId = (result as any)?.booking_id;
if ((result as any)?.status === "booked" && bookingId) {
  const [bookingRes, settingsRes] = await Promise.all([
    context.supabase
      .from("bookings")
      .select(
        "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
      )
      .eq("id", bookingId)
      .maybeSingle(),
    context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const booking = bookingRes.data as any;
  if (booking?.member && booking?.class) {
    await insertNotificationDraftRows(
      context.supabase,
      buildNotificationDraftRows({
        eventKey: "booking_confirmed",
        channels: ["whatsapp", "email"],
        audience: "member",
        member: booking.member,
        appLanguage: null,
        studioSettings: settingsRes.data ?? null,
        relatedIds: { bookingId: booking.id, classId: booking.class_id },
        variables: {
          class_name: booking.class.title,
          class_date: new Date(booking.class.starts_at).toLocaleDateString("en-GB"),
          class_time: new Date(booking.class.starts_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          instructor_name: booking.class.instructor?.name ?? "",
        },
      }),
    );
  }
}
```

- [ ] **Step 3: Wire member cancellation and waitlist in `src/lib/member.functions.ts`**

After `memberCancelBooking` returns success, query booking/member/class and create `booking_cancelled` drafts.

After `joinWaitlist` returns a status with `entry_id`, query waitlist/member/class and create `waitlist_joined` drafts.

For both, use `context.supabase` for inserts and catch/log errors through `insertNotificationDraftRows` so the original RPC result remains successful.

- [ ] **Step 4: Wire admin booking, cancellation, waitlist, reminder, and no-show in `src/lib/admin.functions.ts`**

After `adminCreateBooking` returns a booking id or successful result with booking id, create `booking_confirmed` drafts.

After `adminCancelBooking` returns success, create `booking_cancelled` drafts.

After `waitlistAdd`, query the inserted or matching waiting entry and create `waitlist_joined` drafts.

After `waitlistPromote`, if the returned payload contains a booking id, create `booking_confirmed` drafts; otherwise create `waitlist_spot_available` drafts for the entry.

After `markAttendance`, only when input `status === "no_show"`, query booking/member/class and create `no_show_followup` drafts.

Add a new server function `prepareClassReminderDrafts`:

```ts
export const prepareClassReminderDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const [bookingsRes, clsRes, settingsRes] = await Promise.all([
      context.supabase
        .from("bookings")
        .select("id,member:members(id,name,phone,email,preferred_language)")
        .eq("class_id", data.classId)
        .eq("status", "booked"),
      context.supabase
        .from("classes")
        .select("id,title,starts_at,instructor:instructors(name)")
        .eq("id", data.classId)
        .maybeSingle(),
      context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (bookingsRes.error) throw bookingsRes.error;
    if (clsRes.error) throw clsRes.error;
    const cls = clsRes.data as any;
    const rows = (bookingsRes.data ?? []).flatMap((booking: any) =>
      booking.member && cls
        ? buildNotificationDraftRows({
            eventKey: "class_reminder_24h",
            channels: ["whatsapp", "email"],
            audience: "member",
            member: booking.member,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: { bookingId: booking.id, classId: data.classId },
            variables: {
              class_name: cls.title,
              class_date: new Date(cls.starts_at).toLocaleDateString("en-GB"),
              class_time: new Date(cls.starts_at).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              instructor_name: cls.instructor?.name ?? "",
            },
          })
        : [],
    );
    await insertNotificationDraftRows(context.supabase, rows);
    return { prepared: rows.length };
  });
```

- [ ] **Step 5: Wire package request drafts in `src/lib/memberRequests.functions.ts`**

After `createMyPackageRequest` inserts the request, query member/plan/settings and insert:

- `package_request_received` member draft with `audience: "member"`.
- `package_request_received` admin action draft with `audience: "admin"`.

After `createManualPackagePayment` inserts the pending payment, use `relatedIds.packageRequestId` only when a request exists; otherwise include `relatedIds.paymentId` in payload variables and keep `staff_visibility` admin-only through the event key.

- [ ] **Step 6: Wire payment and receipt drafts in `src/lib/receipts.functions.ts`**

After `confirmPaymentAndIssueReceipt` returns success or already-confirmed with `payment_id` and `receipt_id`, query payment/member/plan/receipt/settings and insert:

- `payment_confirmed` drafts with `relatedPaymentId`.
- `receipt_issued` drafts with `relatedReceiptId`.

Both are admin-only via `notificationStaffVisibility`.

- [ ] **Step 7: Type-check**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cloud-core.functions.ts src/lib/member.functions.ts src/lib/admin.functions.ts src/lib/memberRequests.functions.ts src/lib/receipts.functions.ts
git commit -m "feat: create drafts for notification events"
```

---

### Task 6: Update Admin Messages UI For Draft Workflow

**Files:**

- Modify: `src/routes/_authenticated/admin/messages.tsx`

**Interfaces:**

- Consumes: `listNotificationLogs`, `markNotificationSent`, `prepareClassReminderDrafts`, `waUrl`.
- Produces: admin UI where copy/open actions do not imply sent status and logs can be filtered by V1 fields.

- [ ] **Step 1: Remove real-send action from preview rows**

In `PreviewRow`, remove:

```ts
const sendWaFn = useServerFn(sendWhatsAppMessage);
const sendWa = useMutation({ ... });
```

Remove the button that calls `sendWa.mutate()`.

Keep the WhatsApp deep-link button and change `openWa` to:

```ts
async function openWa() {
  const url = waUrl({ to: member.phone, text: displayText });
  window.open(url, "_blank", "noopener");
}
```

This intentionally removes `await onLogged("opened", displayText)` from opening WhatsApp.

- [ ] **Step 2: Rename composer status labels**

Change `onLogged` type to:

```ts
onLogged: (status: "draft" | "manually_sent", text: string) => Promise<void>;
```

Change copy behavior:

```ts
async function copy(kind: "draft" | "manually_sent") {
  try {
    await navigator.clipboard.writeText(displayText);
    toast.success(kind === "manually_sent" ? "Copied. Marked manually sent." : "Copied draft");
    await onLogged(kind, displayText);
  } catch {
    toast.error("Copy failed");
  }
}
```

Use `copy("draft")` for copy buttons and `copy("manually_sent")` for manual mark buttons.

- [ ] **Step 3: Update log filters**

Change the Logs tab filter state to include:

```ts
const [logFilter, setLogFilter] = useState({
  channel: "all",
  status: "all",
  triggerType: "all",
  visibility: "all",
});
```

Call:

```ts
queryFn: () => fn({ data: { limit: 100, ...logFilter } }),
```

Use query key:

```ts
queryKey: ["notification-logs", logFilter],
```

Render status filters:

```ts
{["all", "draft", "skipped", "failed", "manually_sent", "sent"].map((s) => ...)}
```

Render visibility filters:

```ts
{["all", "operational", "admin_only"].map((v) => ...)}
```

- [ ] **Step 4: Update log row actions**

Show `l.subject`, `l.language`, `l.staff_visibility`, `l.error_message`, and `l.idempotency_key` in the row details.

Render Mark manually sent only when:

```ts
l.status !== "manually_sent" && l.status !== "sent" && l.status !== "skipped";
```

Button label:

```tsx
Mark manually sent
```

- [ ] **Step 5: Type-check and lint**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated/admin/messages.tsx
git commit -m "feat: update messages draft workflow"
```

---

### Task 7: Update Member Copy And Final Verification

**Files:**

- Modify: `src/components/member/ClassDetailSheet.tsx`
- Modify: `src/routes/_authenticated/member/bookings.tsx`
- Modify: package request UI file found by `rg -n "createMyPackageRequest|createManualPackagePayment" src`

**Interfaces:**

- Consumes: completed V1 draft behavior.
- Produces: member-facing copy that says actions succeeded but does not say external messages were sent.

- [ ] **Step 1: Find package request UI call sites**

Run:

```bash
rg -n "createMyPackageRequest|createManualPackagePayment" src
```

Expected: one or more UI files that call package request server functions.

- [ ] **Step 2: Update booking success copy**

In `src/components/member/ClassDetailSheet.tsx`, change any booking success toast or confirmation text that claims a message was sent to neutral copy:

```ts
toast.success(t("booking.confirmed"));
```

If a new translation key is needed, add:

```ts
"booking.confirmed": "Booking confirmed. Details are available in your bookings.",
```

Hebrew:

```ts
"booking.confirmed": "ההרשמה אושרה. פרטי השיעור זמינים באזור ההזמנות.",
```

Arabic:

```ts
"booking.confirmed": "تم تأكيد الحجز. تفاصيل الحصة متاحة في حجوزاتك.",
```

- [ ] **Step 3: Update cancellation success copy**

In `src/routes/_authenticated/member/bookings.tsx`, make cancellation success neutral:

```ts
toast.success(t("booking.cancelled"));
```

Translations if needed:

```ts
"booking.cancelled": "Booking cancelled. Your booking list has been updated.",
"booking.cancelled": "ההזמנה בוטלה. רשימת ההזמנות עודכנה.",
"booking.cancelled": "تم إلغاء الحجز. تم تحديث قائمة حجوزاتك.",
```

- [ ] **Step 4: Update package request success copy**

In the package request UI file found in Step 1, use neutral request copy:

```ts
toast.success(t("packages.requestReceived"));
```

Translations if needed:

```ts
"packages.requestReceived": "Package request received. The studio will confirm it after review.",
"packages.requestReceived": "בקשת החבילה התקבלה. הסטודיו יאשר אותה לאחר בדיקה.",
"packages.requestReceived": "تم استلام طلب الباقة. سيقوم الاستوديو بتأكيدها بعد المراجعة.",
```

- [ ] **Step 5: Run unit tests**

Run:

```bash
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationTemplates.test.mjs
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/notificationDrafts.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Run full verification**

Run:

```bash
/Users/ameeramer/.bun/bin/bun run lint
/Users/ameeramer/.bun/bin/bun run build
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/member/ClassDetailSheet.tsx src/routes/_authenticated/member/bookings.tsx src/lib/i18n.ts
git add "$(rg -l "packages.requestReceived|createMyPackageRequest|createManualPackagePayment" src)"
git commit -m "fix: keep member notification copy accurate"
```

---

## Self-Review Notes

- Spec coverage: the plan covers schema, idempotency, draft status, manual send marking, WhatsApp deep-link-only behavior, email drafts, split visibility, language fallback, member-copy accuracy, and V2 metadata fields. V2 providers and scheduler are intentionally represented as schema/adapter-ready fields only, because V1 implementation must not automate delivery.
- Placeholder scan: no task asks for unspecified validation or unspecified tests. Each task has explicit files, commands, expected outcomes, and commit boundaries.
- Type consistency: the core types are defined in Task 2, consumed by Task 3, and then used by server functions in Tasks 4 and 5. Status names are normalized to `draft`, `skipped`, `failed`, `manually_sent`, `queued`, and `sent` before UI work in Task 6.
