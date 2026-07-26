# Concierge Branded Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver premium editorial Cloud & Core email and WhatsApp presentations, previews, sender identity guidance, and a test-only rollout without weakening Concierge safety controls.

**Architecture:** Add a pure Concierge presentation registry that maps journeys to localized labels, structured facts, safe actions, and versioned channel presentation keys. Reuse the existing email-safe renderer through an explicit presentation override, extend the official WhatsApp adapter to accept typed Meta components, and snapshot presentation evidence with each canonical delivery. The admin Templates tab renders the same pure presentation outputs used by delivery.

**Tech Stack:** TypeScript, React, TanStack Start/Query, Bun test, Supabase/PostgreSQL RPCs, Resend, Meta WhatsApp Cloud API, email-safe table HTML.

## Global Constraints

- Visual direction: premium editorial with ivory surfaces, white cards, navy typography, and restrained gold accents.
- Sender name is exactly `Cloud & Core Studio`.
- Supported locales are exactly `he`, `ar`, and `en`; Hebrew and Arabic render RTL.
- Email must remain branded and readable when remote images are blocked.
- WhatsApp uses one shared branded image header and only Meta-supported template components.
- Buttons appear only for a useful, safe journey destination.
- Missing required variables or locale approval suppresses the affected channel.
- Missing CTA destination removes the button but does not suppress valid informational content.
- Existing consent, recipient resolution, frequency caps, quiet hours, test allowlists, and live-delivery gates remain unchanged.
- Existing approved WhatsApp templates remain active until branded replacements are provider-approved and tested.
- Do not commit local environment files or provider credentials.

---

## File Map

- Create `src/lib/conciergePresentation.ts`: pure journey presentation registry, localized labels, facts, CTA selection, version keys, and safe action resolution.
- Create `src/lib/conciergeEmail.ts`: Concierge-to-email adapter that calls the email-safe renderer with an explicit branded presentation.
- Modify `src/lib/transactionalEmail.ts`: accept a validated presentation override without changing existing unified-message defaults.
- Modify `src/lib/conciergeTemplateCatalog.ts`: create versioned branded Meta template definitions with header, body, footer, and optional buttons.
- Modify `src/lib/messagingProviders.server.ts`: send typed WhatsApp header/body/button components.
- Modify `src/lib/conciergeMaterialization.ts`: include presentation evidence, safe actions, and structured WhatsApp provider components.
- Create `supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql`: validate and persist presentation evidence in message content and snapshots.
- Modify `src/lib/conciergeAdmin.functions.ts`: return provider approval metadata needed by previews.
- Modify `src/components/admin/ConciergeTemplateLibrary.tsx`: render branded email and WhatsApp previews.
- Create `src/components/admin/ConciergeEmailPreview.tsx`: sandboxed email preview.
- Create `src/components/admin/ConciergeWhatsappPreview.tsx`: provider-shaped WhatsApp preview.
- Create `public/brand/concierge-whatsapp-header.webp`: one production-safe branded header derived from existing approved Cloud & Core brand assets.
- Modify `docs/concierge/MANUAL_PROVIDER_SETUP.md`: sender identity, Meta profile, stable asset URL, and approval procedure.
- Modify `docs/concierge/OPERATIONS_RUNBOOK.md`: test-only rollout and rollback procedure.
- Add or modify focused unit/integration tests named in each task.

---

### Task 1: Versioned Concierge Presentation Registry

**Files:**
- Create: `src/lib/conciergePresentation.ts`
- Create: `tests/unit/conciergePresentation.test.mjs`

**Interfaces:**
- Produces:

```ts
export type ConciergePresentationLocale = "he" | "ar" | "en";
export type ConciergePresentationChannel = "email" | "whatsapp";
export type ConciergePresentationFact = {
  key: string;
  label: string;
  value: string;
  ltr: boolean;
};
export type ConciergeAction = {
  label: string;
  url: string;
} | null;
export type ConciergePresentation = {
  key: string;
  version: 2;
  journeyType: string;
  categoryLabel: string;
  subject: string;
  body: string;
  facts: ConciergePresentationFact[];
  action: ConciergeAction;
};
export function buildConciergePresentation(input: {
  journeyType: string;
  templateKey: string;
  locale: ConciergePresentationLocale;
  subject: string | null;
  body: string;
  variables: Record<string, unknown>;
  publicBaseUrl: string;
}): ConciergePresentation;
```

