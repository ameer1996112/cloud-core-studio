CREATE OR REPLACE FUNCTION public.admin_delete_class(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_bookings int := 0;
  v_attendance int := 0;
  v_waitlist int := 0;
  v_notifications int := 0;
  v_financial int := 0;
  v_reason text := null;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'forbidden');
  END IF;

  SELECT *
  INTO v_class
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'class_not_found');
  END IF;

  SELECT count(*) INTO v_bookings
  FROM public.bookings
  WHERE class_id = p_class_id;

  SELECT count(*) INTO v_attendance
  FROM public.attendance_records
  WHERE class_id = p_class_id;

  SELECT count(*) INTO v_waitlist
  FROM public.waitlist_entries
  WHERE class_id = p_class_id;

  SELECT count(*) INTO v_notifications
  FROM public.notification_logs
  WHERE related_class_id = p_class_id;

  SELECT count(*) INTO v_financial
  FROM public.credit_transactions ct
  JOIN public.bookings b ON b.id = ct.related_booking_id
  WHERE b.class_id = p_class_id;

  IF v_bookings > 0 THEN
    v_reason := 'has_bookings';
  ELSIF v_attendance > 0 THEN
    v_reason := 'has_attendance';
  ELSIF v_waitlist > 0 THEN
    v_reason := 'has_waitlist';
  ELSIF v_notifications > 0 THEN
    v_reason := 'has_notifications';
  ELSIF v_financial > 0 THEN
    v_reason := 'has_financial_history';
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'reason', v_reason,
      'counts', jsonb_build_object(
        'bookings', v_bookings,
        'attendance', v_attendance,
        'waitlist', v_waitlist,
        'notifications', v_notifications,
        'financial', v_financial
      )
    );
  END IF;

  DELETE FROM public.classes WHERE id = p_class_id;

  PERFORM public._log_action_as(
    p_actor_id,
    'class.deleted',
    'class',
    p_class_id,
    jsonb_build_object('title', v_class.title)
  );

  RETURN jsonb_build_object('status', 'deleted');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_class(
  p_actor_id uuid,
  p_class_id uuid,
  p_reason text DEFAULT NULL,
  p_refund boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_cancel_result jsonb;
  v_cancelled_booking_ids uuid[] := ARRAY[]::uuid[];
  v_refunded_booking_ids uuid[] := ARRAY[]::uuid[];
  v_closed_waitlist_ids uuid[] := ARRAY[]::uuid[];
  v_bookings_cancelled int := 0;
  v_credits_returned int := 0;
  v_waitlist_closed int := 0;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'forbidden');
  END IF;

  SELECT *
  INTO v_class
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'class_not_found');
  END IF;

  IF v_class.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'status', 'already_cancelled',
      'class_id', p_class_id,
      'cancelled_booking_ids', v_cancelled_booking_ids,
      'refunded_booking_ids', v_refunded_booking_ids,
      'closed_waitlist_ids', v_closed_waitlist_ids,
      'bookings_cancelled', 0,
      'credits_returned', 0,
      'waitlist_closed', 0
    );
  END IF;

  UPDATE public.classes
  SET status = 'cancelled'
  WHERE id = p_class_id;

  FOR v_booking IN
    SELECT *
    FROM public.bookings
    WHERE class_id = p_class_id
      AND status = 'booked'
    ORDER BY created_at
  LOOP
    v_cancel_result := public.admin_cancel_booking(p_actor_id, v_booking.id, p_refund);

    IF v_cancel_result->>'status' = 'cancelled' THEN
      v_cancelled_booking_ids := array_append(v_cancelled_booking_ids, v_booking.id);
      v_bookings_cancelled := v_bookings_cancelled + 1;

      IF p_refund AND coalesce(v_booking.credit_cost, 0) > 0 THEN
        v_refunded_booking_ids := array_append(v_refunded_booking_ids, v_booking.id);
        v_credits_returned := v_credits_returned + v_booking.credit_cost;
      END IF;
    END IF;
  END LOOP;

  WITH closed_waitlist AS (
    UPDATE public.waitlist_entries
    SET status = 'cancelled'
    WHERE class_id = p_class_id
      AND status IN ('waiting', 'offered')
    RETURNING id
  )
  SELECT
    coalesce(array_agg(id), ARRAY[]::uuid[]),
    count(*)
  INTO v_closed_waitlist_ids, v_waitlist_closed
  FROM closed_waitlist;

  UPDATE public.classes
  SET waitlist_count = GREATEST(0, waitlist_count - v_waitlist_closed)
  WHERE id = p_class_id;

  PERFORM public._log_action_as(
    p_actor_id,
    'class.cancelled',
    'class',
    p_class_id,
    jsonb_build_object(
      'reason', p_reason,
      'refund', p_refund,
      'bookings_cancelled', v_bookings_cancelled,
      'waitlist_closed', v_waitlist_closed
    )
  );

  RETURN jsonb_build_object(
    'status', 'cancelled',
    'class_id', p_class_id,
    'cancelled_booking_ids', v_cancelled_booking_ids,
    'refunded_booking_ids', v_refunded_booking_ids,
    'closed_waitlist_ids', v_closed_waitlist_ids,
    'bookings_cancelled', v_bookings_cancelled,
    'credits_returned', v_credits_returned,
    'waitlist_closed', v_waitlist_closed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_class(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_cancel_class(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_delete_class(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_class(uuid, uuid, text, boolean) TO service_role;
