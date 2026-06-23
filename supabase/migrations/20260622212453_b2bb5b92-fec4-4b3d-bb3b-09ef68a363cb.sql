
CREATE OR REPLACE FUNCTION public.book_class_v2(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := p_actor_id;
  v_class public.classes%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_existing public.bookings%ROWTYPE;
  v_booking_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  IF v_class.status <> 'scheduled' THEN RETURN jsonb_build_object('status','error','message','class_not_open'); END IF;
  SELECT * INTO v_member FROM public.members WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT * INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=v_user AND status='booked' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','already_booked','booking_id',v_existing.id,'remaining_credits',v_member.remaining_credits);
  END IF;
  IF v_class.booked_count >= v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  IF v_member.remaining_credits < v_class.credit_cost THEN
    RETURN jsonb_build_object('status','insufficient_credits','remaining_credits',v_member.remaining_credits);
  END IF;
  INSERT INTO public.bookings (class_id, member_id, status, credit_cost)
    VALUES (p_class_id, v_user, 'booked', v_class.credit_cost) RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count = booked_count + 1 WHERE id = p_class_id;
  UPDATE public.members SET remaining_credits = remaining_credits - v_class.credit_cost WHERE id = v_user;
  INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
    VALUES (v_user, -v_class.credit_cost, 'booking', v_booking_id, v_user);
  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status)
    VALUES (v_booking_id, v_user, p_class_id, 'booked')
    ON CONFLICT (booking_id) DO NOTHING;
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id,
    'remaining_credits', v_member.remaining_credits - v_class.credit_cost);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_booking_id FROM public.bookings WHERE class_id=p_class_id AND member_id=v_user AND status='booked' LIMIT 1;
    RETURN jsonb_build_object('status','already_booked','booking_id',v_booking_id);
  WHEN OTHERS THEN RETURN jsonb_build_object('status','error','message',SQLERRM);
END;$$;
REVOKE ALL ON FUNCTION public.book_class_v2(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_v2(uuid, uuid) TO service_role;
DROP FUNCTION IF EXISTS public.book_class(uuid);

CREATE OR REPLACE FUNCTION public.mark_attendance_v2(p_actor_id uuid, p_booking_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_prev text;
BEGIN
  IF NOT (public.has_role(p_actor_id,'admin') OR public.has_role(p_actor_id,'instructor')) THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  IF p_status NOT IN ('booked','checked_in','attended','no_show','cancelled') THEN
    RETURN jsonb_build_object('status','error','message','invalid_status');
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  SELECT status INTO v_prev FROM public.attendance_records WHERE booking_id=p_booking_id;
  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status, marked_by, marked_at)
    VALUES (p_booking_id, v_booking.member_id, v_booking.class_id, p_status, p_actor_id, now())
    ON CONFLICT (booking_id) DO UPDATE SET status=EXCLUDED.status, marked_by=p_actor_id, marked_at=now();
  IF p_status='attended' AND COALESCE(v_prev,'') <> 'attended' THEN
    UPDATE public.members SET attendance_count = attendance_count + 1, last_visit_at = now() WHERE id=v_booking.member_id;
  ELSIF v_prev='attended' AND p_status <> 'attended' THEN
    UPDATE public.members SET attendance_count = GREATEST(0, attendance_count - 1) WHERE id=v_booking.member_id;
  END IF;
  PERFORM public._log_action_as(p_actor_id,'attendance.marked','booking',p_booking_id, jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('status','ok');
END;$$;
REVOKE ALL ON FUNCTION public.mark_attendance_v2(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_attendance_v2(uuid, uuid, text) TO service_role;
DROP FUNCTION IF EXISTS public.mark_attendance(uuid, text);
