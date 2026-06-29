-- FINAL QA CLEANUP PREVIEW ONLY. DO NOT RUN WITHOUT APPROVAL.
-- Project: banjmspemvzrqckajvwo
-- Generated: 2026-06-24T23:21:34.250Z
-- Tags: QA_PRE_RELEASE_, QA_PRE_RELEASE_RERUN_, QA_PRE_RELEASE_FINAL_
-- DELETE statements are commented out intentionally.
BEGIN;

-- public.notification_logs: 2 targeted row(s)
SELECT * FROM public.notification_logs WHERE id IN ('5f934f73-742c-4a93-8cb3-8b51044aaca4', '8c4a02cb-634a-425b-aff6-120f9d0b084f');
-- DELETE FROM public.notification_logs WHERE id IN ('5f934f73-742c-4a93-8cb3-8b51044aaca4', '8c4a02cb-634a-425b-aff6-120f9d0b084f');

-- public.attendance_records: 3 targeted row(s)
SELECT * FROM public.attendance_records WHERE id IN ('58d38722-6216-4bab-9395-4a69e1c83e5c', '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b', 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c');
-- DELETE FROM public.attendance_records WHERE id IN ('58d38722-6216-4bab-9395-4a69e1c83e5c', '8fc9115b-771e-43c5-b9ff-5d87ba0efe4b', 'ccd8a78c-e7dd-4ad4-8a2a-760a76bbb64c');

-- public.package_requests: 1 targeted row(s)
SELECT * FROM public.package_requests WHERE id IN ('d96c697d-55f5-46a9-bcb5-dea18adea9d0');
-- DELETE FROM public.package_requests WHERE id IN ('d96c697d-55f5-46a9-bcb5-dea18adea9d0');

-- public.receipts: 3 targeted row(s)
SELECT * FROM public.receipts WHERE id IN ('01dae582-1beb-40ec-83a9-214a3671778a', '428a6702-dc16-48d9-a0de-5c5222fbbd6f', 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5');
-- DELETE FROM public.receipts WHERE id IN ('01dae582-1beb-40ec-83a9-214a3671778a', '428a6702-dc16-48d9-a0de-5c5222fbbd6f', 'eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5');

-- public.payments: 3 targeted row(s)
SELECT * FROM public.payments WHERE id IN ('24a1076d-64db-48fc-802f-fd36fb375ebf', 'a1d764c7-fdac-451b-823a-09c972833059', 'f07888d0-9760-4647-a883-dd1ce9b70bae');
-- DELETE FROM public.payments WHERE id IN ('24a1076d-64db-48fc-802f-fd36fb375ebf', 'a1d764c7-fdac-451b-823a-09c972833059', 'f07888d0-9760-4647-a883-dd1ce9b70bae');

-- public.member_plans: 3 targeted row(s)
SELECT * FROM public.member_plans WHERE id IN ('657c7463-9b2d-4160-8250-2fa182f1c44d', '9ba2b6f1-1032-47ac-8637-6db45ea09203', 'a3e21528-6c82-4a97-b8bf-0eca630f7630');
-- DELETE FROM public.member_plans WHERE id IN ('657c7463-9b2d-4160-8250-2fa182f1c44d', '9ba2b6f1-1032-47ac-8637-6db45ea09203', 'a3e21528-6c82-4a97-b8bf-0eca630f7630');

-- public.credit_transactions: 7 targeted row(s)
SELECT * FROM public.credit_transactions WHERE id IN ('26127ef0-784b-46cf-b106-e773423a5c7a', '8066a0ac-6095-4f45-93ba-3958bebe7697', '877dd3c5-6180-41b1-8334-a6c2af55138a', 'a94d8106-d693-46bb-845e-bf8de37c22b6', 'c55e77bb-1f61-4681-9dde-7f520b153b9b', 'c9af4af5-48fd-44ad-8adf-f882599be0f0', 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c');
-- DELETE FROM public.credit_transactions WHERE id IN ('26127ef0-784b-46cf-b106-e773423a5c7a', '8066a0ac-6095-4f45-93ba-3958bebe7697', '877dd3c5-6180-41b1-8334-a6c2af55138a', 'a94d8106-d693-46bb-845e-bf8de37c22b6', 'c55e77bb-1f61-4681-9dde-7f520b153b9b', 'c9af4af5-48fd-44ad-8adf-f882599be0f0', 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c');

-- public.bookings: 3 targeted row(s)
SELECT * FROM public.bookings WHERE id IN ('1b363f8f-ee43-48ce-aa2d-75f1a1691f27', '2427d254-d48a-422d-919a-44bca3d42996', 'b7a75532-504e-417e-b80f-062535c08798');
-- DELETE FROM public.bookings WHERE id IN ('1b363f8f-ee43-48ce-aa2d-75f1a1691f27', '2427d254-d48a-422d-919a-44bca3d42996', 'b7a75532-504e-417e-b80f-062535c08798');

-- public.classes: 4 targeted row(s)
SELECT * FROM public.classes WHERE id IN ('70f70337-aec5-44e1-b458-fdc6257acf29', '827e08e3-e592-4384-93d4-53fd2e33cf2f', '82eb7bd6-e926-4195-9695-4f1b1063dbaa', 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e');
-- DELETE FROM public.classes WHERE id IN ('70f70337-aec5-44e1-b458-fdc6257acf29', '827e08e3-e592-4384-93d4-53fd2e33cf2f', '82eb7bd6-e926-4195-9695-4f1b1063dbaa', 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e');

-- public.plans: 3 targeted row(s)
SELECT * FROM public.plans WHERE id IN ('258b8ebd-9909-4a63-b0d5-e26d9376c472', '95d247d9-03a6-410e-b83d-8e119b846dd5', 'e9f966af-0540-4e1f-bb80-87a1c242a5ca');
-- DELETE FROM public.plans WHERE id IN ('258b8ebd-9909-4a63-b0d5-e26d9376c472', '95d247d9-03a6-410e-b83d-8e119b846dd5', 'e9f966af-0540-4e1f-bb80-87a1c242a5ca');

-- public.program_types: 2 targeted row(s)
SELECT * FROM public.program_types WHERE id IN ('606d2347-49ef-4dcd-8fbb-c7e0793ede4c', 'e5919f2c-47fd-4dce-95ca-1c1837fd5516');
-- DELETE FROM public.program_types WHERE id IN ('606d2347-49ef-4dcd-8fbb-c7e0793ede4c', 'e5919f2c-47fd-4dce-95ca-1c1837fd5516');

-- public.rooms: 2 targeted row(s)
SELECT * FROM public.rooms WHERE id IN ('51d1095a-29f8-4247-b1af-4e939aa05223', 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4');
-- DELETE FROM public.rooms WHERE id IN ('51d1095a-29f8-4247-b1af-4e939aa05223', 'a8fbf30a-ad37-49b9-918e-f9330d9a08b4');

-- public.instructors: 1 targeted row(s)
SELECT * FROM public.instructors WHERE id IN ('8180a421-a5db-4865-80cb-78993337e080');
-- DELETE FROM public.instructors WHERE id IN ('8180a421-a5db-4865-80cb-78993337e080');

-- public.members: 5 targeted row(s)
SELECT * FROM public.members WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');
-- DELETE FROM public.members WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');

-- public.profiles: 5 targeted row(s)
SELECT * FROM public.profiles WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');
-- DELETE FROM public.profiles WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');

-- auth.users: 5 targeted row(s)
SELECT id, email, created_at, last_sign_in_at FROM auth.users WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');
-- DELETE FROM auth.users WHERE id IN ('1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185');

-- COMMIT; -- intentionally disabled until owner approval
ROLLBACK;
