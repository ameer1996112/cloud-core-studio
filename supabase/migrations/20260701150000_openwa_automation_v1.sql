CREATE OR REPLACE FUNCTION public.book_class_v2(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := p_actor_id;
  v_class public.classes%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_existing public.bookings%ROWTYPE;
  v_booking_id UUID;
  v_has_active_package boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status','error','message','not_authenticated');
  END IF;

  PERFORM public.sweep_member_credits(v_user);

  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','class_not_found');
  END IF;
  IF v_class.status <> 'scheduled' THEN
    RETURN jsonb_build_object('status','error','message','class_not_open');
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','member_not_found');
  END IF;

  SELECT * INTO v_existing
  FROM public.bookings
  WHERE class_id = p_class_id
    AND member_id = v_user
    AND status = 'booked'
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status','already_booked',
      'booking_id',v_existing.id,
      'remaining_credits',v_member.remaining_credits
    );
  END IF;

  IF v_class.booked_count >= v_class.capacity THEN
    RETURN jsonb_build_object('status','full');
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
      'remaining_credits',
      v_member.remaining_credits
    );
  END IF;

  INSERT INTO public.bookings (class_id, member_id, status, credit_cost)
  VALUES (p_class_id, v_user, 'booked', v_class.credit_cost)
  RETURNING id INTO v_booking_id;

  UPDATE public.classes
  SET booked_count = booked_count + 1
  WHERE id = p_class_id;

  UPDATE public.members
  SET remaining_credits = remaining_credits - v_class.credit_cost
  WHERE id = v_user;

  INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
  VALUES (v_user, -v_class.credit_cost, 'booking', v_booking_id, v_user);

  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status)
  VALUES (v_booking_id, v_user, p_class_id, 'booked')
  ON CONFLICT (booking_id) DO NOTHING;

  RETURN jsonb_build_object(
    'status','booked',
    'booking_id',v_booking_id,
    'remaining_credits',v_member.remaining_credits - v_class.credit_cost
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE class_id = p_class_id
      AND member_id = v_user
      AND status = 'booked'
    LIMIT 1;

    RETURN jsonb_build_object('status','already_booked','booking_id',v_booking_id);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status','error','message',SQLERRM);
END;
$$;
