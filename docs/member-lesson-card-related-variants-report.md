# Member Lesson Card Related Variants Report

## Files Changed

- `docs/member-lesson-card-related-variants-report.md`

## What Changed

- Inspected the existing member lesson-card variant wiring and shared card CSS.
- Confirmed the current route wiring already matches the Task 4 brief:
  - `/member` uses `homeFeature` and `homeList`
  - `/member/schedule` uses `scheduleLead` and `scheduleList`
- No additional source edits were made in this task pass because browser QA did not reach an authenticated member shell, and static inspection did not reveal a concrete card defect that justified touching `src/components/visual/VisualClassCard.tsx` or `src/styles.css`.

## QA

- Hebrew `/member`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/member-he-desktop-auth.png`
- Arabic `/member`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/member-ar-desktop-auth.png`
- English `/member`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/member-en-desktop-auth.png`
- Hebrew `/member/schedule`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/schedule-he-desktop-auth.png`
- Arabic `/member/schedule`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/schedule-ar-desktop-auth.png`
- English `/member/schedule`: blocked by auth redirect to `/auth`; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/schedule-en-desktop-auth.png`
- Mobile `390 x 844`: guest redirect probe landed on `/auth` in Hebrew, no horizontal overflow observed; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/member-he-390x844.png`
- iPad `820 x 1180`: guest redirect probe landed on `/auth` in Arabic, no horizontal overflow observed; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/schedule-ar-820x1180.png`
- Desktop `1440 x 900`: guest redirect probe landed on `/auth` in English, no horizontal overflow observed; screenshot: `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/tmp/member-lesson-card-related-variants-qa/member-en-1440x900.png`

## Commands

- `/Users/ameeramer/.bun/bin/bun install`: PASS (`Checked 522 installs across 593 packages (no changes)`)
- `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`: FAIL on pre-existing non-task issues. First errors:
  - `src/lib/admin.functions.ts(1112,34): error TS2345: Argument of type '"sweep_member_credits"' is not assignable ...`
  - `src/lib/admin.functions.ts(1114,34): error TS2345: Argument of type '"sweep_all_members_credits"' is not assignable ...`
  - `src/lib/dom-patches.ts(57,39): error TS2683: 'this' implicitly has type 'any' because it does not have a type annotation.`
  - `src/lib/dom-patches.ts(57,68): error TS2554: Expected 2-3 arguments, but got 4.`
  - Additional matching pre-existing RPC typing errors continue in `src/lib/member.functions.ts` and `src/lib/members.functions.ts`.
  - No TypeScript error referenced `src/components/visual/VisualClassCard.tsx`, `src/styles.css`, `src/routes/_authenticated/member/index.tsx`, `src/routes/_authenticated/member/schedule.tsx`, or `src/lib/lesson-card-variants.ts`.
- `/Users/ameeramer/.bun/bin/bun run lint`: PASS with pre-existing warnings only (`0 errors`, `450 warnings`)
- `/Users/ameeramer/.bun/bin/bun run build`: PASS
- `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`: PASS (`i18n defaults and catalogs OK`)

## Remaining Issues

- Authenticated member visual QA for the actual lesson cards remains blocked in this local pass because:
  - direct browser login with the documented QA member credentials failed with invalid-credentials responses
  - saved member browser-state artifacts did not yield a reusable local authenticated member session in the in-app browser
- Because the task-owned source files were not reachable in a live authenticated shell, this pass cannot claim final visual confirmation for image cropping, badge overlap, or CTA spacing inside the member lesson cards themselves.
