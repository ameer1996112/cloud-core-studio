-- Tune the premium member journey without widening production delivery.
-- Expand-only: all events remain allowlist-only and no legacy/canonical data is deleted.

INSERT INTO public.notification_event_rollouts (
  event_type,
  enabled,
  allowlist_only,
  copy_reviewed,
  enabled_channels,
  enabled_at,
  updated_at
)
SELECT event_type, true, true, true, enabled_channels, now(), now()
FROM (VALUES
  ('member_welcome', ARRAY['in_app', 'whatsapp', 'email']::text[]),
  ('booking_confirmed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('booking_cancelled', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('booking_changed', ARRAY['in_app', 'push', 'email']::text[]),
  ('booking_checked_in', ARRAY['in_app']::text[]),
  ('booking_no_show_followup', ARRAY['in_app', 'push']::text[]),
  ('class_cancelled_by_admin', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_time_changed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_location_changed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_instructor_changed', ARRAY['in_app', 'push']::text[]),
  ('class_reminder_planning', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('class_reminder_final', ARRAY['in_app', 'whatsapp']::text[]),
  ('class_published', ARRAY['in_app', 'push']::text[]),
  ('class_open_spots', ARRAY['in_app', 'push']::text[]),
  ('class_recommendation', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('waitlist_joined', ARRAY['in_app', 'push']::text[]),
  ('waitlist_position_changed', ARRAY['in_app']::text[]),
  ('waitlist_spot_available', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('waitlist_accepted', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('waitlist_offer_expired', ARRAY['in_app']::text[]),
  ('waitlist_removed', ARRAY['in_app', 'push']::text[]),
  ('payment_request_received', ARRAY['in_app', 'email']::text[]),
  ('payment_pending_reminder', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('payment_confirmed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('payment_failed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('payment_refunded', ARRAY['in_app', 'push', 'email']::text[]),
  ('receipt_issued', ARRAY['in_app', 'email']::text[]),
  ('membership_activated', ARRAY['in_app', 'push', 'email']::text[]),
  ('credits_low', ARRAY['in_app', 'push']::text[]),
  ('credits_depleted', ARRAY['in_app', 'push']::text[]),
  ('membership_expiring', ARRAY['in_app', 'push', 'email']::text[]),
  ('membership_expired', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_renewal_upcoming', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_renewal_succeeded', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('subscription_renewal_failed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('subscription_paused', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_cancelled', ARRAY['in_app', 'push', 'email']::text[]),
  ('human_handoff', ARRAY['whatsapp', 'in_app', 'push']::text[]),
  ('staff_reply', ARRAY['in_app', 'push']::text[]),
  ('human_handoff_resolved', ARRAY['in_app']::text[]),
  ('urgent_studio_announcement', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('trial_followup', ARRAY['in_app', 'push']::text[]),
  ('retention_reminder', ARRAY['in_app', 'push', 'whatsapp']::text[])
) AS catalog(event_type, enabled_channels)
ON CONFLICT (event_type) DO UPDATE SET
  copy_reviewed = true,
  allowlist_only = true,
  enabled_channels = EXCLUDED.enabled_channels,
  enabled_at = COALESCE(public.notification_event_rollouts.enabled_at, now()),
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.notification_experiment_assignments (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  experiment_key text NOT NULL,
  variant text NOT NULL CHECK (variant IN ('control', 'treatment')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, experiment_key)
);

ALTER TABLE public.notification_experiment_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_experiment_assignments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_experiment_assignments TO service_role;

COMMENT ON TABLE public.notification_experiment_assignments IS
  'Stable member-level assignments for measuring nonessential premium messaging incrementality.';

CREATE TABLE IF NOT EXISTS public.notification_growth_cooldowns (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  triggering_message_count integer NOT NULL CHECK (triggering_message_count >= 3),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at)
);

ALTER TABLE public.notification_growth_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_growth_cooldowns FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_growth_cooldowns TO service_role;

COMMENT ON TABLE public.notification_growth_cooldowns IS
  'Durable 30-day pause beginning with the third successfully sent but unengaged growth push.';

CREATE OR REPLACE FUNCTION public.reserve_promotional_notification(
  p_outbox_id uuid,
  p_member_id uuid,
  p_event_type text,
  p_now timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_count integer;
  v_week_count integer;
  v_unengaged_count integer;
  v_bucket integer;
  v_variant text;
  v_cooldown_expires_at timestamptz;
  v_third_unengaged_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-frequency:' || p_member_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.notification_frequency_reservations WHERE outbox_id = p_outbox_id
  ) THEN
    RETURN true;
  END IF;

  v_bucket := mod(
    abs(hashtextextended(p_member_id::text || ':premium_growth_v2', 0)::numeric),
    100
  )::integer;
  INSERT INTO public.notification_experiment_assignments (
    member_id, experiment_key, variant, assigned_at
  ) VALUES (
    p_member_id,
    'premium_growth_v2',
    CASE WHEN v_bucket < 10 THEN 'control' ELSE 'treatment' END,
    p_now
  ) ON CONFLICT (member_id, experiment_key) DO NOTHING;

  SELECT variant INTO v_variant
  FROM public.notification_experiment_assignments
  WHERE member_id = p_member_id AND experiment_key = 'premium_growth_v2';
  IF v_variant = 'control' THEN RETURN false; END IF;

  SELECT expires_at INTO v_cooldown_expires_at
  FROM public.notification_growth_cooldowns
  WHERE member_id = p_member_id;
  IF v_cooldown_expires_at > p_now THEN RETURN false; END IF;

  SELECT count(*), max(ignored.successful_at)
  INTO v_unengaged_count, v_third_unengaged_at
  FROM (
    SELECT DISTINCT
      reservation.id,
      COALESCE(
        delivery.sent_at,
        delivery.accepted_at,
        delivery.delivered_at,
        delivery.read_at
      ) AS successful_at
    FROM public.notification_frequency_reservations reservation
    JOIN public.messages message ON message.outbox_id = reservation.outbox_id
    JOIN public.message_deliveries delivery ON delivery.message_id = message.id
    WHERE reservation.member_id = p_member_id
      AND reservation.event_type IN (
        'class_open_spots', 'class_recommendation', 'retention_reminder'
      )
      AND delivery.channel = 'push'
      AND delivery.status IN ('accepted', 'sent', 'delivered', 'read')
      AND COALESCE(
        delivery.sent_at,
        delivery.accepted_at,
        delivery.delivered_at,
        delivery.read_at
      ) >= COALESCE(v_cooldown_expires_at, p_now - interval '30 days')
      AND NOT EXISTS (
        SELECT 1
        FROM public.message_engagement_events engagement
        WHERE engagement.message_id = message.id
          AND engagement.event_type IN ('opened', 'actioned', 'converted')
      )
    ORDER BY successful_at
    LIMIT 3
  ) ignored;
  IF v_unengaged_count >= 3 THEN
    INSERT INTO public.notification_growth_cooldowns (
      member_id, started_at, expires_at, triggering_message_count, updated_at
    ) VALUES (
      p_member_id,
      v_third_unengaged_at,
      v_third_unengaged_at + interval '30 days',
      v_unengaged_count,
      p_now
    )
    ON CONFLICT (member_id) DO UPDATE SET
      started_at = EXCLUDED.started_at,
      expires_at = EXCLUDED.expires_at,
      triggering_message_count = EXCLUDED.triggering_message_count,
      updated_at = EXCLUDED.updated_at;
    IF v_third_unengaged_at + interval '30 days' > p_now THEN RETURN false; END IF;
  END IF;

  SELECT
    count(*) FILTER (WHERE created_at >= p_now - interval '24 hours'),
    count(*) FILTER (WHERE created_at >= p_now - interval '7 days')
  INTO v_day_count, v_week_count
  FROM public.notification_frequency_reservations
  WHERE member_id = p_member_id AND created_at >= p_now - interval '7 days';

  IF v_day_count >= 1 OR v_week_count >= 3 THEN RETURN false; END IF;

  INSERT INTO public.notification_frequency_reservations (
    outbox_id, member_id, event_type, created_at
  ) VALUES (p_outbox_id, p_member_id, p_event_type, p_now);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_promotional_notification(uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_promotional_notification(uuid, uuid, text, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_open_class_alert(
  p_class_id uuid,
  p_member_id uuid,
  p_spots_available integer,
  p_starts_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outbox_id uuid;
  v_class_alert_count integer;
  v_last_24_hours integer;
  v_last_7_days integer;
BEGIN
  IF p_class_id IS NULL OR p_member_id IS NULL OR p_spots_available < 1 OR p_starts_at <= now() THEN
    RAISE EXCEPTION 'invalid_open_class_alert_reservation';
  END IF;

  -- Lock class first, then member, so every concurrent worker uses the same ordering.
  PERFORM pg_advisory_xact_lock(hashtextextended('open-class-cap:' || p_class_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('open-class-alert:' || p_member_id::text, 0));

  SELECT count(*) INTO v_class_alert_count
  FROM public.message_outbox
  WHERE event_type = 'class_open_spots' AND aggregate_id = p_class_id;
  IF v_class_alert_count >= 10 THEN RETURN NULL; END IF;

  SELECT
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')
  INTO v_last_24_hours, v_last_7_days
  FROM public.message_outbox
  WHERE event_type = 'class_open_spots'
    AND member_id = p_member_id
    AND created_at >= now() - interval '7 days';

  IF v_last_24_hours >= 1 OR v_last_7_days >= 3 THEN RETURN NULL; END IF;

  INSERT INTO public.message_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    member_id,
    payload,
    deduplication_key,
    available_at,
    expires_at
  ) VALUES (
    'class_open_spots',
    'class',
    p_class_id,
    p_member_id,
    jsonb_build_object('class_id', p_class_id, 'spots_available', p_spots_available),
    'class:' || p_class_id::text || ':class_open_spots:member:' || p_member_id::text,
    now(),
    p_starts_at
  )
  ON CONFLICT (deduplication_key) DO NOTHING
  RETURNING id INTO v_outbox_id;

  RETURN v_outbox_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_open_class_alert(uuid, uuid, integer, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_open_class_alert(uuid, uuid, integer, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.enqueue_open_class_alert(uuid, uuid, integer, timestamptz) IS
  'Atomically enforces one/day, three/week, deduplication, and ten recipients per class.';

CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone text;
  v_phone_enabled boolean;
  v_email_enabled boolean;
  v_now timestamptz := now();
  v_previous_source text;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status IS DISTINCT FROM 'active'
  ) THEN
    RETURN NEW;
  END IF;

  v_normalized_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9+]', '', 'g');
  v_phone_enabled := NEW.status = 'active'
    AND v_normalized_phone ~ '^\+[1-9][0-9]{7,14}$';
  v_email_enabled := NEW.status = 'active'
    AND COALESCE(NEW.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  IF TG_OP = 'UPDATE' THEN
    v_previous_source := current_setting('app.notification_preference_source', true);
    PERFORM set_config(
      'app.notification_preference_source',
      'member_activation_auto_enable',
      true
    );
  END IF;

  INSERT INTO public.member_notification_preferences AS preferences (
    member_id,
    whatsapp_enabled,
    email_enabled,
    whatsapp_consent_source,
    email_consent_source,
    whatsapp_consented_at,
    email_consented_at
  ) VALUES (
    NEW.id,
    v_phone_enabled,
    v_email_enabled,
    CASE WHEN v_phone_enabled THEN 'new_active_member_auto_enable' END,
    CASE WHEN v_email_enabled THEN 'new_active_member_auto_enable' END,
    CASE WHEN v_phone_enabled THEN v_now END,
    CASE WHEN v_email_enabled THEN v_now END
  )
  ON CONFLICT (member_id) DO UPDATE SET
    whatsapp_enabled = CASE
      WHEN preferences.whatsapp_consent_source IS NULL
       AND preferences.whatsapp_opted_out_at IS NULL
      THEN EXCLUDED.whatsapp_enabled
      ELSE preferences.whatsapp_enabled
    END,
    email_enabled = CASE
      WHEN preferences.email_consent_source IS NULL
       AND preferences.email_opted_out_at IS NULL
      THEN EXCLUDED.email_enabled
      ELSE preferences.email_enabled
    END,
    whatsapp_consent_source = COALESCE(
      preferences.whatsapp_consent_source,
      EXCLUDED.whatsapp_consent_source
    ),
    email_consent_source = COALESCE(
      preferences.email_consent_source,
      EXCLUDED.email_consent_source
    ),
    whatsapp_consented_at = COALESCE(
      preferences.whatsapp_consented_at,
      EXCLUDED.whatsapp_consented_at
    ),
    email_consented_at = COALESCE(
      preferences.email_consented_at,
      EXCLUDED.email_consented_at
    ),
    updated_at = v_now;
  IF TG_OP = 'UPDATE' THEN
    PERFORM set_config(
      'app.notification_preference_source',
      COALESCE(v_previous_source, ''),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_notification_preferences ON public.members;
CREATE TRIGGER trg_member_notification_preferences
  AFTER INSERT OR UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_member_notification_preferences();

REVOKE ALL ON FUNCTION public.ensure_member_notification_preferences()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_member_notification_preferences() TO service_role;

COMMENT ON FUNCTION public.ensure_member_notification_preferences() IS
  'Initializes valid channels on insert or activation without reversing an explicit member opt-out.';

CREATE OR REPLACE FUNCTION public.enqueue_member_welcome_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'active'
     OR NOT public.canonical_message_writes_enabled()
     OR NOT public.premium_notification_event_enabled('member_welcome')
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_message_outbox(
    'member_welcome',
    'member',
    NEW.id,
    NEW.id,
    '{}'::jsonb,
    'member:welcome:' || NEW.id::text || ':v2',
    now(),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_welcome_outbox ON public.members;
CREATE TRIGGER trg_member_welcome_outbox
  AFTER INSERT OR UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_member_welcome_message_event();

REVOKE ALL ON FUNCTION public.enqueue_member_welcome_message_event()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_member_welcome_message_event() TO service_role;

COMMENT ON FUNCTION public.enqueue_member_welcome_message_event() IS
  'Emits one deduplicated welcome when a member is inserted active or later becomes active.';

CREATE OR REPLACE FUNCTION public.enqueue_payment_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_payment_was_failing boolean := false;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    v_payment_was_failing := OLD.status = 'failed';
  END IF;

  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_confirmed';
  ELSIF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_failed';
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event := 'payment_request_received';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('refunded', 'partially_refunded')
        AND public.premium_notification_event_enabled('payment_refunded') THEN
    v_event := 'payment_refunded';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.emit_message_outbox(
    v_event,
    'payment',
    NEW.id,
    NEW.member_id,
    jsonb_build_object(
      'payment_id', NEW.id,
      'plan_id', NEW.plan_id,
      'subscription_id', NEW.subscription_id,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'payment_was_failing', v_payment_was_failing
    ),
    concat('payment:', NEW.id, ':', v_event),
    now(),
    NULL
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_payment_message_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_payment_message_event() TO service_role;
