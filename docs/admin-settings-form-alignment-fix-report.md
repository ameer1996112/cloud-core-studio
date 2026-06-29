# Admin settings form alignment fix report

## Files changed

- `src/routes/_authenticated/admin/settings.tsx`
  - Added an explicit `settings-page` root with the current app `dir`.
  - Kept technical values LTR for phone, WhatsApp, email, URLs, currency, timezone, language list, default language, receipt prefix, and numeric controls.
  - Replaced inline helper/error classes with dedicated settings helper/error classes.
  - Made settings section titles, toggle copy, and preview labels use settings-specific alignment classes.
- `src/styles.css`
  - Added strict language-aware alignment rules for the settings page.
  - Added settings-specific title, helper, error, toggle, technical-input, and save-bar styling.
  - Increased settings page bottom padding so the sticky save bar has scroll clearance.
  - Reset Hebrew/Arabic settings label tracking to avoid excessive letter spacing.
  - Updated disabled save button styling to match the shared disabled-button treatment.
  - Follow-up: made the settings save bar static on mobile so it cannot cover form fields in mobile Safari / in-app browser views.
  - Follow-up: tightened mobile field/card spacing and added a lighter premium surface treatment for fields and inputs.
- `src/components/admin-shared/index.tsx`
  - Made `AdminPageHeader` and shared admin `Field` layout use logical `text-start`.
- `src/components/ui/textarea.tsx`
  - Added default `dir="auto"` and logical `text-start`.
- `src/components/ui/select.tsx`
  - Added logical alignment to Radix select trigger, label, and item text.

## Shared form components fixed

- `AdminPageHeader`: page title/description now inherit logical alignment cleanly.
- Shared admin `Field`: label/content use logical start alignment.
- Shared `Textarea`: defaults to auto direction and logical text alignment.
- Shared `Select`: trigger, labels, and items use logical text alignment.
- Settings page local form helpers: `Section`, `FieldRow`, `TechnicalInput`, `NumberInput`, `Toggle`, and save bar now follow explicit language-aware layout rules.

## Technical LTR exceptions

The following settings fields stay LTR with left-aligned values while their labels/helper text follow the page language:

- Public phone: `+972 50 000 0000`
- WhatsApp number: `+972 50 000 0000`
- Contact email
- Logo URL
- Fallback image URL
- Instagram URL
- Website URL
- Currency code
- Timezone
- Supported language code list
- Default language select
- Receipt prefix
- Numeric booking/waitlist fields

## Hebrew/Arabic/English QA

Browser QA used a local dev server at `http://127.0.0.1:5177` with non-mutating Playwright mocks for admin access and settings data. No database data, auth logic, schema, booking, payment, receipt, RLS, or business logic was changed.

- Hebrew: page root `rtl`; labels/helpers computed `right`; normal inputs `rtl/right`; technical values `ltr/left`; no console errors; no hydration errors.
- Arabic: page root `rtl`; labels/helpers computed `right`; normal inputs `rtl/right`; technical values `ltr/left`; no console errors; no hydration errors.
- English: page root `ltr`; labels/helpers computed `left`; normal inputs `ltr/left`; technical values `ltr/left`; no console errors; no hydration errors.

## Responsive QA

Checked:

- Mobile: `390 x 844`
- iPad: `820 x 1180`
- Desktop: `1440 x 900`

Results:

- No horizontal overflow in any tested language or viewport.
- Sticky save bar remained usable.
- Focused bottom-of-page scroll check used the app's actual `.member-shell-main` scroll container and found no visible field/card overlapped by the save bar.
- Disabled save button rendered with disabled cursor, muted surface, and reduced opacity.
- Follow-up mobile screenshot QA at `390 x 844` confirmed the save panel is in normal flow below the preview section, not overlaying `כתובת` or other fields.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bunx prettier --write src/routes/_authenticated/admin/settings.tsx src/components/admin-shared/index.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx src/styles.css
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
```

Results:

- Typecheck passed.
- Build passed.
- i18n test passed.

## Remaining issues

- None found for the requested `/admin/settings` alignment scope.
- No migrations were run.

## Production deployment

- Deployed: yes
- Image: `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260629191436`
- Cloud Build: `371854a9-6598-41bf-b5e5-ff62917548dd`
- Cloud Run service: `cloud-core-studio`
- Region: `me-west1`
- Revision: `cloud-core-studio-00140-fqb`
- Traffic: `100%`
- Service URL: `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- Regional URL: `https://cloud-core-studio-190584124070.me-west1.run.app`

Production smoke checks:

- Stable `/auth`: `200`
- Stable `/admin`: `307` redirect to `/auth`
- Regional `/auth`: `200`
- Regional `/admin`: `307` redirect to `/auth`
