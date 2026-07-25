-- Premium Concierge Notification System foundation.
-- Expand-only. All automations are paused/shadow/test_only; this migration sends nothing.

CREATE TABLE public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  week_starts_on smallint NOT NULL DEFAULT 0 CHECK (week_starts_on BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.studios (slug, name)
VALUES ('cloud-core', 'Cloud & Core Studio')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.communication_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  phone_e164 text,
  preferred_locale text NOT NULL DEFAULT 'ar' CHECK (preferred_locale IN ('ar','he','en')),
  is_adult boolean NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','anonymized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, member_id)
);

CREATE TABLE public.participant_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  account_holder_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  participant_member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  -- Polymorphic child identity: the kids module may be installed independently.
  -- Application and authorization checks resolve this to kid_aerial_children.
  participant_child_id uuid,
  payer_recipient_id uuid REFERENCES public.communication_recipients(id) ON DELETE SET NULL,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL CHECK (
    relationship_type IN ('self','parent','guardian','payer','other_authorized')
  ),
  authorized boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(participant_member_id, participant_child_id) = 1),
  UNIQUE NULLS NOT DISTINCT (studio_id, participant_member_id, participant_child_id, communication_recipient_id)
);

CREATE OR REPLACE FUNCTION public.validate_participant_recipient()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_adult boolean;
BEGIN
  SELECT is_adult INTO v_adult FROM public.communication_recipients
  WHERE id = NEW.communication_recipient_id AND studio_id = NEW.studio_id;
  IF v_adult IS NULL THEN RAISE EXCEPTION 'recipient_not_in_studio'; END IF;
  IF NEW.participant_child_id IS NOT NULL AND (
    NOT v_adult OR NOT NEW.authorized OR NEW.relationship_type NOT IN ('parent','guardian','other_authorized')
  ) THEN
    RAISE EXCEPTION 'authorized_adult_recipient_required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER participant_relationship_recipient_guard
BEFORE INSERT OR UPDATE ON public.participant_relationships
FOR EACH ROW EXECUTE FUNCTION public.validate_participant_recipient();

CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('push','email','whatsapp')),
  purpose text NOT NULL CHECK (
    purpose IN ('transactional','operational','schedule','promotional','receipt')
  ),
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  source text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (granted_at IS NOT NULL OR revoked_at IS NOT NULL),
  UNIQUE (studio_id, communication_recipient_id, channel, purpose, locale, policy_version)
);

CREATE TABLE public.automation_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_type text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  mode text NOT NULL DEFAULT 'paused' CHECK (mode IN ('paused','shadow','test_only','live')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, journey_type, version)
);

CREATE TABLE public.concierge_channel_controls (
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('in_app','push','email','whatsapp')),
  enabled boolean NOT NULL DEFAULT false,
  maintenance_only boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, channel)
);

INSERT INTO public.concierge_channel_controls (studio_id, channel, enabled)
SELECT id, channel, channel = 'in_app'
FROM public.studios CROSS JOIN unnest(ARRAY['in_app','push','email','whatsapp']) channel
ON CONFLICT DO NOTHING;

CREATE TABLE public.concierge_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  template_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app','push','email','whatsapp')),
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  version integer NOT NULL CHECK (version > 0),
  lifecycle_status text NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','approved','retired')),
  subject_template text,
  body_template text NOT NULL,
  required_variables text[] NOT NULL DEFAULT '{}',
  content_hash text NOT NULL,
  first_person_voice_approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, template_key, channel, locale, version)
);

CREATE UNIQUE INDEX concierge_one_approved_template
ON public.concierge_template_versions(studio_id, template_key, channel, locale)
WHERE lifecycle_status = 'approved';

CREATE TABLE public.domain_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  participant_id uuid,
  communication_recipient_id uuid REFERENCES public.communication_recipients(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_id uuid NOT NULL,
  causation_id uuid,
  deduplication_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  claim_timestamp timestamptz,
  worker_identifier text,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  last_error text,
  historical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, deduplication_key)
);

CREATE INDEX domain_outbox_claimable_idx
ON public.domain_outbox(studio_id, next_attempt_at, occurred_at)
WHERE processed_at IS NULL AND dead_lettered_at IS NULL AND historical = false;

CREATE OR REPLACE FUNCTION public.claim_domain_outbox(
  p_worker_identifier text,
  p_limit integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.domain_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.domain_outbox
    WHERE processed_at IS NULL
      AND dead_lettered_at IS NULL
      AND historical = false
      AND available_at <= now()
      AND next_attempt_at <= now()
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
    ORDER BY occurred_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  )
  UPDATE public.domain_outbox o
  SET claim_timestamp = now(),
      worker_identifier = p_worker_identifier,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = o.attempt_count + 1
  FROM candidates
  WHERE o.id = candidates.id
  RETURNING o.*;
