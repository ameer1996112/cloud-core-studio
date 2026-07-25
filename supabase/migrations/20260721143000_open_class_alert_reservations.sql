-- Atomically reserve automatic open-class alerts within rolling member frequency limits.
-- Expand-only: no existing rows or legacy notification data are changed.

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
  v_last_24_hours integer;
  v_last_7_days integer;
BEGIN
  IF p_class_id IS NULL OR p_member_id IS NULL OR p_spots_available < 1 OR p_starts_at <= now() THEN
    RAISE EXCEPTION 'invalid_open_class_alert_reservation';
  END IF;

  -- Concurrent sweeps for one member must decide quota and insert as one transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('open-class-alert:' || p_member_id::text, 0));

  SELECT
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
    count(*) FILTER (WHERE created_at >= now() - interval '7 days')
  INTO v_last_24_hours, v_last_7_days
  FROM public.message_outbox
  WHERE event_type = 'class_open_spots'
    AND member_id = p_member_id
    AND created_at >= now() - interval '7 days';

  IF v_last_24_hours >= 1 OR v_last_7_days >= 2 THEN
    RETURN NULL;
  END IF;

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
  'Atomically reserves one open-class outbox event while enforcing 1/24h and 2/7d member caps.';
