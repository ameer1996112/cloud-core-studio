Task 3 report

Files changed:
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/index.tsx`
- `/Users/ameeramer/Documents/Cloud& Core/cloud-core-lovable-site/src/routes/_authenticated/member/schedule.tsx`

Summary:
- Wired the member home featured lesson card to `homeFeature`.
- Wired the member home recommended list cards to `homeList`.
- Wired the schedule day cards to `scheduleLead` for the first item and `scheduleList` for the rest.
- No booking, waitlist, payment, auth, schema, or helper logic was changed.

Commands run with outcomes:
- `git diff -- src/routes/_authenticated/member/index.tsx src/routes/_authenticated/member/schedule.tsx` -> confirmed the route diff was limited to the requested variant prop strings in the staged commit.
- `/Users/ameeramer/.bun/bin/bun run build` -> passed successfully.
- `git commit -m "feat: wire member routes to lesson card variants"` -> succeeded.

Self-review notes:
- The change is narrowly scoped to the two owned route files.
- The build completed cleanly after the variant wiring.
- The committed diff matches the task brief.

Concerns:
- The worktree already contains unrelated local changes outside this task, including an unstaged `src/routes/_authenticated/member/schedule.tsx` change that adds `count={items.length}` to `ScheduleDaySection`. I left it untouched.
