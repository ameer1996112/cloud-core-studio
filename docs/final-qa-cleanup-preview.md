# Cloud & Core Final QA Cleanup Preview

## Verdict

- Cleanup safe: YES
- Cleanup executed: NO
- Real data risk: LOW

## QA tags included

- `QA_PRE_RELEASE_`
- `QA_PRE_RELEASE_RERUN_`
- `QA_PRE_RELEASE_FINAL_`
- Exact QA emails from controlled QA reports:
  - `qa_pre_release_20260624t210916z.admin@example.com`
  - `qa_pre_release_20260624t210916z.instructor@example.com`
  - `qa_pre_release_20260624t210916z.member@example.com`
  - `qa_pre_release_20260624t210916z.nocredits@example.com`
  - `qa_pre_release_20260624t210916z.othermember@example.com`

## Records targeted

| Table                 | Count | Reason                             |
| --------------------- | ----: | ---------------------------------- |
| `notification_logs`   |     2 | direct QA tag/email                |
| `attendance_records`  |     3 | QA dependency                      |
| `package_requests`    |     1 | direct QA tag/email                |
| `receipts`            |     3 | direct QA tag/email                |
| `payments`            |     3 | direct QA tag/email                |
| `member_plans`        |     3 | QA dependency                      |
| `credit_transactions` |     7 | direct QA tag/email, QA dependency |
| `bookings`            |     3 | QA dependency                      |
| `classes`             |     4 | direct QA tag/email                |
| `plans`               |     3 | direct QA tag/email                |
| `program_types`       |     2 | direct QA tag/email                |
| `rooms`               |     2 | direct QA tag/email                |
| `instructors`         |     1 | direct QA tag/email                |
| `members`             |     5 | direct QA tag/email                |
| `profiles`            |     5 | direct QA tag/email                |
| `auth.users`          |     5 | direct QA tag/email                |

## Exact records

