# Cloud & Core Lesson Templates Launch Catalog Report

## Verdict

- Launch lesson catalog created: YES
- Records created/updated: YES
- Public scheduled sessions created: NO
- Fake/random class times created: NO
- Migrations run: NO
- Equipment visible in admin/member smoke: NO

## Target

- Supabase project ID: `banjmspemvzrqckajvwo`
- Model used: `program_types`

## Model decision

The project has a `class_templates` table, but the current table only stores a single plain `title` plus default values. It does not support localized titles/descriptions, and it is not the visible selector used by the current Create Session page.

For this launch catalog, `program_types` was used because it already supports:

- localized English/Hebrew/Arabic names
- localized descriptions
- default duration
- default credits
- default capacity
- admin Programs cards
- Create Session program dropdown
- member-facing localized program display when real sessions are created later

No schema changes were made.

## Records created/updated

| Slug                       | English                         | Hebrew                              | Arabic                               | Duration | Credits | Capacity | Equipment | Active |
| -------------------------- | ------------------------------- | ----------------------------------- | ------------------------------------ | -------- | ------- | -------- | --------- | ------ |
| `lesson-elevate-flow`      | Elevate Flow — Aerial Yoga      | Elevate Flow — יוגה אווירית         | Elevate Flow — يوغا هوائية           | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-aerial-restore`    | Aerial Restore — Aerial Yoga    | Aerial Restore — יוגה אווירית משקמת | Aerial Restore — يوغا هوائية ترميمية | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-sky-core`          | Sky Core — Aerial Yoga          | Sky Core — יוגה אווירית             | Sky Core — يوغا هوائية               | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-float-flow`        | Float & Flow — Aerial Yoga      | Float & Flow — יוגה אווירית         | Float & Flow — يوغا هوائية           | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-core-precision`    | Core Precision — Pilates Mat    | Core Precision — פילאטיס מזרן       | Core Precision — بيلاتيس على الحصيرة | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-sculpt-align`      | Sculpt & Align — Pilates Mat    | Sculpt & Align — פילאטיס מזרן       | Sculpt & Align — بيلاتيس على الحصيرة | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-centered-strength` | Centered Strength — Pilates Mat | Centered Strength — פילאטיס מזרן    | Centered Strength — بيلاتيس عالحصيرة | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-balance-tone`      | Balance & Tone — Pilates Mat    | Balance & Tone — פילאטיס מזרן       | Balance & Tone — بيلاتيس على الحصيرة | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-heat-tone`         | Heat & Tone — Hot Pilates       | Heat & Tone — הוט פילאטיס           | Heat & Tone — هوت بيلاتيس            | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-ignite-core`       | Ignite Core — Hot Pilates       | Ignite Core — הוט פילאטיס           | Ignite Core — هوت بيلاتيس            | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-hot-sculpt`        | Hot Sculpt — Hot Pilates        | Hot Sculpt — הוט פילאטיס            | Hot Sculpt — هوت بيلاتيس             | 60       | 1       | 12       | `[]`      | YES    |
| `lesson-glow-burn`         | Glow Burn — Hot Pilates         | Glow Burn — הוט פילאטיס             | Glow Burn — هوت بيلاتيس              | 60       | 1       | 12       | `[]`      | YES    |

## Sessions

- `classes` row count after setup: `0`
- Future scheduled classes after setup: `0`
- Public sessions created: `0`
- Draft/unpublished sessions created: `0`

Real class dates and times remain intentionally unset until the weekly hours are finalized.

## Admin visibility

| Area                      | Result | Notes                                                          |
| ------------------------- | ------ | -------------------------------------------------------------- |
| Admin Programs page       | PASS   | All 12 launch lessons are visible as program cards             |
| Admin Create Session page | PASS   | All 12 launch lessons are selectable from the program dropdown |
| Default instructor        | PASS   | Yareen Shobash is available/defaulted where possible           |
| Equipment hidden          | PASS   | No `ציוד`, `equipment`, `hammock`, or `none` shown in smoke    |
| Fake time check           | PASS   | Create Session does not preselect a fake class date/time       |

## Member UI

No public sessions exist yet, so no member-facing class cards were created. When real sessions are created later from these lesson options, member-facing program names/descriptions can resolve from the localized `program_types` fields.

The launch schedule remains empty/coming soon until real hours are finalized.

## Commands run

| Command                                                       | Result | Notes                                                          |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| `node --input-type=module ...`                                | PASS   | Upserted 12 real launch `program_types`; no `classes` inserted |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                 | PASS   | Typecheck clean                                                |
| `/Users/ameeramer/.bun/bin/bun run build`                     | PASS   | Build passed with existing chunk-size warning                  |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs` | PASS   | i18n catalogs OK                                               |

## Browser QA

Production browser QA was run against:

`https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`

| Flow                                   | Result | Notes                                                    |
| -------------------------------------- | ------ | -------------------------------------------------------- |
| Admin login                            | PASS   | Redirected to `/admin`                                   |
| Admin Programs has 12 lessons          | PASS   | All expected Hebrew launch lesson names found            |
| Admin Programs equipment hidden        | PASS   | No visible equipment text                                |
| Create Session dropdown has 12 lessons | PASS   | All expected Hebrew launch lesson names found in options |
| Yareen Shobash available/defaulted     | PASS   | Instructor present on Create Session page                |
| No fake selected time                  | PASS   | No date/time selected automatically                      |
| Console errors                         | PASS   | 0 console errors                                         |

## Remaining manual setup

Once real weekly hours are finalized:

- Add real room information if needed.
- Create actual scheduled classes from these launch lesson options.
- Confirm each real class has the correct date, time, instructor, room, capacity, credit cost, and cancellation window.
- Run a final booking QA pass after the first real public sessions are added.
