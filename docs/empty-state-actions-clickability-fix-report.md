# Empty-state actions clickability fix report

## Files changed

- `src/routes/_authenticated/admin/instructors.tsx`
  - Replaced the dead instructors empty-state secondary `<span>` with a real button.
  - Added an accessible help dialog for how instructors work.
  - Reused the same `openAddInstructor` handler for header CTA, empty-state primary CTA, and dialog CTA.
  - Added an accessible label to the existing add/edit instructor modal close button.
- `src/lib/i18n.ts`
  - Added Hebrew, Arabic, and English help title/body/bullets for the instructors help dialog.
- `src/components/member/PremiumClassCard.tsx`
  - Hardened member empty-state action rendering so an action without `to` or `onClick` does not render as a fake button.

## Why the button was not clickable

The instructors empty state rendered the secondary action as:

```tsx
<span className="btn-outline cursor-default select-none">
  {t("admin.instructors.emptySecondary")}
</span>
```

It looked like a button because it used the shared button class, but it was not a real interactive element and had no click handler.

## Modal/help content added

The new `למדו איך זה עובד` action opens a Radix `Dialog` with localized content:

- Hebrew: `איך מדריכים עובדים בסטודיו?`
- Arabic: `كيف يعمل نظام المدربين؟`
- English: `How instructors work`

The dialog includes explanatory body copy, four localized bullets, a primary CTA to open the add instructor flow, and a secondary close button. The dialog inherits the current app direction, so Hebrew/Arabic render RTL and English renders LTR.

## Empty states audited

- Admin instructors: fixed dead secondary action; primary opens add instructor flow.
- Admin attendance: primary links to `/admin/classes/new`; secondary links to `/admin/schedule`.
- Admin clients/members: empty state has no visible action button.
- Admin rooms: empty state has no visible action button; page header add button is wired.
- Admin programs: empty state has no visible action button; page header add button is wired.
- Admin payments: empty state has no visible action button; page header add payment button is wired.
- Admin messages: empty template/log/request states have no visible fake action button; visible buttons are wired or explicitly disabled.
- Member bookings: upcoming empty primary links to `/member/schedule`; non-action empty tabs render no fake button.
- Member packages: package/payment empty states render no fake button.
- Member schedule: global empty primary links to `/support`; filtered empty state renders no fake button.

## Dead buttons fixed or removed

- Fixed: admin instructors `למדו איך זה עובד` now opens the help dialog.
- Hardened: member empty-state action helper now returns `null` if an action has neither `to` nor `onClick`.
- Removed: no visible empty-state actions were removed because no other dead empty-state action was found.

## Commands run

```bash
/Users/ameeramer/.bun/bin/bunx tsc --noEmit
/Users/ameeramer/.bun/bin/bun run build
/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs
/Users/ameeramer/.bun/bin/bun run lint
rg -n "secondaryAction=|MemberEmptyState|<span className=\"btn-|<button[^>]*className=\"btn-|<Link[^>]*className=\"btn-" src/routes/_authenticated/admin src/routes/_authenticated/member src/components -S
```

Results:

- Typecheck passed.
- Build passed.
- i18n test passed.
- Lint passed with existing warnings only: `0 errors, 440 warnings`.

## Browser QA result

Browser QA used the local dev server at `http://127.0.0.1:5177`.

The current live/local data did not expose the instructors empty state through normal authenticated browsing, so the empty-state browser QA used a non-mutating Playwright module mock: route auth was mocked as admin and the instructors list was mocked to `[]`. No database data, schema, auth, booking, payment, receipt, or RLS logic was changed.

Verified:

- Hebrew mobile `390px`: empty state visible, `למדו איך זה עובד` opened the dialog by keyboard, `Escape` closed it, `הוספת מדריך` opened the add instructor flow, dialog direction was RTL, no console errors.
- Arabic mobile `390px`: empty state visible, help dialog opened by keyboard, `Escape` closed it, add instructor CTA opened the add instructor flow, dialog direction was RTL, no console errors.
- English desktop `1280px`: empty state visible, help dialog opened by keyboard, `Escape` closed it, add instructor CTA opened the add instructor flow, dialog direction was LTR, no console errors.

No migrations were run.

## Production deployment

- Deployed: yes
- Image: `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260629174219`
- Cloud Build: `6b48e1c0-ce1e-4840-93d4-00adb63b7459`
- Cloud Run service: `cloud-core-studio`
- Region: `me-west1`
- Revision: `cloud-core-studio-00138-7ls`
- Traffic: `100%`
- Service URL: `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`
- Regional URL: `https://cloud-core-studio-190584124070.me-west1.run.app`

Production smoke checks:

- Stable `/auth`: `200`
- Stable `/admin`: `307` redirect to `/auth`
- Regional `/auth`: `200`
- Regional `/admin`: `307` redirect to `/auth`
