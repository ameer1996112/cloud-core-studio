
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credits integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  duration_days integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable by authenticated" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans admin manage" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.member_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  credits_granted integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  assigned_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_plans TO authenticated;
GRANT ALL ON public.member_plans TO service_role;
ALTER TABLE public.member_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_plans self read" ON public.member_plans FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "member_plans admin manage" ON public.member_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.admin_assign_plan(p_member_id uuid, p_plan_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.plans%ROWTYPE; v_mp_id uuid; v_expires timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','plan_not_found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RETURN jsonb_build_object('status','error','message','member_not_found');
  END IF;
  IF v_plan.duration_days IS NOT NULL THEN v_expires := now() + (v_plan.duration_days || ' days')::interval; END IF;
  INSERT INTO public.member_plans(member_id, plan_id, credits_granted, expires_at, assigned_by, notes)
    VALUES (p_member_id, p_plan_id, v_plan.credits, v_expires, auth.uid(), p_notes)
    RETURNING id INTO v_mp_id;
  IF v_plan.credits > 0 THEN
    UPDATE public.members SET remaining_credits = remaining_credits + v_plan.credits WHERE id = p_member_id;
    INSERT INTO public.credit_transactions(member_id, amount_delta, reason, created_by)
      VALUES (p_member_id, v_plan.credits, 'plan: ' || v_plan.name, auth.uid());
  END IF;
  PERFORM public._log_action('plan.assigned','member',p_member_id, jsonb_build_object('plan_id',p_plan_id,'member_plan_id',v_mp_id,'credits',v_plan.credits));
  RETURN jsonb_build_object('status','ok','member_plan_id',v_mp_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_assign_plan(uuid, uuid, text) TO authenticated;
