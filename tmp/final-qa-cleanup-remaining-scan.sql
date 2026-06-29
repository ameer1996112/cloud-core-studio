select 'notification_logs' as table_name, count(*)::int as row_count from public.notification_logs t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'attendance_records' as table_name, count(*)::int as row_count from public.attendance_records t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'package_requests' as table_name, count(*)::int as row_count from public.package_requests t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'receipts' as table_name, count(*)::int as row_count from public.receipts t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'payments' as table_name, count(*)::int as row_count from public.payments t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'member_plans' as table_name, count(*)::int as row_count from public.member_plans t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'credit_transactions' as table_name, count(*)::int as row_count from public.credit_transactions t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'bookings' as table_name, count(*)::int as row_count from public.bookings t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'classes' as table_name, count(*)::int as row_count from public.classes t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'plans' as table_name, count(*)::int as row_count from public.plans t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'program_types' as table_name, count(*)::int as row_count from public.program_types t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'rooms' as table_name, count(*)::int as row_count from public.rooms t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'instructors' as table_name, count(*)::int as row_count from public.instructors t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'members' as table_name, count(*)::int as row_count from public.members t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'profiles' as table_name, count(*)::int as row_count from public.profiles t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%'
union all
select 'auth.users' as table_name, count(*)::int as row_count from auth.users t where to_jsonb(t)::text ilike '%QA_PRE_RELEASE_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_RERUN_%' or to_jsonb(t)::text ilike '%QA_PRE_RELEASE_FINAL_%' or to_jsonb(t)::text ilike '%qa_pre_release_%' or to_jsonb(t)::text ilike '%qa-pre-release-%' or t.email in ('qa_pre_release_20260624t210916z.admin@example.com', 'qa_pre_release_20260624t210916z.instructor@example.com', 'qa_pre_release_20260624t210916z.member@example.com', 'qa_pre_release_20260624t210916z.nocredits@example.com', 'qa_pre_release_20260624t210916z.othermember@example.com');
