# Cloud & Core Current Database Blank Reset Report

## Verdict

- Database blanked: YES
- Supabase project: `banjmspemvzrqckajvwo`
- Backup created: NO, per owner instruction
- Migrations run: NO
- Database reset/truncate run: NO
- Schema/RLS/functions changed: NO

## Preserved

| Item                     | Count | Notes                                |
| ------------------------ | ----: | ------------------------------------ |
| `auth.users`             |     1 | Preserved owner admin only           |
| `profiles`               |     1 | Preserved owner admin profile        |
| `members`                |     1 | Preserved owner admin member row     |
| `studio_settings`        |     1 | Preserved branding/settings          |
| `notification_templates` |     8 | Preserved reusable message templates |

Owner admin preserved:

- Email: `ameer_1996112@hotmail.com`
- Role: `admin`
- Name: `Ameer Amer`
- Status: `active`

## Deleted / Emptied

| Table                       | Final count |
| --------------------------- | ----------: |
| `account_deletion_requests` |           0 |
| `admin_activity_log`        |           0 |
| `attendance_records`        |           0 |
| `bookings`                  |           0 |
| `class_templates`           |           0 |
| `classes`                   |           0 |
| `credit_transactions`       |           0 |
| `instructors`               |           0 |
| `media_assets`              |           0 |
| `member_notes`              |           0 |
| `member_plans`              |           0 |
| `notification_logs`         |           0 |
| `package_requests`          |           0 |
| `payments`                  |           0 |
| `plans`                     |           0 |
| `program_types`             |           0 |
| `provider_events`           |           0 |
| `receipts`                  |           0 |
| `recurring_class_rules`     |           0 |
| `rooms`                     |           0 |
| `waitlist_entries`          |           0 |

## Execution

SQL file:

- `tmp/blank-current-db-keep-owner.sql`

Execution approach:

- Single transaction
- Dependency-safe `DELETE` order
- No `TRUNCATE`
- No migrations
- Preserved owner admin by exact email
- Transaction assertions verified:
  - exactly one preserved owner admin
  - operational tables empty
  - `auth.users = 1`
  - `profiles = 1`
  - `members = 1`

## Final status

The database is ready for real studio setup:

1. Log in with `ameer_1996112@hotmail.com`.
2. Add real rooms.
3. Add real instructors.
4. Add real program types.
5. Add real packages/plans.
6. Add real classes.
