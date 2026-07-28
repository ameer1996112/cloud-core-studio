CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preferred_language text;
BEGIN
  v_preferred_language := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'he', 'ar')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;

  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.members (id, name, email, phone, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_preferred_language
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(public.members.email, EXCLUDED.email),
      phone = COALESCE(public.members.phone, EXCLUDED.phone),
      preferred_language = EXCLUDED.preferred_language;

  RETURN NEW;
END;
$function$;
