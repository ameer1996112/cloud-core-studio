-- Fresh signup can legitimately encounter legacy nullable preference columns. Keep
-- the existing non-null audit contract by recording their effective false value.
CREATE OR REPLACE FUNCTION public.audit_member_notification_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_key text;
  v_old jsonb := COALESCE(to_jsonb(OLD),'{}'::jsonb);
  v_new jsonb := COALESCE(to_jsonb(NEW),'{}'::jsonb);
  v_source text := COALESCE(NULLIF(current_setting('app.notification_preference_source',true),''),'member_settings');
  v_keys constant text[] := ARRAY[
    'lesson_reminders','schedule_updates','package_reminders','marketing','sound',
    'push_enabled','whatsapp_enabled','email_enabled','class_operations_enabled',
    'class_reminders_enabled','schedule_openings_enabled','waitlist_enabled',
    'payments_enabled','membership_enabled','staff_replies_enabled',
    'recommendations_enabled','marketing_analytics_enabled','time_sensitive_enabled'
  ];
BEGIN
  FOREACH v_key IN ARRAY v_keys LOOP
    IF COALESCE((v_old->>v_key)::boolean,false) IS DISTINCT FROM COALESCE((v_new->>v_key)::boolean,false) THEN
      INSERT INTO public.notification_preference_events(member_id,preference_key,previous_value,new_value,source,actor_id)
      VALUES(NEW.member_id,v_key,CASE WHEN v_old?v_key THEN COALESCE((v_old->>v_key)::boolean,false) ELSE NULL END,
        COALESCE((v_new->>v_key)::boolean,false),v_source,auth.uid());
    END IF;
  END LOOP;
  NEW.preference_revision:=COALESCE(OLD.preference_revision,0)+1;
  RETURN NEW;
END; $$;
