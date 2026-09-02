-- Imported delivery history must never become new transport work. Match the
-- existing claim_message_deliveries eligibility rule without modifying history.
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
  WITH candidates AS (
    SELECT delivery.id
    FROM public.message_deliveries AS delivery
    WHERE delivery.status = 'enqueued'
      AND delivery.task_enqueued_at < now() - interval '25 hours'
      AND delivery.channel IN ('in_app', 'push', 'email')
      AND EXISTS (
        SELECT 1 FROM public.messages AS message
        WHERE message.id = delivery.message_id
          AND (message.template_version = 'v2' OR message.legacy_source_table IS NULL)
      )
    ORDER BY delivery.task_enqueued_at, delivery.created_at
    FOR UPDATE OF delivery SKIP LOCKED
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
      AND EXISTS (
        SELECT 1 FROM public.messages AS message
        WHERE message.id = delivery.message_id
          AND (message.template_version = 'v2' OR message.legacy_source_table IS NULL)
      )
    ORDER BY delivery.lease_expires_at, delivery.created_at
    FOR UPDATE OF delivery SKIP LOCKED
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
    AND EXISTS (
      SELECT 1 FROM public.messages AS message
      WHERE message.id = delivery.message_id
        AND (message.template_version = 'v2' OR message.legacy_source_table IS NULL)
    )
  ORDER BY COALESCE(delivery.next_attempt_at, delivery.scheduled_for), delivery.created_at
  FOR UPDATE OF delivery SKIP LOCKED
  LIMIT GREATEST(v_limit - v_recovered - v_recovered_leases, 0);
END;
$$;

-- A stale or manually submitted task must not bypass the selector's boundary.
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
      AND EXISTS (
        SELECT 1 FROM public.messages AS message
        WHERE message.id = delivery.message_id
          AND (message.template_version = 'v2' OR message.legacy_source_table IS NULL)
      )
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
    FOR UPDATE OF delivery SKIP LOCKED
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

REVOKE ALL ON FUNCTION public.list_notification_deliveries_for_tasks(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_message_delivery_by_id(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_notification_deliveries_for_tasks(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_message_delivery_by_id(uuid, text, uuid, integer) TO service_role;
