ALTER TABLE public.members
  ALTER COLUMN remaining_credits SET DEFAULT 0;

UPDATE public.members m
SET remaining_credits = 0
WHERE m.remaining_credits = 5
  AND NOT EXISTS (
    SELECT 1
    FROM public.member_plans mp
    WHERE mp.member_id = m.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions ct
    WHERE ct.member_id = m.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.member_id = m.id
  );
