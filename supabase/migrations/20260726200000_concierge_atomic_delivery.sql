-- Atomic live/test Concierge decision materialization into the canonical delivery runtime.

ALTER TABLE public.message_snapshots
  DROP CONSTRAINT IF EXISTS message_snapshots_decision_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS message_snapshots_decision_channel_uniq
  ON public.message_snapshots(decision_id, channel);

CREATE OR REPLACE FUNCTION public.reserve_recipient_contact_capacity(
  p_studio_id uuid,
  p_recipient_id uuid,
  p_decision_id uuid,
  p_purpose text,
  p_now timestamptz
)
RETURNS TABLE(reserved boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_six_hour integer;
  v_day integer;
  v_promo_day integer;
  v_promo_week integer;
  v_last_external_contact_at timestamptz;
  v_local_day date := (p_now AT TIME ZONE 'Asia/Jerusalem')::date;
BEGIN
  INSERT INTO public.recipient_contact_state(studio_id,communication_recipient_id)
  VALUES (p_studio_id,p_recipient_id) ON CONFLICT DO NOTHING;
  SELECT last_external_contact_at INTO v_last_external_contact_at
  FROM public.recipient_contact_state
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id
  FOR UPDATE;

  IF v_last_external_contact_at IS NOT NULL
     AND v_last_external_contact_at > p_now - interval '6 hours' THEN
    RETURN QUERY SELECT false,'six_hour_contact_cap'::text;
    RETURN;
  END IF;

  SELECT
    count(*) FILTER (WHERE reserved_at > p_now - interval '6 hours'),
    count(*) FILTER (WHERE reserved_at > p_now - interval '24 hours'),
    count(*) FILTER (WHERE purpose = 'promotional' AND local_calendar_day = v_local_day),
    count(*) FILTER (WHERE purpose = 'promotional' AND reserved_at > p_now - interval '7 days')
  INTO v_six_hour,v_day,v_promo_day,v_promo_week
  FROM public.frequency_reservations
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id
    AND released_at IS NULL
    AND (consumed_at IS NOT NULL OR expires_at > p_now);

  IF v_six_hour >= 1 THEN RETURN QUERY SELECT false,'six_hour_contact_cap'::text; RETURN; END IF;
  IF v_day >= 2 THEN RETURN QUERY SELECT false,'daily_total_contact_cap'::text; RETURN; END IF;
  IF p_purpose = 'promotional' AND v_promo_day >= 1 THEN
    RETURN QUERY SELECT false,'daily_promotional_cap'::text; RETURN;
  END IF;
  IF p_purpose = 'promotional' AND v_promo_week >= 3 THEN
    RETURN QUERY SELECT false,'weekly_promotional_cap'::text; RETURN;
  END IF;

  INSERT INTO public.frequency_reservations(
    studio_id,communication_recipient_id,decision_id,purpose,local_calendar_day,expires_at
  ) VALUES (
    p_studio_id,p_recipient_id,p_decision_id,p_purpose,v_local_day,p_now + interval '8 days'
  ) ON CONFLICT (decision_id) DO NOTHING;
  -- This locked watermark closes the gap between concurrent reservations. It is
  -- reconciled to accepted contact time (or cleared) by the delivery trigger.
  UPDATE public.recipient_contact_state
  SET last_external_contact_at = p_now,version = version + 1,updated_at = now()
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id;
  RETURN QUERY SELECT true,NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_concierge_delivery(
  p_studio_id uuid,
  p_recipient_id uuid,
  p_intent_id uuid,
  p_decision_key text,
  p_policy_version text,
  p_automation_config_version integer,
  p_mode text,
  p_template_key text,
  p_correlation_id uuid,
  p_reason_codes text[],
  p_competing_action_ids uuid[],
  p_rendered_variables jsonb,
  p_materializations jsonb,
  p_now timestamptz
)
RETURNS TABLE(result_decision_id uuid, outcome text, result_suppression_reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
  v_recipient public.communication_recipients%ROWTYPE;
  v_config public.automation_config_versions%ROWTYPE;
  v_decision_id uuid;
  v_snapshot_id uuid;
  v_message_id uuid;
  v_item jsonb;
  v_external_count integer;
  v_reserved boolean;
  v_reservation_reason text;
  v_first_template_id uuid;
  v_first_template_version integer;
  v_template public.concierge_template_versions%ROWTYPE;
  v_snapshot public.message_snapshots%ROWTYPE;
  v_expected_provider text;
  v_expected_address text;
  v_required_variable text;
BEGIN
  IF p_mode NOT IN ('test_only','live') THEN RAISE EXCEPTION 'invalid_delivery_mode'; END IF;
  IF jsonb_typeof(p_materializations) <> 'array' OR jsonb_array_length(p_materializations) = 0 THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;

  SELECT * INTO v_intent
  FROM public.journey_intents
  WHERE id = p_intent_id
    AND studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'concierge_intent_not_found'; END IF;
  IF v_intent.status = 'materialized' THEN
    SELECT id INTO v_decision_id FROM public.concierge_decisions
    WHERE studio_id = p_studio_id AND decision_key = p_decision_key;
    RETURN QUERY SELECT v_decision_id,'duplicate'::text,NULL::text;
    RETURN;
  END IF;
  IF v_intent.status NOT IN ('pending','postponed','suppressed') THEN
    RAISE EXCEPTION 'concierge_intent_not_dispatchable';
  END IF;
  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= p_now THEN
    UPDATE public.journey_intents SET status = 'expired', updated_at = now()
    WHERE id = v_intent.id;
    RETURN QUERY SELECT NULL::uuid,'expired'::text,'intent_expired'::text;
    RETURN;
  END IF;

  SELECT * INTO v_recipient FROM public.communication_recipients
  WHERE id = p_recipient_id AND studio_id = p_studio_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_recipient_not_found'; END IF;

  SELECT * INTO v_config
  FROM public.automation_config_versions
  WHERE studio_id = p_studio_id
    AND journey_type = v_intent.journey_type
    AND version = p_automation_config_version
    AND mode = p_mode
    AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'automation_configuration_changed'; END IF;
  IF p_mode = 'live' AND (v_config.approved_at IS NULL OR v_config.approved_by IS NULL) THEN
    RAISE EXCEPTION 'live_configuration_not_approved';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    IF v_item->'snapshot'->>'channel' IS DISTINCT FROM v_item->'delivery'->>'channel' THEN
      RAISE EXCEPTION 'materialization_channel_mismatch';
    END IF;
    IF v_item->'delivery'->>'status' NOT IN ('queued','suppressed') THEN
      RAISE EXCEPTION 'invalid_initial_delivery_status';
    END IF;
    IF v_item->'delivery'->>'idempotencyKey'
       IS DISTINCT FROM p_decision_key || ':' || (v_item->'snapshot'->>'channel') THEN
      RAISE EXCEPTION 'invalid_delivery_idempotency_key';
    END IF;

    SELECT * INTO v_template
    FROM public.concierge_template_versions
    WHERE id = (v_item->'snapshot'->>'templateId')::uuid
      AND studio_id = p_studio_id
      AND template_key = p_template_key
      AND channel = v_item->'snapshot'->>'channel'
      AND locale = v_recipient.preferred_locale
      AND version = (v_item->'snapshot'->>'templateVersion')::integer
      AND lifecycle_status = 'approved';
    IF NOT FOUND THEN RAISE EXCEPTION 'approved_template_mismatch'; END IF;
    FOREACH v_required_variable IN ARRAY v_template.required_variables LOOP
      IF NOT COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables)
        ? v_required_variable THEN
        RAISE EXCEPTION 'required_template_variable_missing:%',v_required_variable;
      END IF;
    END LOOP;

    v_expected_provider := CASE v_template.channel
      WHEN 'in_app' THEN 'internal'
      WHEN 'push' THEN 'apns'
      WHEN 'email' THEN 'resend'
      WHEN 'whatsapp' THEN 'official_whatsapp'
    END;
    v_expected_address := CASE v_template.channel
      WHEN 'in_app' THEN v_recipient.member_id::text
      WHEN 'push' THEN v_recipient.member_id::text
      WHEN 'email' THEN v_recipient.email
      WHEN 'whatsapp' THEN v_recipient.phone_e164
    END;
    IF v_item->'delivery'->>'provider' IS DISTINCT FROM v_expected_provider
       OR v_item->'delivery'->>'recipientAddress' IS DISTINCT FROM v_expected_address THEN
      RAISE EXCEPTION 'untrusted_delivery_target';
    END IF;
    IF v_template.channel = 'whatsapp' AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_template_deployments w
      WHERE w.template_name = p_template_key
        AND w.language = CASE v_recipient.preferred_locale WHEN 'en' THEN 'en_US'
                        ELSE v_recipient.preferred_locale END
        AND upper(w.approval_status) = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'whatsapp_template_not_provider_approved';
    END IF;
  END LOOP;

  SELECT
    (item->'snapshot'->>'templateId')::uuid,
    (item->'snapshot'->>'templateVersion')::integer
  INTO v_first_template_id,v_first_template_version
  FROM jsonb_array_elements(p_materializations) item
  LIMIT 1;

  INSERT INTO public.concierge_decisions(
    studio_id,journey_instance_id,intent_id,communication_recipient_id,decision_key,
    policy_version,automation_config_version,template_id,template_version,locale,
    reason_codes,competing_action_ids,simulated
  ) VALUES (
    p_studio_id,v_intent.journey_instance_id,v_intent.id,p_recipient_id,p_decision_key,
    p_policy_version,p_automation_config_version,v_first_template_id,v_first_template_version,
    v_recipient.preferred_locale,COALESCE(p_reason_codes,'{}'),
    COALESCE(p_competing_action_ids,'{}'),false
  )
  ON CONFLICT (studio_id,decision_key) DO NOTHING
  RETURNING id INTO v_decision_id;

  IF v_decision_id IS NULL THEN
    SELECT id INTO v_decision_id FROM public.concierge_decisions
    WHERE studio_id = p_studio_id AND decision_key = p_decision_key;
    RETURN QUERY SELECT v_decision_id,'duplicate'::text,NULL::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_external_count
  FROM jsonb_array_elements(p_materializations) item
  WHERE item->'delivery'->>'channel' <> 'in_app'
    AND item->'delivery'->>'status' = 'queued';

  IF v_external_count > 0 THEN
    IF v_intent.priority = 1 THEN
      INSERT INTO public.recipient_contact_state(studio_id,communication_recipient_id)
      VALUES (p_studio_id,p_recipient_id) ON CONFLICT DO NOTHING;
      PERFORM 1 FROM public.recipient_contact_state
      WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id FOR UPDATE;
      INSERT INTO public.frequency_reservations(
        studio_id,communication_recipient_id,decision_id,purpose,local_calendar_day,expires_at
      ) VALUES (
        p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,
        (p_now AT TIME ZONE 'Asia/Jerusalem')::date,p_now + interval '8 days'
      ) ON CONFLICT (decision_id) DO NOTHING;
      v_reserved := true;
    ELSE
      SELECT reserved,reason INTO v_reserved,v_reservation_reason
      FROM public.reserve_recipient_contact_capacity(
        p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,p_now
      );
    END IF;
    IF NOT COALESCE(v_reserved,false) THEN
      UPDATE public.concierge_decisions
      SET suppression_reason = v_reservation_reason,
          reason_codes = reason_codes || v_reservation_reason
      WHERE id = v_decision_id;
      UPDATE public.journey_intents
      SET status = 'postponed',suppression_reason = v_reservation_reason,
          eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),updated_at = now()
      WHERE id = v_intent.id;
      RETURN QUERY SELECT v_decision_id,'postponed'::text,v_reservation_reason;
      RETURN;
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    INSERT INTO public.message_snapshots(
      studio_id,decision_id,template_id,locale,channel,rendered_variables,
      final_subject,final_body,content_hash,correlation_id,journey_instance_id
    ) VALUES (
      p_studio_id,v_decision_id,(v_item->'snapshot'->>'templateId')::uuid,
      v_item->'snapshot'->>'locale',v_item->'snapshot'->>'channel',
      COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),
      v_item->'snapshot'->>'finalSubject',v_item->'snapshot'->>'finalBody',
      md5(COALESCE(v_item->'snapshot'->>'finalSubject','') || E'\n' ||
          (v_item->'snapshot'->>'finalBody')),
      p_correlation_id,v_intent.journey_instance_id
    )
    ON CONFLICT (decision_id,channel) DO NOTHING
    RETURNING id INTO v_snapshot_id;
    IF v_snapshot_id IS NULL THEN
      SELECT * INTO v_snapshot FROM public.message_snapshots
      WHERE decision_id = v_decision_id
        AND channel = v_item->'snapshot'->>'channel';
      IF v_snapshot.template_id IS DISTINCT FROM (v_item->'snapshot'->>'templateId')::uuid
         OR v_snapshot.locale IS DISTINCT FROM v_item->'snapshot'->>'locale'
         OR v_snapshot.rendered_variables IS DISTINCT FROM
              COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables)
         OR v_snapshot.final_subject IS DISTINCT FROM v_item->'snapshot'->>'finalSubject'
         OR v_snapshot.final_body IS DISTINCT FROM v_item->'snapshot'->>'finalBody'
         OR v_snapshot.correlation_id IS DISTINCT FROM p_correlation_id THEN
        RAISE EXCEPTION 'snapshot_replay_mismatch';
      END IF;
      v_snapshot_id := v_snapshot.id;
    END IF;

    INSERT INTO public.messages(
      member_id,direction,audience,event_type,language,template_key,template_version,
      subject,body,content,member_visible,idempotency_key
    ) VALUES (
      v_recipient.member_id,'outbound','member',p_template_key,v_recipient.preferred_locale,
      p_template_key,(v_item->'snapshot'->>'templateVersion'),
      v_item->'snapshot'->>'finalSubject',v_item->'snapshot'->>'finalBody',
      jsonb_build_object(
        'variables',COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),
        'concierge_decision_id',v_decision_id,'correlation_id',p_correlation_id
      ),
      (v_item->'delivery'->>'channel') = 'in_app',
      'concierge:' || v_decision_id || ':' || (v_item->'delivery'->>'channel')
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_message_id;
    IF v_message_id IS NULL THEN
      SELECT id INTO v_message_id FROM public.messages
      WHERE idempotency_key = 'concierge:' || v_decision_id || ':' ||
        (v_item->'delivery'->>'channel');
    END IF;

    INSERT INTO public.message_deliveries(
      studio_id,snapshot_id,message_id,channel,provider,recipient_address,status,
      provider_payload,idempotency_key,scheduled_for,expires_at,failure_class,error_code
    ) VALUES (
      p_studio_id,v_snapshot_id,v_message_id,v_item->'delivery'->>'channel',
      v_item->'delivery'->>'provider',v_item->'delivery'->>'recipientAddress',
      v_item->'delivery'->>'status',COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb),
      v_item->'delivery'->>'idempotencyKey',
      (v_item->'delivery'->>'scheduledFor')::timestamptz,
      NULLIF(v_item->'delivery'->>'expiresAt','')::timestamptz,
      CASE WHEN v_item->'delivery'->>'status' = 'suppressed' THEN 'configuration' END,
      v_item->'delivery'->>'errorCode'
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  UPDATE public.journey_intents
  SET status = 'materialized',suppression_reason = NULL,updated_at = now()
  WHERE id = v_intent.id;
  UPDATE public.journey_intents
  SET status = 'postponed',suppression_reason = 'higher_priority_action_selected',
      eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),updated_at = now()
  WHERE studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id
    AND id = ANY(COALESCE(p_competing_action_ids,'{}'))
    AND status IN ('pending','postponed','suppressed');

  RETURN QUERY SELECT v_decision_id,'materialized'::text,NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,timestamptz
) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_concierge_frequency_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_decision_id uuid;
BEGIN
  IF NEW.snapshot_id IS NULL OR NEW.channel = 'in_app' THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT decision_id INTO v_decision_id FROM public.message_snapshots WHERE id = NEW.snapshot_id;
  IF NEW.status IN ('accepted','sent','delivered','read') THEN
    UPDATE public.frequency_reservations
    SET consumed_at = COALESCE(consumed_at,now()),released_at = NULL
    WHERE decision_id = v_decision_id;
    UPDATE public.recipient_contact_state s
    SET last_external_contact_at = now(),version = version + 1,updated_at = now()
    FROM public.concierge_decisions d
    WHERE d.id = v_decision_id
      AND s.studio_id = d.studio_id
      AND s.communication_recipient_id = d.communication_recipient_id;
  ELSIF NEW.status IN ('dead_letter','suppressed','expired','cancelled')
    AND NOT EXISTS (
      SELECT 1
      FROM public.message_deliveries d
      JOIN public.message_snapshots s ON s.id = d.snapshot_id
      WHERE s.decision_id = v_decision_id
        AND d.channel <> 'in_app'
        AND d.status IN ('queued','sending','accepted','sent','delivered','read','failed','delivery_unknown')
    ) THEN
    UPDATE public.frequency_reservations
    SET released_at = COALESCE(released_at,now())
    WHERE decision_id = v_decision_id AND consumed_at IS NULL;
    UPDATE public.recipient_contact_state state
    SET last_external_contact_at = (
          SELECT max(reservation.consumed_at)
          FROM public.frequency_reservations reservation
          WHERE reservation.studio_id = state.studio_id
            AND reservation.communication_recipient_id = state.communication_recipient_id
            AND reservation.consumed_at IS NOT NULL
        ),
        version = version + 1,
        updated_at = now()
    FROM public.concierge_decisions decision
    WHERE decision.id = v_decision_id
      AND state.studio_id = decision.studio_id
      AND state.communication_recipient_id = decision.communication_recipient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consume_concierge_frequency_reservation_trigger
  ON public.message_deliveries;
