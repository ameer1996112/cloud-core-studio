-- PREVIEW ONLY. DO NOT RUN WITHOUT APPROVAL.
-- Project: banjmspemvzrqckajvwo
-- QA tag: QA_PRE_RELEASE_20260624T210916Z
BEGIN;
DELETE FROM public.notification_logs WHERE id IN ('5f934f73-742c-4a93-8cb3-8b51044aaca4');
DELETE FROM public.attendance_records WHERE id IN ('8fc9115b-771e-43c5-b9ff-5d87ba0efe4b', '58d38722-6216-4bab-9395-4a69e1c83e5c');
DELETE FROM public.package_requests WHERE id IN ('d96c697d-55f5-46a9-bcb5-dea18adea9d0');
DELETE FROM public.receipts WHERE id IN ('eb1c2c58-ea4a-4e4a-8b0f-f5178b8a59a5', '01dae582-1beb-40ec-83a9-214a3671778a');
DELETE FROM public.payments WHERE id IN ('f07888d0-9760-4647-a883-dd1ce9b70bae', '24a1076d-64db-48fc-802f-fd36fb375ebf');
DELETE FROM public.member_plans WHERE id IN ('a3e21528-6c82-4a97-b8bf-0eca630f7630', '9ba2b6f1-1032-47ac-8637-6db45ea09203');
DELETE FROM public.credit_transactions WHERE id IN ('26127ef0-784b-46cf-b106-e773423a5c7a', 'a94d8106-d693-46bb-845e-bf8de37c22b6', 'c55e77bb-1f61-4681-9dde-7f520b153b9b', '877dd3c5-6180-41b1-8334-a6c2af55138a', 'd950d9ff-2b36-4ea4-85a0-f69c7edca06c');
DELETE FROM public.bookings WHERE id IN ('2427d254-d48a-422d-919a-44bca3d42996', '1b363f8f-ee43-48ce-aa2d-75f1a1691f27');
DELETE FROM public.classes WHERE id IN ('82eb7bd6-e926-4195-9695-4f1b1063dbaa', '70f70337-aec5-44e1-b458-fdc6257acf29', 'cc6639d9-8f87-49fe-8ee6-45c6262dda5e');
DELETE FROM public.plans WHERE id IN ('258b8ebd-9909-4a63-b0d5-e26d9376c472', 'e9f966af-0540-4e1f-bb80-87a1c242a5ca');
DELETE FROM public.program_types WHERE id IN ('606d2347-49ef-4dcd-8fbb-c7e0793ede4c');
DELETE FROM public.rooms WHERE id IN ('51d1095a-29f8-4247-b1af-4e939aa05223');
DELETE FROM public.instructors WHERE id IN ('8180a421-a5db-4865-80cb-78993337e080');
DELETE FROM public.members WHERE id IN ('c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', 'ec526875-a620-4808-9fbc-02ca0ae98185', '1dbce5ae-0cab-4a55-8015-39391131a141', '5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31');
DELETE FROM public.profiles WHERE id IN ('5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', '1dbce5ae-0cab-4a55-8015-39391131a141', 'ec526875-a620-4808-9fbc-02ca0ae98185');
DELETE FROM auth.users WHERE id IN ('5ee58596-2e4f-440e-b15b-3899f67a67b5', '718f2318-c3e0-404b-8283-e1697d3e4c31', 'c4fc6ecc-cf7a-4025-a3c2-d7f049eed52c', '1dbce5ae-0cab-4a55-8015-39391131a141', 'ec526875-a620-4808-9fbc-02ca0ae98185');
-- COMMIT; -- intentionally commented until approved
ROLLBACK;