- [ ] **Step 1: Write the failing registry tests**

```js
import { describe, expect, test } from "bun:test";
import { buildConciergePresentation } from "../../src/lib/conciergePresentation.ts";

describe("Concierge branded presentation", () => {
  test("creates a localized booking action and facts", () => {
    const result = buildConciergePresentation({
      journeyType: "booking",
      templateKey: "booking_confirmed_first",
      locale: "he",
      subject: "השיעור הראשון שלך הוזמן",
      body: "היי נועה, ההזמנה אושרה.",
      variables: {
        booking_id: "b-1",
        class_name: "פילאטיס מזרן",
        class_date: "28/07/2026",
        class_time: "18:00",
      },
      publicBaseUrl: "https://cloudandcorestudio.com",
    });
    expect(result.key).toBe("booking_confirmed_first:email:v2");
    expect(result.categoryLabel).toBe("פרטי ההזמנה");
    expect(result.action).toEqual({
      label: "צפייה בהזמנה",
      url: "https://cloudandcorestudio.com/member/bookings",
    });
    expect(result.facts.map((fact) => fact.key)).toEqual([
      "class_name",
      "class_date",
      "class_time",
    ]);
  });

  test("omits an action when no safe destination applies", () => {
    const result = buildConciergePresentation({
      journeyType: "booking_cancellation",
      templateKey: "booking_cancelled",
      locale: "en",
      subject: "Cancellation confirmed",
      body: "Your cancellation is confirmed.",
      variables: {},
      publicBaseUrl: "https://cloudandcorestudio.com",
    });
    expect(result.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun test tests/unit/conciergePresentation.test.mjs`  
Expected: FAIL because `src/lib/conciergePresentation.ts` does not exist.

- [ ] **Step 3: Implement the minimal typed registry**

Use one registry entry per supported journey. Derive all URLs with `new URL(path, publicBaseUrl)`;
never accept an arbitrary URL from template variables. Include these paths:

```ts
const ACTION_PATHS = {
  booking: "/member/bookings",
  payment_outcome: "/member/payments",
  weekly_schedule: "/member/schedule",
  waitlist: "/member/schedule",
  recommendation: "/member/schedule",
} as const;
```

Use localized action labels:

```ts
const ACTION_LABELS = {
  booking: { he: "צפייה בהזמנה", ar: "عرض الحجز", en: "View booking" },
  payment_outcome: { he: "בדיקת התשלום", ar: "مراجعة الدفع", en: "Review payment" },
  weekly_schedule: { he: "למערכת השעות", ar: "استكشاف الجدول", en: "Explore schedule" },
  waitlist: { he: "מימוש המקום", ar: "حجز المكان", en: "Claim spot" },
  recommendation: { he: "צפייה בהמלצה", ar: "عرض التوصية", en: "View recommendation" },
} as const;
```

Only `payment_requires_action` and `payment_terminally_failed` receive the payment action.
Successful and recovered payment messages remain informational.

- [ ] **Step 4: Add full locale and unresolved-variable coverage**

Add tests iterating all ten journey types and all three locales. Assert:

```js
expect(JSON.stringify(result)).not.toMatch(/\{\{[^}]+\}\}/);
expect(result.action?.url ?? "").not.toContain("javascript:");
expect(result.version).toBe(2);
```

- [ ] **Step 5: Run focused tests**

Run: `bun test tests/unit/conciergePresentation.test.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/conciergePresentation.ts tests/unit/conciergePresentation.test.mjs
git commit -m "feat: add concierge presentation registry"
```

---

### Task 2: Premium Concierge Email Adapter

**Files:**
- Create: `src/lib/conciergeEmail.ts`
- Modify: `src/lib/transactionalEmail.ts`
- Modify: `src/lib/unifiedMessaging.server.ts`
- Test: `tests/unit/conciergeEmail.test.mjs`
- Test: `tests/unit/transactionalEmail.test.mjs`

