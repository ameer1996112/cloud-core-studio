BEGIN;

-- Preview only for temporary member sweep cleanup.
-- Do not COMMIT until explicitly approved.

select 'attendance_records' as table_name, id, booking_id, class_id, status
from public.attendance_records
where id = '6bbb8812-0319-4caf-b959-080225434642';

select 'bookings' as table_name, id, member_id, class_id, status, credit_cost
from public.bookings
where id = '691a2f1f-82cc-41d6-888e-7cf6949ac45c';

select 'receipts' as table_name, id, payment_id, member_id, receipt_number, amount, currency
from public.receipts
where id = '362b425b-917e-49ed-b9c1-d173428152a2';

select 'credit_transactions' as table_name, id, member_id, amount_delta, reason, related_booking_id
from public.credit_transactions
where id in (
  '0c3b3320-354d-4a18-ad19-ed379b8f783b',
  '4435850a-c0bc-4e4c-b9e8-c223065b50ef',
  'ecba3d87-e40c-4499-a7eb-62f82799c238'
)
order by created_at asc;

select 'payments' as table_name, id, member_id, member_plan_id, plan_id, status, method, amount, currency
from public.payments
where id = '0520e649-e22d-4ae8-ad89-7941c1d4c051';

select 'member_plans' as table_name, id, member_id, plan_id, status, credits_granted, notes
from public.member_plans
where id = '64802333-b6bd-46bd-95d7-f2df06de0f7d';

select 'member_plans' as table_name, id, member_id, plan_id, status, credits_granted, notes
from public.member_plans
where id = 'd3aa59e1-78dc-4a96-993b-34545dc09db1';

select 'members' as table_name, id, email, name, status
from public.members
where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);

select 'profiles' as table_name, id, role
from public.profiles
where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);

select 'auth.users' as table_name, id, email
from auth.users
where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);

-- Cleanup order
delete from public.attendance_records where id = '6bbb8812-0319-4caf-b959-080225434642';
delete from public.bookings where id = '691a2f1f-82cc-41d6-888e-7cf6949ac45c';
delete from public.receipts where id = '362b425b-917e-49ed-b9c1-d173428152a2';
delete from public.credit_transactions
where id in (
  '0c3b3320-354d-4a18-ad19-ed379b8f783b',
  '4435850a-c0bc-4e4c-b9e8-c223065b50ef',
  'ecba3d87-e40c-4499-a7eb-62f82799c238'
);
delete from public.payments where id = '0520e649-e22d-4ae8-ad89-7941c1d4c051';
delete from public.member_plans where id = '64802333-b6bd-46bd-95d7-f2df06de0f7d';
delete from public.member_plans where id = 'd3aa59e1-78dc-4a96-993b-34545dc09db1';
delete from public.members where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);
delete from public.profiles where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);
delete from auth.users where id in (
  '95dff3d3-6cc5-428d-a29c-72d977f82865',
  'f458fbb3-91f0-4612-9713-673429b4428b'
);

ROLLBACK;
