
CREATE OR REPLACE FUNCTION public.member_cancel_booking(p_actor_id uuid, p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_deadline timestamptz;
  v_next public.waitlist_entries%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_booking.member_id <> p_actor_id THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF v_booking.status <> 'booked' THEN RETURN jsonb_build_object('status','error','message','already_cancelled'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id = v_booking.class_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  v_deadline := v_class.starts_at - (COALESCE(v_class.cancellation_window_hours,4) || ' hours')::interval;
  IF now() > v_deadline THEN RETURN jsonb_build_object('status','window_passed','deadline', v_deadline); END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id = p_booking_id;
  UPDATE public.classes SET booked_count = GREATEST(0, booked_count - 1) WHERE id = v_class.id;
  UPDATE public.attendance_records SET status='cancelled', marked_by=p_actor_id, marked_at=now() WHERE booking_id = p_booking_id;
  IF v_booking.credit_cost > 0 THEN
    UPDATE public.members SET remaining_credits = remaining_credits + v_booking.credit_cost WHERE id = v_booking.member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (v_booking.member_id, v_booking.credit_cost, 'member self cancel refund', p_booking_id, p_actor_id);
  END IF;
  SELECT * INTO v_next FROM public.waitlist_entries WHERE class_id = v_class.id AND status='waiting'
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN
    UPDATE public.waitlist_entries SET status='promoted', promoted_at=now() WHERE id = v_next.id;
  END IF;
  INSERT INTO public.admin_activity_log(actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_actor_id, 'booking.member_cancel', 'booking', p_booking_id,
            jsonb_build_object('class_id', v_class.id, 'waitlist_promoted', v_next.id));
  RETURN jsonb_build_object('status','cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.member_join_waitlist(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_existing public.waitlist_entries%ROWTYPE;
  v_id uuid;
  v_pos int;
BEGIN
  IF p_actor_id IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id=p_class_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  IF v_class.status <> 'scheduled' THEN RETURN jsonb_build_object('status','error','message','class_not_open'); END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE class_id=p_class_id AND member_id=p_actor_id AND status='booked') THEN
    RETURN jsonb_build_object('status','already_booked');
  END IF;
  SELECT * INTO v_existing FROM public.waitlist_entries
    WHERE class_id=p_class_id AND member_id=p_actor_id AND status IN ('waiting','promoted') LIMIT 1;
  IF FOUND THEN
    SELECT count(*) INTO v_pos FROM public.waitlist_entries
      WHERE class_id=p_class_id AND status='waiting' AND created_at <= v_existing.created_at;
    RETURN jsonb_build_object('status','already_waiting','entry_id', v_existing.id, 'position', v_pos);
  END IF;
  INSERT INTO public.waitlist_entries(class_id, member_id, status)
    VALUES (p_class_id, p_actor_id, 'waiting') RETURNING id INTO v_id;
  UPDATE public.classes SET waitlist_count = COALESCE(waitlist_count,0) + 1 WHERE id = p_class_id;
  SELECT count(*) INTO v_pos FROM public.waitlist_entries WHERE class_id=p_class_id AND status='waiting';
  RETURN jsonb_build_object('status','waiting','entry_id', v_id, 'position', v_pos);
END;
$$;

CREATE OR REPLACE FUNCTION public.member_leave_waitlist(p_actor_id uuid, p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e public.waitlist_entries%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  SELECT * INTO v_e FROM public.waitlist_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_e.member_id <> p_actor_id THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  UPDATE public.waitlist_entries SET status='removed' WHERE id=p_entry_id;
  UPDATE public.classes SET waitlist_count = GREATEST(0, COALESCE(waitlist_count,0) - 1) WHERE id = v_e.class_id;
  RETURN jsonb_build_object('status','ok');
END;
$$;

REVOKE ALL ON FUNCTION public.member_cancel_booking(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_join_waitlist(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_leave_waitlist(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_cancel_booking(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_join_waitlist(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_leave_waitlist(uuid, uuid) TO service_role;
