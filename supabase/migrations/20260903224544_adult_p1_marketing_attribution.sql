-- P1 first-party marketing attribution. This is additive reporting context only:
-- it does not alter Adult P0 reservation, payment, HYP, or continuation semantics.

ALTER TABLE public.lead_journeys
  ADD COLUMN IF NOT EXISTS acquisition_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS contact_channel text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS attribution_evidence_kind text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS service_program_type_id uuid REFERENCES public.program_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_adset_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_id text,
  ADD COLUMN IF NOT EXISTS meta_creative_id text;

ALTER TABLE public.lead_journeys
  ADD CONSTRAINT lead_journeys_acquisition_source_check CHECK (
    acquisition_source IN (
      'meta_ads','instagram_organic','word_of_mouth','existing_customer_referral','other','unknown'
    )
  ) NOT VALID,
  ADD CONSTRAINT lead_journeys_contact_channel_check CHECK (
    contact_channel IN ('instagram_dm','whatsapp','phone','app','other','unknown')
  ) NOT VALID,
  ADD CONSTRAINT lead_journeys_attribution_evidence_kind_check CHECK (
    attribution_evidence_kind IN (
      'direct_meta_ad','instagram_organic','customer_stated','staff_selected','unknown'
    )
  ) NOT VALID,
  ADD CONSTRAINT lead_journeys_meta_identifier_length_check CHECK (
    (meta_campaign_id IS NULL OR char_length(meta_campaign_id) <= 64)
    AND (meta_adset_id IS NULL OR char_length(meta_adset_id) <= 64)
    AND (meta_ad_id IS NULL OR char_length(meta_ad_id) <= 64)
    AND (meta_creative_id IS NULL OR char_length(meta_creative_id) <= 64)
  ) NOT VALID;

-- Existing leads retain their legacy source/service/evidence fields and receive
-- explicit unknown attribution rather than an inferred classification.
ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_acquisition_source_check;
ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_contact_channel_check;
ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_attribution_evidence_kind_check;
ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_meta_identifier_length_check;

CREATE INDEX lead_journeys_adult_attribution_reporting_idx
  ON public.lead_journeys (
    acquisition_source, contact_channel, service_program_type_id, created_at DESC
  )
  WHERE provider = 'manual' AND provider_lead_id LIKE 'adult:%';

