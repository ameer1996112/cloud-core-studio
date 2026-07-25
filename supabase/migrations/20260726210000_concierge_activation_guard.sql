-- Versioned, audited automation promotion. Live requires explicit approval and locale coverage.

CREATE OR REPLACE FUNCTION public.promote_concierge_automation(
  p_current_config_id uuid,
  p_actor_id uuid,
  p_mode text,
  p_confirmation text DEFAULT NULL
)
RETURNS TABLE(id uuid,journey_type text,version integer,mode text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current public.automation_config_versions%ROWTYPE;
  v_new_id uuid;
  v_required_key text;
  v_channel text;
  v_missing integer;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_mode NOT IN ('paused','shadow','test_only','live') THEN
    RAISE EXCEPTION 'invalid_automation_mode';
  END IF;

  SELECT * INTO v_current FROM public.automation_config_versions
  WHERE automation_config_versions.id = p_current_config_id AND retired_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'current_automation_config_not_found'; END IF;

  IF p_mode = 'live' THEN
    IF p_confirmation <> 'ENABLE LIVE CONCIERGE' THEN
      RAISE EXCEPTION 'live_confirmation_required';
    END IF;
    IF jsonb_typeof(v_current.config->'requiredTemplateKeys') <> 'array'
       OR jsonb_array_length(v_current.config->'requiredTemplateKeys') = 0 THEN
      RAISE EXCEPTION 'required_template_keys_missing';
    END IF;
    FOR v_required_key IN
      SELECT jsonb_array_elements_text(v_current.config->'requiredTemplateKeys')
    LOOP
      FOR v_channel IN
        SELECT channel FROM public.concierge_channel_controls
        WHERE studio_id = v_current.studio_id AND enabled
      LOOP
        SELECT count(*) INTO v_missing
        FROM unnest(ARRAY['ar','he','en']) locale
        WHERE NOT EXISTS (
          SELECT 1 FROM public.concierge_template_versions t
          WHERE t.studio_id = v_current.studio_id
            AND t.template_key = v_required_key
            AND t.channel = v_channel
            AND t.locale = locale
            AND t.lifecycle_status = 'approved'
        );
        IF v_missing > 0 THEN
          RAISE EXCEPTION 'approved_locale_coverage_missing:%:%',v_required_key,v_channel;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.automation_config_versions
  SET retired_at = now()
  WHERE automation_config_versions.id = v_current.id;
  UPDATE public.message_deliveries delivery
  SET status = 'suppressed',
      failure_class = 'configuration',
      error_code = 'concierge_automation_version_retired',
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  FROM public.message_snapshots snapshot
  JOIN public.concierge_decisions decision ON decision.id = snapshot.decision_id
  JOIN public.journey_intents intent ON intent.id = decision.intent_id
  WHERE delivery.snapshot_id = snapshot.id
    AND decision.studio_id = v_current.studio_id
    AND decision.automation_config_version = v_current.version
    AND intent.journey_type = v_current.journey_type
    AND delivery.status IN ('queued','failed');
  INSERT INTO public.automation_config_versions(
    studio_id,journey_type,version,mode,config,approved_at,approved_by
  ) VALUES (
    v_current.studio_id,v_current.journey_type,v_current.version + 1,p_mode,v_current.config,
    CASE WHEN p_mode = 'live' THEN now() ELSE NULL END,
    CASE WHEN p_mode = 'live' THEN p_actor_id ELSE NULL END
  ) RETURNING automation_config_versions.id INTO v_new_id;

  INSERT INTO public.admin_activity_log(
    actor_id,action,entity_type,entity_id,metadata
  ) VALUES (
    p_actor_id,'concierge.automation_version_promoted','automation_config_version',v_new_id,
    jsonb_build_object(
      'previous_id',v_current.id,'journey_type',v_current.journey_type,
      'previous_version',v_current.version,'version',v_current.version + 1,'mode',p_mode
    )
  );
  RETURN QUERY
  SELECT c.id,c.journey_type,c.version,c.mode
  FROM public.automation_config_versions c WHERE c.id = v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_concierge_automation(uuid,uuid,text,text)
  FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.promote_concierge_automation(uuid,uuid,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.suppress_disabled_concierge_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.enabled AND NOT NEW.enabled THEN
    UPDATE public.message_deliveries delivery
    SET status = 'suppressed',
        failure_class = 'configuration',
        error_code = 'concierge_channel_disabled',
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    FROM public.message_snapshots snapshot
    JOIN public.concierge_decisions decision ON decision.id = snapshot.decision_id
    WHERE delivery.snapshot_id = snapshot.id
      AND decision.studio_id = NEW.studio_id
      AND delivery.channel = NEW.channel
      AND delivery.status IN ('queued','failed');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS suppress_disabled_concierge_channel_trigger
  ON public.concierge_channel_controls;
CREATE TRIGGER suppress_disabled_concierge_channel_trigger
AFTER UPDATE OF enabled ON public.concierge_channel_controls
FOR EACH ROW EXECUTE FUNCTION public.suppress_disabled_concierge_channel();