**Interfaces:**
- Consumes: `buildConciergePresentation(...)` from Task 1.
- Produces:

```ts
export function renderConciergeEmail(input: {
  journeyType: string;
  templateKey: string;
  locale: "he" | "ar" | "en";
  subject: string;
  body: string;
  variables: Record<string, unknown>;
  publicBaseUrl: string;
  replyTo?: string | null;
  messageKey: string;
}): RenderedTransactionalEmail & { presentationKey: string };
```

- [ ] **Step 1: Write a failing branded email test**

```js
test("renders the premium shell with localized action and presentation evidence", () => {
  const rendered = renderConciergeEmail({
    journeyType: "payment_outcome",
    templateKey: "payment_requires_action",
    locale: "en",
    subject: "Payment action required",
    body: "Hi Noa, your payment needs attention.",
    variables: { member_name: "Noa" },
    publicBaseUrl: "https://cloudandcorestudio.com",
    replyTo: "support@cloudandcorestudio.com",
    messageKey: "delivery-1",
  });
  expect(rendered.html).toContain("Cloud &amp; Core");
  expect(rendered.html).toContain("#F4EFE7");
  expect(rendered.html).toContain("#D4AF6A");
  expect(rendered.html).toContain("Review payment");
  expect(rendered.html).toContain("/member/payments");
  expect(rendered.text).toContain("Review payment:");
  expect(rendered.presentationKey).toBe("payment_requires_action:email:v2");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `bun test tests/unit/conciergeEmail.test.mjs`  
Expected: FAIL because `renderConciergeEmail` is not defined.

- [ ] **Step 3: Add an explicit email presentation override**

Extend `TransactionalEmailInput` with:

```ts
presentation?: {
  key: string;
  categoryLabel: string;
  action: { label: string; url: string } | null;
  facts: Array<{ key: string; label: string; value: string; ltr: boolean }>;
};
```

When supplied, use `categoryLabel`, the validated action, and explicit facts instead of deriving
them from `MessageEventType`. Preserve the current default path for all non-Concierge email.

- [ ] **Step 4: Implement `renderConciergeEmail`**

Call `buildConciergePresentation`, pass the result into `renderTransactionalEmail`, and return
the renderer output with `presentationKey`.

- [ ] **Step 5: Route canonical Concierge messages through the adapter**

In `unifiedMessaging.server.ts`, detect:

```ts
const concierge =
  typeof message.content?.concierge_decision_id === "string";
const journeyType =
  typeof message.content?.journey_type === "string"
    ? message.content.journey_type
    : conciergeJourneyForTemplate(message.template_key ?? message.event_type);
```

Use `renderConciergeEmail` only for those messages. Keep `renderTransactionalEmail` unchanged for
all other canonical messages.

- [ ] **Step 6: Run email tests**

Run:

```bash
bun test tests/unit/conciergeEmail.test.mjs tests/unit/transactionalEmail.test.mjs
```

Expected: PASS, including the existing Gmail/Outlook-safe HTML assertions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/conciergeEmail.ts src/lib/transactionalEmail.ts src/lib/unifiedMessaging.server.ts tests/unit/conciergeEmail.test.mjs tests/unit/transactionalEmail.test.mjs
git commit -m "feat: render branded concierge email"
```

---

### Task 3: Branded WhatsApp Template Definitions and Sending

**Files:**
- Modify: `src/lib/conciergeTemplateCatalog.ts`
- Modify: `src/lib/conciergeMaterialization.ts`
- Modify: `src/lib/messagingProviders.server.ts`
- Test: `tests/unit/conciergeTemplateCatalog.test.mjs`
- Test: `tests/unit/conciergeMaterialization.test.mjs`
- Test: `tests/unit/unifiedMessagingProviders.test.mjs`

**Interfaces:**
- Produces:

```ts
export type WhatsappTemplateComponent =
  | { type: "header"; parameters: [{ type: "image"; image: { link: string } }] }
  | { type: "body"; parameters: Array<{ type: "text"; text: string }> };

export type WhatsappTemplateSendInput = {
  to: string;
  templateName: string;
  languageCode: "he" | "ar" | "en_US";
  components: WhatsappTemplateComponent[];
};
```

- [ ] **Step 1: Write failing catalog assertions**

For every Concierge WhatsApp definition, assert:

```js
expect(template.name).toEndWith("_branded_v2");
expect(template.components[0]).toMatchObject({
  type: "HEADER",
  format: "IMAGE",
});
expect(template.components.some((component) => component.type === "FOOTER")).toBe(true);
```

For booking, actionable payment, waitlist, and recommendation definitions, also assert a URL
button exists. Assert successful payment and informational cancellation definitions have no
button.

- [ ] **Step 2: Run catalog tests and verify they fail**

Run: `bun test tests/unit/conciergeTemplateCatalog.test.mjs`  
Expected: FAIL because current definitions contain BODY only.

- [ ] **Step 3: Generate versioned Meta definitions**

Use one shared header handle/example URL:

```ts
const CONCIERGE_WHATSAPP_HEADER_URL =
  "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp";
```

Generate Meta components in this order:

```ts
[
  {
    type: "HEADER",
    format: "IMAGE",
    example: { header_handle: [CONCIERGE_WHATSAPP_HEADER_URL] },
  },
  {
    type: "BODY",
    text: localizedBodyWithNumberedVariables,
    example: { body_text: [["Noa"]] },
  },
  { type: "FOOTER", text: "Cloud & Core Studio" },
  ...(action ? [{
    type: "BUTTONS",
    buttons: [{
      type: "URL",
      text: action.label,
      url: `${publicBaseUrl}${action.path}`,
    }],
  }] : []),
]
```

Names use `${templateKey}_branded_v2`; deployments are separate from current v1 names.

- [ ] **Step 4: Replace positional-only WhatsApp sending with typed components**

Update `sendWhatsappTemplate` to accept `components`. Its request body must use:

```ts
template: {
  name: input.templateName,
  language: { code: input.languageCode },
  components: input.components,
}
```

Do not retain a second path that reconstructs components from `parameters`.

- [ ] **Step 5: Build provider components during Concierge materialization**

For WhatsApp deliveries, materialize:

```ts
providerPayload: {
  template_name: brandedTemplateName,
  template_language: metaLanguage,
  presentation_key: `${templateKey}:whatsapp:v2`,
  components: [
    {
      type: "header",
      parameters: [{
        type: "image",
        image: { link: headerUrl },
      }],
    },
    {
      type: "body",
      parameters: orderedVariables.map((text) => ({ type: "text", text })),
    },
  ],
}
```

The contextual URL button is static in the approved Meta template definition, so it is not
repeated as a send-time component.

- [ ] **Step 6: Add provider request tests**

Assert the mocked Meta request contains header, body, and URL button components in stable order.
Also assert a transmitted timeout still returns the existing ambiguous failure class.

- [ ] **Step 7: Run focused tests**

Run:

```bash
bun test tests/unit/conciergeTemplateCatalog.test.mjs tests/unit/conciergeMaterialization.test.mjs tests/unit/unifiedMessagingProviders.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/conciergeTemplateCatalog.ts src/lib/conciergeMaterialization.ts src/lib/messagingProviders.server.ts tests/unit/conciergeTemplateCatalog.test.mjs tests/unit/conciergeMaterialization.test.mjs tests/unit/unifiedMessagingProviders.test.mjs
git commit -m "feat: add branded concierge whatsapp templates"
```

---

### Task 4: Persist Presentation and Journey Evidence Atomically

**Files:**
- Modify: `src/lib/conciergeMaterialization.ts`
- Modify: `src/lib/conciergeDispatch.server.ts`
- Create: `supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql`
- Modify: `tests/integration/conciergeDatabase.test.mjs`
- Modify: `tests/unit/conciergeMaterialization.test.mjs`

**Interfaces:**
- Consumes presentation keys from Tasks 1–3.
- Adds these fields to each materialization snapshot:

