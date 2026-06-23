
REVOKE UPDATE (remaining_credits, attendance_count, last_visit_at) ON public.members FROM authenticated;

CREATE POLICY "Admins manage instructors insert" ON public.instructors
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage instructors update" ON public.instructors
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage instructors delete" ON public.instructors
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Block direct booking insert" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Block direct booking update" ON public.bookings
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Block direct booking delete" ON public.bookings
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public._log_action_as(_actor_id uuid, _action text, _entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_activity_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, _action, _entity_type, _entity_id, _metadata);
$$;

CREATE OR REPLACE FUNCTION public.admin_create_booking(p_actor_id uuid, p_class_id uuid, p_member_id uuid, p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE; v_booking_id uuid; v_existing uuid; v_cost int;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id=p_class_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT id INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=p_member_id AND status='booked' LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('status','already_booked','booking_id',v_existing); END IF;
  IF NOT p_override AND v_class.booked_count >= v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  v_cost := v_class.credit_cost;
  IF NOT p_override AND v_member.remaining_credits < v_cost THEN
    RETURN jsonb_build_object('status','insufficient_credits');
  END IF;
  INSERT INTO public.bookings(class_id, member_id, status, credit_cost) VALUES (p_class_id, p_member_id, 'booked', v_cost) RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count = booked_count + 1 WHERE id = p_class_id;
  IF v_member.remaining_credits >= v_cost THEN
    UPDATE public.members SET remaining_credits = remaining_credits - v_cost WHERE id = p_member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (p_member_id, -v_cost, 'admin booking', v_booking_id, p_actor_id);
  ELSE
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (p_member_id, 0, 'admin booking (credit override)', v_booking_id, p_actor_id);
  END IF;
  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status) VALUES (v_booking_id, p_member_id, p_class_id, 'booked');
  PERFORM public._log_action_as(p_actor_id,'booking.created','booking',v_booking_id, jsonb_build_object('class_id',p_class_id,'member_id',p_member_id,'override',p_override));
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id);
END;$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_actor_id uuid, p_booking_id uuid, p_refund boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_booking.status <> 'booked' THEN RETURN jsonb_build_object('status','error','message','already_cancelled'); END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking_id;
  UPDATE public.classes SET booked_count = GREATEST(0, booked_count - 1) WHERE id=v_booking.class_id;
  UPDATE public.attendance_records SET status='cancelled', marked_by=p_actor_id, marked_at=now() WHERE booking_id=p_booking_id;
  IF p_refund AND v_booking.credit_cost > 0 THEN
    UPDATE public.members SET remaining_credits = remaining_credits + v_booking.credit_cost WHERE id=v_booking.member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (v_booking.member_id, v_booking.credit_cost, 'admin cancel refund', p_booking_id, p_actor_id);
  END IF;
  PERFORM public._log_action_as(p_actor_id,'booking.cancelled','booking',p_booking_id, jsonb_build_object('refund',p_refund));
  RETURN jsonb_build_object('status','cancelled');
END;$$;

CREATE OR REPLACE FUNCTION public.admin_generate_class_from_template(p_actor_id uuid, p_template_id uuid, p_start_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.class_templates%ROWTYPE; v_class_id uuid;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_t FROM public.class_templates WHERE id = p_template_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','template_not_found'); END IF;
  INSERT INTO public.classes(title, instructor_id, starts_at, duration_minutes, capacity, room, energy, credit_cost, cancellation_window_hours, status)
    VALUES (v_t.title, v_t.default_instructor_id, p_start_at, v_t.default_duration_minutes, v_t.default_capacity, v_t.default_room, v_t.default_energy, v_t.default_credit_cost, v_t.default_cancellation_window_hours, 'scheduled')
    RETURNING id INTO v_class_id;
  PERFORM public._log_action_as(p_actor_id,'class.generated','class',v_class_id, jsonb_build_object('template_id',p_template_id));
  RETURN jsonb_build_object('status','ok','class_id',v_class_id);
END;$$;

CREATE OR REPLACE FUNCTION public.admin_assign_plan(p_actor_id uuid, p_member_id uuid, p_plan_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.plans%ROWTYPE; v_mp_id uuid; v_expires timestamptz;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','plan_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RETURN jsonb_build_object('status','error','message','member_not_found');
  END IF;
  IF v_plan.duration_days IS NOT NULL THEN v_expires := now() + (v_plan.duration_days || ' days')::interval; END IF;
  INSERT INTO public.member_plans(member_id, plan_id, credits_granted, expires_at, assigned_by, notes)
    VALUES (p_member_id, p_plan_id, v_plan.credits, v_expires, p_actor_id, p_notes)
    RETURNING id INTO v_mp_id;
  IF v_plan.credits > 0 THEN
    UPDATE public.members SET remaining_credits = remaining_credits + v_plan.credits WHERE id = p_member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, created_by)
      VALUES (p_member_id, v_plan.credits, 'plan: ' || v_plan.name, p_actor_id);
  END IF;
  PERFORM public._log_action_as(p_actor_id,'plan.assigned','member',p_member_id, jsonb_build_object('plan_id',p_plan_id,'member_plan_id',v_mp_id,'credits',v_plan.credits));
  RETURN jsonb_build_object('status','ok','member_plan_id',v_mp_id);
END;$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(p_actor_id uuid, p_member_id uuid, p_delta integer, p_reason text, p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new int; v_member public.members%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RETURN jsonb_build_object('status','error','message','reason_required'); END IF;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  v_new := v_member.remaining_credits + p_delta;
  IF v_new < 0 AND NOT p_override THEN RETURN jsonb_build_object('status','error','message','would_go_negative'); END IF;
  UPDATE public.members SET remaining_credits = v_new WHERE id=p_member_id;
  INSERT INTO public.credit_transactions(member_id, amount_delta, reason, created_by)
    VALUES (p_member_id, p_delta, p_reason, p_actor_id);
  PERFORM public._log_action_as(p_actor_id,'credits.adjusted','member',p_member_id, jsonb_build_object('delta',p_delta,'reason',p_reason));
  RETURN jsonb_build_object('status','ok','remaining_credits', v_new);
END;$$;

CREATE OR REPLACE FUNCTION public.admin_waitlist_promote(p_actor_id uuid, p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry public.waitlist_entries%ROWTYPE; v_result jsonb;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_entry FROM public.waitlist_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  v_result := public.admin_create_booking(p_actor_id, v_entry.class_id, v_entry.member_id, true);
  IF (v_result->>'status') IN ('booked','already_booked') THEN
    UPDATE public.waitlist_entries SET status='promoted', promoted_at=now() WHERE id=p_entry_id;
    PERFORM public._log_action_as(p_actor_id,'waitlist.promoted','waitlist',p_entry_id, v_result);
  END IF;
  RETURN v_result;
END;$$;

DROP FUNCTION IF EXISTS public.admin_create_booking(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_cancel_booking(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_generate_class_from_template(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.admin_assign_plan(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_adjust_credits(uuid, integer, text, boolean);
DROP FUNCTION IF EXISTS public.admin_waitlist_promote(uuid);
DROP FUNCTION IF EXISTS public._log_action(text, text, uuid, jsonb);

REVOKE ALL ON FUNCTION public.admin_create_booking(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_cancel_booking(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_generate_class_from_template(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_plan(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_waitlist_promote(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._log_action_as(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_create_booking(uuid, uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_class_from_template(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_plan(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_waitlist_promote(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._log_action_as(uuid, text, text, uuid, jsonb) TO service_role;
