
CREATE OR REPLACE FUNCTION public.admin_generate_class_from_template(p_template_id uuid, p_start_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.class_templates%ROWTYPE; v_class_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_t FROM public.class_templates WHERE id = p_template_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','template_not_found'); END IF;
  INSERT INTO public.classes(title, instructor_id, starts_at, duration_minutes, capacity, room, energy, credit_cost, cancellation_window_hours, status)
    VALUES (v_t.title, v_t.default_instructor_id, p_start_at, v_t.default_duration_minutes, v_t.default_capacity, v_t.default_room, v_t.default_energy, v_t.default_credit_cost, v_t.default_cancellation_window_hours, 'scheduled')
    RETURNING id INTO v_class_id;
  PERFORM public._log_action('class.generated','class',v_class_id, jsonb_build_object('template_id',p_template_id));
  RETURN jsonb_build_object('status','ok','class_id',v_class_id);
END;$$;