```ts
presentationKey: string;
journeyType: string;
actionUrl: string | null;
```

- [ ] **Step 1: Verify the migration version is unused**

Run:

```bash
test ! -e supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql
```

Expected: exit code 0. If the file exists because another branch landed first, stop and re-plan
this task with a newly agreed exact version before creating a migration.

- [ ] **Step 2: Write the failing materialization test**

```js
expect(plan[0].snapshot).toMatchObject({
  presentationKey: "payment_requires_action:email:v2",
  journeyType: "payment_outcome",
  actionUrl: "https://cloudandcorestudio.com/member/payments",
});
```

- [ ] **Step 3: Extend the pure materialization plan**

Require `journeyType`, `presentationByChannel`, and `actionByChannel` inputs. Do not derive them
inside SQL.

- [ ] **Step 4: Write the expand-only RPC migration**

Replace `materialize_concierge_delivery` with the same authorization, consent-independent
target validation, atomic capacity reservation, and idempotency logic, plus validation that:

```sql
v_item->'snapshot'->>'presentationKey' IS NOT NULL
AND v_item->'snapshot'->>'journeyType' = v_intent.journey_type
AND (
  v_item->'snapshot'->>'actionUrl' IS NULL
  OR v_item->'snapshot'->>'actionUrl' LIKE 'https://cloudandcorestudio.com/%'
)
```

Persist in `messages.content`:

```sql
jsonb_build_object(
  'variables', COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),
  'concierge_decision_id',v_decision_id,
  'correlation_id',p_correlation_id,
  'journey_type',v_intent.journey_type,
  'presentation_key',v_item->'snapshot'->>'presentationKey',
  'action_url',v_item->'snapshot'->>'actionUrl'
)
```

Include these fields in replay-mismatch validation so duplicate decisions cannot change
presentation evidence.

- [ ] **Step 5: Extend disposable-database integration coverage**

Assert one decision produces one message per selected channel, stores the exact presentation key,
rejects an off-origin action URL, and remains idempotent across two dispatcher calls.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test tests/unit/conciergeMaterialization.test.mjs
MESSAGING_TEST_DATABASE_URL="$MESSAGING_TEST_DATABASE_URL" bun test tests/integration/conciergeDatabase.test.mjs
```

Expected: unit PASS; database integration PASS when the disposable database variable is present.

- [ ] **Step 7: Commit**

```bash
git add src/lib/conciergeMaterialization.ts src/lib/conciergeDispatch.server.ts supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql tests/unit/conciergeMaterialization.test.mjs tests/integration/conciergeDatabase.test.mjs
git commit -m "feat: snapshot concierge presentation evidence"
```

---

### Task 5: Branded Email and WhatsApp Previews

**Files:**
- Create: `src/components/admin/ConciergeEmailPreview.tsx`
- Create: `src/components/admin/ConciergeWhatsappPreview.tsx`
- Modify: `src/components/admin/ConciergeTemplateLibrary.tsx`
- Modify: `src/lib/conciergeAdmin.functions.ts`
- Modify: `src/lib/conciergeTemplateAdmin.ts`
- Create: `tests/unit/conciergeBrandedPreview.test.mjs`

**Interfaces:**
- Consumes `renderConciergeEmail(...)`, `buildConciergePresentation(...)`, and approved deployment
  metadata.
- Produces a `PreviewModel`:

```ts
export type ConciergeBrandedPreview = {
  channel: "email" | "whatsapp";
  locale: "he" | "ar" | "en";
  presentationKey: string;
  lifecycleStatus: "draft" | "approved";
  providerApprovalStatus: string | null;
  subject: string | null;
  body: string;
  action: { label: string; url: string } | null;
  emailHtml: string | null;
  whatsappHeaderUrl: string | null;
  whatsappFooter: string | null;
};
```

- [ ] **Step 1: Write failing preview-model tests**

Assert email previews contain the premium HTML and WhatsApp previews contain the shared header,
footer, and contextual button. Assert Arabic and Hebrew previews set `dir: "rtl"`.

- [ ] **Step 2: Run tests and verify they fail**

Run: `bun test tests/unit/conciergeBrandedPreview.test.mjs`  
Expected: FAIL because the preview model does not exist.

- [ ] **Step 3: Return provider approval state**

In `getConciergeCenter`, query `whatsapp_template_deployments` for the configured WABA and return
only:

```ts
{
  template_name: string;
  language: string;
  approval_status: string;
  content_hash: string | null;
}
```

Do not return provider tokens, WABA credentials, or recipient data.

- [ ] **Step 4: Implement pure preview-model construction**

Use the same presentation registry and renderer as delivery. Fixtures use:

```ts
{
  member_name: locale === "he" ? "נועה" : locale === "ar" ? "نور" : "Noa",
  class_name: locale === "he" ? "פילאטיס מזרן" : locale === "ar" ? "بيلاتس مات" : "Mat Pilates",
  class_date: "28/07/2026",
  class_time: "18:00",
  amount: "₪350",
  offer_expires_at: "18:30",
}
```

- [ ] **Step 5: Implement isolated preview components**

`ConciergeEmailPreview` uses:

```tsx
<iframe
  title={title}
  sandbox=""
  srcDoc={emailHtml}
  className="min-h-[680px] w-full rounded-xl border border-border bg-white"
