# Premium WhatsApp Concierge Implementation Plan

> **Execution:** Implement task by task with tests first. Keep current approved Meta templates active
> until each `v3` locale is approved and allowlisted evidence passes.

**Goal:** Replace basic WhatsApp bodies with localized Boutique Concierge Cards containing only
event-relevant facts, a restrained emoji, a personal signature, and one useful action.

**Architecture:** Extend the existing pure Concierge presentation registry with an explicit
WhatsApp content contract. Generate versioned Meta `v3` templates from that contract, and have the
delivery resolver populate deterministic event-specific body parameters. Preview and production
delivery use the same contract. Provider approval selection retains `v2` as the fallback until the
exact `v3` locale and content hash are approved.

**Tech stack:** TypeScript, Bun tests, Meta WhatsApp Cloud API templates, existing Supabase
deployment registry and messaging materialization.

## Global constraints

- Preserve the current branded image header.
- Voice is personal boutique concierge.
- Include essential event details only.
- Use localized `Yareen | Cloud & Core` signatures.
- Use at most one restrained emoji; omit it for sensitive negative events when inappropriate.
- Keep Hebrew and Arabic RTL and author all three locales natively.
- Never weaken consent, marketing opt-out, allowlist, quiet-hour, cap, or live-mode safeguards.
- Never route a live delivery through an unapproved template locale or mismatched content hash.
- Do not delete or retire `v2` templates during this work.
- Do not commit provider credentials or local environment files.

---

## Task 1: Define the premium WhatsApp presentation contract

**Files**

- Modify: `src/lib/conciergePresentation.ts`
- Modify: `src/lib/conciergeTemplateCatalog.ts`
- Modify: `tests/unit/conciergePresentation.test.mjs`
- Modify: `tests/unit/conciergeTemplateCatalog.test.mjs`

### Steps

- [ ] Add failing tests for one positive, one negative, one payment, and one informational journey
  in Hebrew, Arabic, and English.
- [ ] Define a pure WhatsApp presentation result containing:

```ts
type ConciergeWhatsappPresentation = {
  key: string;
  version: 3;
  templateKey: string;
  locale: "he" | "ar" | "en";
  requiredVariables: readonly string[];
  optionalVariables: readonly string[];
  bodyTemplate: string;
  orderedParameters: readonly string[];
  action: ConciergeAction;
};
```

- [ ] Add explicit journey fact contracts:
  - booking: class, date, time, instructor, location;
  - booking cancellation: class, date, time, concise credit outcome;
  - class cancellation/change: class, revised or cancelled time, useful location/instructor;
  - waitlist confirmation/offer: class, date, time, deadline where applicable;
  - payment: package, amount or renewal date, receipt availability;
  - membership expiry: package, expiry date, remaining credits;
  - recommendation: one concise recommendation summary;
  - welcome: one next step;
  - urgent announcement: actual announcement summary.
- [ ] Encode the approved copy rules: personal opening, short headline, grouped facts, helpful
  closing, localized signature, and at most one permitted emoji.
- [ ] Ensure optional values remove their complete line and required values are machine-readable
  for later suppression.
- [ ] Generate new provider names ending in `_premium_v3`; keep `v2` definitions available for
  fallback.
- [ ] Run:

```bash
bun test tests/unit/conciergePresentation.test.mjs \
  tests/unit/conciergeTemplateCatalog.test.mjs
```

Expected: all tests pass, and every WhatsApp catalog entry has a deterministic parameter contract.

---

## Task 2: Build deterministic Meta components from event variables

**Files**

- Modify: `src/lib/whatsappTemplateConsolidation.ts`
- Modify: `src/lib/unifiedMessagingMaterialization.ts`
- Modify: `tests/unit/whatsappTemplateConsolidation.test.mjs`
- Modify: `tests/unit/unifiedMessagingMaterialization.test.mjs`

### Steps

- [ ] Write failing resolver tests that assert exact ordered body parameters for booking,
  cancellation, payment failure, waitlist, recommendation, and urgent announcement.
- [ ] Extend `resolveConsolidatedWhatsappTemplate` to consume the premium presentation contract
  instead of sending only `member_name`.
- [ ] Return header, body, and button components in the exact order required by the matching
  `_premium_v3` Meta template.
- [ ] Distinguish required from optional values:
  - missing required value returns a typed configuration failure;
  - missing optional value selects copy that does not leave a blank label or separator.
- [ ] Preserve same-origin application destinations and existing native/universal-link behavior.
- [ ] Keep marketing consent evaluation before provider payload creation.
- [ ] Verify the message snapshot records the chosen presentation version, provider template,
  ordered variables, and action URL without leaking private provider configuration.
- [ ] Run:

```bash
bun test tests/unit/whatsappTemplateConsolidation.test.mjs \
  tests/unit/unifiedMessagingMaterialization.test.mjs
```

Expected: exact component assertions pass and all existing consent/suppression tests remain green.

---

## Task 3: Make preview and test fixtures identical to delivery

**Files**

- Modify: `src/lib/conciergeTemplateAdmin.ts`
- Modify: `src/lib/premiumJourneyLab.ts`
- Modify: `tests/unit/conciergeBrandedPreview.test.mjs`
- Modify: `tests/unit/premiumJourneyLab.test.mjs`

