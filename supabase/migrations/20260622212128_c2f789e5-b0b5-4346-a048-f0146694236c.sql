
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';
ALTER TABLE public.classes ADD CONSTRAINT classes_status_check CHECK (status IN ('scheduled','cancelled','archived'));
ALTER TABLE public.instructors ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage instructors" ON public.instructors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage bookings" ON public.bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage members" ON public.members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.class_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  default_duration_minutes int NOT NULL DEFAULT 60,
  default_capacity int NOT NULL DEFAULT 10,
  default_room text NOT NULL DEFAULT 'Cloud Room',
  default_energy text NOT NULL DEFAULT 'calm',
  default_cancellation_window_hours int NOT NULL DEFAULT 24,
  default_credit_cost int NOT NULL DEFAULT 1,
  default_instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_templates TO authenticated;
GRANT ALL ON public.class_templates TO service_role;
ALTER TABLE public.class_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read templates" ON public.class_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "Admins manage templates" ON public.class_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount_delta int NOT NULL,
  reason text NOT NULL,
  created_by uuid,
  related_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_member_idx ON public.credit_transactions(member_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own ledger" ON public.credit_transactions FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Staff read ledger" ON public.credit_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "Admins manage ledger" ON public.credit_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  class_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','checked_in','attended','no_show','cancelled')),
  marked_by uuid,
  marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_class_idx ON public.attendance_records(class_id);
CREATE INDEX attendance_member_idx ON public.attendance_records(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own attendance" ON public.attendance_records FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Staff read attendance" ON public.attendance_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "Admins manage attendance" ON public.attendance_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','promoted','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  UNIQUE (class_id, member_id)
);
CREATE INDEX waitlist_class_idx ON public.waitlist_entries(class_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own waitlist" ON public.waitlist_entries FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Staff read waitlist" ON public.waitlist_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "Admins manage waitlist" ON public.waitlist_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.studio_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  studio_name text NOT NULL DEFAULT 'Cloud & Core Studio',
  default_cancellation_window_hours int NOT NULL DEFAULT 24,
  default_capacity int NOT NULL DEFAULT 10,
  default_language text NOT NULL DEFAULT 'en',
  default_credit_cost int NOT NULL DEFAULT 1,
  rooms text[] NOT NULL DEFAULT ARRAY['Cloud Room','Core Room'],
  energy_labels text[] NOT NULL DEFAULT ARRAY['calm','grounding','uplifting','restorative'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.studio_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.studio_settings TO authenticated;
GRANT ALL ON public.studio_settings TO service_role;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read settings" ON public.studio_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.studio_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_created_idx ON public.admin_activity_log(created_at DESC);
CREATE INDEX admin_activity_entity_idx ON public.admin_activity_log(entity_type, entity_id);
GRANT SELECT, INSERT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read audit" ON public.admin_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));

CREATE OR REPLACE FUNCTION public._log_action(
  _action text, _entity_type text, _entity_id uuid, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_activity_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata);
$$;

CREATE OR REPLACE FUNCTION public.book_class(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
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

CREATE OR REPLACE FUNCTION public.admin_create_booking(p_class_id uuid, p_member_id uuid, p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE; v_booking_id uuid; v_existing uuid; v_cost int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
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
      VALUES (p_member_id, -v_cost, 'admin booking', v_booking_id, auth.uid());
  ELSE
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (p_member_id, 0, 'admin booking (credit override)', v_booking_id, auth.uid());
  END IF;
  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status) VALUES (v_booking_id, p_member_id, p_class_id, 'booked');
  PERFORM public._log_action('booking.created','booking',v_booking_id, jsonb_build_object('class_id',p_class_id,'member_id',p_member_id,'override',p_override));
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id);
END;$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id uuid, p_refund boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_booking.status <> 'booked' THEN RETURN jsonb_build_object('status','error','message','already_cancelled'); END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking_id;
  UPDATE public.classes SET booked_count = GREATEST(0, booked_count - 1) WHERE id=v_booking.class_id;
  UPDATE public.attendance_records SET status='cancelled', marked_by=auth.uid(), marked_at=now() WHERE booking_id=p_booking_id;
  IF p_refund AND v_booking.credit_cost > 0 THEN
    UPDATE public.members SET remaining_credits = remaining_credits + v_booking.credit_cost WHERE id=v_booking.member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, related_booking_id, created_by)
      VALUES (v_booking.member_id, v_booking.credit_cost, 'admin cancel refund', p_booking_id, auth.uid());
  END IF;
  PERFORM public._log_action('booking.cancelled','booking',p_booking_id, jsonb_build_object('refund',p_refund));
  RETURN jsonb_build_object('status','cancelled');
END;$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(p_member_id uuid, p_delta int, p_reason text, p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new int; v_member public.members%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN RETURN jsonb_build_object('status','error','message','reason_required'); END IF;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  v_new := v_member.remaining_credits + p_delta;
  IF v_new < 0 AND NOT p_override THEN RETURN jsonb_build_object('status','error','message','would_go_negative'); END IF;
  UPDATE public.members SET remaining_credits = v_new WHERE id=p_member_id;
  INSERT INTO public.credit_transactions(member_id, amount_delta, reason, created_by)
    VALUES (p_member_id, p_delta, p_reason, auth.uid());
  PERFORM public._log_action('credits.adjusted','member',p_member_id, jsonb_build_object('delta',p_delta,'reason',p_reason));
  RETURN jsonb_build_object('status','ok','remaining_credits', v_new);
END;$$;

CREATE OR REPLACE FUNCTION public.mark_attendance(p_booking_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_prev text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor')) THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  IF p_status NOT IN ('booked','checked_in','attended','no_show','cancelled') THEN
    RETURN jsonb_build_object('status','error','message','invalid_status');
  END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  SELECT status INTO v_prev FROM public.attendance_records WHERE booking_id=p_booking_id;
  INSERT INTO public.attendance_records(booking_id, member_id, class_id, status, marked_by, marked_at)
    VALUES (p_booking_id, v_booking.member_id, v_booking.class_id, p_status, auth.uid(), now())
    ON CONFLICT (booking_id) DO UPDATE SET status=EXCLUDED.status, marked_by=auth.uid(), marked_at=now();
  IF p_status='attended' AND COALESCE(v_prev,'') <> 'attended' THEN
    UPDATE public.members SET attendance_count = attendance_count + 1, last_visit_at = now() WHERE id=v_booking.member_id;
  ELSIF v_prev='attended' AND p_status <> 'attended' THEN
    UPDATE public.members SET attendance_count = GREATEST(0, attendance_count - 1) WHERE id=v_booking.member_id;
  END IF;
  PERFORM public._log_action('attendance.marked','booking',p_booking_id, jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('status','ok');
END;$$;

CREATE OR REPLACE FUNCTION public.admin_waitlist_promote(p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry public.waitlist_entries%ROWTYPE; v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_entry FROM public.waitlist_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  v_result := public.admin_create_booking(v_entry.class_id, v_entry.member_id, true);
  IF (v_result->>'status') IN ('booked','already_booked') THEN
    UPDATE public.waitlist_entries SET status='promoted', promoted_at=now() WHERE id=p_entry_id;
    PERFORM public._log_action('waitlist.promoted','waitlist',p_entry_id, v_result);
  END IF;
  RETURN v_result;
END;$$;

GRANT EXECUTE ON FUNCTION public.admin_create_booking(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, int, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_attendance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_waitlist_promote(uuid) TO authenticated;
