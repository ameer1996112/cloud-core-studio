-- Keep the evidence that selected branded presentation and action material with the delivery.

ALTER TABLE public.concierge_decisions
  ADD COLUMN IF NOT EXISTS materialization_evidence jsonb;

DROP FUNCTION IF EXISTS public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,timestamptz
);

CREATE OR REPLACE FUNCTION public.materialize_concierge_delivery(
  p_studio_id uuid, p_recipient_id uuid, p_intent_id uuid, p_decision_key text,
  p_policy_version text, p_automation_config_version integer, p_mode text,
  p_template_key text, p_correlation_id uuid, p_reason_codes text[],
  p_competing_action_ids uuid[], p_rendered_variables jsonb, p_materializations jsonb,
  p_whatsapp_waba_id text, p_now timestamptz
)
RETURNS TABLE(result_decision_id uuid, outcome text, result_suppression_reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
  v_recipient public.communication_recipients%ROWTYPE;
  v_config public.automation_config_versions%ROWTYPE;
  v_decision_id uuid; v_snapshot_id uuid; v_message_id uuid; v_item jsonb;
  v_external_count integer; v_reserved boolean; v_reservation_reason text;
  v_first_template_id uuid; v_first_template_version integer;
  v_template public.concierge_template_versions%ROWTYPE;
  v_snapshot public.message_snapshots%ROWTYPE;
  v_expected_provider text; v_expected_address text; v_required_variable text;
  v_expected_presentation_key text; v_expected_provider_payload jsonb; v_expected_action_url text;
  v_whatsapp_parameters jsonb; v_materialization_evidence jsonb;
  v_existing_evidence jsonb; v_existing_decision boolean := false;
BEGIN
  IF p_mode NOT IN ('test_only','live') THEN RAISE EXCEPTION 'invalid_delivery_mode'; END IF;
  IF jsonb_typeof(p_materializations) <> 'array' OR jsonb_array_length(p_materializations) = 0 THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;

  SELECT * INTO v_intent FROM public.journey_intents
  WHERE id = p_intent_id AND studio_id = p_studio_id AND communication_recipient_id = p_recipient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'concierge_intent_not_found'; END IF;
  IF v_intent.status NOT IN ('pending','postponed','suppressed','materialized') THEN
    RAISE EXCEPTION 'concierge_intent_not_dispatchable';
  END IF;
  IF v_intent.status <> 'materialized' AND v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= p_now THEN
    UPDATE public.journey_intents SET status = 'expired', updated_at = now() WHERE id = v_intent.id;
    RETURN QUERY SELECT NULL::uuid,'expired'::text,'intent_expired'::text; RETURN;
  END IF;

  SELECT * INTO v_recipient FROM public.communication_recipients
  WHERE id = p_recipient_id AND studio_id = p_studio_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_recipient_not_found'; END IF;
  SELECT * INTO v_config FROM public.automation_config_versions
  WHERE studio_id = p_studio_id AND journey_type = v_intent.journey_type
    AND version = p_automation_config_version AND mode = p_mode AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'automation_configuration_changed'; END IF;
  IF p_mode = 'live' AND (v_config.approved_at IS NULL OR v_config.approved_by IS NULL) THEN
    RAISE EXCEPTION 'live_configuration_not_approved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_materializations) item
    GROUP BY item->'snapshot'->>'channel' HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate_materialization_channel'; END IF;
  SELECT jsonb_build_object(
    'intent_id', p_intent_id,
    'correlation_id', p_correlation_id,
    'journey_type', v_intent.journey_type,
    'deliveries', jsonb_agg(
    jsonb_build_object(
      'channel', item->'snapshot'->>'channel',
      'template_id', item->'snapshot'->>'templateId',
      'template_version', item->'snapshot'->>'templateVersion',
      'locale', item->'snapshot'->>'locale',
      'rendered_variables', COALESCE(item->'snapshot'->'renderedVariables',p_rendered_variables),
      'final_subject', item->'snapshot'->>'finalSubject',
      'final_body', item->'snapshot'->>'finalBody',
      'presentation_key', item->'snapshot'->>'presentationKey',
      'journey_type', item->'snapshot'->>'journeyType',
      'action_url', item->'snapshot'->>'actionUrl',
      'provider', item->'delivery'->>'provider',
      'recipient_address', item->'delivery'->>'recipientAddress',
      'provider_payload', COALESCE(item->'delivery'->'providerPayload','{}'::jsonb)
    ) ORDER BY item->'snapshot'->>'channel'
    )
  ) INTO v_materialization_evidence
  FROM jsonb_array_elements(p_materializations) item;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    IF v_item->'snapshot'->>'channel' IS DISTINCT FROM v_item->'delivery'->>'channel' THEN
      RAISE EXCEPTION 'materialization_channel_mismatch';
    END IF;
    IF v_item->'delivery'->>'status' NOT IN ('queued','suppressed') THEN
      RAISE EXCEPTION 'invalid_initial_delivery_status';
    END IF;
    IF v_item->'delivery'->>'idempotencyKey' IS DISTINCT FROM p_decision_key || ':' || (v_item->'snapshot'->>'channel') THEN
      RAISE EXCEPTION 'invalid_delivery_idempotency_key';
    END IF;
    IF v_item->'snapshot'->>'presentationKey' IS NULL
       OR v_item->'snapshot'->>'journeyType' IS DISTINCT FROM v_intent.journey_type
       OR (v_item->'snapshot'->>'actionUrl' IS NOT NULL
           AND v_item->'snapshot'->>'actionUrl' NOT LIKE 'https://cloudandcorestudio.com/%') THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;
    v_expected_presentation_key := p_template_key || ':' || (v_item->'snapshot'->>'channel') ||
      CASE WHEN v_item->'snapshot'->>'channel' = 'push' THEN ':v1' ELSE ':v2' END;
    IF v_item->'snapshot'->>'presentationKey' IS DISTINCT FROM v_expected_presentation_key THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;
    v_expected_action_url := CASE p_template_key
      WHEN 'booking_confirmed_first' THEN 'https://cloudandcorestudio.com/member/bookings'
      WHEN 'booking_confirmed_repeat' THEN 'https://cloudandcorestudio.com/member/bookings'
      WHEN 'payment_requires_action' THEN 'https://cloudandcorestudio.com/member/packages'
      WHEN 'payment_terminally_failed' THEN 'https://cloudandcorestudio.com/member/packages'
      WHEN 'waitlist_offer' THEN 'https://cloudandcorestudio.com/member/schedule'
      WHEN 'recommendation' THEN 'https://cloudandcorestudio.com/member/schedule'
      ELSE NULL
    END;
    IF v_item->'snapshot'->>'actionUrl' IS DISTINCT FROM v_expected_action_url THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;

    SELECT * INTO v_template FROM public.concierge_template_versions
    WHERE id = (v_item->'snapshot'->>'templateId')::uuid AND studio_id = p_studio_id
      AND template_key = p_template_key AND channel = v_item->'snapshot'->>'channel'
      AND locale = v_recipient.preferred_locale AND version = (v_item->'snapshot'->>'templateVersion')::integer
      AND lifecycle_status = 'approved';
    IF NOT FOUND THEN RAISE EXCEPTION 'approved_template_mismatch'; END IF;
    FOREACH v_required_variable IN ARRAY v_template.required_variables LOOP
      IF NOT COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables) ? v_required_variable THEN
        RAISE EXCEPTION 'required_template_variable_missing:%',v_required_variable;
      END IF;
    END LOOP;
    v_expected_provider := CASE v_template.channel WHEN 'in_app' THEN 'internal' WHEN 'push' THEN 'apns'
      WHEN 'email' THEN 'resend' WHEN 'whatsapp' THEN 'official_whatsapp' END;
    v_expected_address := CASE v_template.channel WHEN 'in_app' THEN v_recipient.member_id::text
      WHEN 'push' THEN v_recipient.member_id::text WHEN 'email' THEN v_recipient.email
      WHEN 'whatsapp' THEN v_recipient.phone_e164 END;
    IF v_item->'delivery'->>'provider' IS DISTINCT FROM v_expected_provider
       OR v_item->'delivery'->>'recipientAddress' IS DISTINCT FROM v_expected_address THEN
      RAISE EXCEPTION 'untrusted_delivery_target';
    END IF;
    IF v_template.channel = 'email'
       AND COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb) IS DISTINCT FROM '{}'::jsonb THEN
      RAISE EXCEPTION 'invalid_concierge_email_evidence';
    END IF;
    IF v_template.channel = 'whatsapp' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('type','text','text',
        COALESCE(v_item->'snapshot'->'renderedVariables'->>v_required_variable,p_rendered_variables->>v_required_variable)
      ) ORDER BY v_required_variable),'[]'::jsonb)
      INTO v_whatsapp_parameters
      FROM unnest(v_template.required_variables) v_required_variable;
      v_expected_provider_payload := jsonb_build_object(
        'template_name', p_template_key || '_branded_v2',
        'template_language', CASE v_recipient.preferred_locale WHEN 'en' THEN 'en_US' ELSE v_recipient.preferred_locale END,
        'presentation_key', v_expected_presentation_key,
        'components', jsonb_build_array(
          jsonb_build_object('type','header','parameters',jsonb_build_array(
            jsonb_build_object('type','image','image',jsonb_build_object('link','https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp'))
          )),
          jsonb_build_object('type','body','parameters',v_whatsapp_parameters)
        )
      );
      IF COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb) IS DISTINCT FROM v_expected_provider_payload THEN
        RAISE EXCEPTION 'invalid_concierge_whatsapp_evidence';
      END IF;
    END IF;
    IF v_template.channel = 'whatsapp' AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_template_deployments w WHERE w.waba_id = NULLIF(p_whatsapp_waba_id,'')
        AND w.template_name = p_template_key || '_branded_v2'
        AND w.language = CASE v_recipient.preferred_locale WHEN 'en' THEN 'en_US' ELSE v_recipient.preferred_locale END
        AND upper(w.approval_status) = 'APPROVED'
    ) THEN RAISE EXCEPTION 'whatsapp_template_not_provider_approved'; END IF;
  END LOOP;

  SELECT (item->'snapshot'->>'templateId')::uuid,(item->'snapshot'->>'templateVersion')::integer
  INTO v_first_template_id,v_first_template_version FROM jsonb_array_elements(p_materializations) item LIMIT 1;
  IF v_intent.status = 'materialized' THEN
    SELECT id,materialization_evidence INTO v_decision_id,v_existing_evidence
    FROM public.concierge_decisions WHERE studio_id = p_studio_id AND decision_key = p_decision_key;
    v_existing_decision := true;
  ELSE
    INSERT INTO public.concierge_decisions(studio_id,journey_instance_id,intent_id,communication_recipient_id,decision_key,
      policy_version,automation_config_version,template_id,template_version,locale,reason_codes,competing_action_ids,simulated,materialization_evidence)
    VALUES (p_studio_id,v_intent.journey_instance_id,v_intent.id,p_recipient_id,p_decision_key,p_policy_version,
      p_automation_config_version,v_first_template_id,v_first_template_version,v_recipient.preferred_locale,
      COALESCE(p_reason_codes,'{}'),COALESCE(p_competing_action_ids,'{}'),false,v_materialization_evidence)
    ON CONFLICT (studio_id,decision_key) DO NOTHING RETURNING id INTO v_decision_id;
    IF v_decision_id IS NULL THEN
      SELECT id,materialization_evidence INTO v_decision_id,v_existing_evidence
      FROM public.concierge_decisions WHERE studio_id = p_studio_id AND decision_key = p_decision_key;
      v_existing_decision := true;
    END IF;
  END IF;
  IF v_existing_decision THEN
    IF v_decision_id IS NULL THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    IF v_existing_evidence IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.concierge_decisions d
        WHERE d.id = v_decision_id AND d.studio_id = p_studio_id AND d.intent_id = p_intent_id
          AND d.communication_recipient_id = p_recipient_id AND d.policy_version = p_policy_version
          AND d.automation_config_version = p_automation_config_version AND d.template_id = v_first_template_id
          AND d.template_version = v_first_template_version AND d.locale = v_recipient.preferred_locale
      ) THEN RAISE EXCEPTION 'snapshot_replay_mismatch'; END IF;
    ELSIF v_existing_evidence IS DISTINCT FROM v_materialization_evidence THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    IF v_intent.status = 'materialized' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.message_snapshots s
          JOIN public.message_deliveries d ON d.snapshot_id = s.id
          JOIN public.messages m ON m.id = d.message_id
          WHERE s.decision_id = v_decision_id AND s.channel = v_item->'snapshot'->>'channel'
            AND s.template_id IS NOT DISTINCT FROM (v_item->'snapshot'->>'templateId')::uuid
            AND s.locale IS NOT DISTINCT FROM v_item->'snapshot'->>'locale'
            AND s.rendered_variables IS NOT DISTINCT FROM COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables)
            AND s.final_subject IS NOT DISTINCT FROM v_item->'snapshot'->>'finalSubject'
            AND s.final_body IS NOT DISTINCT FROM v_item->'snapshot'->>'finalBody'
            AND s.correlation_id IS NOT DISTINCT FROM p_correlation_id
            AND d.provider IS NOT DISTINCT FROM v_item->'delivery'->>'provider'
            AND d.recipient_address IS NOT DISTINCT FROM v_item->'delivery'->>'recipientAddress'
            AND d.provider_payload IS NOT DISTINCT FROM COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb)
            AND m.content->>'journey_type' IS NOT DISTINCT FROM v_item->'snapshot'->>'journeyType'
            AND m.content->>'presentation_key' IS NOT DISTINCT FROM v_item->'snapshot'->>'presentationKey'
            AND m.content->>'action_url' IS NOT DISTINCT FROM v_item->'snapshot'->>'actionUrl'
        ) THEN RAISE EXCEPTION 'snapshot_replay_mismatch'; END IF;
      END LOOP;
    ELSIF EXISTS (
      SELECT 1 FROM public.message_snapshots s WHERE s.decision_id = v_decision_id
    ) THEN RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    IF v_existing_evidence IS NULL THEN
      UPDATE public.concierge_decisions
      SET materialization_evidence = v_materialization_evidence
      WHERE id = v_decision_id AND materialization_evidence IS NULL;
    END IF;
    RETURN QUERY SELECT v_decision_id,'duplicate'::text,NULL::text; RETURN;
  END IF;

  SELECT count(*) INTO v_external_count FROM jsonb_array_elements(p_materializations) item
  WHERE item->'delivery'->>'channel' <> 'in_app' AND item->'delivery'->>'status' = 'queued';
  IF v_external_count > 0 THEN
    IF v_intent.priority = 1 THEN
      INSERT INTO public.recipient_contact_state(studio_id,communication_recipient_id) VALUES (p_studio_id,p_recipient_id) ON CONFLICT DO NOTHING;
      PERFORM 1 FROM public.recipient_contact_state WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id FOR UPDATE;
      INSERT INTO public.frequency_reservations(studio_id,communication_recipient_id,decision_id,purpose,local_calendar_day,expires_at)
      VALUES (p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,(p_now AT TIME ZONE 'Asia/Jerusalem')::date,p_now + interval '8 days') ON CONFLICT (decision_id) DO NOTHING;
      v_reserved := true;
    ELSE
      SELECT reserved,reason INTO v_reserved,v_reservation_reason FROM public.reserve_recipient_contact_capacity(p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,p_now);
    END IF;
    IF NOT COALESCE(v_reserved,false) THEN
      UPDATE public.concierge_decisions SET suppression_reason = v_reservation_reason,reason_codes = reason_codes || v_reservation_reason WHERE id = v_decision_id;
      UPDATE public.journey_intents SET status = 'postponed',suppression_reason = v_reservation_reason,eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),updated_at = now() WHERE id = v_intent.id;
      RETURN QUERY SELECT v_decision_id,'postponed'::text,v_reservation_reason; RETURN;
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    INSERT INTO public.message_snapshots(studio_id,decision_id,template_id,locale,channel,rendered_variables,final_subject,final_body,content_hash,correlation_id,journey_instance_id)
    VALUES (p_studio_id,v_decision_id,(v_item->'snapshot'->>'templateId')::uuid,v_item->'snapshot'->>'locale',v_item->'snapshot'->>'channel',
      COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),v_item->'snapshot'->>'finalSubject',v_item->'snapshot'->>'finalBody',
      md5(COALESCE(v_item->'snapshot'->>'finalSubject','') || E'\n' || (v_item->'snapshot'->>'finalBody')),p_correlation_id,v_intent.journey_instance_id)
    ON CONFLICT (decision_id,channel) DO NOTHING RETURNING id INTO v_snapshot_id;
    IF v_snapshot_id IS NULL THEN
      SELECT * INTO v_snapshot FROM public.message_snapshots WHERE decision_id = v_decision_id AND channel = v_item->'snapshot'->>'channel';
      IF v_snapshot.template_id IS DISTINCT FROM (v_item->'snapshot'->>'templateId')::uuid OR v_snapshot.locale IS DISTINCT FROM v_item->'snapshot'->>'locale'
        OR v_snapshot.rendered_variables IS DISTINCT FROM COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables)
        OR v_snapshot.final_subject IS DISTINCT FROM v_item->'snapshot'->>'finalSubject' OR v_snapshot.final_body IS DISTINCT FROM v_item->'snapshot'->>'finalBody'
        OR v_snapshot.correlation_id IS DISTINCT FROM p_correlation_id THEN RAISE EXCEPTION 'snapshot_replay_mismatch'; END IF;
      v_snapshot_id := v_snapshot.id;
    END IF;
    INSERT INTO public.messages(member_id,direction,audience,event_type,language,template_key,template_version,subject,body,content,member_visible,idempotency_key)
    VALUES (v_recipient.member_id,'outbound','member',p_template_key,v_recipient.preferred_locale,p_template_key,(v_item->'snapshot'->>'templateVersion'),
      v_item->'snapshot'->>'finalSubject',v_item->'snapshot'->>'finalBody',jsonb_build_object('variables',COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),
      'concierge_decision_id',v_decision_id,'correlation_id',p_correlation_id,'journey_type',v_intent.journey_type,
      'presentation_key',v_item->'snapshot'->>'presentationKey','action_url',v_item->'snapshot'->>'actionUrl'),
      (v_item->'delivery'->>'channel') = 'in_app','concierge:' || v_decision_id || ':' || (v_item->'delivery'->>'channel'))
    ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO v_message_id;
    IF v_message_id IS NULL THEN
      SELECT id INTO v_message_id FROM public.messages
      WHERE idempotency_key = 'concierge:' || v_decision_id || ':' || (v_item->'delivery'->>'channel');
      IF NOT EXISTS (
        SELECT 1 FROM public.messages m WHERE m.id = v_message_id
          AND m.content->>'journey_type' IS NOT DISTINCT FROM v_item->'snapshot'->>'journeyType'
          AND m.content->>'presentation_key' IS NOT DISTINCT FROM v_item->'snapshot'->>'presentationKey'
          AND m.content->>'action_url' IS NOT DISTINCT FROM v_item->'snapshot'->>'actionUrl'
      ) THEN RAISE EXCEPTION 'snapshot_replay_mismatch'; END IF;
    END IF;
    INSERT INTO public.message_deliveries(studio_id,snapshot_id,message_id,channel,provider,recipient_address,status,provider_payload,idempotency_key,scheduled_for,expires_at,failure_class,error_code)
    VALUES (p_studio_id,v_snapshot_id,v_message_id,v_item->'delivery'->>'channel',v_item->'delivery'->>'provider',v_item->'delivery'->>'recipientAddress',v_item->'delivery'->>'status',
      COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb),v_item->'delivery'->>'idempotencyKey',(v_item->'delivery'->>'scheduledFor')::timestamptz,
      NULLIF(v_item->'delivery'->>'expiresAt','')::timestamptz,CASE WHEN v_item->'delivery'->>'status' = 'suppressed' THEN 'configuration' END,v_item->'delivery'->>'errorCode')
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.message_deliveries d
      WHERE d.idempotency_key = v_item->'delivery'->>'idempotencyKey'
        AND d.snapshot_id IS NOT DISTINCT FROM v_snapshot_id
        AND d.message_id IS NOT DISTINCT FROM v_message_id
        AND d.provider IS NOT DISTINCT FROM v_item->'delivery'->>'provider'
        AND d.recipient_address IS NOT DISTINCT FROM v_item->'delivery'->>'recipientAddress'
        AND d.provider_payload IS NOT DISTINCT FROM COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb)
    ) THEN RAISE EXCEPTION 'snapshot_replay_mismatch'; END IF;
  END LOOP;
  UPDATE public.journey_intents SET status = 'materialized',suppression_reason = NULL,updated_at = now() WHERE id = v_intent.id;
  UPDATE public.journey_intents SET status = 'postponed',suppression_reason = 'higher_priority_action_selected',eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),updated_at = now()
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id AND id = ANY(COALESCE(p_competing_action_ids,'{}')) AND status IN ('pending','postponed','suppressed');
  RETURN QUERY SELECT v_decision_id,'materialized'::text,NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_concierge_delivery(uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,text,timestamptz) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_concierge_delivery(uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,text,timestamptz) TO service_role;
