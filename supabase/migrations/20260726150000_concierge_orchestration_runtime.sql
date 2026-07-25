-- Transactional runtime helpers for the Premium Concierge worker.
-- This migration does not activate journeys or external channels.

CREATE OR REPLACE FUNCTION public.defer_domain_outbox_claim(
  p_outbox_id uuid,
  p_worker_identifier text,
  p_reason text,
  p_next_attempt_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer;
BEGIN
  UPDATE public.domain_outbox
  SET worker_identifier = NULL,
      claim_timestamp = NULL,
      lease_expires_at = NULL,
      next_attempt_at = GREATEST(p_next_attempt_at, now() + interval '1 minute'),
      last_error = left(p_reason, 500)
  WHERE id = p_outbox_id
    AND worker_identifier = p_worker_identifier
    AND processed_at IS NULL
    AND dead_lettered_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_domain_outbox_claim(
  p_outbox_id uuid,
  p_worker_identifier text,
  p_error text,
  p_retryable boolean,
  p_max_attempts integer DEFAULT 8
)
RETURNS TABLE(retry_scheduled boolean, dead_lettered boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.domain_outbox%ROWTYPE;
  v_dead boolean;
  v_delay_seconds integer;
BEGIN
  SELECT * INTO v_event
  FROM public.domain_outbox
  WHERE id = p_outbox_id AND worker_identifier = p_worker_identifier
  FOR UPDATE;
  IF NOT FOUND OR v_event.processed_at IS NOT NULL OR v_event.dead_lettered_at IS NOT NULL THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  v_dead := NOT p_retryable OR v_event.attempt_count >= p_max_attempts;
  v_delay_seconds := LEAST(21600, 30 * (2 ^ GREATEST(v_event.attempt_count - 1, 0)));
  UPDATE public.domain_outbox
  SET worker_identifier = NULL,
      claim_timestamp = NULL,
      lease_expires_at = NULL,
      last_error = left(p_error, 500),
      next_attempt_at = CASE
        WHEN v_dead THEN next_attempt_at
        ELSE now() + make_interval(secs => v_delay_seconds)
      END,
      dead_lettered_at = CASE WHEN v_dead THEN now() ELSE NULL END
  WHERE id = p_outbox_id;

  IF v_dead THEN
    INSERT INTO public.admin_attention_items(
      studio_id,item_type,severity,title,details,deduplication_key,related_entity_type,related_entity_id
    ) VALUES (
      v_event.studio_id,'dead_lettered_event','urgent','Concierge event needs attention',
      jsonb_build_object(
        'event_type',v_event.event_type,'attempt_count',v_event.attempt_count,
        'correlation_id',v_event.correlation_id,'error',left(p_error,200)
      ),
      'dead_lettered_event:' || v_event.id,'domain_outbox',v_event.id
    ) ON CONFLICT (studio_id,deduplication_key) DO UPDATE
      SET details = EXCLUDED.details, status = 'open', resolved_at = NULL;
  END IF;

  RETURN QUERY SELECT NOT v_dead, v_dead;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_concierge_claim(
  p_outbox_id uuid,
  p_worker_identifier text,
  p_journey_type text,
  p_purpose text,
  p_priority integer,
  p_journey_key text,
  p_intent_key text,
  p_eligible_at timestamptz,
  p_expires_at timestamptz,
  p_cancellation_conditions jsonb,
  p_policy_version text,
  p_automation_config_version integer,
  p_create_customer_intent boolean,
  p_execution_action text,
  p_execution_reason text
)
RETURNS TABLE(journey_instance_id uuid, intent_id uuid, decision_id uuid, execution_action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.domain_outbox%ROWTYPE;
  v_journey_id uuid;
  v_intent_id uuid;
  v_decision_id uuid;
  v_intent_status text;
BEGIN
  IF p_execution_action NOT IN ('shadow','suppress','test_only') THEN
    RAISE EXCEPTION 'unsupported_execution_action';
  END IF;
  IF p_purpose NOT IN ('transactional','operational','schedule','promotional','receipt') THEN
    RAISE EXCEPTION 'unsupported_purpose';
  END IF;
  IF p_priority NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'invalid_priority'; END IF;

  SELECT * INTO v_event
  FROM public.domain_outbox
  WHERE id = p_outbox_id AND worker_identifier = p_worker_identifier
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'outbox_claim_not_owned'; END IF;
  IF v_event.processed_at IS NOT NULL OR v_event.dead_lettered_at IS NOT NULL THEN
    RAISE EXCEPTION 'outbox_claim_terminal';
  END IF;

  IF v_event.communication_recipient_id IS NULL THEN
    INSERT INTO public.admin_attention_items(
      studio_id,item_type,severity,title,details,deduplication_key,related_entity_type,related_entity_id
    ) VALUES (
      v_event.studio_id,'recipient_resolution','urgent',
      'Concierge event has no communication recipient',
      jsonb_build_object(
        'event_type',v_event.event_type,'aggregate_type',v_event.aggregate_type,
        'aggregate_id',v_event.aggregate_id,'correlation_id',v_event.correlation_id
      ),
      'recipient_resolution:' || v_event.id,v_event.aggregate_type,v_event.aggregate_id
    ) ON CONFLICT (studio_id,deduplication_key) DO NOTHING;
    UPDATE public.domain_outbox
    SET processed_at = now(), worker_identifier = NULL, claim_timestamp = NULL,
        lease_expires_at = NULL, last_error = 'recipient_resolution_required'
    WHERE id = v_event.id;
    RETURN QUERY SELECT NULL::uuid,NULL::uuid,NULL::uuid,'attention_required'::text;
    RETURN;
  END IF;

  IF NOT p_create_customer_intent THEN
    UPDATE public.domain_outbox
    SET processed_at = now(),worker_identifier = NULL,claim_timestamp = NULL,
        lease_expires_at = NULL,last_error = 'internal_only_no_customer_intent'
    WHERE id = v_event.id;
    RETURN QUERY SELECT NULL::uuid,NULL::uuid,NULL::uuid,'internal_only'::text;
    RETURN;
  END IF;

  INSERT INTO public.journey_instances(
    studio_id,journey_type,participant_id,communication_recipient_id,state,
    deduplication_key,correlation_id
  ) VALUES (
    v_event.studio_id,p_journey_type,v_event.participant_id,
    v_event.communication_recipient_id,'active',p_journey_key,v_event.correlation_id
  )
  ON CONFLICT (studio_id,deduplication_key) DO NOTHING
  RETURNING id INTO v_journey_id;
  IF v_journey_id IS NULL THEN
    SELECT id INTO v_journey_id FROM public.journey_instances
    WHERE studio_id = v_event.studio_id AND deduplication_key = p_journey_key;
  END IF;

  v_intent_status := CASE
    WHEN p_execution_action IN ('shadow','suppress','test_only') THEN 'suppressed'
    ELSE 'selected'
  END;
  INSERT INTO public.journey_intents(
    studio_id,journey_instance_id,journey_type,participant_id,communication_recipient_id,
    purpose,priority,eligible_at,expires_at,cancellation_conditions,deduplication_key,
    initial_policy_version,status,suppression_reason
  ) VALUES (
    v_event.studio_id,v_journey_id,p_journey_type,v_event.participant_id,
    v_event.communication_recipient_id,p_purpose,p_priority,p_eligible_at,p_expires_at,
    COALESCE(p_cancellation_conditions,'[]'::jsonb),p_intent_key,p_policy_version,
    v_intent_status,CASE WHEN p_execution_action IN ('shadow','suppress') THEN p_execution_reason END
  )
  ON CONFLICT (studio_id,deduplication_key) DO NOTHING
  RETURNING id INTO v_intent_id;
  IF v_intent_id IS NULL THEN
    SELECT id INTO v_intent_id FROM public.journey_intents
    WHERE studio_id = v_event.studio_id AND deduplication_key = p_intent_key;
  END IF;

  INSERT INTO public.concierge_decisions(
    studio_id,journey_instance_id,intent_id,communication_recipient_id,decision_key,
    policy_version,automation_config_version,locale,reason_codes,suppression_reason,simulated
  )
  SELECT
    v_event.studio_id,v_journey_id,v_intent_id,v_event.communication_recipient_id,
    'decision:' || v_event.deduplication_key,p_policy_version,p_automation_config_version,
    r.preferred_locale,ARRAY[p_execution_reason],
    CASE
      WHEN p_execution_action = 'test_only' THEN 'test_delivery_materialization_pending'
      ELSE p_execution_reason
    END,
    p_execution_action = 'shadow'
  FROM public.communication_recipients r
  WHERE r.id = v_event.communication_recipient_id
  ON CONFLICT (studio_id,decision_key) DO NOTHING
  RETURNING id INTO v_decision_id;
  IF v_decision_id IS NULL THEN
    SELECT id INTO v_decision_id FROM public.concierge_decisions
    WHERE studio_id = v_event.studio_id
      AND decision_key = 'decision:' || v_event.deduplication_key;
  END IF;

  UPDATE public.domain_outbox
  SET processed_at = now(),worker_identifier = NULL,claim_timestamp = NULL,
      lease_expires_at = NULL,last_error = NULL
  WHERE id = v_event.id;

  RETURN QUERY SELECT v_journey_id,v_intent_id,v_decision_id,p_execution_action;
END;
$$;

REVOKE ALL ON FUNCTION public.defer_domain_outbox_claim(uuid,text,text,timestamptz) FROM PUBLIC,authenticated;
REVOKE ALL ON FUNCTION public.fail_domain_outbox_claim(uuid,text,text,boolean,integer) FROM PUBLIC,authenticated;
REVOKE ALL ON FUNCTION public.materialize_concierge_claim(
  uuid,text,text,text,integer,text,text,timestamptz,timestamptz,jsonb,text,integer,boolean,text,text
) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.defer_domain_outbox_claim(uuid,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_domain_outbox_claim(uuid,text,text,boolean,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_concierge_claim(
  uuid,text,text,text,integer,text,text,timestamptz,timestamptz,jsonb,text,integer,boolean,text,text
) TO service_role;
