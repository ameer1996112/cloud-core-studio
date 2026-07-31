-- Keep the existing-member WhatsApp re-consent path aligned with signup phone
-- validation, and activate the approved weekly WhatsApp delivery channel.
CREATE OR REPLACE FUNCTION public.set_member_whatsapp_onboarding_decision(
  p_member_id uuid,
  p_decision text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_affected_rows integer := 0;
BEGIN
  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'member_id_required';
  END IF;
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_whatsapp_onboarding_decision';
  END IF;

  PERFORM set_config(
    'app.notification_preference_source',
    'member_whatsapp_onboarding',
    true
  );

  UPDATE public.member_notification_preferences AS preferences
  SET whatsapp_enabled = p_decision = 'accepted',
      whatsapp_consent_source = CASE
        WHEN p_decision = 'accepted' THEN 'member_whatsapp_onboarding'
        ELSE 'member_whatsapp_onboarding_declined'
      END,
      whatsapp_consented_at = CASE WHEN p_decision = 'accepted' THEN v_now ELSE NULL END,
      whatsapp_opted_out_at = CASE WHEN p_decision = 'declined' THEN v_now ELSE NULL END,
      updated_at = v_now
  FROM public.members AS member
  JOIN public.profiles AS profile ON profile.id = member.id
  WHERE preferences.member_id = p_member_id
    AND member.id = preferences.member_id
    AND profile.role = 'member'
    AND member.phone ~ '^[+0-9().[:space:]-]+$'
    AND length(regexp_replace(member.phone, '[^0-9]', '', 'g')) BETWEEN 10 AND 15
    AND preferences.whatsapp_opted_out_at IS NULL
    AND (
      preferences.whatsapp_consent_source IS NULL
      OR preferences.whatsapp_consent_source IN (
        'existing_member_auto_enable',
        'new_active_member_auto_enable',
        'legacy_auto_enable_pending_reconsent'
      )
    );

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  RETURN v_affected_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) TO service_role;

COMMENT ON FUNCTION public.set_member_whatsapp_onboarding_decision(uuid, text) IS
  'Records an explicit WhatsApp onboarding choice for a server-authenticated member with a valid phone number.';

DO $$
DECLARE
  v_affected_rows integer := 0;
BEGIN
  UPDATE public.notification_event_rollouts
  SET enabled_channels = CASE event_type
        WHEN 'weekly_schedule' THEN ARRAY['in_app', 'push', 'whatsapp']::text[]
        ELSE enabled_channels
      END,
      updated_at = now()
  WHERE event_type = 'weekly_schedule'
    AND copy_reviewed = true;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  IF v_affected_rows <> 1 THEN
    RAISE EXCEPTION 'weekly_schedule rollout is missing or has not passed copy review';
  END IF;
END;
$$;
