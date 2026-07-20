-- Unified Messaging System, phases 1 and 2.
-- Expand-only: legacy messaging tables are retained and mirrored into this model.

CREATE TABLE IF NOT EXISTS public.message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  deduplication_key text NOT NULL UNIQUE,
  available_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  claimed_by text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'whatsapp',
  external_contact_id text NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unassigned'
    CHECK (status IN ('unassigned', 'claimed', 'resolved')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_inbound_at timestamptz,
  service_window_expires_at timestamptz,
  open_generation uuid NOT NULL DEFAULT gen_random_uuid(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_contact_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid REFERENCES public.message_outbox(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.message_conversations(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  audience text NOT NULL DEFAULT 'member' CHECK (audience IN ('member', 'admin')),
  event_type text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('he', 'ar', 'en')),
  template_key text,
  template_version text,
  subject text,
  body text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_visible boolean NOT NULL DEFAULT false,
  related_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  related_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  related_receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  related_package_request_id uuid REFERENCES public.package_requests(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  legacy_source_table text,
  legacy_source_id uuid,
  redacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_legacy_source_uniq
  ON public.messages(legacy_source_table, legacy_source_id)
  WHERE legacy_source_table IS NOT NULL AND legacy_source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'whatsapp')),
  provider text,
  recipient_address text,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued', 'sending', 'accepted', 'sent', 'delivered', 'read', 'failed',
      'dead_letter', 'suppressed', 'expired', 'cancelled', 'delivery_unknown'
    )
  ),
  provider_status text,
  provider_message_id text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_class text CHECK (
    failure_class IS NULL OR failure_class IN ('transient', 'permanent', 'ambiguous', 'configuration')
  ),
  error_code text,
  error_message text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, channel)
);

CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_provider_message_uniq
  ON public.message_deliveries(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.message_deliveries(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  provider text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  outcome text,
  provider_http_status integer,
  provider_error_code text,
  failure_class text CHECK (
    failure_class IS NULL OR failure_class IN ('transient', 'permanent', 'ambiguous', 'configuration')
  ),
  retry_after_seconds integer,
  next_attempt_at timestamptz,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.message_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('whatsapp', 'resend')),
  event_key text NOT NULL,
  event_type text,
  provider_message_id text,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (provider, event_key)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_template_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id text NOT NULL,
  template_name text NOT NULL,
  language text NOT NULL,
  version text NOT NULL,
  category text NOT NULL CHECK (category IN ('UTILITY', 'AUTHENTICATION', 'MARKETING')),
  content_hash text NOT NULL,
  provider_template_id text,
  approval_status text NOT NULL DEFAULT 'not_created',
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waba_id, template_name, language)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_provisioning_leases (
  waba_id text PRIMARY KEY,
  lease_owner text NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.apply_message_delivery_status(
  p_provider text,
  p_provider_message_id text,
  p_incoming_status text,
  p_provider_status text,
  p_occurred_at timestamptz,
  p_error_message text DEFAULT NULL,
  p_failure_class text DEFAULT NULL
)
RETURNS TABLE(delivery_id uuid, matched boolean, resulting_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivery public.message_deliveries%ROWTYPE;
  v_result text;
  v_current_rank integer;
  v_incoming_rank integer;
  v_advance boolean := false;
BEGIN
  SELECT * INTO v_delivery
  FROM public.message_deliveries d
  WHERE d.provider = p_provider AND d.provider_message_id = p_provider_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::text;
    RETURN;
  END IF;

  IF p_incoming_status NOT IN (
    'accepted', 'sent', 'delivered', 'read', 'failed', 'dead_letter', 'suppressed',
    'delivery_delayed'
  ) THEN
    RETURN QUERY SELECT v_delivery.id, true, v_delivery.status;
    RETURN;
  END IF;

  IF p_incoming_status = 'delivery_delayed' THEN
    UPDATE public.message_deliveries d
    SET provider_status = CASE
          WHEN d.status IN ('queued', 'sending', 'accepted', 'sent', 'failed')
            THEN p_provider_status
          ELSE d.provider_status
        END,
        updated_at = now()
    WHERE d.id = v_delivery.id;
    RETURN QUERY SELECT v_delivery.id, true, v_delivery.status;
    RETURN;
  END IF;

  v_current_rank := CASE v_delivery.status
    WHEN 'queued' THEN 0 WHEN 'sending' THEN 1 WHEN 'accepted' THEN 2
    WHEN 'sent' THEN 3 WHEN 'delivered' THEN 4 WHEN 'read' THEN 5
    ELSE NULL END;
  v_incoming_rank := CASE p_incoming_status
    WHEN 'accepted' THEN 2 WHEN 'sent' THEN 3 WHEN 'delivered' THEN 4 WHEN 'read' THEN 5
    ELSE NULL END;

  IF v_delivery.status IN ('dead_letter', 'suppressed', 'expired', 'cancelled', 'delivery_unknown') THEN
    v_advance := false;
  ELSIF p_incoming_status IN ('dead_letter', 'suppressed') THEN
    v_advance := true;
  ELSIF p_incoming_status = 'failed' THEN
    v_advance := v_delivery.status NOT IN ('delivered', 'read');
  ELSIF v_delivery.status = 'failed' THEN
    v_advance := true;
  ELSE
    v_advance := v_incoming_rank IS NOT NULL
      AND (v_current_rank IS NULL OR v_incoming_rank >= v_current_rank);
  END IF;

  v_result := CASE WHEN v_advance THEN p_incoming_status ELSE v_delivery.status END;
  UPDATE public.message_deliveries d
  SET status = v_result,
      provider_status = CASE WHEN v_advance THEN p_provider_status ELSE d.provider_status END,
      sent_at = CASE
        WHEN p_incoming_status = 'sent' THEN COALESCE(d.sent_at, p_occurred_at) ELSE d.sent_at END,
      delivered_at = CASE
        WHEN p_incoming_status = 'delivered' THEN COALESCE(d.delivered_at, p_occurred_at)
        ELSE d.delivered_at END,
      read_at = CASE
        WHEN p_incoming_status = 'read' THEN COALESCE(d.read_at, p_occurred_at) ELSE d.read_at END,
      failed_at = CASE
        WHEN p_incoming_status IN ('failed', 'dead_letter', 'suppressed')
          THEN COALESCE(d.failed_at, p_occurred_at)
        ELSE d.failed_at END,
      failure_class = CASE
        WHEN v_advance AND p_failure_class IS NOT NULL THEN p_failure_class ELSE d.failure_class END,
      error_message = CASE
        WHEN v_advance AND p_error_message IS NOT NULL THEN left(p_error_message, 500)
        ELSE d.error_message END,
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE d.id = v_delivery.id;

  IF p_provider = 'resend' AND p_provider_status = 'complained' THEN
    UPDATE public.member_notification_preferences p
    SET email_enabled = false,
        email_opted_out_at = COALESCE(p.email_opted_out_at, p_occurred_at),
        email_consent_source = 'resend_complaint',
        updated_at = now()
    FROM public.messages m
    WHERE m.id = v_delivery.message_id AND p.member_id = m.member_id;
  END IF;

  RETURN QUERY SELECT v_delivery.id, true, v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_whatsapp_message_conversation(
  p_external_contact_id text,
  p_member_id uuid,
  p_received_at timestamptz
)
RETURNS TABLE(
  conversation_id uuid,
  newly_opened boolean,
  acknowledgement_needed boolean,
  open_generation uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.message_conversations%ROWTYPE; v_generation uuid;
BEGIN
  INSERT INTO public.message_conversations (
    provider, external_contact_id, member_id, status, last_inbound_at,
    service_window_expires_at, open_generation, acknowledged_at, resolved_at
  ) VALUES (
    'whatsapp', p_external_contact_id, p_member_id, 'unassigned', p_received_at,
    p_received_at + interval '24 hours', gen_random_uuid(), NULL, NULL
  )
  ON CONFLICT (provider, external_contact_id) DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT v_row.id, true, true, v_row.open_generation;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.message_conversations c
  WHERE c.provider = 'whatsapp' AND c.external_contact_id = p_external_contact_id
  FOR UPDATE;

  IF v_row.status = 'resolved' THEN
    v_generation := gen_random_uuid();
    UPDATE public.message_conversations c
    SET member_id = COALESCE(p_member_id, c.member_id), status = 'unassigned', assigned_to = NULL,
        last_inbound_at = p_received_at,
        service_window_expires_at = p_received_at + interval '24 hours',
        open_generation = v_generation, acknowledged_at = NULL, resolved_at = NULL,
        updated_at = now()
    WHERE c.id = v_row.id
    RETURNING * INTO v_row;
    RETURN QUERY SELECT v_row.id, true, true, v_row.open_generation;
    RETURN;
  END IF;

  UPDATE public.message_conversations c
  SET member_id = COALESCE(c.member_id, p_member_id), last_inbound_at = p_received_at,
      service_window_expires_at = p_received_at + interval '24 hours', updated_at = now()
  WHERE c.id = v_row.id
  RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.id, false, v_row.acknowledged_at IS NULL, v_row.open_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_message_delivery_status(text, text, text, text, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_whatsapp_message_conversation(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_message_delivery_status(text, text, text, text, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_whatsapp_message_conversation(text, uuid, timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS message_outbox_due_idx
  ON public.message_outbox(available_at, created_at)
  WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS message_deliveries_due_idx
  ON public.message_deliveries(scheduled_for, next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS message_deliveries_message_idx
  ON public.message_deliveries(message_id, created_at);
CREATE INDEX IF NOT EXISTS message_delivery_attempts_delivery_idx
  ON public.message_delivery_attempts(delivery_id, attempt_number DESC);
CREATE INDEX IF NOT EXISTS message_webhook_events_received_idx
  ON public.message_webhook_events(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS message_conversations_inbox_idx
  ON public.message_conversations(status, last_inbound_at DESC);
CREATE INDEX IF NOT EXISTS messages_member_inbox_idx
  ON public.messages(member_id, created_at DESC)
  WHERE member_visible = true AND direction = 'outbound';

ALTER TABLE public.member_notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source text,
  ADD COLUMN IF NOT EXISTS email_consent_source text,
  ADD COLUMN IF NOT EXISTS whatsapp_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opted_out_at timestamptz;

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS messaging_canonical_writes_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.canonical_message_writes_enabled()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT messaging_canonical_writes_enabled FROM public.studio_settings WHERE id = 1),
    false
  )
$$;

UPDATE public.member_notification_preferences p
SET whatsapp_enabled = true,
    whatsapp_consent_source = COALESCE(p.whatsapp_consent_source, 'existing_member_auto_enable'),
    whatsapp_consented_at = COALESCE(p.whatsapp_consented_at, now())
FROM public.members m
WHERE m.id = p.member_id
  AND m.status = 'active'
  AND NULLIF(regexp_replace(COALESCE(m.phone, ''), '[^0-9+]', '', 'g'), '') IS NOT NULL
  AND p.whatsapp_opted_out_at IS NULL;

UPDATE public.member_notification_preferences p
SET email_enabled = true,
    email_consent_source = COALESCE(p.email_consent_source, 'existing_member_auto_enable'),
    email_consented_at = COALESCE(p.email_consented_at, now())
FROM public.members m
WHERE m.id = p.member_id
  AND m.status = 'active'
  AND COALESCE(m.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND p.email_opted_out_at IS NULL;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;

UPDATE public.waitlist_entries w
SET offered_at = COALESCE(w.offered_at, w.promoted_at),
    offer_expires_at = COALESCE(
      w.offer_expires_at,
      w.promoted_at + make_interval(mins => COALESCE(s.waitlist_claim_window_minutes, 30))
    )
FROM public.studio_settings s
WHERE s.id = 1 AND w.status = 'promoted' AND w.promoted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_waitlist_offer_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_minutes integer;
BEGIN
  IF NEW.status = 'promoted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT COALESCE(waitlist_claim_window_minutes, 30) INTO v_minutes
    FROM public.studio_settings WHERE id = 1;
    NEW.offered_at := COALESCE(NEW.offered_at, NEW.promoted_at, now());
    NEW.promoted_at := COALESCE(NEW.promoted_at, NEW.offered_at);
    NEW.offer_expires_at := COALESCE(
      NEW.offer_expires_at,
      NEW.offered_at + make_interval(mins => COALESCE(v_minutes, 30))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waitlist_offer_window ON public.waitlist_entries;
CREATE TRIGGER trg_waitlist_offer_window
  BEFORE INSERT OR UPDATE OF status, promoted_at ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_waitlist_offer_window();

CREATE OR REPLACE FUNCTION public.emit_message_outbox(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_member_id uuid,
  p_payload jsonb,
  p_deduplication_key text,
  p_available_at timestamptz DEFAULT now(),
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.message_outbox (
    event_type, aggregate_type, aggregate_id, member_id, payload,
    deduplication_key, available_at, expires_at
  ) VALUES (
    p_event_type, p_aggregate_type, p_aggregate_id, p_member_id,
    COALESCE(p_payload, '{}'::jsonb), p_deduplication_key,
    COALESCE(p_available_at, now()), p_expires_at
  )
  ON CONFLICT (deduplication_key) DO UPDATE
  SET deduplication_key = EXCLUDED.deduplication_key
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_message_outbox(text, text, uuid, uuid, jsonb, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_message_outbox(text, text, uuid, uuid, jsonb, text, timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_booking_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_class_status text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'booked' THEN
    v_event := 'booking_confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'booked' THEN
    v_event := 'booking_confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND NEW.status = 'cancelled' THEN
    SELECT status INTO v_class_status FROM public.classes WHERE id = NEW.class_id;
    IF v_class_status = 'cancelled' THEN RETURN NEW; END IF;
    v_event := 'booking_cancelled';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'booking', NEW.id, NEW.member_id,
    jsonb_build_object('booking_id', NEW.id, 'class_id', NEW.class_id),
    concat('booking:', NEW.id, ':', v_event, ':', txid_current()), now(), NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_message_outbox ON public.bookings;
CREATE TRIGGER trg_booking_message_outbox
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_booking_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_class_message_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking record; v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    v_event := 'class_cancelled_by_admin';
  ELSIF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN
    v_event := 'class_time_changed';
  ELSE
    RETURN NEW;
  END IF;
  FOR v_booking IN
    SELECT id, member_id FROM public.bookings WHERE class_id = NEW.id AND status = 'booked'
  LOOP
    PERFORM public.emit_message_outbox(
      v_event, 'class', NEW.id, v_booking.member_id,
      jsonb_build_object(
        'class_id', NEW.id, 'booking_id', v_booking.id,
        'previous_starts_at', OLD.starts_at, 'starts_at', NEW.starts_at
      ),
      concat('class:', NEW.id, ':', v_booking.member_id, ':', v_event, ':', txid_current()),
      now(), NULL
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_message_outbox ON public.classes;
CREATE TRIGGER trg_class_message_outbox
  AFTER UPDATE OF status, starts_at ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_class_message_events();

CREATE OR REPLACE FUNCTION public.enqueue_waitlist_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
    v_event := 'waitlist_joined';
  ELSIF NEW.status = 'promoted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'waitlist_spot_available';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'waitlist_entry', NEW.id, NEW.member_id,
    jsonb_build_object(
      'waitlist_entry_id', NEW.id, 'class_id', NEW.class_id,
      'offered_at', NEW.offered_at, 'offer_expires_at', NEW.offer_expires_at
    ),
    concat('waitlist:', NEW.id, ':', v_event, ':', txid_current()),
    now(), CASE WHEN v_event = 'waitlist_spot_available' THEN NEW.offer_expires_at ELSE NULL END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waitlist_message_outbox ON public.waitlist_entries;
CREATE TRIGGER trg_waitlist_message_outbox
  AFTER INSERT OR UPDATE OF status ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_waitlist_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_payment_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_confirmed';
  ELSIF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_failed';
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event := 'payment_request_received';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'payment', NEW.id, NEW.member_id,
    jsonb_build_object(
      'payment_id', NEW.id, 'plan_id', NEW.plan_id,
      'subscription_id', NEW.subscription_id, 'amount', NEW.amount, 'currency', NEW.currency
    ),
    concat('payment:', NEW.id, ':', v_event), now(), NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_message_outbox ON public.payments;
CREATE TRIGGER trg_payment_message_outbox
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_payment_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_subscription_failure_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF NEW.status = 'past_due'
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.retry_count IS DISTINCT FROM NEW.retry_count) THEN
    PERFORM public.emit_message_outbox(
      'payment_failed', 'member_subscription', NEW.id, NEW.member_id,
      jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id),
      concat('subscription:', NEW.id, ':payment_failed:', NEW.retry_count), now(), NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_failure_message_outbox ON public.member_subscriptions;
CREATE TRIGGER trg_subscription_failure_message_outbox
  AFTER UPDATE OF status, retry_count ON public.member_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_subscription_failure_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_receipt_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  PERFORM public.emit_message_outbox(
    'receipt_issued', 'receipt', NEW.id, NEW.member_id,
    jsonb_build_object('receipt_id', NEW.id, 'payment_id', NEW.payment_id),
    concat('receipt:', NEW.id, ':issued'), now(), NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_message_outbox ON public.receipts;
CREATE TRIGGER trg_receipt_message_outbox
  AFTER INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_receipt_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_package_request_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF NEW.status = 'requested' THEN
    PERFORM public.emit_message_outbox(
      'payment_request_received', 'package_request', NEW.id, NEW.member_id,
      jsonb_build_object('package_request_id', NEW.id, 'plan_id', NEW.plan_id),
      concat('package-request:', NEW.id, ':received'), now(), NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_request_message_outbox ON public.package_requests;
CREATE TRIGGER trg_package_request_message_outbox
  AFTER INSERT ON public.package_requests
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_package_request_message_event();

CREATE OR REPLACE FUNCTION public.claim_message_outbox(
  p_worker text,
  p_limit integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.message_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.message_outbox
    WHERE processed_at IS NULL
      AND available_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
      AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => p_lease_seconds))
    ORDER BY available_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  )
  UPDATE public.message_outbox o
  SET claimed_at = now(), claimed_by = p_worker,
      attempt_count = o.attempt_count + 1, updated_at = now()
  FROM candidates c WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_message_deliveries(
  p_worker text,
  p_limit integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 120,
  p_channels text[] DEFAULT ARRAY['in_app']::text[]
)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.message_deliveries
  SET status = CASE WHEN channel = 'whatsapp' THEN 'delivery_unknown' ELSE 'failed' END,
      failure_class = CASE WHEN channel = 'whatsapp' THEN 'ambiguous' ELSE 'transient' END,
      error_code = 'stale_worker_recovered',
      error_message = CASE
        WHEN channel = 'whatsapp' THEN 'Worker lease expired after a possible provider transmission; staff reconciliation required.'
        ELSE 'Worker lease expired; delivery released for an idempotent retry.'
      END,
      next_attempt_at = CASE WHEN channel = 'whatsapp' THEN NULL ELSE now() END,
      failed_at = now(), lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE status = 'sending' AND lease_expires_at IS NOT NULL AND lease_expires_at < now();

  UPDATE public.message_deliveries
  SET status = 'expired', updated_at = now(), lease_owner = NULL, lease_expires_at = NULL
  WHERE status IN ('queued', 'failed') AND expires_at IS NOT NULL AND expires_at <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.message_deliveries d
    WHERE status IN ('queued', 'failed')
      AND channel = ANY(p_channels)
      AND scheduled_for <= now()
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      AND (expires_at IS NULL OR expires_at > now())
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
      AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = d.message_id AND m.template_version = 'v2'
      )
    ORDER BY COALESCE(next_attempt_at, scheduled_for), created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
  )
  UPDATE public.message_deliveries d
  SET status = 'sending', lease_owner = p_worker,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now(), attempt_count = d.attempt_count + 1, updated_at = now()
  FROM candidates c WHERE d.id = c.id
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_message_outbox(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_message_outbox(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_whatsapp_provisioning_lease(
  p_waba_id text,
  p_owner text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.whatsapp_provisioning_leases (waba_id, lease_owner, lease_expires_at)
  VALUES (p_waba_id, p_owner, now() + make_interval(secs => p_lease_seconds))
  ON CONFLICT (waba_id) DO UPDATE
  SET lease_owner = EXCLUDED.lease_owner,
      lease_expires_at = EXCLUDED.lease_expires_at,
      updated_at = now()
  WHERE public.whatsapp_provisioning_leases.lease_expires_at < now()
     OR public.whatsapp_provisioning_leases.lease_owner = p_owner;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_whatsapp_provisioning_lease(p_waba_id text, p_owner text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.whatsapp_provisioning_leases
  WHERE waba_id = p_waba_id AND lease_owner = p_owner;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_whatsapp_provisioning_lease(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_whatsapp_provisioning_lease(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_whatsapp_provisioning_lease(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_provisioning_lease(text, text) TO service_role;

-- Preserve legacy source IDs and statuses without updating or deleting legacy rows.
INSERT INTO public.messages (
  member_id, direction, audience, event_type, language, template_key, template_version,
  subject, body, content, member_visible, related_booking_id, related_class_id,
  related_payment_id, related_receipt_id, related_package_request_id,
  idempotency_key, legacy_source_table, legacy_source_id, created_at
)
SELECT
  n.recipient_member_id, 'outbound',
  CASE WHEN n.staff_visibility = 'admin_only' THEN 'admin' ELSE 'member' END,
  n.trigger_type, COALESCE(NULLIF(n.language, ''), 'en'), n.template_key, 'legacy',
  n.subject, COALESCE(n.generated_text, n.payload->>'body'), n.payload,
  false, n.related_booking_id, n.related_class_id, n.related_payment_id,
  n.related_receipt_id, n.related_package_request_id,
  concat('legacy:notification_logs:', n.id), 'notification_logs', n.id, n.created_at
FROM public.notification_logs n
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.message_deliveries (
  message_id, channel, provider, status, provider_status, provider_message_id,
  idempotency_key, scheduled_for, attempt_count, next_attempt_at,
  sent_at, failed_at, error_message, created_at
)
SELECT
  m.id,
  CASE WHEN n.channel = 'email' THEN 'email' ELSE 'whatsapp' END,
  n.provider,
  CASE n.status
    WHEN 'sending' THEN 'sending'
    WHEN 'sent' THEN 'sent'
    WHEN 'manually_sent' THEN 'sent'
    WHEN 'marked_sent' THEN 'sent'
    WHEN 'failed' THEN 'failed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'skipped' THEN 'suppressed'
    ELSE 'queued'
  END,
  n.status, n.provider_message_id,
  concat('legacy:notification_logs:', n.id, ':delivery'),
  COALESCE(n.scheduled_for, n.created_at), COALESCE(n.attempt_count, 0), n.next_attempt_at,
  COALESCE(n.sent_at, n.marked_sent_at),
  CASE WHEN n.status = 'failed' THEN COALESCE(n.last_attempt_at, n.created_at) END,
  n.error_message, n.created_at
FROM public.notification_logs n
JOIN public.messages m
  ON m.legacy_source_table = 'notification_logs' AND m.legacy_source_id = n.id
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.messages (
  member_id, direction, audience, event_type, language, template_key, template_version,
  subject, body, content, member_visible, related_booking_id, related_class_id,
  related_payment_id, idempotency_key, legacy_source_table, legacy_source_id, created_at
)
SELECT
  n.member_id, 'outbound', 'member', n.category,
  COALESCE(NULLIF(m.preferred_language, ''), 'en'), n.category, 'legacy',
  n.title, n.body,
  jsonb_build_object('action_url', n.action_url, 'campaign_id', n.campaign_id),
  true, n.related_booking_id, n.related_class_id, n.related_payment_id,
  concat('legacy:member_notifications:', n.id), 'member_notifications', n.id, n.created_at
FROM public.member_notifications n
JOIN public.members m ON m.id = n.member_id
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.message_deliveries (
  message_id, channel, provider, status, idempotency_key, scheduled_for,
  delivered_at, read_at, created_at
)
SELECT m.id, 'in_app', 'internal',
  CASE WHEN n.read_at IS NOT NULL THEN 'read' ELSE 'delivered' END,
  concat('legacy:member_notifications:', n.id, ':in_app'), n.created_at,
  COALESCE(n.delivered_at, n.created_at), n.read_at, n.created_at
FROM public.member_notifications n
JOIN public.messages m
  ON m.legacy_source_table = 'member_notifications' AND m.legacy_source_id = n.id
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.message_deliveries (
  message_id, channel, provider, status, provider_status, provider_message_id,
  idempotency_key, scheduled_for, expires_at, attempt_count, next_attempt_at,
  sent_at, delivered_at, failed_at, error_message, created_at
)
SELECT m.id, 'push', 'apns',
  CASE n.delivery_status
    WHEN 'sending' THEN 'sending'
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'failed' THEN 'failed'
    WHEN 'suppressed' THEN 'suppressed'
    ELSE 'queued'
  END,
  n.delivery_status, n.apns_id,
  concat('legacy:member_notifications:', n.id, ':push'),
  COALESCE(n.scheduled_for, n.created_at), n.expires_at, n.attempt_count,
  n.next_attempt_at, n.sent_at, n.delivered_at,
  CASE WHEN n.delivery_status = 'failed' THEN COALESCE(n.last_attempt_at, n.created_at) END,
  n.suppression_reason, n.created_at
FROM public.member_notifications n
JOIN public.messages m
  ON m.legacy_source_table = 'member_notifications' AND m.legacy_source_id = n.id
ON CONFLICT (idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mirror_notification_log_to_canonical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_message_id uuid; v_status text;
BEGIN
  IF current_setting('app.messaging_rollback_reconciliation', true) = 'on'
     OR public.canonical_message_writes_enabled() THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.messages (
    member_id, direction, audience, event_type, language, template_key, template_version,
    subject, body, content, member_visible, related_booking_id, related_class_id,
    related_payment_id, related_receipt_id, related_package_request_id,
    idempotency_key, legacy_source_table, legacy_source_id, created_at, updated_at
  ) VALUES (
    NEW.recipient_member_id, 'outbound',
    CASE WHEN NEW.staff_visibility = 'admin_only' THEN 'admin' ELSE 'member' END,
    NEW.trigger_type,
    CASE WHEN NEW.language IN ('he', 'ar', 'en') THEN NEW.language ELSE 'en' END,
    NEW.template_key, 'legacy', NEW.subject,
    COALESCE(NEW.generated_text, NEW.payload->>'body'), NEW.payload, false,
    NEW.related_booking_id, NEW.related_class_id, NEW.related_payment_id,
    NEW.related_receipt_id, NEW.related_package_request_id,
    concat('legacy:notification_logs:', NEW.id), 'notification_logs', NEW.id,
    NEW.created_at, now()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    subject = EXCLUDED.subject, body = EXCLUDED.body, content = EXCLUDED.content,
    updated_at = now()
  RETURNING id INTO v_message_id;

  v_status := CASE NEW.status
    WHEN 'sending' THEN 'sending'
    WHEN 'sent' THEN 'sent'
    WHEN 'manually_sent' THEN 'sent'
    WHEN 'marked_sent' THEN 'sent'
    WHEN 'failed' THEN 'failed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'skipped' THEN 'suppressed'
    ELSE 'queued'
  END;

  INSERT INTO public.message_deliveries (
    message_id, channel, provider, status, provider_status, provider_message_id,
    idempotency_key, scheduled_for, attempt_count, next_attempt_at,
    sent_at, failed_at, error_message, created_at, updated_at
  ) VALUES (
    v_message_id, CASE WHEN NEW.channel = 'email' THEN 'email' ELSE 'whatsapp' END,
    NEW.provider, v_status, NEW.status, NEW.provider_message_id,
    concat('legacy:notification_logs:', NEW.id, ':delivery'),
    COALESCE(NEW.scheduled_for, NEW.created_at), COALESCE(NEW.attempt_count, 0),
    NEW.next_attempt_at, COALESCE(NEW.sent_at, NEW.marked_sent_at),
    CASE WHEN NEW.status = 'failed' THEN COALESCE(NEW.last_attempt_at, NEW.created_at) END,
    NEW.error_message, NEW.created_at, now()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    status = EXCLUDED.status, provider_status = EXCLUDED.provider_status,
    provider_message_id = EXCLUDED.provider_message_id,
    attempt_count = EXCLUDED.attempt_count, next_attempt_at = EXCLUDED.next_attempt_at,
    sent_at = EXCLUDED.sent_at, failed_at = EXCLUDED.failed_at,
    error_message = EXCLUDED.error_message, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_notification_log_to_canonical ON public.notification_logs;
CREATE TRIGGER trg_mirror_notification_log_to_canonical
  AFTER INSERT OR UPDATE ON public.notification_logs
  FOR EACH ROW EXECUTE FUNCTION public.mirror_notification_log_to_canonical();

CREATE OR REPLACE FUNCTION public.mirror_member_notification_to_canonical()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_message_id uuid; v_language text; v_event text; v_push_status text;
BEGIN
  IF current_setting('app.messaging_rollback_reconciliation', true) = 'on'
     OR public.canonical_message_writes_enabled() THEN
    RETURN NEW;
  END IF;
  SELECT CASE WHEN preferred_language IN ('he', 'ar', 'en') THEN preferred_language ELSE 'en' END
  INTO v_language FROM public.members WHERE id = NEW.member_id;
  v_event := CASE NEW.category
    WHEN 'payment_confirmed' THEN 'payment_confirmed'
    WHEN 'payment_failed' THEN 'payment_failed'
    WHEN 'urgent_class_change' THEN 'class_time_changed'
    WHEN 'waitlist' THEN 'waitlist_spot_available'
    WHEN 'lesson_reminder' THEN 'class_reminder_final'
    ELSE NEW.category
  END;

  INSERT INTO public.messages (
    member_id, direction, audience, event_type, language, template_key, template_version,
    subject, body, content, member_visible, related_booking_id, related_class_id,
    related_payment_id, idempotency_key, legacy_source_table, legacy_source_id,
    created_at, updated_at
  ) VALUES (
    NEW.member_id, 'outbound', 'member', v_event, COALESCE(v_language, 'en'),
    NEW.category, 'legacy', NEW.title, NEW.body,
    jsonb_build_object('action_url', NEW.action_url, 'campaign_id', NEW.campaign_id),
    true, NEW.related_booking_id, NEW.related_class_id, NEW.related_payment_id,
    concat('legacy:member_notifications:', NEW.id), 'member_notifications', NEW.id,
    NEW.created_at, now()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    subject = EXCLUDED.subject, body = EXCLUDED.body, content = EXCLUDED.content,
    updated_at = now()
  RETURNING id INTO v_message_id;

  INSERT INTO public.message_deliveries (
    message_id, channel, provider, status, idempotency_key, scheduled_for,
    delivered_at, read_at, created_at, updated_at
  ) VALUES (
    v_message_id, 'in_app', 'internal',
    CASE WHEN NEW.read_at IS NOT NULL THEN 'read' ELSE 'delivered' END,
    concat('legacy:member_notifications:', NEW.id, ':in_app'), NEW.created_at,
    COALESCE(NEW.delivered_at, NEW.created_at), NEW.read_at, NEW.created_at, now()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    status = EXCLUDED.status, delivered_at = EXCLUDED.delivered_at,
    read_at = EXCLUDED.read_at, updated_at = now();

  v_push_status := CASE NEW.delivery_status
    WHEN 'sending' THEN 'sending'
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'failed' THEN 'failed'
    WHEN 'suppressed' THEN 'suppressed'
    ELSE 'queued'
  END;
  INSERT INTO public.message_deliveries (
    message_id, channel, provider, status, provider_status, provider_message_id,
    idempotency_key, scheduled_for, expires_at, attempt_count, next_attempt_at,
    sent_at, delivered_at, failed_at, error_message, created_at, updated_at
  ) VALUES (
    v_message_id, 'push', 'apns', v_push_status, NEW.delivery_status, NEW.apns_id,
    concat('legacy:member_notifications:', NEW.id, ':push'),
    COALESCE(NEW.scheduled_for, NEW.created_at), NEW.expires_at, NEW.attempt_count,
    NEW.next_attempt_at, NEW.sent_at, NEW.delivered_at,
    CASE WHEN NEW.delivery_status = 'failed' THEN COALESCE(NEW.last_attempt_at, NEW.created_at) END,
    NEW.suppression_reason, NEW.created_at, now()
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    status = EXCLUDED.status, provider_status = EXCLUDED.provider_status,
    provider_message_id = EXCLUDED.provider_message_id,
    attempt_count = EXCLUDED.attempt_count, next_attempt_at = EXCLUDED.next_attempt_at,
    sent_at = EXCLUDED.sent_at, delivered_at = EXCLUDED.delivered_at,
    failed_at = EXCLUDED.failed_at, error_message = EXCLUDED.error_message,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_member_notification_to_canonical ON public.member_notifications;
CREATE TRIGGER trg_mirror_member_notification_to_canonical
  AFTER INSERT OR UPDATE ON public.member_notifications
  FOR EACH ROW EXECUTE FUNCTION public.mirror_member_notification_to_canonical();

CREATE OR REPLACE FUNCTION public.redact_and_purge_message_audit(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_redacted integer; v_webhook_bodies integer; v_deliveries integer;
  v_attempts integer; v_webhooks integer;
BEGIN
  UPDATE public.messages
  SET body = NULL,
      subject = CASE WHEN subject IS NULL THEN NULL ELSE '[redacted]' END,
      content = content - 'variables' - 'body' - 'text' - 'caption',
      redacted_at = p_now,
      updated_at = p_now
  WHERE redacted_at IS NULL AND created_at < p_now - interval '180 days';
  GET DIAGNOSTICS v_redacted = ROW_COUNT;

  UPDATE public.message_webhook_events
  SET payload = CASE
    WHEN jsonb_typeof(payload->'media') = 'object'
      THEN jsonb_set(payload - 'text', '{media}', (payload->'media') - 'caption')
    ELSE payload - 'text'
  END
  WHERE provider = 'whatsapp'
    AND received_at < p_now - interval '180 days'
    AND (payload ? 'text' OR (payload->'media') ? 'caption');
  GET DIAGNOSTICS v_webhook_bodies = ROW_COUNT;

  UPDATE public.message_deliveries
  SET recipient_address = NULL,
      provider_message_id = NULL,
      provider_payload = '{}'::jsonb,
      provider_status = NULL,
      error_code = NULL,
      error_message = NULL,
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = p_now
  WHERE created_at < p_now - interval '13 months'
    AND (
      recipient_address IS NOT NULL OR provider_message_id IS NOT NULL
      OR provider_payload <> '{}'::jsonb OR provider_status IS NOT NULL
      OR error_code IS NOT NULL OR error_message IS NOT NULL
      OR lease_owner IS NOT NULL OR lease_expires_at IS NOT NULL
    );
  GET DIAGNOSTICS v_deliveries = ROW_COUNT;

  DELETE FROM public.message_delivery_attempts
  WHERE created_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_attempts = ROW_COUNT;

  DELETE FROM public.message_webhook_events
  WHERE received_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;

  RETURN jsonb_build_object(
    'redacted_messages', v_redacted,
    'redacted_webhook_bodies', v_webhook_bodies,
    'redacted_deliveries', v_deliveries,
    'deleted_attempts', v_attempts,
    'deleted_webhooks', v_webhooks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redact_and_purge_message_audit(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redact_and_purge_message_audit(timestamptz) TO service_role;

ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_template_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_provisioning_leases ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.message_conversations TO authenticated;
GRANT SELECT ON public.message_deliveries TO authenticated;
GRANT SELECT ON public.whatsapp_template_deployments TO authenticated;
GRANT ALL ON public.message_outbox TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.message_deliveries TO service_role;
GRANT ALL ON public.message_delivery_attempts TO service_role;
GRANT ALL ON public.message_webhook_events TO service_role;
GRANT ALL ON public.message_conversations TO service_role;
GRANT ALL ON public.whatsapp_template_deployments TO service_role;
GRANT ALL ON public.whatsapp_provisioning_leases TO service_role;

CREATE POLICY "members read own canonical messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    AND member_visible = true
    AND direction = 'outbound'
    AND audience = 'member'
  );
CREATE POLICY "admins read canonical messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read message deliveries"
  ON public.message_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read message conversations"
  ON public.message_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read template deployments"
  ON public.whatsapp_template_deployments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.message_outbox IS 'Transactional outbox for canonical transactional messaging.';
COMMENT ON COLUMN public.messages.legacy_source_id IS 'Original row ID retained during non-destructive legacy backfill.';
COMMENT ON COLUMN public.message_deliveries.recipient_address IS 'Admin-only delivery target; never expose through member RLS or logs.';
COMMENT ON TABLE public.whatsapp_template_deployments IS 'WABA-scoped reconcile state. Production creation is never performed by a migration.';
