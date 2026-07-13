CREATE TABLE IF NOT EXISTS public.subscription_payment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL UNIQUE REFERENCES public.member_subscriptions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'hyp',
  token text NOT NULL,
  token_exp_month text NOT NULL,
  token_exp_year text NOT NULL,
  token_user_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_subscriptions_merchant_token_due_idx
  ON public.member_subscriptions(next_charge_at)
  WHERE status IN ('active', 'past_due')
    AND provider = 'hyp';

CREATE INDEX IF NOT EXISTS subscription_payment_tokens_subscription_idx
  ON public.subscription_payment_tokens(subscription_id);

GRANT ALL ON public.subscription_payment_tokens TO service_role;

ALTER TABLE public.subscription_payment_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages subscription payment tokens" ON public.subscription_payment_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
