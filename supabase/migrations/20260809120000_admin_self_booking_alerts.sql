-- Notify studio admins when a member completes a class booking herself.

INSERT INTO public.notification_event_rollouts (
  event_type,
  enabled,
  allowlist_only,
  copy_reviewed,
  enabled_channels,
  enabled_at,
  updated_at
)
SELECT
  event_type,
  true,
  false,
  true,
  enabled_channels,
  now(),
  now()
FROM (
  VALUES ('booking_registered_admin', ARRAY['push', 'email']::text[])
) AS rollout(event_type, enabled_channels)
ON CONFLICT (event_type) DO UPDATE
SET enabled = EXCLUDED.enabled,
    allowlist_only = EXCLUDED.allowlist_only,
    copy_reviewed = EXCLUDED.copy_reviewed,
    enabled_channels = EXCLUDED.enabled_channels,
    enabled_at = COALESCE(public.notification_event_rollouts.enabled_at, EXCLUDED.enabled_at),
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.book_class_v2(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := p_actor_id;
  v_class public.classes%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_existing public.bookings%ROWTYPE;
  v_booking_id uuid;
  v_has_active_package boolean := false;
  v_first_booking boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'not_authenticated');
  END IF;
  IF auth.uid() IS DISTINCT FROM p_actor_id THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'forbidden');
  END IF;

  PERFORM public.sweep_member_credits(v_user);

  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'class_not_found');
  END IF;
  IF v_class.status <> 'scheduled' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'class_not_open');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'member_not_found');
  END IF;

  SELECT * INTO v_existing
  FROM public.bookings
  WHERE class_id = p_class_id
    AND member_id = v_user
    AND status = 'booked'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_booked',
      'booking_id', v_existing.id,
      'remaining_credits', v_member.remaining_credits
    );
  END IF;

  IF v_class.booked_count >= v_class.capacity THEN
    RETURN jsonb_build_object('status', 'full');
  END IF;

  IF v_member.remaining_credits < v_class.credit_cost THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.member_plans
      WHERE member_id = v_user
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
    )
    INTO v_has_active_package;

    RETURN jsonb_build_object(
      'status',
      CASE WHEN v_has_active_package THEN 'insufficient_credits' ELSE 'no_active_package' END,
      'remaining_credits', v_member.remaining_credits
    );
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings WHERE member_id = v_user
  ) INTO v_first_booking;

  INSERT INTO public.bookings (class_id, member_id, status, credit_cost)
  VALUES (p_class_id, v_user, 'booked', v_class.credit_cost)
  RETURNING id INTO v_booking_id;

  UPDATE public.classes
  SET booked_count = booked_count + 1
  WHERE id = p_class_id;

  UPDATE public.members
  SET remaining_credits = remaining_credits - v_class.credit_cost
  WHERE id = v_user;

  INSERT INTO public.credit_transactions (
    member_id,
    amount_delta,
    reason,
    related_booking_id,
    created_by
  )
  VALUES (v_user, -v_class.credit_cost, 'booking', v_booking_id, v_user);

  INSERT INTO public.attendance_records (booking_id, member_id, class_id, status)
  VALUES (v_booking_id, v_user, p_class_id, 'booked')
  ON CONFLICT (booking_id) DO NOTHING;

  PERFORM public.emit_message_outbox(
    'booking_registered_admin',
    'booking',
    v_booking_id,
    v_user,
    jsonb_build_object(
      'booking_id', v_booking_id,
      'class_id', p_class_id,
      'member_phone', v_member.phone,
      'first_booking', v_first_booking
    ),
    concat('booking:', v_booking_id, ':registered-admin'),
    now(),
    NULL
  );

  RETURN jsonb_build_object(
    'status', 'booked',
    'booking_id', v_booking_id,
    'remaining_credits', v_member.remaining_credits - v_class.credit_cost
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE class_id = p_class_id
      AND member_id = v_user
      AND status = 'booked'
    LIMIT 1;

    RETURN jsonb_build_object('status', 'already_booked', 'booking_id', v_booking_id);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.book_class_v2(uuid, uuid) IS
  'Books a class for a member and atomically queues the studio owner registration alert.';