/>
```

`ConciergeWhatsappPreview` renders a phone-shaped static preview using the exact header URL,
localized body, footer, and button. It does not call Meta.

- [ ] **Step 6: Add preview toggles to the Templates tab**

Keep existing filters. Each template card offers `Source` and `Branded preview`. Show lifecycle
and provider approval as separate badges.

- [ ] **Step 7: Run focused UI and contract tests**

Run:

```bash
bun test tests/unit/conciergeBrandedPreview.test.mjs tests/unit/conciergeTemplateAdmin.test.mjs tests/unit/conciergeMessagesIntegration.test.mjs
bun run lint
bun run build
```

Expected: tests PASS, lint has zero errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/ConciergeEmailPreview.tsx src/components/admin/ConciergeWhatsappPreview.tsx src/components/admin/ConciergeTemplateLibrary.tsx src/lib/conciergeAdmin.functions.ts src/lib/conciergeTemplateAdmin.ts tests/unit/conciergeBrandedPreview.test.mjs
git commit -m "feat: preview branded concierge messages"
```

---

### Task 6: Brand Asset, Provider Approval, and Sender Identity

**Files:**
- Create: `public/brand/concierge-whatsapp-header.webp`
- Modify: `scripts/create-whatsapp-templates.mjs`
- Modify: `src/lib/whatsappTemplateProvisioning.ts`
- Modify: `docs/concierge/MANUAL_PROVIDER_SETUP.md`
- Modify: `docs/concierge/OPERATIONS_RUNBOOK.md`
- Test: `tests/unit/whatsappTemplateProvisioningV2.test.mjs`
- Test: `tests/unit/transactionalEmail.test.mjs`

**Interfaces:**
- Consumes `CONCIERGE_META_TEMPLATE_CATALOG`.
- Produces a plan-only reconciliation report and an explicit `--apply --waba-id` approval path.

- [ ] **Step 1: Create the shared header asset**

Build a 1200×628 WebP from the existing Cloud & Core full logo and navy/ivory/gold brand palette.
Keep important content centered so Meta cropping remains safe. Verify:

```bash
file public/brand/concierge-whatsapp-header.webp
```

Expected: WebP image, 1200×628.

- [ ] **Step 2: Add the Concierge catalog to the existing provisioner**

The default remains plan-only. Applying requires both:

```bash
bun scripts/create-whatsapp-templates.mjs --apply --waba-id 1009561255148806 --scope concierge
```

Extend `parseTemplateProvisioningArgs` with
`scope?: "all" | "concierge" | "unified"`, defaulting to `"all"`. In the script,
`--scope concierge` selects only `CONCIERGE_META_TEMPLATE_CATALOG`. Do not update a drifted
approved template in place. Create the `_branded_v2` name and reconcile after provider errors.