| Table                 | ID                                     | QA tag/email/name/title                                               | Dependency notes                                        |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| `notification_logs`   | `5f934f73-742c-4a93-8cb3-8b51044aaca4` | QA_PRE_RELEASE_20260624T210916Z_whatsapp                              | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `notification_logs`   | `8c4a02cb-634a-425b-aff6-120f9d0b084f` | QA_PRE_RELEASE_RERUN_20260624T214226Z_whatsapp                        | direct template_key match                               |
| `attendance_records`  | `58d38722-6216-4bab-9395-4a69e1c83e5c` | 58d38722-6216-4bab-9395-4a69e1c83e5c                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `attendance_records`  | `8fc9115b-771e-43c5-b9ff-5d87ba0efe4b` | 8fc9115b-771e-43c5-b9ff-5d87ba0efe4b                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `attendance_records`  | `ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c` | ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c                                  | QA member dependency                                    |
| `package_requests`    | `d96c697d-55f5-46a9-bcb5-dea18adea9d0` | d96c697d-55f5-46a9-bcb5-dea18adea9d0                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `receipts`            | `01dae582-1beb-40ec-83a9-214a3671778a` | CC-2026-01006                                                         | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `receipts`            | `428a6702-dc16-48d9-a0de-5c5222fbbd6f` | CC-2026-01007                                                         | direct member_name_snapshot match                       |
| `receipts`            | `eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5` | CC-2026-01005                                                         | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `payments`            | `24a1076d-64db-48fc-802f-fd36fb375ebf` | QA_PRE_RELEASE_20260624T210916Z_COMPLETION_1782335749501              | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `payments`            | `a1d764c7-fdac-451b-823a-09c972833059` | QA_PRE_RELEASE_RERUN_20260624T214226Z                                 | direct reference match                                  |
| `payments`            | `f07888d0-9760-4647-a883-dd1ce9b70bae` | QA_PRE_RELEASE_20260624T210916Z                                       | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `member_plans`        | `657c7463-9b2d-4160-8250-2fa182f1c44d` | 657c7463-9b2d-4160-8250-2fa182f1c44d                                  | QA member dependency                                    |
| `member_plans`        | `9ba2b6f1-1032-47ac-8637-6db45ea09203` | 9ba2b6f1-1032-47ac-8637-6db45ea09203                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `member_plans`        | `a3e21528-6c82-4a97-b8bf-0eca630f7630` | a3e21528-6c82-4a97-b8bf-0eca630f7630                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `credit_transactions` | `26127ef0-784b-46cf-b106-e773423a5c7a` | plan paid: QA_PRE_RELEASE_20260624T210916Z_Plan                       | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `credit_transactions` | `8066a0ac-6095-4f45-93ba-3958bebe7697` | plan paid: QA_PRE_RELEASE_RERUN_20260624T214226Z_Plan                 | direct reason match                                     |
| `credit_transactions` | `877dd3c5-6180-41b1-8334-a6c2af55138a` | booking                                                               | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `credit_transactions` | `a94d8106-d693-46bb-845e-bf8de37c22b6` | plan paid: QA_PRE_RELEASE_20260624T210916Z_Plan                       | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `credit_transactions` | `c55e77bb-1f61-4681-9dde-7f520b153b9b` | booking                                                               | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `credit_transactions` | `c9af4af5-48fd-44ad-8adf-f882599be0f0` | booking                                                               | QA member dependency                                    |
| `credit_transactions` | `d950d9ff-2b36-4ea4-85a0-f69c7edca06c` | member self cancel refund                                             | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `bookings`            | `1b363f8f-ee43-48ce-aa2d-75f1a1691f27` | 1b363f8f-ee43-48ce-aa2d-75f1a1691f27                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `bookings`            | `2427d254-d48a-422d-919a-44bca3d42996` | 2427d254-d48a-422d-919a-44bca3d42996                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `bookings`            | `b7a75532-504e-417e-b80f-062535c08798` | b7a75532-504e-417e-b80f-062535c08798                                  | QA member dependency                                    |
| `classes`             | `70f70337-aec5-44e1-b458-fdc6257acf29` | QA_PRE_RELEASE_20260624T210916Z_Class_Main_Edited                     | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `classes`             | `827e08e3-e592-4384-93d4-53fd2e33cf2f` | QA_PRE_RELEASE_RERUN_20260624T214226Z_Class                           | direct title match                                      |
| `classes`             | `82eb7bd6-e926-4195-9695-4f1b1063dbaa` | QA_PRE_RELEASE_20260624T210916Z_Cancel_Class                          | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `classes`             | `cc6639d9-8f87-49fe-8ee6-45c6262dda5e` | QA_PRE_RELEASE_20260624T210916Z_Cancel_Class_Completion_1782335762573 | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `plans`               | `258b8ebd-9909-4a63-b0d5-e26d9376c472` | QA_PRE_RELEASE_20260624T210916Z_Plan                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `plans`               | `95d247d9-03a6-410e-b83d-8e119b846dd5` | QA_PRE_RELEASE_RERUN_20260624T214226Z_Plan                            | direct name match                                       |
| `plans`               | `e9f966af-0540-4e1f-bb80-87a1c242a5ca` | QA_PRE_RELEASE_20260624T210916Z_Plan                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `program_types`       | `606d2347-49ef-4dcd-8fbb-c7e0793ede4c` | qa-pre-release-20260624t210916z                                       | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `program_types`       | `e5919f2c-47fd-4dce-95ca-1c1837fd5516` | qa-pre-release-rerun-20260624t214226z                                 | direct slug match                                       |
| `rooms`               | `51d1095a-29f8-4247-b1af-4e939aa05223` | QA_PRE_RELEASE_20260624T210916Z_Room                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `rooms`               | `a8fbf30a-ad37-49b9-918e-f9330d9a08b4` | QA_PRE_RELEASE_RERUN_20260624T214226Z_Room                            | direct name match                                       |
| `instructors`         | `8180a421-a5db-4865-80cb-78993337e080` | QA_PRE_RELEASE_20260624T210916Z_Instructor                            | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `members`             | `1dbce5ae-0cab-4a55-8015-39391131a141` | QA_PRE_RELEASE_20260624T210916Z_instructor                            | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `members`             | `5ee58596-2e4f-440e-b15b-3899f67a67b5` | qa_pre_release_20260624t210916z.othermember@example.com               | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `members`             | `718f2318-c3e0-404b-8283-e1697d3e4c31` | qa_pre_release_20260624t210916z.nocredits@example.com                 | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `members`             | `c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c` | qa_pre_release_20260624t210916z.member@example.com                    | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `members`             | `ec526875-a620-4808-9fbc-02ca0ae98185` | QA_PRE_RELEASE_20260624T210916Z_admin                                 | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `profiles`            | `1dbce5ae-0cab-4a55-8015-39391131a141` | 1dbce5ae-0cab-4a55-8015-39391131a141                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `profiles`            | `5ee58596-2e4f-440e-b15b-3899f67a67b5` | 5ee58596-2e4f-440e-b15b-3899f67a67b5                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `profiles`            | `718f2318-c3e0-404b-8283-e1697d3e4c31` | 718f2318-c3e0-404b-8283-e1697d3e4c31                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `profiles`            | `c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c` | c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `profiles`            | `ec526875-a620-4808-9fbc-02ca0ae98185` | ec526875-a620-4808-9fbc-02ca0ae98185                                  | from tmp/pre-release-current-db-qa/cleanup-preview.json |
| `auth.users`          | `1dbce5ae-0cab-4a55-8015-39391131a141` | qa_pre_release_20260624t210916z.instructor@example.com                | exact QA email                                          |
| `auth.users`          | `5ee58596-2e4f-440e-b15b-3899f67a67b5` | qa_pre_release_20260624t210916z.othermember@example.com               | exact QA email                                          |
| `auth.users`          | `718f2318-c3e0-404b-8283-e1697d3e4c31` | qa_pre_release_20260624t210916z.nocredits@example.com                 | exact QA email                                          |
| `auth.users`          | `c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c` | qa_pre_release_20260624t210916z.member@example.com                    | exact QA email                                          |
| `auth.users`          | `ec526875-a620-4808-9fbc-02ca0ae98185` | qa_pre_release_20260624t210916z.admin@example.com                     | exact QA email                                          |

## Cleanup order

1. `notification_logs`
2. `attendance_records`
3. `package_requests`
4. `receipts`
5. `payments`
6. `member_plans`
7. `credit_transactions`
8. `bookings`
9. `classes`
10. `plans`
11. `program_types`
12. `rooms`
13. `instructors`
14. `members`
15. `profiles`
16. `auth.users`

## SQL generated

Reference: `tmp/final-qa-cleanup-preview.sql`

The SQL file shows a `SELECT` preview before every commented `DELETE` statement. It ends with `ROLLBACK;` and does not execute cleanup.

## Safety checks

- Every targeted row contains QA tag or exact QA email: YES, directly or through a selected QA parent row shown in dependency notes
- No broad deletes: YES
- No real studio data targeted: YES
- Manual approval required before execution: YES

## Scan notes

- Project scanned read-only: `banjmspemvzrqckajvwo`
- Cleanup SQL generated but not executed.
- Direct QA-tag/email rows: 39
- Dependency-only QA rows: 13
- Non-blocking skipped scans: 59. See `tmp/final-qa-cleanup-preview.json`.

## Next step

Stop and wait for approval before cleanup.
