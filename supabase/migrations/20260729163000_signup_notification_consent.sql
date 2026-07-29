-- Persist the explicit channel choices shown during member registration.

ALTER TABLE public.member_notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_preferred_language text;
  v_phone text;
  v_whatsapp_enabled boolean;
  v_email_enabled boolean;
  v_push_enabled boolean;
  v_now timestamptz := now();
BEGIN
  v_preferred_language := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'he', 'ar')
      THEN NEW.raw_user_meta_data->>'preferred_language'
    ELSE 'en'
  END;
  v_phone := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_whatsapp_enabled := v_phone IS NOT NULL
    AND COALESCE((NEW.raw_user_meta_data->>'whatsapp_updates_enabled')::boolean, false);
  v_email_enabled := COALESCE(
    (NEW.raw_user_meta_data->>'email_updates_enabled')::boolean,
    false
  );
  v_push_enabled := COALESCE(
    (NEW.raw_user_meta_data->>'push_updates_enabled')::boolean,
    false
  );

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
    'signup_channel_choices',
    true
  );

  UPDATE public.member_notification_preferences
  SET
    push_enabled = v_push_enabled,
    whatsapp_enabled = v_whatsapp_enabled,
    email_enabled = v_email_enabled,
    whatsapp_consent_source = 'signup_channel_choices',
    email_consent_source = 'signup_channel_choices',
    whatsapp_consented_at = CASE WHEN v_whatsapp_enabled THEN v_now ELSE NULL END,
    email_consented_at = CASE WHEN v_email_enabled THEN v_now ELSE NULL END,
    whatsapp_opted_out_at = CASE
      WHEN v_phone IS NOT NULL AND NOT v_whatsapp_enabled THEN v_now
      ELSE NULL
    END,
    email_opted_out_at = CASE WHEN NOT v_email_enabled THEN v_now ELSE NULL END,
    updated_at = v_now
  WHERE member_id = NEW.id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_member_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_source text := COALESCE(
    NULLIF(current_setting('app.notification_preference_source', true), ''),
    'member_settings'
  );
  v_keys constant text[] := ARRAY[
    'lesson_reminders', 'schedule_updates', 'package_reminders', 'marketing', 'sound',
    'push_enabled', 'whatsapp_enabled', 'email_enabled', 'class_operations_enabled',
    'class_reminders_enabled', 'schedule_openings_enabled', 'waitlist_enabled',
    'payments_enabled', 'membership_enabled', 'staff_replies_enabled',
    'recommendations_enabled', 'marketing_analytics_enabled', 'time_sensitive_enabled'
  ];
BEGIN
  FOREACH v_key IN ARRAY v_keys LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      INSERT INTO public.notification_preference_events (
        member_id, preference_key, previous_value, new_value, source, actor_id
      ) VALUES (
        NEW.member_id,
        v_key,
        CASE WHEN v_old ? v_key THEN (v_old ->> v_key)::boolean ELSE NULL END,
        (v_new ->> v_key)::boolean,
        v_source,
        auth.uid()
      );
    END IF;
  END LOOP;
  NEW.preference_revision := OLD.preference_revision + 1;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.member_notification_preferences.push_enabled IS
  'Member-wide preference for APNs delivery; iOS permission remains the final device-level gate.';

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates member records and persists explicit, auditable signup channel choices.';
