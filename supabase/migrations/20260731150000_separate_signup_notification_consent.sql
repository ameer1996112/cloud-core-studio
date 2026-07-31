-- Keep essential service email available while requiring affirmative consent for
-- WhatsApp, marketing, and native push notifications.

ALTER TABLE public.member_notification_preferences
  ALTER COLUMN push_enabled SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preferred_language text;
  v_phone text;
  v_phone_digits text;
  v_phone_valid boolean;
  v_consent_version text;
  v_whatsapp_enabled boolean;
  v_marketing_enabled boolean;
  v_now timestamptz := now();
BEGIN
  v_preferred_language := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'he', 'ar')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;
  v_phone := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_phone_digits := regexp_replace(COALESCE(v_phone, ''), '[^0-9]', '', 'g');
  v_phone_valid := v_phone IS NOT NULL
    AND v_phone ~ '^[+0-9().[:space:]-]+$'
    AND length(v_phone_digits) BETWEEN 10 AND 15;
  v_consent_version := NEW.raw_user_meta_data->>'notification_consent_version';
  v_whatsapp_enabled := v_consent_version = '2'
    AND v_phone_valid
    AND NEW.raw_user_meta_data->>'whatsapp_signup_opt_in_v2' = 'true';
  v_marketing_enabled := v_consent_version = '2'
    AND NEW.raw_user_meta_data->>'marketing_updates_enabled' = 'true';

  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.members (id, name, email, phone, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_phone,
    v_preferred_language
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(public.members.email, EXCLUDED.email),
      phone = COALESCE(public.members.phone, EXCLUDED.phone),
      preferred_language = EXCLUDED.preferred_language;

  PERFORM set_config(
    'app.notification_preference_source',
    'signup_notification_choices',
    true
  );

  UPDATE public.member_notification_preferences
  SET
    email_enabled = true,
    email_consent_source = 'essential_service_email',
    email_consented_at = NULL,
    email_opted_out_at = NULL,
    push_enabled = false,
    whatsapp_enabled = v_whatsapp_enabled,
    whatsapp_consent_source = CASE
      WHEN v_whatsapp_enabled THEN 'signup_explicit_whatsapp'
      WHEN v_phone IS NOT NULL AND NOT v_phone_valid THEN 'signup_invalid_whatsapp_phone'
      WHEN v_phone_valid THEN 'signup_whatsapp_not_selected'
      ELSE NULL
    END,
    whatsapp_consented_at = CASE WHEN v_whatsapp_enabled THEN v_now ELSE NULL END,
    whatsapp_opted_out_at = CASE
      WHEN v_phone_valid AND NOT v_whatsapp_enabled THEN v_now
      ELSE NULL
    END,
    marketing = v_marketing_enabled,
    recommendations_enabled = v_marketing_enabled,
    updated_at = v_now
  WHERE member_id = NEW.id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_enabled boolean;
  v_now timestamptz := now();
  v_previous_source text;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status IS DISTINCT FROM 'active'
  ) THEN
    RETURN NEW;
  END IF;

  v_email_enabled := NEW.status = 'active'
    AND COALESCE(NEW.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  IF TG_OP = 'UPDATE' THEN
    v_previous_source := current_setting('app.notification_preference_source', true);
    PERFORM set_config(
      'app.notification_preference_source',
      'member_activation_essential_email',
      true
    );
  END IF;

  INSERT INTO public.member_notification_preferences AS preferences (
    member_id,
    push_enabled,
    whatsapp_enabled,
    email_enabled,
    email_consent_source
  ) VALUES (
    NEW.id,
    false,
    false,
    v_email_enabled,
    CASE WHEN v_email_enabled THEN 'essential_service_email' END
  )
  ON CONFLICT (member_id) DO UPDATE SET
    email_enabled = CASE
      WHEN preferences.email_consent_source IS NULL
       AND preferences.email_opted_out_at IS NULL
      THEN EXCLUDED.email_enabled
      ELSE preferences.email_enabled
    END,
    email_consent_source = COALESCE(
      preferences.email_consent_source,
      EXCLUDED.email_consent_source
    ),
    updated_at = v_now;

  IF TG_OP = 'UPDATE' THEN
    PERFORM set_config(
      'app.notification_preference_source',
      COALESCE(v_previous_source, ''),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.ensure_member_notification_preferences()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_member_notification_preferences() TO service_role;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a member with essential email enabled and explicit signup choices for optional channels.';
COMMENT ON FUNCTION public.ensure_member_notification_preferences() IS
  'Initializes essential email without automatically opting members into WhatsApp or push.';
