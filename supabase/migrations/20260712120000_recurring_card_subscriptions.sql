ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subscription_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;

CREATE TABLE IF NOT EXISTS public.member_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'incomplete')),
  provider text NOT NULL DEFAULT 'hyp',
  initial_payment_id uuid UNIQUE REFERENCES public.payments(id) ON DELETE SET NULL,
  last_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  provider_subscription_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  interval_unit text NOT NULL DEFAULT 'month' CHECK (interval_unit = 'month'),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  next_charge_at timestamptz NOT NULL,
  card_mask text,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  last_renewal_attempt_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_subscription_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES public.member_subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT ON public.member_subscriptions TO authenticated;
GRANT ALL ON public.member_subscriptions TO service_role;

ALTER TABLE public.member_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own subscriptions" ON public.member_subscriptions
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "admins read subscriptions" ON public.member_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage subscriptions" ON public.member_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS member_subscriptions_one_running_per_member
  ON public.member_subscriptions(member_id)
  WHERE status IN ('active', 'past_due', 'incomplete');

CREATE UNIQUE INDEX IF NOT EXISTS member_subscriptions_provider_subscription_uniq
  ON public.member_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS member_subscriptions_due_idx
  ON public.member_subscriptions(next_charge_at)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS payments_subscription_period_uniq
  ON public.payments(subscription_id, subscription_period_start)
  WHERE subscription_id IS NOT NULL AND subscription_period_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_subscription_idx
  ON public.payments(subscription_id);
