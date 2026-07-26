-- Allow the canonical delivery worker to claim Concierge deliveries.
-- Legacy deliveries are identified by template version v2; Concierge deliveries are
-- independently protected by an immutable, policy-validated message snapshot.

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
        WHERE m.id = d.message_id
          AND (m.template_version = 'v2' OR d.snapshot_id IS NOT NULL)
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

REVOKE ALL ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_message_deliveries(text, integer, integer, text[])
  TO service_role;
