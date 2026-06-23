
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.payments SET provider = 'manual' WHERE provider IS NULL OR provider = '';
UPDATE public.payments SET confirmed_at = paid_at WHERE confirmed_at IS NULL AND status = 'paid';

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_uniq
  ON public.payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_session_id_uniq
  ON public.payments (provider, provider_session_id) WHERE provider_session_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  receipt_number text NOT NULL UNIQUE,
  receipt_type text NOT NULL DEFAULT 'payment_receipt',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  studio_name_snapshot text,
  member_name_snapshot text,
  plan_name_snapshot text,
  method_snapshot text,
  footer_note text,
  external_provider text,
  external_doc_id text,
  external_doc_url text,
  status text NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own receipts" ON public.receipts
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "admins read all receipts" ON public.receipts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage receipts" ON public.receipts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT SELECT ON public.provider_events TO authenticated;
GRANT ALL ON public.provider_events TO service_role;
ALTER TABLE public.provider_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read provider events" ON public.provider_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS payments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payments_provider text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payments_mode text NOT NULL DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS payments_success_url text,
  ADD COLUMN IF NOT EXISTS payments_cancel_url text,
  ADD COLUMN IF NOT EXISTS receipt_prefix text NOT NULL DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS receipt_footer_note text,
  ADD COLUMN IF NOT EXISTS invoice_provider text NOT NULL DEFAULT 'none';

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
  IF FOUND AND v_payment.status = 'paid' AND v_payment.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_confirmed','payment_id',p_payment_id,
      'receipt_id', v_existing_receipt.id, 'receipt_number', v_existing_receipt.receipt_number);
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
  IF v_existing_receipt.id IS NULL THEN
    v_receipt_number := COALESCE(v_settings.receipt_prefix, 'CC') || '-' ||
                        to_char(now(), 'YYYY') || '-' ||
                        lpad(nextval('public.receipt_number_seq')::text, 5, '0');
    INSERT INTO public.receipts(
      payment_id, member_id, receipt_number, amount, currency,
      studio_name_snapshot, member_name_snapshot, plan_name_snapshot,
      method_snapshot, footer_note
    )
    SELECT p_payment_id, v_payment.member_id, v_receipt_number,
           v_payment.amount, v_payment.currency,
           COALESCE(v_settings.studio_name, 'Studio'),
           v_member.name,
           pl.name,
           v_payment.method,
           v_settings.receipt_footer_note
    FROM public.plans pl
    WHERE pl.id = v_payment.plan_id
    UNION ALL
    SELECT p_payment_id, v_payment.member_id, v_receipt_number,
           v_payment.amount, v_payment.currency,
           COALESCE(v_settings.studio_name, 'Studio'),
           v_member.name,
           NULL,
           v_payment.method,
           v_settings.receipt_footer_note
    WHERE v_payment.plan_id IS NULL
    LIMIT 1
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
REVOKE ALL ON FUNCTION public.confirm_payment_and_issue_receipt(uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_and_issue_receipt(uuid, uuid, text, text, text, text, jsonb) TO authenticated;