END;
$$;

CREATE TABLE public.journey_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_type text NOT NULL,
  participant_id uuid,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','completed','cancelled','expired')),
  deduplication_key text NOT NULL,
  correlation_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, deduplication_key)
);

CREATE TABLE public.journey_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_instance_id uuid NOT NULL REFERENCES public.journey_instances(id) ON DELETE CASCADE,
  journey_type text NOT NULL,
  participant_id uuid,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('transactional','operational','schedule','promotional','receipt')),
  priority smallint NOT NULL CHECK (priority BETWEEN 1 AND 7),
  eligible_at timestamptz NOT NULL,
  expires_at timestamptz,
  cancellation_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  deduplication_key text NOT NULL,
  initial_policy_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','selected','postponed','suppressed','cancelled','expired','materialized')
  ),
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, deduplication_key)
);

CREATE INDEX journey_intents_recipient_due_idx
ON public.journey_intents(studio_id, communication_recipient_id, eligible_at, priority)
WHERE status IN ('pending','postponed');

CREATE TABLE public.recipient_contact_state (
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE CASCADE,
  last_external_contact_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, communication_recipient_id)
);

CREATE TABLE public.concierge_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_instance_id uuid REFERENCES public.journey_instances(id) ON DELETE SET NULL,
  intent_id uuid REFERENCES public.journey_intents(id) ON DELETE SET NULL,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  decision_key text NOT NULL,
  policy_version text NOT NULL,
  automation_config_version integer NOT NULL,
  template_id uuid REFERENCES public.concierge_template_versions(id) ON DELETE SET NULL,
  template_version integer,
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  channel text CHECK (channel IN ('in_app','push','email','whatsapp')),
  reason_codes text[] NOT NULL DEFAULT '{}',
  suppression_reason text,
  competing_action_ids uuid[] NOT NULL DEFAULT '{}',
  simulated boolean NOT NULL DEFAULT false,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, decision_key)
);

CREATE TABLE public.frequency_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL UNIQUE REFERENCES public.concierge_decisions(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  local_calendar_day date NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  released_at timestamptz
);

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
  v_local_day date := (p_now AT TIME ZONE 'Asia/Jerusalem')::date;
BEGIN
  INSERT INTO public.recipient_contact_state(studio_id, communication_recipient_id)
  VALUES (p_studio_id, p_recipient_id) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.recipient_contact_state
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id FOR UPDATE;

  SELECT
    count(*) FILTER (WHERE reserved_at > p_now - interval '6 hours'),
    count(*) FILTER (WHERE reserved_at > p_now - interval '24 hours'),
    count(*) FILTER (WHERE purpose = 'promotional' AND local_calendar_day = v_local_day),
    count(*) FILTER (WHERE purpose = 'promotional' AND reserved_at > p_now - interval '7 days')
  INTO v_six_hour, v_day, v_promo_day, v_promo_week
  FROM public.frequency_reservations
  WHERE studio_id = p_studio_id AND communication_recipient_id = p_recipient_id
    AND released_at IS NULL
    AND (consumed_at IS NOT NULL OR expires_at > p_now);

  IF v_six_hour >= 1 THEN RETURN QUERY SELECT false, 'six_hour_contact_cap'; RETURN; END IF;
  IF v_day >= 2 THEN RETURN QUERY SELECT false, 'daily_total_contact_cap'; RETURN; END IF;
  IF p_purpose = 'promotional' AND v_promo_day >= 1 THEN
    RETURN QUERY SELECT false, 'daily_promotional_cap'; RETURN;
  END IF;
  IF p_purpose = 'promotional' AND v_promo_week >= 3 THEN
    RETURN QUERY SELECT false, 'weekly_promotional_cap'; RETURN;
  END IF;

  INSERT INTO public.frequency_reservations(
    studio_id, communication_recipient_id, decision_id, purpose, local_calendar_day, expires_at
  ) VALUES (p_studio_id, p_recipient_id, p_decision_id, p_purpose, v_local_day, p_now + interval '8 days')
  ON CONFLICT (decision_id) DO NOTHING;
  RETURN QUERY SELECT true, NULL::text;
END;
$$;

CREATE TABLE public.message_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL UNIQUE REFERENCES public.concierge_decisions(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES public.concierge_template_versions(id) ON DELETE RESTRICT,
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  channel text NOT NULL CHECK (channel IN ('in_app','push','email','whatsapp')),
  rendered_variables jsonb NOT NULL,
  final_subject text,
  final_body text NOT NULL,
  content_hash text NOT NULL,
  correlation_id uuid NOT NULL,
  journey_instance_id uuid REFERENCES public.journey_instances(id) ON DELETE SET NULL,
  redact_after timestamptz,
  redacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_deliveries ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id);
