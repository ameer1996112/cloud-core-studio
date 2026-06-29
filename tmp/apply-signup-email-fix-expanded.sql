CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.members (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(public.members.email, EXCLUDED.email);

  RETURN NEW;
END;
$function$;

UPDATE public.members
SET email = 'ameer1996112@gmail.com'
WHERE id = '76490148-49a5-4b76-af2d-b39475ff4f11'
  AND (email IS NULL OR email = '')
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = public.members.id
      AND u.email = 'ameer1996112@gmail.com'
  );
