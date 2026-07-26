-- Persist policy postponements so due intents do not spin on the same eligibility window.

CREATE OR REPLACE FUNCTION public.postpone_concierge_intent(
  p_studio_id uuid,
  p_recipient_id uuid,
  p_intent_id uuid,
  p_reason text,
  p_eligible_at timestamptz,
  p_now timestamptz
)
RETURNS public.journey_intents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
BEGIN
  IF p_reason NOT IN (
    'quiet_hours',
    'six_hour_contact_cap',
    'daily_total_contact_cap',
    'daily_promotional_cap',
    'weekly_promotional_cap'
  ) THEN
    RAISE EXCEPTION 'invalid_postponement_reason';
  END IF;
  IF p_eligible_at <= p_now THEN
    RAISE EXCEPTION 'postponement_must_be_future';
  END IF;

  UPDATE public.journey_intents
  SET status = 'postponed',
      suppression_reason = p_reason,
      eligible_at = GREATEST(eligible_at, p_eligible_at),
      updated_at = now()
  WHERE id = p_intent_id
    AND studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id
    AND status IN ('pending','postponed','suppressed')
    AND eligible_at <= p_now
  RETURNING * INTO v_intent;

  IF NOT FOUND THEN RAISE EXCEPTION 'postponable_intent_not_found'; END IF;
  RETURN v_intent;
END;
$$;

REVOKE ALL ON FUNCTION public.postpone_concierge_intent(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.postpone_concierge_intent(
  uuid,uuid,uuid,text,timestamptz,timestamptz
) TO service_role;