- [ ] **Step 3: Test provider planning and safe apply guards**

Assert plan mode performs zero creates, wrong WABA fails, matching remote content is unchanged,
and content drift is reported without mutation.

- [ ] **Step 4: Document exact sender identity checks**

Add this production checklist:

```text
Email sender: Cloud & Core Studio
Sender domain: verified studio domain
Reply-To: configured support inbox
DNS: SPF pass, DKIM pass, DMARC present
WhatsApp display name: Cloud & Core Studio
WhatsApp profile: logo, description, website, email, address complete
Header asset URL: HTTPS 200, correct content type, stable cache policy
```

Document that Gmail avatars are provider-controlled and not guaranteed by HTML.

- [ ] **Step 5: Document approval and rollback**

The runbook must require:

1. plan output review;
2. Meta submission;
3. deployment row showing `APPROVED`;
4. test-only send;
5. delivery evidence review;
6. per-journey promotion;
7. rollback by selecting the prior template/presentation version.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
bun test tests/unit/whatsappTemplateProvisioningV2.test.mjs tests/unit/transactionalEmail.test.mjs
```

Then:

```bash
git add public/brand/concierge-whatsapp-header.webp scripts/create-whatsapp-templates.mjs src/lib/whatsappTemplateProvisioning.ts docs/concierge/MANUAL_PROVIDER_SETUP.md docs/concierge/OPERATIONS_RUNBOOK.md tests/unit/whatsappTemplateProvisioningV2.test.mjs tests/unit/transactionalEmail.test.mjs
git commit -m "docs: prepare branded concierge provider rollout"
```

---

### Task 7: Full Verification and Test-Only Production Rollout

**Files:**
- Modify only if a failing verification reveals a scoped defect.

**Interfaces:**
- Consumes all prior tasks.
- Produces production delivery evidence without changing any journey to `live`.

- [ ] **Step 1: Run repository gates**

```bash
bun install
bun test tests/unit tests/integration
bun run lint
bun run build
git diff --check
```

Expected: all runnable tests PASS; disposable database tests PASS when configured; lint has zero
errors; build succeeds; diff check is clean.

- [ ] **Step 2: Review every branded preview**

In Admin → Messages → Concierge → Templates:

- filter each of the ten journeys;
- review `he`, `ar`, and `en`;
- review email and WhatsApp;
- verify source variables, presentation version, lifecycle, and provider approval badges.

- [ ] **Step 3: Apply database migrations**

```bash
bunx supabase db push --linked --dry-run
bunx supabase db push --linked
```

Expected: only the branded presentation evidence migration is applied.

- [ ] **Step 4: Deploy a zero-traffic application revision**

Build from the exact verified commit, deploy with `--no-traffic`, and attach the existing
`concierge-e2e` tag. Smoke-test the home route and protected Concierge routes before traffic
movement.

- [ ] **Step 5: Test branded email**

Keep all journeys `test_only`. Trigger one supported event per journey for the allowlisted test
recipient. Verify Resend accepted/sent/delivered evidence and inspect Gmail desktop/mobile,
Outlook, images-disabled, RTL, and plain text.

- [ ] **Step 6: Submit and verify branded WhatsApp**

Run the explicit provision command from Task 6. Do not test-send until every selected locale has
an `APPROVED` deployment row for its `_branded_v2` name.

- [ ] **Step 7: Test branded WhatsApp**

Trigger only the WhatsApp-eligible journeys for the allowlisted recipient. Verify the shared
header, body variables, footer, contextual buttons, and provider delivery receipts.

- [ ] **Step 8: Record the rollout decision**

Keep journeys `test_only` if any locale, provider approval, rendering, link, or delivery evidence
is incomplete. Promotion to `live` is a separate explicit operator action using the existing
confirmation gate.

- [ ] **Step 9: Commit any verification-only documentation**

If the runbook receives observed provider IDs or non-secret operational outcomes:

```bash
git add docs/concierge/OPERATIONS_RUNBOOK.md
git commit -m "docs: record branded concierge rollout evidence"
```

Do not commit credentials, recipient addresses, phone numbers, or local environment files.