ALTER TABLE public.message_delivery_attempts ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id);
ALTER TABLE public.message_webhook_events ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios(id);
ALTER TABLE public.message_deliveries ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES public.message_snapshots(id);
ALTER TABLE public.message_deliveries ADD COLUMN IF NOT EXISTS reconciliation_required boolean NOT NULL DEFAULT false;

CREATE TABLE public.inactivity_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  threshold_days integer NOT NULL CHECK (threshold_days > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at timestamptz NOT NULL,
  whatsapp_sent_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX inactivity_one_open_episode
ON public.inactivity_episodes(studio_id, participant_id)
WHERE status = 'open';

CREATE TABLE public.admin_attention_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  item_type text NOT NULL,
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal','urgent')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  deduplication_key text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (studio_id, deduplication_key)
);

CREATE TABLE public.weekly_schedule_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  studio_week_key text NOT NULL,
  campaign_kind text NOT NULL CHECK (campaign_kind IN ('initial','update')),
  revision integer,
  correction_reason text,
  deduplication_key text NOT NULL,
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode IN ('paused','shadow','test_only','live')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (
    (campaign_kind = 'initial' AND revision IS NULL AND correction_reason IS NULL)
    OR (campaign_kind = 'update' AND revision > 0 AND length(trim(correction_reason)) > 0)
  ),
  UNIQUE (studio_id, deduplication_key)
);

CREATE UNIQUE INDEX weekly_schedule_initial_once
ON public.weekly_schedule_campaigns(studio_id, studio_week_key)
WHERE campaign_kind = 'initial';
CREATE UNIQUE INDEX weekly_schedule_revision_once
ON public.weekly_schedule_campaigns(studio_id, studio_week_key, revision)
WHERE campaign_kind = 'update';

CREATE TABLE public.lead_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('instagram','whatsapp','manual','test')),
  provider_lead_id text NOT NULL,
  communication_recipient_id uuid REFERENCES public.communication_recipients(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'lead_received' CHECK (state IN (
    'lead_received','lead_acknowledged','staff_responded','trial_proposed','trial_booked',
    'trial_attended','package_purchased','lead_unqualified','lead_closed','trial_cancelled',
    'trial_no_show','follow_up_due'
  )),
  service_window_expires_at timestamptz,
  staff_responded_at timestamptz,
  follow_up_count integer NOT NULL DEFAULT 0 CHECK (follow_up_count BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, provider, provider_lead_id)
);

