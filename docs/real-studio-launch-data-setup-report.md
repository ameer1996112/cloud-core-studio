# Cloud & Core Real Studio Launch Data Setup Report

## Verdict

- Real launch instructor configured: YES
- Real program types configured: YES
- Public sessions created: NO
- Fake/random schedule times created: NO
- Production deployment completed: YES

## Target

- Supabase project ID: `banjmspemvzrqckajvwo`
- Studio opening date: `1.7.2026`
- No migrations were run.
- No cleanup, reset, truncate, or destructive scripts were run.

## Instructor

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| ID             | `609d6a68-f2d5-42d0-b048-8d66dc71018a` |
| Display name   | `Yareen Shobash`                       |
| Hebrew display | `יארין שובאש`                          |
| Arabic display | `يارين شوباش`                          |
| Role           | Instructor                             |
| Active         | YES                                    |

Note: the current `instructors` table stores one `name` field, not separate localized name columns. No schema migration was run. Hebrew/Arabic instructor display is handled through the existing localized-content alias layer.

## Program Types

| Program     | ID                                     | English       | Hebrew         | Arabic                | Credits | Duration | Category        |
| ----------- | -------------------------------------- | ------------- | -------------- | --------------------- | ------- | -------- | --------------- |
| Aerial Yoga | `f0d24cf8-34d4-4443-8bfe-543dbef17737` | `Aerial Yoga` | `יוגה אווירית` | `يوغا هوائية`         | 1       | 60 min   | `Aerial / Yoga` |
| Pilates Mat | `9b786c16-81bc-4c3b-9ff5-8ef3c1f608ed` | `Pilates Mat` | `פילאטיס מזרן` | `بيلاتيس على الحصيرة` | 1       | 60 min   | `Pilates`       |
| Hot Pilates | `804e48da-a907-43a1-8c05-94daf1c2a903` | `Hot Pilates` | `הוט פילאטיס`  | `هوت بيلاتيس`         | 1       | 60 min   | `Pilates`       |

Note: the current `program_types` table does not have a dedicated `category` column. No schema migration was run. The category value is stored in the existing `level` field.

## Sessions

- Sessions created: NO
- Reason: class hours are not finalized.
- Future scheduled classes currently found: `0`
- Draft templates created: NO

This keeps the member-facing schedule from showing fake opening times.

## Studio Metadata

| Field               | Value                        |
| ------------------- | ---------------------------- |
| Studio name         | `Cloud & Core Studio`        |
| Announcement        | `Official opening: 1.7.2026` |
| Default language    | `he`                         |
| Supported languages | `he`, `ar`, `en`             |

## Member Schedule Behavior

When no published classes exist, the member schedule now uses the launch empty state:

| Language | Message                                         | CTA                                              |
| -------- | ----------------------------------------------- | ------------------------------------------------ |
| Hebrew   | `לוח השיעורים לפתיחה הרשמית יתעדכן בקרוב.`      | `רוצה שנעדכן אותך כשנפתח את לוח השיעורים?`       |
| Arabic   | `سيتم تحديث جدول الحصص قريبًا للافتتاح الرسمي.` | `هل تريدين أن نخبرك عند فتح جدول الحصص؟`         |
| English  | `The launch schedule will be updated soon.`     | `Want us to notify you when the schedule opens?` |

## Admin Create Session Behavior

- Program dropdown uses the real active program types.
- Yareen Shobash is selected by default when available.
- Date/time is intentionally blank by default.
- Save/create is disabled until a real date and time are selected.
- The page shows a localized friendly message instead of silently creating a random session time.

## Commands Run

| Command                                                                                                                                                                                      | Result | Notes                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `/Users/ameeramer/.bun/bin/bunx prettier --write src/routes/_authenticated/admin/classes/new.tsx src/routes/_authenticated/member/schedule.tsx src/lib/i18n.ts src/lib/localized-content.ts` | PASS   | Formatting only                                                                                                 |
| `/Users/ameeramer/.bun/bin/bunx tsc --noEmit`                                                                                                                                                | PASS   | Typecheck passed                                                                                                |
| `/Users/ameeramer/.bun/bin/bunx tsx tests/unit/i18n.test.mjs`                                                                                                                                | PASS   | i18n tests passed                                                                                               |
| `/Users/ameeramer/.bun/bin/bun run build`                                                                                                                                                    | PASS   | Build passed with existing chunk-size warning                                                                   |
| `gcloud builds submit --config cloudbuild.yaml ...`                                                                                                                                          | PASS   | Built and pushed image `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260625130020` |
| `gcloud run deploy cloud-core-studio ...`                                                                                                                                                    | PASS   | Deployed revision `cloud-core-studio-00033-g6q`                                                                 |
| `gcloud run services describe cloud-core-studio ...`                                                                                                                                         | PASS   | Confirmed 100% traffic to revision `cloud-core-studio-00033-g6q`                                                |

## Production Deployment

| Field             | Value                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Cloud Run project | `cloudandcorestudio`                                                                     |
| Service           | `cloud-core-studio`                                                                      |
| Region            | `me-west1`                                                                               |
| Live URL          | `https://cloud-core-studio-6uthbm2yyq-zf.a.run.app`                                      |
| Revision          | `cloud-core-studio-00033-g6q`                                                            |
| Image             | `me-west1-docker.pkg.dev/cloudandcorestudio/cloud-core/cloud-core-studio:20260625130020` |
| Traffic           | `100%`                                                                                   |

## Production Smoke QA

| Check                                      | Result  | Notes                                                                                                                                          |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth` loads                              | PASS    | Live Cloud Run URL loaded                                                                                                                      |
| Admin login                                | PASS    | Admin redirected to `/admin`                                                                                                                   |
| Admin create-session real program dropdown | PASS    | Dropdown contained `יוגה אווירית`, `פילאטיס מזרן`, `הוט פילאטיס`                                                                               |
| Admin create-session instructor            | PASS    | `Yareen Shobash` visible/selectable                                                                                                            |
| Date/time not prefilled                    | PASS    | No random generated date/time was selected                                                                                                     |
| Save disabled without real time            | PASS    | Create button disabled until required real time data is selected                                                                               |
| Desktop overflow                           | PASS    | `1440px` viewport had no horizontal overflow                                                                                                   |
| Mobile overflow                            | PASS    | `390px` viewport had no horizontal overflow                                                                                                    |
| Console errors                             | PASS    | No console errors/warnings during admin smoke                                                                                                  |
| Member schedule browser login              | LIMITED | Existing old E2E member account no longer logs in after cleanup. No replacement member was created because this task is real launch data only. |

## Remaining Setup Once Hours Are Finalized

- Add real rooms if the studio wants room-specific scheduling.
- Choose exact launch class dates and times.
- Create published classes only from the real schedule.
- Optionally add dedicated localized instructor-name columns later through an approved migration.
- Optionally add a dedicated program category column later through an approved migration.
