with patterns(pattern) as (
  values
    ('QA_TEST'),
    ('QA_PRE_RELEASE_AUTH_FIX'),
    ('QA_PRE_RELEASE_AUTH_FIX_RETRY'),
    ('E2E')
),
scan as (
  select 'auth.users' as table_name, id::text, email as marker
  from auth.users
  where exists (select 1 from patterns p where email ilike '%' || p.pattern || '%')

  union all
  select 'profiles', id::text, role::text
  from public.profiles
  where id in (
    select id from auth.users
    where exists (select 1 from patterns p where email ilike '%' || p.pattern || '%')
  )

  union all
  select 'members', id::text, concat_ws(' | ', name, email)
  from public.members
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
       or coalesce(email, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'instructors', id::text, name
  from public.instructors
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'rooms', id::text, name
  from public.rooms
  where exists (select 1 from patterns p where coalesce(name, '') ilike '%' || p.pattern || '%')

  union all
  select 'program_types', id::text, concat_ws(' | ', name_en, name_he, name_ar, slug)
  from public.program_types
  where exists (
    select 1 from patterns p
    where coalesce(name_en, '') ilike '%' || p.pattern || '%'
       or coalesce(name_he, '') ilike '%' || p.pattern || '%'
       or coalesce(name_ar, '') ilike '%' || p.pattern || '%'
       or coalesce(slug, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'classes', id::text, title
  from public.classes
  where exists (
    select 1 from patterns p
    where coalesce(title, '') ilike '%' || p.pattern || '%'
       or coalesce(room, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'plans', id::text, concat_ws(' | ', name, description)
  from public.plans
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
       or coalesce(description, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'payments', id::text, concat_ws(' | ', reference, notes)
  from public.payments
  where exists (
    select 1 from patterns p
    where coalesce(reference, '') ilike '%' || p.pattern || '%'
       or coalesce(notes, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'receipts', id::text, concat_ws(' | ', receipt_number, member_name_snapshot)
  from public.receipts
  where exists (
    select 1 from patterns p
    where coalesce(receipt_number, '') ilike '%' || p.pattern || '%'
       or coalesce(member_name_snapshot, '') ilike '%' || p.pattern || '%'
  )

  union all
  select 'credit_transactions', id::text, reason
  from public.credit_transactions
  where exists (select 1 from patterns p where coalesce(reason, '') ilike '%' || p.pattern || '%')

  union all
  select 'package_requests', id::text, message_text
  from public.package_requests
  where exists (select 1 from patterns p where coalesce(message_text, '') ilike '%' || p.pattern || '%')

  union all
  select 'notification_logs', id::text, concat_ws(' | ', template_key, subject, generated_text)
  from public.notification_logs
  where exists (
    select 1 from patterns p
    where coalesce(template_key, '') ilike '%' || p.pattern || '%'
       or coalesce(subject, '') ilike '%' || p.pattern || '%'
       or coalesce(generated_text, '') ilike '%' || p.pattern || '%'
  )
)
select table_name, count(*)::int as count
from scan
group by table_name
order by table_name;

with patterns(pattern) as (
  values
    ('QA_TEST'),
    ('QA_PRE_RELEASE_AUTH_FIX'),
    ('QA_PRE_RELEASE_AUTH_FIX_RETRY'),
    ('E2E')
),
scan as (
  select 'auth.users' as table_name, id::text, email as marker
  from auth.users
  where exists (select 1 from patterns p where email ilike '%' || p.pattern || '%')
  union all
  select 'members', id::text, concat_ws(' | ', name, email)
  from public.members
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
       or coalesce(email, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'instructors', id::text, name
  from public.instructors
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'rooms', id::text, name
  from public.rooms
  where exists (select 1 from patterns p where coalesce(name, '') ilike '%' || p.pattern || '%')
  union all
  select 'program_types', id::text, concat_ws(' | ', name_en, name_he, name_ar, slug)
  from public.program_types
  where exists (
    select 1 from patterns p
    where coalesce(name_en, '') ilike '%' || p.pattern || '%'
       or coalesce(name_he, '') ilike '%' || p.pattern || '%'
       or coalesce(name_ar, '') ilike '%' || p.pattern || '%'
       or coalesce(slug, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'classes', id::text, title
  from public.classes
  where exists (
    select 1 from patterns p
    where coalesce(title, '') ilike '%' || p.pattern || '%'
       or coalesce(room, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'plans', id::text, concat_ws(' | ', name, description)
  from public.plans
  where exists (
    select 1 from patterns p
    where coalesce(name, '') ilike '%' || p.pattern || '%'
       or coalesce(description, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'payments', id::text, concat_ws(' | ', reference, notes)
  from public.payments
  where exists (
    select 1 from patterns p
    where coalesce(reference, '') ilike '%' || p.pattern || '%'
       or coalesce(notes, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'receipts', id::text, concat_ws(' | ', receipt_number, member_name_snapshot)
  from public.receipts
  where exists (
    select 1 from patterns p
    where coalesce(receipt_number, '') ilike '%' || p.pattern || '%'
       or coalesce(member_name_snapshot, '') ilike '%' || p.pattern || '%'
  )
  union all
  select 'credit_transactions', id::text, reason
  from public.credit_transactions
  where exists (select 1 from patterns p where coalesce(reason, '') ilike '%' || p.pattern || '%')
  union all
  select 'package_requests', id::text, message_text
  from public.package_requests
  where exists (select 1 from patterns p where coalesce(message_text, '') ilike '%' || p.pattern || '%')
  union all
  select 'notification_logs', id::text, concat_ws(' | ', template_key, subject, generated_text)
  from public.notification_logs
  where exists (
    select 1 from patterns p
    where coalesce(template_key, '') ilike '%' || p.pattern || '%'
       or coalesce(subject, '') ilike '%' || p.pattern || '%'
       or coalesce(generated_text, '') ilike '%' || p.pattern || '%'
  )
)
select table_name, id, left(marker, 160) as marker
from scan
order by table_name, marker, id
limit 500;