-- Admin-only access. Customer durable records remain in the existing member-facing messages table.
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_channel_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_contact_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequency_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inactivity_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_attention_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_schedule_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_journeys ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studios','communication_recipients','participant_relationships','consent_records',
    'automation_config_versions','concierge_channel_controls','concierge_template_versions',
    'domain_outbox','journey_instances','journey_intents','recipient_contact_state',
    'concierge_decisions','frequency_reservations','message_snapshots','inactivity_episodes',
    'admin_attention_items','weekly_schedule_campaigns','lead_journeys'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      'admins manage ' || t, t
    );
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.claim_domain_outbox(text, integer, integer) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.reserve_recipient_contact_capacity(uuid, uuid, uuid, text, timestamptz) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_domain_outbox(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_recipient_contact_capacity(uuid, uuid, uuid, text, timestamptz) TO service_role;

-- Existing members become self-recipients. Existing kids are intentionally not inferred:
-- guardian identity must be reviewed before a relationship is authorized.
INSERT INTO public.communication_recipients(
  studio_id, member_id, display_name, email, phone_e164, preferred_locale, is_adult
)
SELECT s.id, m.id, m.name, m.email, m.phone,
  CASE WHEN m.preferred_language IN ('ar','he','en') THEN m.preferred_language ELSE 'ar' END,
  true
FROM public.studios s CROSS JOIN public.members m
WHERE s.slug = 'cloud-core'
ON CONFLICT (studio_id, member_id) DO NOTHING;

INSERT INTO public.participant_relationships(
  studio_id, account_holder_id, participant_member_id, communication_recipient_id, relationship_type
)
SELECT r.studio_id, r.member_id, r.member_id, r.id, 'self'
FROM public.communication_recipients r
WHERE r.member_id IS NOT NULL
ON CONFLICT (studio_id, participant_member_id, participant_child_id, communication_recipient_id)
DO NOTHING;

INSERT INTO public.automation_config_versions(studio_id, journey_type, version, mode, config)
SELECT id, journey, 1, 'paused', jsonb_build_object(
  'policyVersion','concierge-2026-07-v1',
  'quietHours',jsonb_build_object('start','20:30','end','08:00','timezone','Asia/Jerusalem')
)
FROM public.studios CROSS JOIN unnest(ARRAY[
  'booking','booking_cancellation','class_change','waitlist','payment_outcome',
  'weekly_schedule','recommendation','retention','lead_to_trial','daily_briefing'
]) journey
ON CONFLICT DO NOTHING;

-- Canonical event emission occurs inside the same transaction as each mutation.
CREATE OR REPLACE FUNCTION public.emit_concierge_domain_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_studio_id uuid;
  v_event_type text;
  v_aggregate_id uuid := NEW.id;
  v_participant_id uuid;
  v_recipient_id uuid;
  v_business_version text;
  v_payload jsonb;
BEGIN
  SELECT id INTO v_studio_id FROM public.studios WHERE slug = 'cloud-core';
  IF TG_TABLE_NAME = 'bookings' THEN
    v_participant_id := NEW.member_id;
    SELECT communication_recipient_id INTO v_recipient_id
    FROM public.participant_relationships
    WHERE studio_id = v_studio_id AND participant_member_id = NEW.member_id
      AND authorized ORDER BY (relationship_type = 'self') DESC LIMIT 1;
    v_event_type := CASE
      WHEN TG_OP = 'INSERT' AND NEW.status = 'booked' THEN 'booking.confirmed'
      WHEN TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled'
        THEN 'booking.cancelled'
      ELSE NULL END;
    v_business_version := NEW.status;
    v_payload := jsonb_build_object('booking_id',NEW.id,'class_id',NEW.class_id,'status',NEW.status);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    v_participant_id := NEW.member_id;
    SELECT communication_recipient_id INTO v_recipient_id
    FROM public.participant_relationships
    WHERE studio_id = v_studio_id AND participant_member_id = NEW.member_id
      AND authorized ORDER BY (relationship_type = 'self') DESC LIMIT 1;
    v_event_type := CASE NEW.status
      WHEN 'paid' THEN 'payment.succeeded'
      WHEN 'failed' THEN 'payment.failed'
      WHEN 'pending' THEN 'payment.pending'
      ELSE NULL END;
    v_business_version := NEW.status;
    v_payload := jsonb_build_object(
      'payment_id',NEW.id,'member_id',NEW.member_id,'status',NEW.status,
      'provider',NEW.provider,'provider_payment_id',NEW.provider_payment_id
    );
  ELSIF TG_TABLE_NAME = 'classes' THEN
    v_event_type := CASE
      WHEN TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled'
        THEN 'class.cancelled'
      WHEN TG_OP = 'UPDATE' AND OLD.starts_at IS DISTINCT FROM NEW.starts_at
        THEN 'class.time_changed'
      ELSE NULL END;
    v_business_version := concat_ws(':', NEW.status, NEW.starts_at::text);
    v_payload := jsonb_build_object('class_id',NEW.id,'status',NEW.status,'starts_at',NEW.starts_at);
  ELSIF TG_TABLE_NAME = 'receipts' THEN
    v_participant_id := NEW.member_id;
    SELECT communication_recipient_id INTO v_recipient_id
    FROM public.participant_relationships
    WHERE studio_id = v_studio_id AND participant_member_id = NEW.member_id
      AND authorized ORDER BY (relationship_type = 'self') DESC LIMIT 1;
    v_event_type := 'receipt.issued';
    v_business_version := NEW.receipt_number;
    v_payload := jsonb_build_object(
      'receipt_id',NEW.id,'payment_id',NEW.payment_id,'receipt_number',NEW.receipt_number
    );
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.domain_outbox(
      studio_id,event_type,schema_version,aggregate_type,aggregate_id,participant_id,
      communication_recipient_id,correlation_id,deduplication_key,payload
    ) VALUES (
      v_studio_id,v_event_type,1,TG_TABLE_NAME,v_aggregate_id,v_participant_id,
      v_recipient_id,gen_random_uuid(),
      concat(v_event_type,':',v_aggregate_id,':',md5(v_business_version)),
      v_payload
    ) ON CONFLICT (studio_id,deduplication_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER concierge_booking_domain_event
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.emit_concierge_domain_event();
CREATE TRIGGER concierge_payment_domain_event
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.emit_concierge_domain_event();
CREATE TRIGGER concierge_class_domain_event
AFTER UPDATE OF status, starts_at ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.emit_concierge_domain_event();
CREATE TRIGGER concierge_receipt_domain_event
AFTER INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.emit_concierge_domain_event();
