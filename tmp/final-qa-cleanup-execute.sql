-- FINAL QA CLEANUP EXECUTION - APPROVED TARGETED RECORDS ONLY
-- Project: banjmspemvzrqckajvwo
-- Generated from tmp/final-qa-cleanup-preview.json at 2026-06-25T08:03:28.318Z
-- No migrations, no truncates, no broad deletes.
BEGIN;
CREATE TEMP TABLE qa_cleanup_expected (table_name text NOT NULL, id uuid NOT NULL, label text, direct_qa_text boolean NOT NULL, reason text);
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('notification_logs', '5f934f73-742c-4a93-8cb3-8b51044aaca4', 'QA_PRE_RELEASE_20260624T210916Z_whatsapp', true, 'existing cleanup preview record; template_key contains QA cleanup tag; subject contains QA cleanup tag; notification belongs to QA member; notification belongs to QA class; notification belongs to QA member; notification belongs to QA class; notification belongs to QA member; notification belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('notification_logs', '8c4a02cb-634a-425b-aff6-120f9d0b084f', 'QA_PRE_RELEASE_RERUN_20260624T214226Z_whatsapp', true, 'template_key contains QA cleanup tag; template_key contains QA cleanup tag; subject contains QA cleanup tag; subject contains QA cleanup tag; notification belongs to QA member; notification belongs to QA class; notification belongs to QA member; notification belongs to QA class; notification belongs to QA member; notification belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('attendance_records', '58d38722-6216-4bab-9395-4a69e1c83e5c', '58d38722-6216-4bab-9395-4a69e1c83e5c', false, 'existing cleanup preview record; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('attendance_records', '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b', '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b', false, 'existing cleanup preview record; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('attendance_records', 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c', 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c', false, 'attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class; attendance belongs to QA booking; attendance belongs to QA member; attendance belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('package_requests', 'd96c697d-55f5-46a9-bcb5-dea18adea9d0', 'd96c697d-55f5-46a9-bcb5-dea18adea9d0', true, 'existing cleanup preview record; package request belongs to QA member; package request uses QA plan; package request belongs to QA member; package request uses QA plan; package request belongs to QA member; package request uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('receipts', '01dae582-1beb-40ec-83a9-214a3671778a', 'CC-2026-01006', true, 'existing cleanup preview record; member_name_snapshot contains QA cleanup tag; plan_name_snapshot contains QA cleanup tag; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('receipts', '428a6702-dc16-48d9-a0de-5c5222fbbd6f', 'CC-2026-01007', true, 'member_name_snapshot contains QA cleanup tag; plan_name_snapshot contains QA cleanup tag; plan_name_snapshot contains QA cleanup tag; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('receipts', 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5', 'CC-2026-01005', true, 'existing cleanup preview record; member_name_snapshot contains QA cleanup tag; plan_name_snapshot contains QA cleanup tag; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member; receipt belongs to QA payment; receipt belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('payments', '24a1076d-64db-48fc-802f-fd36fb375ebf', 'QA_PRE_RELEASE_20260624T210916Z_COMPLETION_1782335749501', true, 'existing cleanup preview record; reference contains QA cleanup tag; notes contains QA cleanup tag; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('payments', 'a1d764c7-fdac-451b-823a-09c972833059', 'QA_PRE_RELEASE_RERUN_20260624T214226Z', true, 'reference contains QA cleanup tag; reference contains QA cleanup tag; notes contains QA cleanup tag; notes contains QA cleanup tag; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('payments', 'f07888d0-9760-4647-a883-dd1ce9b70bae', 'QA_PRE_RELEASE_20260624T210916Z', true, 'existing cleanup preview record; reference contains QA cleanup tag; notes contains QA cleanup tag; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan; payment belongs to QA member; payment uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('member_plans', '657c7463-9b2d-4160-8250-2fa182f1c44d', '657c7463-9b2d-4160-8250-2fa182f1c44d', false, 'member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('member_plans', '9ba2b6f1-1032-47ac-8637-6db45ea09203', '9ba2b6f1-1032-47ac-8637-6db45ea09203', false, 'existing cleanup preview record; member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('member_plans', 'a3e21528-6c82-4a97-b8bf-0eca630f7630', 'a3e21528-6c82-4a97-b8bf-0eca630f7630', false, 'existing cleanup preview record; member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan; member plan belongs to QA member; member plan uses QA plan');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', '26127ef0-784b-46cf-b106-e773423a5c7a', 'plan paid: QA_PRE_RELEASE_20260624T210916Z_Plan', true, 'existing cleanup preview record; reason contains QA cleanup tag; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', '8066a0ac-6095-4f45-93ba-3958bebe7697', 'plan paid: QA_PRE_RELEASE_RERUN_20260624T214226Z_Plan', true, 'reason contains QA cleanup tag; reason contains QA cleanup tag; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', '877dd3c5-6180-41b1-8334-a6c2af55138a', 'booking', false, 'existing cleanup preview record; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', 'a94d8106-d693-46bb-845e-bf8de37c22b6', 'plan paid: QA_PRE_RELEASE_20260624T210916Z_Plan', true, 'existing cleanup preview record; reason contains QA cleanup tag; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', 'c55e77bb-1f61-4681-9dde-7f520b153b9b', 'booking', false, 'existing cleanup preview record; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', 'c9af4af5-48fd-44ad-8adf-f882599be0f0', 'booking', false, 'credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('credit_transactions', 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c', 'member self cancel refund', false, 'existing cleanup preview record; credit transaction belongs to QA member; credit transaction belongs to QA member; credit transaction belongs to QA member');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('bookings', '1b363f8f-ee43-48ce-aa2d-75f1a1691f27', '1b363f8f-ee43-48ce-aa2d-75f1a1691f27', false, 'existing cleanup preview record; booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('bookings', '2427d254-d48a-422d-919a-44bca3d42996', '2427d254-d48a-422d-919a-44bca3d42996', false, 'existing cleanup preview record; booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('bookings', 'b7a75532-504e-417e-b80f-062535c08798', 'b7a75532-504e-417e-b80f-062535c08798', false, 'booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class; booking belongs to QA member; booking belongs to QA class');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('classes', '70f70337-aec5-44e1-b458-fdc6257acf29', 'QA_PRE_RELEASE_20260624T210916Z_Class_Main_Edited', true, 'existing cleanup preview record; title contains QA cleanup tag; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('classes', '827e08e3-e592-4384-93d4-53fd2e33cf2f', 'QA_PRE_RELEASE_RERUN_20260624T214226Z_Class', true, 'title contains QA cleanup tag; title contains QA cleanup tag; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('classes', '82eb7bd6-e926-4195-9695-4f1b1063dbaa', 'QA_PRE_RELEASE_20260624T210916Z_Cancel_Class', true, 'existing cleanup preview record; title contains QA cleanup tag; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('classes', 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e', 'QA_PRE_RELEASE_20260624T210916Z_Cancel_Class_Completion_1782335762573', true, 'existing cleanup preview record; title contains QA cleanup tag; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type; class uses QA instructor; class uses QA room; class uses QA program type');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('plans', '258b8ebd-9909-4a63-b0d5-e26d9376c472', 'QA_PRE_RELEASE_20260624T210916Z_Plan', true, 'existing cleanup preview record; name contains QA cleanup tag; description contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('plans', '95d247d9-03a6-410e-b83d-8e119b846dd5', 'QA_PRE_RELEASE_RERUN_20260624T214226Z_Plan', true, 'name contains QA cleanup tag; name contains QA cleanup tag; description contains QA cleanup tag; description contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('plans', 'e9f966af-0540-4e1f-bb80-87a1c242a5ca', 'QA_PRE_RELEASE_20260624T210916Z_Plan', true, 'existing cleanup preview record; name contains QA cleanup tag; description contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('program_types', '606d2347-49ef-4dcd-8fbb-c7e0793ede4c', 'qa-pre-release-20260624t210916z', true, 'existing cleanup preview record; slug contains QA cleanup tag; name_en contains QA cleanup tag; name_he contains QA cleanup tag; name_ar contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('program_types', 'e5919f2c-47fd-4dce-95ca-1c1837fd5516', 'qa-pre-release-rerun-20260624t214226z', true, 'slug contains QA cleanup tag; slug contains QA cleanup tag; name_en contains QA cleanup tag; name_en contains QA cleanup tag; name_he contains QA cleanup tag; name_he contains QA cleanup tag; name_ar contains QA cleanup tag; name_ar contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('rooms', '51d1095a-29f8-4247-b1af-4e939aa05223', 'QA_PRE_RELEASE_20260624T210916Z_Room', true, 'existing cleanup preview record; name contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('rooms', 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4', 'QA_PRE_RELEASE_RERUN_20260624T214226Z_Room', true, 'name contains QA cleanup tag; name contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('instructors', '8180a421-a5db-4865-80cb-78993337e080', 'QA_PRE_RELEASE_20260624T210916Z_Instructor', true, 'existing cleanup preview record; name contains QA cleanup tag; instructor user_id matches QA auth user; instructor user_id matches QA auth user; instructor user_id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('members', '1dbce5ae-0cab-4a55-8015-39391131a141', 'QA_PRE_RELEASE_20260624T210916Z_instructor', true, 'existing cleanup preview record; member id matches QA auth user; name contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('members', '5ee58596-2e4f-440e-b15b-3899f67a67b5', 'qa_pre_release_20260624t210916z.othermember@example.com', true, 'existing cleanup preview record; member id matches QA auth user; name contains QA cleanup tag; email contains QA cleanup tag; email contains exact QA email');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('members', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'qa_pre_release_20260624t210916z.nocredits@example.com', true, 'existing cleanup preview record; member id matches QA auth user; name contains QA cleanup tag; email contains QA cleanup tag; email contains exact QA email');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('members', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'qa_pre_release_20260624t210916z.member@example.com', true, 'existing cleanup preview record; member id matches QA auth user; name contains QA cleanup tag; email contains QA cleanup tag; email contains exact QA email');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('members', 'ec526875-a620-4808-9fbc-02ca0ae98185', 'QA_PRE_RELEASE_20260624T210916Z_admin', true, 'existing cleanup preview record; member id matches QA auth user; name contains QA cleanup tag');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('profiles', '1dbce5ae-0cab-4a55-8015-39391131a141', '1dbce5ae-0cab-4a55-8015-39391131a141', true, 'existing cleanup preview record; profile id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('profiles', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '5ee58596-2e4f-440e-b15b-3899f67a67b5', true, 'existing cleanup preview record; profile id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('profiles', '718f2318-c3e0-404b-8283-e1697d3e4c31', '718f2318-c3e0-404b-8283-e1697d3e4c31', true, 'existing cleanup preview record; profile id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('profiles', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', true, 'existing cleanup preview record; profile id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('profiles', 'ec526875-a620-4808-9fbc-02ca0ae98185', 'ec526875-a620-4808-9fbc-02ca0ae98185', true, 'existing cleanup preview record; profile id matches QA auth user');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('auth.users', '1dbce5ae-0cab-4a55-8015-39391131a141', 'qa_pre_release_20260624t210916z.instructor@example.com', true, 'auth email matches QA pattern');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('auth.users', '5ee58596-2e4f-440e-b15b-3899f67a67b5', 'qa_pre_release_20260624t210916z.othermember@example.com', true, 'auth email matches QA pattern');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('auth.users', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'qa_pre_release_20260624t210916z.nocredits@example.com', true, 'auth email matches QA pattern');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('auth.users', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'qa_pre_release_20260624t210916z.member@example.com', true, 'auth email matches QA pattern');
INSERT INTO qa_cleanup_expected(table_name, id, label, direct_qa_text, reason) VALUES ('auth.users', 'ec526875-a620-4808-9fbc-02ca0ae98185', 'qa_pre_release_20260624t210916z.admin@example.com', true, 'auth email matches QA pattern');
CREATE TEMP TABLE qa_cleanup_counts (phase text NOT NULL, table_name text NOT NULL, row_count integer NOT NULL);
INSERT INTO qa_cleanup_counts SELECT 'before', 'notification_logs', count(*)::int FROM public.notification_logs WHERE id = ANY(ARRAY['5f934f73-742c-4a93-8cb3-8b51044aaca4'::uuid, '8c4a02cb-634a-425b-aff6-120f9d0b084f'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'attendance_records', count(*)::int FROM public.attendance_records WHERE id = ANY(ARRAY['58d38722-6216-4bab-9395-4a69e1c83e5c'::uuid, '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b'::uuid, 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'package_requests', count(*)::int FROM public.package_requests WHERE id = ANY(ARRAY['d96c697d-55f5-46a9-bcb5-dea18adea9d0'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'receipts', count(*)::int FROM public.receipts WHERE id = ANY(ARRAY['01dae582-1beb-40ec-83a9-214a3671778a'::uuid, '428a6702-dc16-48d9-a0de-5c5222fbbd6f'::uuid, 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'payments', count(*)::int FROM public.payments WHERE id = ANY(ARRAY['24a1076d-64db-48fc-802f-fd36fb375ebf'::uuid, 'a1d764c7-fdac-451b-823a-09c972833059'::uuid, 'f07888d0-9760-4647-a883-dd1ce9b70bae'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'member_plans', count(*)::int FROM public.member_plans WHERE id = ANY(ARRAY['657c7463-9b2d-4160-8250-2fa182f1c44d'::uuid, '9ba2b6f1-1032-47ac-8637-6db45ea09203'::uuid, 'a3e21528-6c82-4a97-b8bf-0eca630f7630'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'credit_transactions', count(*)::int FROM public.credit_transactions WHERE id = ANY(ARRAY['26127ef0-784b-46cf-b106-e773423a5c7a'::uuid, '8066a0ac-6095-4f45-93ba-3958bebe7697'::uuid, '877dd3c5-6180-41b1-8334-a6c2af55138a'::uuid, 'a94d8106-d693-46bb-845e-bf8de37c22b6'::uuid, 'c55e77bb-1f61-4681-9dde-7f520b153b9b'::uuid, 'c9af4af5-48fd-44ad-8adf-f882599be0f0'::uuid, 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'bookings', count(*)::int FROM public.bookings WHERE id = ANY(ARRAY['1b363f8f-ee43-48ce-aa2d-75f1a1691f27'::uuid, '2427d254-d48a-422d-919a-44bca3d42996'::uuid, 'b7a75532-504e-417e-b80f-062535c08798'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'classes', count(*)::int FROM public.classes WHERE id = ANY(ARRAY['70f70337-aec5-44e1-b458-fdc6257acf29'::uuid, '827e08e3-e592-4384-93d4-53fd2e33cf2f'::uuid, '82eb7bd6-e926-4195-9695-4f1b1063dbaa'::uuid, 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'plans', count(*)::int FROM public.plans WHERE id = ANY(ARRAY['258b8ebd-9909-4a63-b0d5-e26d9376c472'::uuid, '95d247d9-03a6-410e-b83d-8e119b846dd5'::uuid, 'e9f966af-0540-4e1f-bb80-87a1c242a5ca'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'program_types', count(*)::int FROM public.program_types WHERE id = ANY(ARRAY['606d2347-49ef-4dcd-8fbb-c7e0793ede4c'::uuid, 'e5919f2c-47fd-4dce-95ca-1c1837fd5516'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'rooms', count(*)::int FROM public.rooms WHERE id = ANY(ARRAY['51d1095a-29f8-4247-b1af-4e939aa05223'::uuid, 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'instructors', count(*)::int FROM public.instructors WHERE id = ANY(ARRAY['8180a421-a5db-4865-80cb-78993337e080'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'members', count(*)::int FROM public.members WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'profiles', count(*)::int FROM public.profiles WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'before', 'auth.users', count(*)::int FROM auth.users WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
-- SELECT preview counts before DELETE for every reviewed table.
SELECT phase, table_name, row_count FROM qa_cleanup_counts WHERE phase = 'before' ORDER BY array_position(ARRAY['notification_logs','attendance_records','package_requests','receipts','payments','member_plans','credit_transactions','bookings','classes','plans','program_types','rooms','instructors','members','profiles','auth.users'], table_name);
DO $$
DECLARE
  mismatch text;
  unsafe_count integer;
BEGIN
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'notification_logs') <> 2 THEN
    RAISE EXCEPTION 'Count mismatch for notification_logs: expected 2, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'notification_logs');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'attendance_records') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for attendance_records: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'attendance_records');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'package_requests') <> 1 THEN
    RAISE EXCEPTION 'Count mismatch for package_requests: expected 1, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'package_requests');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'receipts') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for receipts: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'receipts');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'payments') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for payments: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'payments');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'member_plans') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for member_plans: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'member_plans');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'credit_transactions') <> 7 THEN
    RAISE EXCEPTION 'Count mismatch for credit_transactions: expected 7, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'credit_transactions');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'bookings') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for bookings: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'bookings');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'classes') <> 4 THEN
    RAISE EXCEPTION 'Count mismatch for classes: expected 4, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'classes');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'plans') <> 3 THEN
    RAISE EXCEPTION 'Count mismatch for plans: expected 3, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'plans');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'program_types') <> 2 THEN
    RAISE EXCEPTION 'Count mismatch for program_types: expected 2, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'program_types');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'rooms') <> 2 THEN
    RAISE EXCEPTION 'Count mismatch for rooms: expected 2, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'rooms');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'instructors') <> 1 THEN
    RAISE EXCEPTION 'Count mismatch for instructors: expected 1, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'instructors');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'members') <> 5 THEN
    RAISE EXCEPTION 'Count mismatch for members: expected 5, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'members');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'profiles') <> 5 THEN
    RAISE EXCEPTION 'Count mismatch for profiles: expected 5, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'profiles');
  END IF;
  IF (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'auth.users') <> 5 THEN
    RAISE EXCEPTION 'Count mismatch for auth.users: expected 5, got %', (SELECT row_count FROM qa_cleanup_counts WHERE phase = 'before' AND table_name = 'auth.users');
  END IF;

  -- Direct QA text/email checks for rows that carry their own QA marker.
  SELECT string_agg(table_name || ':' || id::text, ', ') INTO mismatch
  FROM qa_cleanup_expected e
  WHERE e.direct_qa_text
    AND NOT EXISTS (
      SELECT 1
      FROM (
        SELECT 'notification_logs' table_name, n.id, to_jsonb(n)::text body FROM public.notification_logs n WHERE n.id = e.id UNION ALL
        SELECT 'package_requests', pr.id, to_jsonb(pr)::text FROM public.package_requests pr WHERE pr.id = e.id UNION ALL
        SELECT 'receipts', r.id, to_jsonb(r)::text FROM public.receipts r WHERE r.id = e.id UNION ALL
        SELECT 'payments', p.id, to_jsonb(p)::text FROM public.payments p WHERE p.id = e.id UNION ALL
        SELECT 'credit_transactions', ct.id, to_jsonb(ct)::text FROM public.credit_transactions ct WHERE ct.id = e.id UNION ALL
        SELECT 'classes', c.id, to_jsonb(c)::text FROM public.classes c WHERE c.id = e.id UNION ALL
        SELECT 'plans', pl.id, to_jsonb(pl)::text FROM public.plans pl WHERE pl.id = e.id UNION ALL
        SELECT 'program_types', pt.id, to_jsonb(pt)::text FROM public.program_types pt WHERE pt.id = e.id UNION ALL
        SELECT 'rooms', rm.id, to_jsonb(rm)::text FROM public.rooms rm WHERE rm.id = e.id UNION ALL
        SELECT 'instructors', i.id, to_jsonb(i)::text FROM public.instructors i WHERE i.id = e.id UNION ALL
        SELECT 'members', m.id, to_jsonb(m)::text FROM public.members m WHERE m.id = e.id UNION ALL
        SELECT 'profiles', pf.id, to_jsonb(pf)::text FROM public.profiles pf WHERE pf.id = e.id UNION ALL
        SELECT 'auth.users', au.id, to_jsonb(au)::text FROM auth.users au WHERE au.id = e.id
      ) rowcheck
      WHERE rowcheck.table_name = e.table_name
        AND rowcheck.id = e.id
        AND (
          rowcheck.body ILIKE '%QA_PRE_RELEASE_%'
          OR rowcheck.body ILIKE '%QA_PRE_RELEASE_RERUN_%'
          OR rowcheck.body ILIKE '%QA_PRE_RELEASE_FINAL_%'
          OR rowcheck.body ILIKE '%qa-pre-release-%'
          OR rowcheck.body ILIKE '%qa_pre_release_%'
          OR rowcheck.body ILIKE '%qa-pre-release-rerun-%'
          OR rowcheck.body ILIKE '%qa_pre_release_rerun_%'
        )
    );
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe direct QA rows without tag/email marker: %', mismatch;
  END IF;

  -- Dependency-only rows must belong to reviewed QA member/class/booking/plan IDs.
  SELECT count(*) INTO unsafe_count
  FROM public.attendance_records a
  JOIN qa_cleanup_expected e ON e.table_name = 'attendance_records' AND e.id = a.id
  WHERE NOT (
    a.booking_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'bookings')
    OR a.member_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'members')
    OR a.class_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'classes')
  );
  IF unsafe_count <> 0 THEN RAISE EXCEPTION 'Unsafe attendance dependency rows: %', unsafe_count; END IF;

  SELECT count(*) INTO unsafe_count
  FROM public.member_plans mp
  JOIN qa_cleanup_expected e ON e.table_name = 'member_plans' AND e.id = mp.id
  WHERE NOT (
    mp.member_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'members')
    OR mp.plan_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'plans')
  );
  IF unsafe_count <> 0 THEN RAISE EXCEPTION 'Unsafe member_plan dependency rows: %', unsafe_count; END IF;

  SELECT count(*) INTO unsafe_count
  FROM public.credit_transactions ct
  JOIN qa_cleanup_expected e ON e.table_name = 'credit_transactions' AND e.id = ct.id
  WHERE NOT (
    ct.member_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'members')
    OR to_jsonb(ct)::text ILIKE '%QA_PRE_RELEASE_%'
    OR to_jsonb(ct)::text ILIKE '%QA_PRE_RELEASE_RERUN_%'
    OR to_jsonb(ct)::text ILIKE '%QA_PRE_RELEASE_FINAL_%'
    OR to_jsonb(ct)::text ILIKE '%qa_pre_release_%'
  );
  IF unsafe_count <> 0 THEN RAISE EXCEPTION 'Unsafe credit_transaction dependency rows: %', unsafe_count; END IF;

  SELECT count(*) INTO unsafe_count
  FROM public.bookings b
  JOIN qa_cleanup_expected e ON e.table_name = 'bookings' AND e.id = b.id
  WHERE NOT (
    b.member_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'members')
    OR b.class_id IN (SELECT id FROM qa_cleanup_expected WHERE table_name = 'classes')
  );
  IF unsafe_count <> 0 THEN RAISE EXCEPTION 'Unsafe booking dependency rows: %', unsafe_count; END IF;
END $$;
CREATE TEMP TABLE qa_cleanup_deleted (table_name text NOT NULL, deleted_count integer NOT NULL);
WITH deleted AS (DELETE FROM public.notification_logs WHERE id = ANY(ARRAY['5f934f73-742c-4a93-8cb3-8b51044aaca4'::uuid, '8c4a02cb-634a-425b-aff6-120f9d0b084f'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'notification_logs', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.attendance_records WHERE id = ANY(ARRAY['58d38722-6216-4bab-9395-4a69e1c83e5c'::uuid, '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b'::uuid, 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'attendance_records', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.package_requests WHERE id = ANY(ARRAY['d96c697d-55f5-46a9-bcb5-dea18adea9d0'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'package_requests', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.receipts WHERE id = ANY(ARRAY['01dae582-1beb-40ec-83a9-214a3671778a'::uuid, '428a6702-dc16-48d9-a0de-5c5222fbbd6f'::uuid, 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'receipts', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.payments WHERE id = ANY(ARRAY['24a1076d-64db-48fc-802f-fd36fb375ebf'::uuid, 'a1d764c7-fdac-451b-823a-09c972833059'::uuid, 'f07888d0-9760-4647-a883-dd1ce9b70bae'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'payments', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.member_plans WHERE id = ANY(ARRAY['657c7463-9b2d-4160-8250-2fa182f1c44d'::uuid, '9ba2b6f1-1032-47ac-8637-6db45ea09203'::uuid, 'a3e21528-6c82-4a97-b8bf-0eca630f7630'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'member_plans', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.credit_transactions WHERE id = ANY(ARRAY['26127ef0-784b-46cf-b106-e773423a5c7a'::uuid, '8066a0ac-6095-4f45-93ba-3958bebe7697'::uuid, '877dd3c5-6180-41b1-8334-a6c2af55138a'::uuid, 'a94d8106-d693-46bb-845e-bf8de37c22b6'::uuid, 'c55e77bb-1f61-4681-9dde-7f520b153b9b'::uuid, 'c9af4af5-48fd-44ad-8adf-f882599be0f0'::uuid, 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'credit_transactions', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.bookings WHERE id = ANY(ARRAY['1b363f8f-ee43-48ce-aa2d-75f1a1691f27'::uuid, '2427d254-d48a-422d-919a-44bca3d42996'::uuid, 'b7a75532-504e-417e-b80f-062535c08798'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'bookings', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.classes WHERE id = ANY(ARRAY['70f70337-aec5-44e1-b458-fdc6257acf29'::uuid, '827e08e3-e592-4384-93d4-53fd2e33cf2f'::uuid, '82eb7bd6-e926-4195-9695-4f1b1063dbaa'::uuid, 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'classes', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.plans WHERE id = ANY(ARRAY['258b8ebd-9909-4a63-b0d5-e26d9376c472'::uuid, '95d247d9-03a6-410e-b83d-8e119b846dd5'::uuid, 'e9f966af-0540-4e1f-bb80-87a1c242a5ca'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'plans', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.program_types WHERE id = ANY(ARRAY['606d2347-49ef-4dcd-8fbb-c7e0793ede4c'::uuid, 'e5919f2c-47fd-4dce-95ca-1c1837fd5516'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'program_types', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.rooms WHERE id = ANY(ARRAY['51d1095a-29f8-4247-b1af-4e939aa05223'::uuid, 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'rooms', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.instructors WHERE id = ANY(ARRAY['8180a421-a5db-4865-80cb-78993337e080'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'instructors', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.members WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'members', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM public.profiles WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'profiles', count(*)::int FROM deleted;
WITH deleted AS (DELETE FROM auth.users WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]) RETURNING id)
INSERT INTO qa_cleanup_deleted SELECT 'auth.users', count(*)::int FROM deleted;
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'notification_logs', count(*)::int FROM public.notification_logs WHERE id = ANY(ARRAY['5f934f73-742c-4a93-8cb3-8b51044aaca4'::uuid, '8c4a02cb-634a-425b-aff6-120f9d0b084f'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'attendance_records', count(*)::int FROM public.attendance_records WHERE id = ANY(ARRAY['58d38722-6216-4bab-9395-4a69e1c83e5c'::uuid, '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b'::uuid, 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'package_requests', count(*)::int FROM public.package_requests WHERE id = ANY(ARRAY['d96c697d-55f5-46a9-bcb5-dea18adea9d0'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'receipts', count(*)::int FROM public.receipts WHERE id = ANY(ARRAY['01dae582-1beb-40ec-83a9-214a3671778a'::uuid, '428a6702-dc16-48d9-a0de-5c5222fbbd6f'::uuid, 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'payments', count(*)::int FROM public.payments WHERE id = ANY(ARRAY['24a1076d-64db-48fc-802f-fd36fb375ebf'::uuid, 'a1d764c7-fdac-451b-823a-09c972833059'::uuid, 'f07888d0-9760-4647-a883-dd1ce9b70bae'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'member_plans', count(*)::int FROM public.member_plans WHERE id = ANY(ARRAY['657c7463-9b2d-4160-8250-2fa182f1c44d'::uuid, '9ba2b6f1-1032-47ac-8637-6db45ea09203'::uuid, 'a3e21528-6c82-4a97-b8bf-0eca630f7630'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'credit_transactions', count(*)::int FROM public.credit_transactions WHERE id = ANY(ARRAY['26127ef0-784b-46cf-b106-e773423a5c7a'::uuid, '8066a0ac-6095-4f45-93ba-3958bebe7697'::uuid, '877dd3c5-6180-41b1-8334-a6c2af55138a'::uuid, 'a94d8106-d693-46bb-845e-bf8de37c22b6'::uuid, 'c55e77bb-1f61-4681-9dde-7f520b153b9b'::uuid, 'c9af4af5-48fd-44ad-8adf-f882599be0f0'::uuid, 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'bookings', count(*)::int FROM public.bookings WHERE id = ANY(ARRAY['1b363f8f-ee43-48ce-aa2d-75f1a1691f27'::uuid, '2427d254-d48a-422d-919a-44bca3d42996'::uuid, 'b7a75532-504e-417e-b80f-062535c08798'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'classes', count(*)::int FROM public.classes WHERE id = ANY(ARRAY['70f70337-aec5-44e1-b458-fdc6257acf29'::uuid, '827e08e3-e592-4384-93d4-53fd2e33cf2f'::uuid, '82eb7bd6-e926-4195-9695-4f1b1063dbaa'::uuid, 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'plans', count(*)::int FROM public.plans WHERE id = ANY(ARRAY['258b8ebd-9909-4a63-b0d5-e26d9376c472'::uuid, '95d247d9-03a6-410e-b83d-8e119b846dd5'::uuid, 'e9f966af-0540-4e1f-bb80-87a1c242a5ca'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'program_types', count(*)::int FROM public.program_types WHERE id = ANY(ARRAY['606d2347-49ef-4dcd-8fbb-c7e0793ede4c'::uuid, 'e5919f2c-47fd-4dce-95ca-1c1837fd5516'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'rooms', count(*)::int FROM public.rooms WHERE id = ANY(ARRAY['51d1095a-29f8-4247-b1af-4e939aa05223'::uuid, 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'instructors', count(*)::int FROM public.instructors WHERE id = ANY(ARRAY['8180a421-a5db-4865-80cb-78993337e080'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'members', count(*)::int FROM public.members WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'profiles', count(*)::int FROM public.profiles WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
INSERT INTO qa_cleanup_counts SELECT 'after_target_ids', 'auth.users', count(*)::int FROM auth.users WHERE id = ANY(ARRAY['1dbce5ae-0cab-4a55-8015-39391131a141'::uuid, '5ee58596-2e4f-440e-b15b-3899f67a67b5'::uuid, '718f2318-c3e0-404b-8283-e1697d3e4c31'::uuid, 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c'::uuid, 'ec526875-a620-4808-9fbc-02ca0ae98185'::uuid]);
DO $$
DECLARE
  mismatch text;
BEGIN
  SELECT string_agg(d.table_name || ': deleted ' || d.deleted_count::text || ' expected ' || c.row_count::text, ', ') INTO mismatch
  FROM qa_cleanup_deleted d
  JOIN qa_cleanup_counts c ON c.phase = 'before' AND c.table_name = d.table_name
  WHERE d.deleted_count <> c.row_count;
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Delete count mismatch: %', mismatch;
  END IF;

  SELECT string_agg(table_name || ': remaining target ids ' || row_count::text, ', ') INTO mismatch
  FROM qa_cleanup_counts
  WHERE phase = 'after_target_ids' AND row_count <> 0;
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'Target ids still remain after delete: %', mismatch;
  END IF;
END $$;
CREATE TEMP TABLE qa_cleanup_remaining_scan (table_name text NOT NULL, row_count integer NOT NULL);
INSERT INTO qa_cleanup_remaining_scan SELECT 'notification_logs', count(*)::int FROM public.notification_logs t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'attendance_records', count(*)::int FROM public.attendance_records t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'package_requests', count(*)::int FROM public.package_requests t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'receipts', count(*)::int FROM public.receipts t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'payments', count(*)::int FROM public.payments t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'member_plans', count(*)::int FROM public.member_plans t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'credit_transactions', count(*)::int FROM public.credit_transactions t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'bookings', count(*)::int FROM public.bookings t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'classes', count(*)::int FROM public.classes t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'plans', count(*)::int FROM public.plans t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'program_types', count(*)::int FROM public.program_types t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'rooms', count(*)::int FROM public.rooms t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'instructors', count(*)::int FROM public.instructors t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'members', count(*)::int FROM public.members t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'profiles', count(*)::int FROM public.profiles t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%');
INSERT INTO qa_cleanup_remaining_scan SELECT 'auth.users', count(*)::int FROM auth.users t WHERE (to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_RERUN_%' OR to_jsonb(t)::text ILIKE '%QA_PRE_RELEASE_FINAL_%' OR to_jsonb(t)::text ILIKE '%qa_pre_release_%' OR to_jsonb(t)::text ILIKE '%qa-pre-release-%') OR t.email = ANY(ARRAY['qa_pre_release_20260624t210916z.admin@example.com', 'qa_pre_release_20260624t210916z.instructor@example.com', 'qa_pre_release_20260624t210916z.member@example.com', 'qa_pre_release_20260624t210916z.nocredits@example.com', 'qa_pre_release_20260624t210916z.othermember@example.com']);
DO $$
DECLARE
  mismatch text;
BEGIN
  SELECT string_agg(table_name || ': ' || row_count::text, ', ') INTO mismatch
  FROM qa_cleanup_remaining_scan
  WHERE row_count <> 0;
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'QA tag/email rows still remain after cleanup: %', mismatch;
  END IF;
END $$;
SELECT 'deleted' AS phase, table_name, deleted_count AS row_count FROM qa_cleanup_deleted ORDER BY array_position(ARRAY['notification_logs','attendance_records','package_requests','receipts','payments','member_plans','credit_transactions','bookings','classes','plans','program_types','rooms','instructors','members','profiles','auth.users'], table_name);
SELECT 'remaining_scan' AS phase, table_name, row_count FROM qa_cleanup_remaining_scan ORDER BY array_position(ARRAY['notification_logs','attendance_records','package_requests','receipts','payments','member_plans','credit_transactions','bookings','classes','plans','program_types','rooms','instructors','members','profiles','auth.users'], table_name);
COMMIT;