CREATE TRIGGER consume_concierge_frequency_reservation_trigger
AFTER UPDATE OF status ON public.message_deliveries
FOR EACH ROW EXECUTE FUNCTION public.reconcile_concierge_frequency_reservation();

CREATE OR REPLACE FUNCTION public.concierge_delivery_send_allowed(
  p_delivery_id uuid,
  p_live_runtime_enabled boolean,
  p_test_recipient_ids text[]
)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivery public.message_deliveries%ROWTYPE;
  v_decision public.concierge_decisions%ROWTYPE;
  v_intent public.journey_intents%ROWTYPE;
  v_config public.automation_config_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_delivery FROM public.message_deliveries WHERE id = p_delivery_id;
  IF NOT FOUND OR v_delivery.snapshot_id IS NULL THEN
    RETURN QUERY SELECT true,NULL::text;
    RETURN;
  END IF;

  SELECT d.* INTO v_decision
  FROM public.message_snapshots s
  JOIN public.concierge_decisions d ON d.id = s.decision_id
  WHERE s.id = v_delivery.snapshot_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false,'concierge_decision_missing'::text;
    RETURN;
  END IF;
  SELECT * INTO v_intent FROM public.journey_intents WHERE id = v_decision.intent_id;
  SELECT * INTO v_config
  FROM public.automation_config_versions
  WHERE studio_id = v_decision.studio_id
    AND journey_type = v_intent.journey_type
    AND version = v_decision.automation_config_version
    AND retired_at IS NULL;

  IF NOT FOUND OR v_config.mode NOT IN ('test_only','live') THEN
    RETURN QUERY SELECT false,'concierge_automation_disabled'::text;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.concierge_channel_controls c
    WHERE c.studio_id = v_decision.studio_id
      AND c.channel = v_delivery.channel
      AND c.enabled
  ) THEN
    RETURN QUERY SELECT false,'concierge_channel_disabled'::text;
  ELSIF v_config.mode = 'live' AND (
    NOT p_live_runtime_enabled OR v_config.approved_at IS NULL OR v_config.approved_by IS NULL
  ) THEN
    RETURN QUERY SELECT false,'concierge_live_runtime_disabled'::text;
  ELSIF v_config.mode = 'test_only'
    AND NOT (v_decision.communication_recipient_id::text = ANY(COALESCE(p_test_recipient_ids,'{}')))
  THEN
    RETURN QUERY SELECT false,'concierge_test_recipient_not_allowlisted'::text;
  ELSE
    RETURN QUERY SELECT true,NULL::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.concierge_delivery_send_allowed(uuid,boolean,text[])
  FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.concierge_delivery_send_allowed(uuid,boolean,text[])
  TO service_role;
