-- Add a Cloud Tasks transport to the existing canonical messaging outbox.
-- Expand-only and disabled by runtime flags; existing delivery paths remain intact.

ALTER TABLE public.message_outbox
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS locale text;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS notification_schedule_version bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_class_notification_schedule_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.notification_schedule_version := OLD.notification_schedule_version + 1;
  ELSE
    NEW.notification_schedule_version := OLD.notification_schedule_version;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_class_notification_schedule_version ON public.classes;
CREATE TRIGGER trg_bump_class_notification_schedule_version
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.bump_class_notification_schedule_version();

UPDATE public.message_outbox AS outbox
SET template_key = COALESCE(outbox.template_key, outbox.event_type),
    template_version = COALESCE(outbox.template_version, 2),
    locale = COALESCE(
      outbox.locale,
      (SELECT CASE member.preferred_language
        WHEN 'ar' THEN 'ar'
        WHEN 'en' THEN 'en'
        ELSE 'he'
      END FROM public.members AS member WHERE member.id = outbox.member_id),
      'he'
    )
WHERE outbox.template_key IS NULL
   OR outbox.template_version IS NULL
   OR outbox.locale IS NULL;

ALTER TABLE public.message_outbox
  ALTER COLUMN template_key SET NOT NULL,
  ALTER COLUMN template_version SET NOT NULL,
  ALTER COLUMN template_version SET DEFAULT 2,
  ALTER COLUMN locale SET NOT NULL,
  ALTER COLUMN locale DROP DEFAULT;

ALTER TABLE public.message_outbox
  DROP CONSTRAINT IF EXISTS message_outbox_locale_check;
ALTER TABLE public.message_outbox
  ADD CONSTRAINT message_outbox_locale_check CHECK (locale IN ('he', 'ar', 'en'));

CREATE OR REPLACE FUNCTION public.populate_message_outbox_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.template_key := COALESCE(NULLIF(NEW.template_key, ''), NEW.event_type);
  NEW.template_version := COALESCE(NEW.template_version, 2);
  IF NEW.locale IS NULL OR NEW.locale = '' THEN
    SELECT CASE member.preferred_language
      WHEN 'ar' THEN 'ar'
      WHEN 'en' THEN 'en'
      ELSE 'he'
    END INTO NEW.locale
    FROM public.members AS member
    WHERE member.id = NEW.member_id;
    NEW.locale := COALESCE(NEW.locale, 'he');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_message_outbox_metadata ON public.message_outbox;
CREATE TRIGGER trg_populate_message_outbox_metadata
  BEFORE INSERT ON public.message_outbox
  FOR EACH ROW EXECUTE FUNCTION public.populate_message_outbox_metadata();

CREATE OR REPLACE FUNCTION public.protect_message_outbox_business_fact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.event_type, NEW.aggregate_type, NEW.aggregate_id, NEW.member_id,
    NEW.deduplication_key, NEW.template_key, NEW.template_version, NEW.locale,
    NEW.payload, NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.event_type, OLD.aggregate_type, OLD.aggregate_id, OLD.member_id,
    OLD.deduplication_key, OLD.template_key, OLD.template_version, OLD.locale,
    OLD.payload, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'message_outbox_business_fact_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_message_outbox_business_fact ON public.message_outbox;
CREATE TRIGGER trg_protect_message_outbox_business_fact
  BEFORE UPDATE ON public.message_outbox
  FOR EACH ROW EXECUTE FUNCTION public.protect_message_outbox_business_fact();

ALTER TABLE public.message_deliveries
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS task_name text,
  ADD COLUMN IF NOT EXISTS task_enqueued_at timestamptz,
  ADD COLUMN IF NOT EXISTS task_last_error_code text,
  ADD COLUMN IF NOT EXISTS task_generation integer NOT NULL DEFAULT 0;

ALTER TABLE public.message_deliveries
  DROP CONSTRAINT IF EXISTS message_deliveries_status_check;
