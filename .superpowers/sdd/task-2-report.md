Files changed:
- src/components/visual/VisualClassCard.tsx
- src/styles.css

Summary:
- Refactored `VisualClassCard` to normalize lesson variants once with `normalizeLessonCardVariant(variant, compact)`.
- Added `data-lesson-variant={normalizedVariant}` on the root card shell for CSS targeting.
- Replaced the legacy non-feature branch with one shared dense list layout for `homeList` and `scheduleList`.
- Replaced the legacy feature branch with one shared editorial layout for `homeFeature` and `scheduleLead`.
- Kept existing props compatible, preserved keyboard access via the existing button wrapper, and kept RTL/LTR-aware alignment in both markup and CSS.
- Used resolved class images for list and feature media when available, with `ClassArtTile` retained as the fallback.

Commands run with outcomes:
- `/Users/ameeramer/.bun/bin/bun install`
  - Passed. No dependency changes.
- `/Users/ameeramer/.bun/bin/bun run lint`
  - Failed due a pre-existing prettier error in `src/lib/lesson-card-variants.ts:116` plus many existing warnings outside task ownership.
  - My task-owned files no longer produced lint errors after the local formatting fix.
- `/Users/ameeramer/.bun/bin/bun run build`
  - Passed for both client and SSR production builds.

Self-review notes:
- The card now branches on explicit normalized variants instead of legacy `hero/standard/compact` naming in component logic.
- Feature variants emphasize the next best action with larger editorial copy and stronger CTA treatment.
- List variants compress time, capacity, instructor, location, and CTA into a quicker comparison layout for schedule scanning.
- CSS targeting now uses `data-lesson-variant` for the new variants while keeping the rest of the member app untouched.
- Media presentation uses existing image helpers and avoids placing participant chips or other marks over the lesson image area in the main layouts.

Concerns:
- `bun run lint` is still red because of a pre-existing formatting error in `src/lib/lesson-card-variants.ts`, which this task explicitly did not allow me to edit.
- I did not modify routes or tests, so validation is limited to static lint/build checks and code review of the owned surfaces.

Task 2 fix report:
- `/Users/ameeramer/.bun/bin/bunx prettier --write src/lib/lesson-card-variants.ts` - passed.
- `/Users/ameeramer/.bun/bin/bunx prettier --check src/lib/lesson-card-variants.ts` - passed.
- `/Users/ameeramer/.bun/bin/bun run lint` - passed with existing repository warnings only, no errors.
- `/Users/ameeramer/.bun/bin/bun run build` - passed.

Task 2 review-fix follow-up:
- Files changed:
  - `src/components/visual/VisualClassCard.tsx`
  - `src/styles.css`
- Summary:
  - Mapped legacy `memberHome` callers that still pass `variant="hero" | "standard" | "compact"` to `homeFeature` / `homeList` before `normalizeLessonCardVariant`, while leaving explicit variants unchanged.
  - Added an explicit RTL mirror rule for `.lesson-card__feature-layout` so the feature columns swap direction correctly in RTL.
  - Left route files untouched.
- Commands run with outcomes:
  - `/Users/ameeramer/.bun/bin/bun run lint` - passed.
  - `/Users/ameeramer/.bun/bin/bun run build` - passed.
- Self-review:
  - The legacy home call path now resolves to the intended member-home variants without affecting explicit schedule/home variants.
  - The feature card layout now mirrors in RTL instead of relying only on border swapping.
  - Keyboard-accessible button wrapping and existing media handling were preserved.
- Concerns:
  - `lessonCountLabel` hardcoded strings remain as a non-blocking review note per the task instruction.
