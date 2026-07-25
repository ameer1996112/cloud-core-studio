-- Real-state shadow dispatch evaluation. This path never creates reservations or deliveries.

CREATE OR REPLACE FUNCTION public.record_concierge_shadow_evaluation(
  p_studio_id uuid,
  p_recipient_id uuid,
  p_selected_intent_id uuid,
  p_evaluation_key text,
  p_policy_version text,
  p_automation_config_version integer,
  p_template_id uuid,
  p_template_version integer,
  p_locale text,
  p_reason_codes text[],
  p_suppression_reason text,
  p_competing_action_ids uuid[],
  p_attention_reasons text[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
  v_decision_id uuid;
  v_reason text;
BEGIN
  SELECT * INTO v_intent
  FROM public.journey_intents
  WHERE id = p_selected_intent_id
    AND studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'shadow_intent_not_found'; END IF;
  IF p_locale NOT IN ('ar','he','en') THEN RAISE EXCEPTION 'unsupported_locale'; END IF;

  INSERT INTO public.concierge_decisions(
    studio_id,journey_instance_id,intent_id,communication_recipient_id,decision_key,
    policy_version,automation_config_version,template_id,template_version,locale,
    reason_codes,suppression_reason,competing_action_ids,simulated
  ) VALUES (
    p_studio_id,v_intent.journey_instance_id,v_intent.id,p_recipient_id,p_evaluation_key,
    p_policy_version,p_automation_config_version,p_template_id,p_template_version,p_locale,
    COALESCE(p_reason_codes,'{}'),p_suppression_reason,
    COALESCE(p_competing_action_ids,'{}'),true
  )
  ON CONFLICT (studio_id,decision_key) DO NOTHING
  RETURNING id INTO v_decision_id;

  IF v_decision_id IS NULL THEN
    SELECT id INTO v_decision_id
    FROM public.concierge_decisions
    WHERE studio_id = p_studio_id AND decision_key = p_evaluation_key;
  END IF;

  FOREACH v_reason IN ARRAY COALESCE(p_attention_reasons,'{}') LOOP
    INSERT INTO public.admin_attention_items(
      studio_id,item_type,severity,title,details,deduplication_key,
      related_entity_type,related_entity_id
    ) VALUES (
      p_studio_id,'missing_template_locale','normal',
      'Concierge template approval is missing',
      jsonb_build_object(
        'reason',v_reason,'recipient_id',p_recipient_id,'intent_id',v_intent.id
      ),
      'shadow_attention:' || v_intent.id || ':' || md5(v_reason),
      'journey_intent',v_intent.id
    ) ON CONFLICT (studio_id,deduplication_key) DO NOTHING;
  END LOOP;

  RETURN v_decision_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_concierge_shadow_evaluation(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text[],text,uuid[],text[]
) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.record_concierge_shadow_evaluation(
  uuid,uuid,uuid,text,text,integer,uuid,integer,text,text[],text,uuid[],text[]
) TO service_role;
