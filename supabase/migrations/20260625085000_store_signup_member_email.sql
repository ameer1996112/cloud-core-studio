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
