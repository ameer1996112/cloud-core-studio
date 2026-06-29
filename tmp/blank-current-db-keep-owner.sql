begin;

do $$
declare
  owner_id uuid;
  owner_email text := 'ameer_1996112@hotmail.com';
begin
  select u.id
    into owner_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(owner_email)
    and p.role = 'admin';

  if owner_id is null then
    raise exception 'Owner admin % was not found. Aborting blank database cleanup.', owner_email;
  end if;

  raise notice 'Keeping owner admin: % (%)', owner_email, owner_id;
end $$;

delete from public.notification_logs;
delete from public.attendance_records;
delete from public.account_deletion_requests;
delete from public.package_requests;
delete from public.receipts;
delete from public.provider_events;
delete from public.payments;
delete from public.member_plans;
delete from public.credit_transactions;
delete from public.waitlist_entries;
delete from public.bookings;
delete from public.recurring_class_rules;
delete from public.classes;
delete from public.class_templates;
delete from public.plans;
delete from public.program_types;
delete from public.rooms;
delete from public.instructors;
delete from public.member_notes;
delete from public.admin_activity_log;
delete from public.media_assets;

delete from public.members
where id <> (
  select id from auth.users where lower(email) = lower('ameer_1996112@hotmail.com')
);

delete from public.profiles
where id <> (
  select id from auth.users where lower(email) = lower('ameer_1996112@hotmail.com')
);

delete from auth.users
where lower(email) <> lower('ameer_1996112@hotmail.com');

do $$
declare
  bad_count int;
  owner_count int;
begin
  select count(*) into owner_count
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.members m on m.id = u.id
  where lower(u.email) = lower('ameer_1996112@hotmail.com')
    and p.role = 'admin';

  if owner_count <> 1 then
    raise exception 'Expected exactly one preserved owner admin, found %.', owner_count;
  end if;

  select count(*) into bad_count
  from (
    select id from public.notification_logs
    union all select id from public.attendance_records
    union all select id from public.account_deletion_requests
    union all select id from public.package_requests
    union all select id from public.receipts
    union all select id from public.provider_events
    union all select id from public.payments
    union all select id from public.member_plans
    union all select id from public.credit_transactions
    union all select id from public.waitlist_entries
    union all select id from public.bookings
    union all select id from public.recurring_class_rules
    union all select id from public.classes
    union all select id from public.class_templates
    union all select id from public.plans
    union all select id from public.program_types
    union all select id from public.rooms
    union all select id from public.instructors
    union all select id from public.member_notes
    union all select id from public.admin_activity_log
    union all select id from public.media_assets
  ) remaining;

  if bad_count <> 0 then
    raise exception 'Expected blank operational tables, found % remaining rows.', bad_count;
  end if;

  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Expected profiles count 1.';
  end if;

  if (select count(*) from public.members) <> 1 then
    raise exception 'Expected members count 1.';
  end if;

  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected auth.users count 1.';
  end if;
end $$;

commit;
