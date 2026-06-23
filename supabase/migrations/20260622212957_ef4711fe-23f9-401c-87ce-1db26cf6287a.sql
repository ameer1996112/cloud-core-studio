
CREATE OR REPLACE FUNCTION public.confirm_payment_and_issue_receipt(
  p_actor_id uuid,
  p_payment_id uuid,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_session_id text DEFAULT NULL,
  p_provider_status text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_settings public.studio_settings%ROWTYPE;
  v_existing_receipt public.receipts%ROWTYPE;
  v_has_existing boolean := false;
  v_member_plan_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_expires timestamptz;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','payment_not_found'); END IF;
  SELECT * INTO v_existing_receipt FROM public.receipts WHERE payment_id = p_payment_id;
  v_has_existing := FOUND;
  IF v_has_existing AND v_payment.status = 'paid' AND v_payment.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_confirmed','payment_id',p_payment_id,
      'receipt_id', v_existing_receipt.id, 'receipt_number', v_existing_receipt.receipt_number,
      'member_plan_id', v_payment.member_plan_id);
  END IF;
  IF v_payment.status IN ('refunded','partially_refunded','cancelled','failed') THEN
    RETURN jsonb_build_object('status','error','message','payment_not_confirmable','current_status', v_payment.status);
  END IF;
  IF v_payment.amount IS NULL OR v_payment.amount <= 0 THEN
    RETURN jsonb_build_object('status','error','message','invalid_amount');
  END IF;
  SELECT * INTO v_member FROM public.members WHERE id = v_payment.member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT * INTO v_settings FROM public.studio_settings ORDER BY id LIMIT 1;
  UPDATE public.payments SET
    status = 'paid',
    confirmed_at = COALESCE(confirmed_at, now()),
    paid_at = COALESCE(paid_at, now()),
    provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
    provider_session_id = COALESCE(p_provider_session_id, provider_session_id),
    provider_status = COALESCE(p_provider_status, provider_status),
    receipt_url = COALESCE(p_receipt_url, receipt_url),
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = p_payment_id;
  IF v_payment.plan_id IS NOT NULL AND v_payment.member_plan_id IS NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_payment.plan_id;
    IF FOUND THEN
      IF v_plan.duration_days IS NOT NULL THEN
        v_expires := now() + (v_plan.duration_days || ' days')::interval;
      END IF;
      INSERT INTO public.member_plans(member_id, plan_id, credits_granted, expires_at, assigned_by, notes)
        VALUES (v_payment.member_id, v_plan.id, v_plan.credits, v_expires, p_actor_id,
                'auto via payment ' || p_payment_id::text)
        RETURNING id INTO v_member_plan_id;
      IF v_plan.credits > 0 THEN
        UPDATE public.members SET remaining_credits = remaining_credits + v_plan.credits
          WHERE id = v_payment.member_id;
        INSERT INTO public.credit_transactions(member_id, amount_delta, reason, created_by)
          VALUES (v_payment.member_id, v_plan.credits, 'plan paid: ' || v_plan.name, p_actor_id);
      END IF;
      UPDATE public.payments SET member_plan_id = v_member_plan_id WHERE id = p_payment_id;
    END IF;
  END IF;
  IF NOT v_has_existing THEN
    v_receipt_number := COALESCE(v_settings.receipt_prefix, 'CC') || '-' ||
                        to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('public.receipt_number_seq')::text, 5, '0');
    INSERT INTO public.receipts(
      payment_id, member_id, receipt_number, amount, currency,
      studio_name_snapshot, member_name_snapshot, plan_name_snapshot,
      method_snapshot, footer_note
    ) VALUES (
      p_payment_id, v_payment.member_id, v_receipt_number,
      v_payment.amount, v_payment.currency,
      COALESCE(v_settings.studio_name, 'Studio'),
      v_member.name,
      (SELECT name FROM public.plans WHERE id = v_payment.plan_id),
      v_payment.method,
      v_settings.receipt_footer_note
    )
    RETURNING id INTO v_receipt_id;
  ELSE
    v_receipt_id := v_existing_receipt.id;
    v_receipt_number := v_existing_receipt.receipt_number;
  END IF;
  PERFORM public._log_action_as(p_actor_id, 'payment.confirmed', 'payment', p_payment_id,
    jsonb_build_object('member_plan_id', v_member_plan_id, 'receipt_id', v_receipt_id));
  RETURN jsonb_build_object('status','confirmed','payment_id',p_payment_id,
    'receipt_id', v_receipt_id, 'receipt_number', v_receipt_number,
    'member_plan_id', v_member_plan_id);
END;
$$;
