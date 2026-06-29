-- 1. Update existing plans credits and duration_days
-- Cloud Monthly 1x Week: 5 credits, 30 days
UPDATE public.plans
SET credits = 5,
    duration_days = 30
WHERE description = 'cloud_monthly_1x_week';

-- Cloud Monthly 2x Week: 10 credits, 30 days
UPDATE public.plans
SET credits = 10,
    duration_days = 30
WHERE description = 'cloud_monthly_2x_week';

-- 2. Create the sweep functions
CREATE OR REPLACE FUNCTION public.sweep_member_credits(p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_active_credits_limit integer;
  v_current_credits integer;
  v_deduction integer;
BEGIN
  -- Mark all active plans for this member that have expired as 'expired'
  FOR v_rec IN 
    SELECT mp.id, p.name as plan_name, mp.credits_granted
    FROM public.member_plans mp
    JOIN public.plans p ON p.id = mp.plan_id
    WHERE mp.member_id = p_member_id AND mp.status = 'active' AND mp.expires_at <= now()
  LOOP
    UPDATE public.member_plans SET status = 'expired' WHERE id = v_rec.id;
  END LOOP;

  -- Recalculate remaining_credits if needed
  SELECT remaining_credits INTO v_current_credits FROM public.members WHERE id = p_member_id;
  IF FOUND AND v_current_credits > 0 THEN
    -- Calculate active plan credits limit: sum of credits_granted of all active plans (non-expired)
    -- plus manual positive adjustments
    SELECT COALESCE(SUM(credits_granted), 0) INTO v_active_credits_limit
    FROM public.member_plans
    WHERE member_id = p_member_id AND status = 'active' AND (expires_at IS NULL OR expires_at > now());
    
    v_active_credits_limit := v_active_credits_limit + COALESCE((
      SELECT SUM(amount_delta) FROM public.credit_transactions 
      WHERE member_id = p_member_id AND amount_delta > 0 AND reason NOT LIKE 'plan%'
    ), 0);

    -- If current credits exceed this limit, we deduct the difference
    IF v_current_credits > v_active_credits_limit THEN
      v_deduction := v_current_credits - v_active_credits_limit;
      UPDATE public.members SET remaining_credits = v_active_credits_limit WHERE id = p_member_id;
      INSERT INTO public.credit_transactions (member_id, amount_delta, reason, created_by)
        VALUES (p_member_id, -v_deduction, 'expiration sweep', '00000000-0000-0000-0000-000000000000'::uuid);
    END IF;
  END IF;
END;$$;

CREATE OR REPLACE FUNCTION public.sweep_all_members_credits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_id uuid;
BEGIN
  FOR v_member_id IN 
    SELECT DISTINCT member_id 
    FROM public.member_plans 
    WHERE status = 'active' AND expires_at <= now()
  LOOP
    PERFORM public.sweep_member_credits(v_member_id);
  END LOOP;
END;$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sweep_member_credits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sweep_all_members_credits() TO authenticated, service_role;

-- 3. Update book_class_v2 to run sweep first
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
  
  -- Run credit expiration sweep for the booking user
  PERFORM public.sweep_member_credits(v_user);

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

-- 4. Update admin_create_booking to run sweep first
CREATE OR REPLACE FUNCTION public.admin_create_booking(p_actor_id uuid, p_class_id uuid, p_member_id uuid, p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE; v_booking_id uuid; v_existing uuid; v_cost int;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  
  -- Run credit expiration sweep for the member
  PERFORM public.sweep_member_credits(p_member_id);

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
