BEGIN;
\i supabase/migrations/20260625085000_store_signup_member_email.sql
UPDATE public.members
SET email = 'ameer1996112@gmail.com'
WHERE id = '76490148-49a5-4b76-af2d-b39475ff4f11'
  AND (email IS NULL OR email = '')
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = public.members.id
      AND u.email = 'ameer1996112@gmail.com'
  );
COMMIT;