ALTER TABLE public.message_deliveries
  ADD CONSTRAINT message_deliveries_status_check CHECK (
    status IN (
      'queued', 'enqueued', 'sending', 'accepted', 'sent', 'delivered', 'read', 'failed',
      'dead_letter', 'suppressed', 'expired', 'cancelled', 'delivery_unknown'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_task_name_uniq
  ON public.message_deliveries(task_name)
  WHERE task_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_deliveries_task_recovery_idx
  ON public.message_deliveries(
    status,
    COALESCE(next_attempt_at, scheduled_for),
    task_enqueued_at,
    created_at
  )
  WHERE channel IN ('in_app', 'push', 'email')
    AND status IN ('queued', 'enqueued', 'failed', 'sending');

CREATE OR REPLACE FUNCTION public.list_notification_deliveries_for_tasks(
  p_limit integer DEFAULT 100
)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(p_limit, 1), 100);
  v_recovered integer := 0;
  v_recovered_leases integer := 0;
BEGIN
  -- A task queue retries for 24 hours. Release only work whose task has been
  -- absent longer than that window, or whose delivery lease expired safely.
  WITH candidates AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    WHERE delivery.status = 'enqueued'
      AND delivery.task_enqueued_at < now() - interval '25 hours'
      AND delivery.channel IN ('in_app', 'push', 'email')
    ORDER BY delivery.task_enqueued_at, delivery.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'queued',
      task_name = NULL,
      task_enqueued_at = NULL,
      task_generation = delivery.task_generation + 1,
      task_last_error_code = 'task_retry_window_exhausted',
      updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id;
  GET DIAGNOSTICS v_recovered = ROW_COUNT;

  WITH candidates AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    WHERE delivery.status = 'sending'
      AND delivery.lease_expires_at < now()
      AND delivery.channel IN ('in_app', 'push', 'email')
    ORDER BY delivery.lease_expires_at, delivery.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(v_limit - v_recovered, 0)
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'failed',
      failure_class = 'transient',
      error_code = 'expired_delivery_lease_recovered',
      error_message = 'Delivery lease expired before a confirmed provider outcome.',
      next_attempt_at = now(),
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      task_name = NULL,
      task_enqueued_at = NULL,
      updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id;
  GET DIAGNOSTICS v_recovered_leases = ROW_COUNT;

  RETURN QUERY
  SELECT delivery.*
  FROM public.message_deliveries AS delivery
  WHERE delivery.channel IN ('in_app', 'push', 'email')
    AND delivery.status IN ('queued', 'failed')
    AND delivery.scheduled_for <= now()
    AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= now())
    AND (delivery.expires_at IS NULL OR delivery.expires_at > now())
  ORDER BY COALESCE(delivery.next_attempt_at, delivery.scheduled_for), delivery.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT GREATEST(v_limit - v_recovered - v_recovered_leases, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_obsolete_notification_reminders(
  p_limit integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer := 0;
BEGIN
  WITH candidates AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    JOIN public.messages AS message ON message.id = delivery.message_id
    LEFT JOIN public.bookings AS booking ON booking.id = message.related_booking_id
    LEFT JOIN public.classes AS studio_class ON studio_class.id = booking.class_id
    WHERE message.event_type IN ('class_reminder_planning', 'class_reminder_final')
      AND delivery.status IN ('queued', 'enqueued', 'failed')
      AND (
        booking.id IS NULL
        OR booking.status <> 'booked'
        OR studio_class.id IS NULL
        OR studio_class.status <> 'scheduled'
        OR studio_class.starts_at IS DISTINCT FROM (message.content->>'source_class_starts_at')::timestamptz
        OR (
          message.content->>'class_schedule_version' IS NOT NULL
          AND message.content->>'class_schedule_version'
            IS DISTINCT FROM studio_class.notification_schedule_version::text
        )
      )
    ORDER BY delivery.created_at
    FOR UPDATE OF delivery SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'cancelled',
      failure_class = NULL,
      error_code = 'reminder_business_state_changed',
      error_message = NULL,
      next_attempt_at = NULL,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      task_name = NULL,
      task_enqueued_at = NULL,
      updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id;
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RETURN v_cancelled;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notification_runtime_heartbeats (
  heartbeat_key text PRIMARY KEY CHECK (heartbeat_key IN ('maintenance', 'openwa')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_runtime_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_notification_runtime_heartbeat(
  p_heartbeat_key text,
  p_outcome text,
  p_summary jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_heartbeat_key NOT IN ('maintenance', 'openwa') THEN
    RAISE EXCEPTION 'invalid_notification_heartbeat_key';
  END IF;
  INSERT INTO public.notification_runtime_heartbeats(
    heartbeat_key, checked_at, outcome, summary, updated_at
  ) VALUES (
    p_heartbeat_key,
    now(),
    left(COALESCE(NULLIF(p_outcome, ''), 'unknown'), 40),
    COALESCE(p_summary, '{}'::jsonb),
    now()
  )
  ON CONFLICT (heartbeat_key) DO UPDATE
  SET checked_at = EXCLUDED.checked_at,
      outcome = EXCLUDED.outcome,
      summary = EXCLUDED.summary,
      updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.notification_delivery_health()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending_count', count(*) FILTER (WHERE delivery.status IN ('queued', 'enqueued')),
    'retry_wait_count', count(*) FILTER (WHERE delivery.status = 'failed'),
    'expired_lease_count', count(*) FILTER (
      WHERE delivery.status = 'sending' AND delivery.lease_expires_at < now()
    ),
    'permanently_failed_count', count(*) FILTER (
      WHERE delivery.status IN ('dead_letter', 'delivery_unknown')
    ),
    'sent_last_24_hours', count(*) FILTER (
      WHERE delivery.status IN ('accepted', 'sent', 'delivered', 'read')
        AND COALESCE(delivery.sent_at, delivery.accepted_at, delivery.delivered_at) >= now() - interval '24 hours'
    ),
    'oldest_pending_at', min(delivery.created_at) FILTER (
      WHERE delivery.status IN ('queued', 'enqueued', 'failed')
    ),
    'attempts_by_provider', (
      SELECT COALESCE(jsonb_object_agg(attempts.provider_key, attempts.total), '{}'::jsonb)
      FROM (
        SELECT COALESCE(attempt.provider, 'unknown') AS provider_key, count(*) AS total
        FROM public.message_delivery_attempts AS attempt
        WHERE attempt.started_at >= now() - interval '24 hours'
        GROUP BY COALESCE(attempt.provider, 'unknown')
      ) AS attempts
    ),
    'last_maintenance_execution', (
      SELECT heartbeat.checked_at
      FROM public.notification_runtime_heartbeats AS heartbeat
      WHERE heartbeat.heartbeat_key = 'maintenance'
    ),
    'last_whatsapp_worker_heartbeat', (
      SELECT heartbeat.checked_at
      FROM public.notification_runtime_heartbeats AS heartbeat
      WHERE heartbeat.heartbeat_key = 'openwa'
    )
  )
  FROM public.message_deliveries AS delivery;
$$;

CREATE OR REPLACE FUNCTION public.notification_whatsapp_consent_current(p_member_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_notification_preferences AS preferences
    WHERE preferences.member_id = p_member_id
      AND preferences.whatsapp_enabled = true
      AND preferences.whatsapp_opted_out_at IS NULL
      AND preferences.whatsapp_consented_at IS NOT NULL
      AND NULLIF(trim(preferences.whatsapp_consent_source), '') IS NOT NULL
      AND preferences.whatsapp_consent_source NOT IN (
        'existing_member_auto_enable', 'signup_auto_enable',
        'legacy_auto_enable_pending_reconsent'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_retry_notification_delivery(
  p_actor_id uuid,
  p_delivery_id uuid,
  p_now timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.message_deliveries%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR NOT public.has_role(p_actor_id, 'admin') THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  SELECT * INTO v_delivery
  FROM public.message_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_delivery.status NOT IN ('failed', 'dead_letter')
    OR (v_delivery.failure_class IS NOT NULL AND v_delivery.failure_class <> 'transient')
    OR (v_delivery.expires_at IS NOT NULL AND v_delivery.expires_at <= p_now)
    OR (
      v_delivery.channel = 'whatsapp'
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages AS message
        WHERE message.id = v_delivery.message_id
          AND public.notification_whatsapp_consent_current(message.member_id)
      )
    ) THEN
    RETURN false;
  END IF;
  UPDATE public.message_deliveries
  SET status = 'queued',
      failure_class = NULL,
      error_code = NULL,
      error_message = NULL,
      next_attempt_at = p_now,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      task_name = NULL,
      task_enqueued_at = NULL,
      updated_at = p_now
  WHERE id = p_delivery_id;
  INSERT INTO public.admin_activity_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_actor_id,
    'notification.delivery_retried',
    'message_delivery',
    p_delivery_id,
    jsonb_build_object('previous_status', v_delivery.status)
  );
  RETURN true;
END;
$$;

-- The Mac OpenWA bridge claims the same canonical delivery ledger as every
-- other channel. A fresh token is returned with each lease and current consent
-- is checked atomically immediately before the job leaves the database.
CREATE OR REPLACE FUNCTION public.claim_message_deliveries(
  p_worker text,
  p_limit integer DEFAULT 50,
  p_lease_seconds integer DEFAULT 120,
  p_channels text[] DEFAULT ARRAY['in_app']::text[]
)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(p_limit, 1), 200);
BEGIN
  WITH stale AS (
    SELECT id FROM public.message_deliveries
    WHERE status = 'sending' AND channel = ANY(p_channels)
      AND lease_expires_at IS NOT NULL AND lease_expires_at < now()
    ORDER BY lease_expires_at
    FOR UPDATE SKIP LOCKED LIMIT v_limit
  )
  UPDATE public.message_deliveries AS delivery
  SET status = CASE WHEN delivery.channel = 'whatsapp' THEN 'delivery_unknown' ELSE 'failed' END,
      failure_class = CASE WHEN delivery.channel = 'whatsapp' THEN 'ambiguous' ELSE 'transient' END,
      error_code = 'stale_worker_recovered',
      error_message = CASE
        WHEN delivery.channel = 'whatsapp' THEN 'Worker lease expired after a possible provider transmission; staff reconciliation required.'
        ELSE 'Worker lease expired; delivery released for an idempotent retry.'
      END,
      next_attempt_at = CASE WHEN delivery.channel = 'whatsapp' THEN NULL ELSE now() END,
      failed_at = now(), lease_owner = NULL, lease_token = NULL,
      lease_expires_at = NULL, updated_at = now()
  FROM stale WHERE delivery.id = stale.id;

  WITH expired AS (
    SELECT id FROM public.message_deliveries
    WHERE status IN ('queued', 'failed') AND channel = ANY(p_channels)
      AND expires_at IS NOT NULL AND expires_at <= now()
    ORDER BY expires_at
    FOR UPDATE SKIP LOCKED LIMIT v_limit
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'expired', updated_at = now(), lease_owner = NULL,
      lease_token = NULL, lease_expires_at = NULL
  FROM expired WHERE delivery.id = expired.id;

  WITH opted_out AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    JOIN public.messages AS message ON delivery.message_id = message.id
    WHERE delivery.channel = 'whatsapp' AND delivery.channel = ANY(p_channels)
      AND delivery.status IN ('queued', 'failed')
      AND NOT public.notification_whatsapp_consent_current(message.member_id)
    ORDER BY delivery.created_at
    FOR UPDATE OF delivery SKIP LOCKED LIMIT v_limit
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'suppressed', failure_class = NULL, error_code = 'whatsapp_consent_withdrawn',
      error_message = NULL, next_attempt_at = NULL, lease_owner = NULL,
      lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  FROM opted_out WHERE delivery.id = opted_out.id;

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    JOIN public.messages AS message ON message.id = delivery.message_id
    WHERE delivery.status IN ('queued', 'failed')
      AND delivery.channel = ANY(p_channels)
      AND delivery.scheduled_for <= now()
      AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= now())
      AND (delivery.expires_at IS NULL OR delivery.expires_at > now())
      AND (delivery.lease_expires_at IS NULL OR delivery.lease_expires_at < now())
      AND (message.template_version = 'v2' OR message.legacy_source_table IS NULL)
      AND (
        delivery.channel <> 'whatsapp'
        OR public.notification_whatsapp_consent_current(message.member_id)
      )
    ORDER BY COALESCE(delivery.next_attempt_at, delivery.scheduled_for), delivery.created_at
    FOR UPDATE OF delivery SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'sending', lease_owner = left(p_worker, 200), lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 900)),
      last_attempt_at = now(), attempt_count = delivery.attempt_count + 1, updated_at = now()
  FROM candidates
  WHERE delivery.id = candidates.id
  RETURNING delivery.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_task_enqueued(
  p_delivery_id uuid,
  p_task_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_deliveries AS delivery
  SET status = 'enqueued',
      task_name = p_task_name,
      task_enqueued_at = now(),
      task_last_error_code = NULL,
      updated_at = now()
  WHERE delivery.id = p_delivery_id
    AND delivery.status IN ('queued', 'failed');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_delivery_task_failed(
  p_delivery_id uuid,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_deliveries AS delivery
  SET task_last_error_code = left(COALESCE(NULLIF(p_error_code, ''), 'task_enqueue_failed'), 100),
      task_generation = CASE
        WHEN p_error_code = 'task_name_expired' THEN delivery.task_generation + 1
        ELSE delivery.task_generation
      END,
      updated_at = now()
  WHERE delivery.id = p_delivery_id
    AND delivery.status IN ('queued', 'failed');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_message_delivery_by_id(
  p_delivery_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 300
)
RETURNS SETOF public.message_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    WHERE delivery.id = p_delivery_id
      AND (
        delivery.status IN ('queued', 'enqueued', 'failed')
        OR (
          delivery.status = 'sending'
          AND delivery.channel IN ('in_app', 'push', 'email')
          AND delivery.lease_expires_at < now()
        )
      )
      AND delivery.scheduled_for <= now()
      AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= now())
      AND (delivery.expires_at IS NULL OR delivery.expires_at > now())
      AND (delivery.lease_expires_at IS NULL OR delivery.lease_expires_at < now())
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.message_deliveries AS delivery
  SET status = 'sending',
      lease_owner = left(p_worker, 200),
      lease_token = p_lease_token,
      lease_expires_at = now() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 900)),
      last_attempt_at = now(),
      attempt_count = delivery.attempt_count + 1,
      updated_at = now()
  FROM candidate
  WHERE delivery.id = candidate.id
  RETURNING delivery.*;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_message_outbox_metadata() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_class_notification_schedule_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_notification_deliveries_for_tasks(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_obsolete_notification_reminders(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_delivery_task_enqueued(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_delivery_task_failed(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_message_delivery_by_id(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_notification_runtime_heartbeat(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_delivery_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_retry_notification_delivery(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_whatsapp_consent_current(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.notification_runtime_heartbeats FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notification_runtime_heartbeats TO service_role;

GRANT EXECUTE ON FUNCTION public.populate_message_outbox_metadata() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_notification_deliveries_for_tasks(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_obsolete_notification_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_task_enqueued(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_delivery_task_failed(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_message_delivery_by_id(uuid, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_notification_runtime_heartbeat(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_delivery_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_retry_notification_delivery(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_consent_current(uuid) TO service_role;

COMMENT ON COLUMN public.message_outbox.template_key IS
  'Versioned rendering key captured with the immutable business event.';
COMMENT ON COLUMN public.message_outbox.locale IS
  'Locale snapshot used to render the historical event.';
COMMENT ON COLUMN public.message_deliveries.task_name IS
  'Cloud Tasks transport identifier. It never contains recipient or message content.';
COMMENT ON COLUMN public.message_deliveries.task_generation IS
  'Monotonic transport generation used to avoid stale Cloud Tasks name tombstones during recovery.';