-- Preserve the P0 RPC signature and existing service-role boundary. P1 fields
-- are supplied through the existing evidence argument, validated here, and
-- persisted in dedicated canonical columns. Legacy evidence remains intact.
CREATE OR REPLACE FUNCTION public.create_adult_inquiry(
  p_actor_id uuid,
  p_contact_name text,
  p_phone_e164 text,
  p_email text,
  p_locale text,
  p_service text,
  p_locality text,
  p_source text,
  p_attribution_evidence jsonb,
  p_primary_question text,
  p_assigned_staff_id uuid,
  p_trial_interest boolean,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_studio_id uuid;
  v_recipient_id uuid;
  v_journey public.lead_journeys%ROWTYPE;
  v_acquisition_source text := COALESCE(NULLIF(trim(p_attribution_evidence->>'acquisition_source'), ''), 'unknown');
  v_contact_channel text := COALESCE(NULLIF(trim(p_attribution_evidence->>'contact_channel'), ''), 'unknown');
  v_evidence_kind text := COALESCE(NULLIF(trim(p_attribution_evidence->>'attribution_evidence_kind'), ''), 'unknown');
  v_service_program_type_id uuid;
  v_meta_campaign_id text := NULLIF(left(trim(COALESCE(p_attribution_evidence->>'meta_campaign_id', '')), 64), '');
  v_meta_adset_id text := NULLIF(left(trim(COALESCE(p_attribution_evidence->>'meta_adset_id', '')), 64), '');
  v_meta_ad_id text := NULLIF(left(trim(COALESCE(p_attribution_evidence->>'meta_ad_id', '')), 64), '');
  v_meta_creative_id text := NULLIF(left(trim(COALESCE(p_attribution_evidence->>'meta_creative_id', '')), 64), '');
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF length(trim(COALESCE(p_contact_name,''))) = 0 OR length(trim(COALESCE(p_idempotency_key,''))) = 0 THEN
    RETURN jsonb_build_object('status','invalid_input');
  END IF;
  IF v_acquisition_source NOT IN ('meta_ads','instagram_organic','word_of_mouth','existing_customer_referral','other','unknown')
    OR v_contact_channel NOT IN ('instagram_dm','whatsapp','phone','app','other','unknown')
    OR v_evidence_kind NOT IN ('direct_meta_ad','instagram_organic','customer_stated','staff_selected','unknown') THEN
    RETURN jsonb_build_object('status','invalid_attribution');
  END IF;
  IF (v_meta_campaign_id IS NOT NULL OR v_meta_adset_id IS NOT NULL OR v_meta_ad_id IS NOT NULL OR v_meta_creative_id IS NOT NULL)
    AND v_acquisition_source <> 'meta_ads' THEN
    RETURN jsonb_build_object('status','meta_identifiers_require_meta_source');
  END IF;
  IF NULLIF(trim(COALESCE(p_attribution_evidence->>'service_program_type_id', '')), '') IS NOT NULL THEN
    BEGIN
      v_service_program_type_id := (p_attribution_evidence->>'service_program_type_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('status','invalid_service_program_type');
    END;
    PERFORM 1 FROM public.program_types WHERE id = v_service_program_type_id AND active = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid_service_program_type'); END IF;
  END IF;

  SELECT id INTO v_studio_id FROM public.studios WHERE slug = 'cloud-core';
  IF v_studio_id IS NULL THEN RAISE EXCEPTION 'cloud_core_studio_missing'; END IF;

  SELECT * INTO v_journey FROM public.lead_journeys
    WHERE studio_id = v_studio_id AND provider = 'manual'
      AND provider_lead_id = 'adult:' || p_idempotency_key
    LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','already_created','lead_journey_id',v_journey.id,'recipient_id',v_journey.communication_recipient_id); END IF;

  IF NULLIF(trim(COALESCE(p_phone_e164,'')),'') IS NOT NULL THEN
    SELECT id INTO v_recipient_id FROM public.communication_recipients
      WHERE studio_id = v_studio_id AND phone_e164 = trim(p_phone_e164) AND status = 'active'
      ORDER BY created_at LIMIT 1;
  ELSIF NULLIF(trim(COALESCE(p_email,'')),'') IS NOT NULL THEN
    SELECT id INTO v_recipient_id FROM public.communication_recipients
      WHERE studio_id = v_studio_id AND lower(email) = lower(trim(p_email)) AND status = 'active'
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_recipient_id IS NULL THEN
    INSERT INTO public.communication_recipients(
      studio_id,display_name,phone_e164,email,preferred_locale,is_adult,status
    ) VALUES (
      v_studio_id,trim(p_contact_name),NULLIF(trim(p_phone_e164),''),NULLIF(trim(p_email),''),
      CASE WHEN p_locale IN ('ar','he','en') THEN p_locale ELSE 'ar' END,true,'active'
    ) RETURNING id INTO v_recipient_id;
  END IF;

  INSERT INTO public.lead_journeys(
    studio_id,provider,provider_lead_id,communication_recipient_id,state,service,locality,source,
    attribution_evidence,primary_question,assigned_staff_id,next_action,trial_interest,
    acquisition_source,contact_channel,attribution_evidence_kind,service_program_type_id,
    meta_campaign_id,meta_adset_id,meta_ad_id,meta_creative_id
  ) VALUES (
    v_studio_id,'manual','adult:' || p_idempotency_key,v_recipient_id,'lead_received',p_service,p_locality,
    p_source,
    COALESCE(p_attribution_evidence, '{}'::jsonb) - ARRAY[
      'acquisition_source','contact_channel','attribution_evidence_kind','service_program_type_id',
      'meta_campaign_id','meta_adset_id','meta_ad_id','meta_creative_id'
    ],
    p_primary_question,p_assigned_staff_id,
    CASE WHEN p_trial_interest THEN 'offer_class' ELSE 'reply' END,p_trial_interest,
    v_acquisition_source,v_contact_channel,v_evidence_kind,v_service_program_type_id,
    v_meta_campaign_id,v_meta_adset_id,v_meta_ad_id,v_meta_creative_id
  ) RETURNING * INTO v_journey;
  PERFORM public.adult_trial_emit_event(
    v_studio_id,'adult_inquiry_created','adult-inquiry:' || v_journey.id::text,v_journey.id,NULL,NULL,NULL,NULL,
    v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL
  );
  IF p_trial_interest THEN
    PERFORM public.adult_trial_emit_event(
      v_studio_id,'trial_interested','trial-interested:' || v_journey.id::text,v_journey.id,NULL,NULL,NULL,NULL,
      v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL
    );
  END IF;
  RETURN jsonb_build_object('status','created','lead_journey_id',v_journey.id,'recipient_id',v_recipient_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_adult_inquiry(uuid,text,text,text,text,text,text,text,jsonb,text,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_adult_inquiry(uuid,text,text,text,text,text,text,text,jsonb,text,uuid,boolean,text) TO service_role;