### Steps

- [ ] Add failing preview tests for the final WhatsApp body, signature, fact hierarchy, action,
  header, locale direction, and provider lifecycle status.
- [ ] Render previews from the same WhatsApp presentation contract and ordered parameters used by
  delivery.
- [ ] Expand Journey Lab fixtures with realistic package, credit outcome, renewal date,
  announcement summary, and receipt availability values.
- [ ] Assert every supported journey/locale has:
  - no unresolved placeholder;
  - no literal `\n`;
  - no empty fact line;
  - no duplicated fact;
  - no more than one allowed emoji;
  - a safe action or an intentional no-action result.
- [ ] Keep preview-only data out of production code paths.
- [ ] Run:

```bash
bun test tests/unit/conciergeBrandedPreview.test.mjs \
  tests/unit/premiumJourneyLab.test.mjs
```

Expected: previews exactly match the provider candidate content and fixtures cover every locale.

---

## Task 4: Add approval-aware `v3` selection and fallback

**Files**

- Modify: `src/lib/unifiedMessagingMaterialization.ts`
- Modify: `src/lib/conciergeTemplateAdmin.ts`
- Modify: `src/lib/whatsappTemplateProvisioning.ts`
- Modify: `tests/unit/conciergeDeliverySelection.test.mjs`
- Modify: `tests/unit/whatsappTemplateProvisioningV2.test.mjs`
- Modify: `tests/unit/conciergeTemplateAdmin.test.mjs`

### Steps

- [ ] Write failing tests for these states:
  - exact `v3` locale and hash approved: select `v3`;
  - `v3` pending/not created/content drift: retain approved `v2`;
  - no approved safe version: suppress with `whatsapp_template_locale_unapproved`;
  - marketing opt-out: suppress regardless of approval state.
- [ ] Select templates by exact WABA, locale, provider status, and content hash.
- [ ] Expose both candidate and active versions in the admin preview so pending approval is visible
  without implying that the candidate is live.
- [ ] Keep provider reconciliation idempotent; refresh may update deployment state but may not
  silently promote a mismatched template.
- [ ] Run:

```bash
bun test tests/unit/conciergeDeliverySelection.test.mjs \
  tests/unit/whatsappTemplateProvisioningV2.test.mjs \
  tests/unit/conciergeTemplateAdmin.test.mjs
```

Expected: `v2` remains active until the exact `v3` approval evidence exists.

---

## Task 5: Validate the complete local change

**Files**

- Update focused tests as required by Tasks 1–4.
- Do not modify `.env`, `.env.whatsapp.local`, or credentials.

### Steps

- [ ] Run the focused Concierge and WhatsApp test suite:

```bash
bun test tests/unit/conciergePresentation.test.mjs \
  tests/unit/conciergeTemplateCatalog.test.mjs \
  tests/unit/whatsappTemplateConsolidation.test.mjs \
  tests/unit/unifiedMessagingMaterialization.test.mjs \
  tests/unit/conciergeBrandedPreview.test.mjs \
  tests/unit/premiumJourneyLab.test.mjs \
  tests/unit/conciergeDeliverySelection.test.mjs \
  tests/unit/whatsappTemplateProvisioningV2.test.mjs \
  tests/unit/conciergeTemplateAdmin.test.mjs
```

- [ ] Run repository-required validation:

```bash
bun install
bun run lint
bun run build
```

- [ ] Confirm `git diff --check` and confirm no local environment files are staged.
- [ ] Commit the implementation in focused commits.

Expected: tests, lint, and production build pass with a clean staged scope.

---

## Task 6: Submit, approve, and allowlisted-test only the required templates

**Operational commands**

- Use `scripts/create-whatsapp-templates.mjs` in plan mode first.
- Apply only the required `_premium_v3` template names to the confirmed production WABA.
- Refresh provider status before each selection decision.

### Steps

- [ ] Generate a read-only reconciliation plan and verify that only required Concierge templates
  are candidates.
- [ ] Submit the required Hebrew, Arabic, and English locale variants to Meta.
- [ ] Leave journeys on the currently approved version while provider status is pending.
- [ ] After approval, queue one allowlisted test per supported event/channel using the verified
  test member.
- [ ] Execute the existing unified messaging sweep and record per-delivery evidence.
- [ ] Verify:
  - branded header renders;
  - body matches the approved Boutique Concierge Card;
  - event facts are relevant and correct;
  - action opens the intended application destination;
  - operational messages deliver;
  - marketing opt-outs remain suppressed;
  - no unresolved placeholders or literal escape sequences appear.
- [ ] Promote journeys individually only after explicit approval of the allowlisted evidence.
- [ ] Keep `v2` available for immediate rollback.

Expected: every promoted locale has Meta approval plus accepted/delivered/read allowlisted evidence,
and no live customer receives an unreviewed candidate.

## Completion criteria

- All required operational WhatsApp journeys have premium, event-specific `v3` content.
- Preview, provider definition, payload ordering, and delivery snapshot share one contract.
- Every locale is natural, concise, and free of irrelevant data.
- Existing `v2` delivery continues throughout provider review.
- Consent and operational safety tests are unchanged and green.
- Allowlisted evidence is reviewed before any journey becomes live.
