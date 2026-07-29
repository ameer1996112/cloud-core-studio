-- Historical automatic enablement did not capture an affirmative member action.
-- Pause those rows and preserve their provenance until the member makes a one-time choice.
SELECT set_config(
  'app.notification_preference_source',
  'legacy_whatsapp_reconsent_migration',
  true
);

UPDATE public.member_notification_preferences AS preferences
SET whatsapp_enabled = false,
    whatsapp_consent_source = 'legacy_auto_enable_pending_reconsent',
    whatsapp_consented_at = NULL,
    updated_at = now()
FROM public.members AS member
WHERE member.id = preferences.member_id
  AND preferences.whatsapp_consent_source IN (
    'existing_member_auto_enable',
    'new_active_member_auto_enable'
  )
  AND preferences.whatsapp_opted_out_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_member_whatsapp_onboarding_decision(
  p_decision text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
  v_now timestamptz := now();
  v_affected_rows integer := 0;
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
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
  WHERE preferences.member_id = v_member_id
    AND member.id = preferences.member_id
    AND NULLIF(BTRIM(member.phone), '') IS NOT NULL
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

REVOKE ALL ON FUNCTION public.set_member_whatsapp_onboarding_decision(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_member_whatsapp_onboarding_decision(text) TO authenticated;

COMMENT ON FUNCTION public.set_member_whatsapp_onboarding_decision(text) IS
  'Records one explicit existing-member WhatsApp onboarding decision with audit provenance.';
