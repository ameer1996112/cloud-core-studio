INSERT INTO public.program_types
  (slug, name_en, name_he, name_ar,
   description_en, description_he, description_ar,
   age_groups, level, default_duration_minutes, default_capacity, default_credit_cost,
   equipment, color_tag, sort_order, active)
VALUES
  ('kids-aerial-yoga',
   'Kids Aerial Yoga', 'יוגה אווירית לילדים', 'يوغا هوائية للأطفال',
   'Aerial yoga classes for children with fixed weekly groups and admin-managed attendance.',
   'שיעורי יוגה אווירית לילדים בקבוצות שבועיות קבועות, עם מעקב נוכחות ותשלומים בניהול הסטודיו.',
   'حصص يوغا هوائية للأطفال ضمن مجموعات أسبوعية ثابتة مع متابعة حضور ومدفوعات من الإدارة.',
   ARRAY['kids'], 'kids', 60, 8, 0,
   ARRAY['silk hammock','yoga mat'], '#DAB86F', 3, true)
ON CONFLICT (slug) DO UPDATE
SET name_en = EXCLUDED.name_en,
    name_he = EXCLUDED.name_he,
    name_ar = EXCLUDED.name_ar,
    description_en = EXCLUDED.description_en,
    description_he = EXCLUDED.description_he,
    description_ar = EXCLUDED.description_ar,
    age_groups = EXCLUDED.age_groups,
    level = EXCLUDED.level,
    default_duration_minutes = EXCLUDED.default_duration_minutes,
    default_capacity = EXCLUDED.default_capacity,
    default_credit_cost = EXCLUDED.default_credit_cost,
    equipment = EXCLUDED.equipment,
    color_tag = EXCLUDED.color_tag,
    active = true,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.kid_aerial_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name text NOT NULL,
  guardian_name text NOT NULL,
  guardian_phone text,
  guardian_email text,
  birth_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_children_set_updated_at
BEFORE UPDATE ON public.kid_aerial_children
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kid_aerial_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code IN ('monthly','yearly')),
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'ILS',
  credits_per_period integer NOT NULL DEFAULT 4 CHECK (credits_per_period > 0),
  total_periods integer NOT NULL CHECK (total_periods > 0),
  period_days integer NOT NULL DEFAULT 30 CHECK (period_days > 0),
  recurring_available boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_packages_set_updated_at
BEFORE UPDATE ON public.kid_aerial_packages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.kid_aerial_packages
  (code, name, price, credits_per_period, total_periods, period_days, recurring_available, sort_order)
VALUES
  ('monthly', 'חודשי לילדים - 4 שיעורים', 280, 4, 10, 30, true, 1),
  ('yearly', 'שנתי לילדים - 40 שיעורים', 2500, 4, 10, 30, false, 2)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    price = EXCLUDED.price,
    credits_per_period = EXCLUDED.credits_per_period,
    total_periods = EXCLUDED.total_periods,
    period_days = EXCLUDED.period_days,
    recurring_available = EXCLUDED.recurring_available,
    active = true,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.kid_aerial_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kid_aerial_children(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.kid_aerial_packages(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','cancelled','completed')),
  payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash','bit','card','other')),
  price numeric NOT NULL CHECK (price >= 0),
  total_periods integer NOT NULL CHECK (total_periods > 0),
  current_period_index integer NOT NULL DEFAULT 1 CHECK (current_period_index > 0),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  credits_total integer NOT NULL DEFAULT 0 CHECK (credits_total >= 0),
  credits_remaining integer NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_enrollments_set_updated_at
BEFORE UPDATE ON public.kid_aerial_enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS kid_aerial_one_active_enrollment
  ON public.kid_aerial_enrollments(child_id)
  WHERE status IN ('active','past_due');

CREATE TABLE IF NOT EXISTS public.kid_aerial_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kid_aerial_children(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.kid_aerial_packages(id) ON DELETE RESTRICT,
  enrollment_id uuid REFERENCES public.kid_aerial_enrollments(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'ILS',
  method text NOT NULL CHECK (method IN ('cash','bit','card','other')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft','pending','paid','failed','cancelled','refunded')),
  period_index integer,
  period_start timestamptz,
  period_end timestamptz,
  credits_granted integer NOT NULL DEFAULT 0 CHECK (credits_granted >= 0),
  reference text,
  notes text,
  provider text,
  provider_payment_id text,
  provider_session_id text,
  provider_status text,
  provider_payment_url text,
  payment_link_expires_at timestamptz,
  paid_at timestamptz,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_payments_set_updated_at
BEFORE UPDATE ON public.kid_aerial_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kid_aerial_payments_child_idx
  ON public.kid_aerial_payments(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kid_aerial_payments_status_idx
  ON public.kid_aerial_payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.kid_aerial_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kid_aerial_children(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.kid_aerial_packages(id) ON DELETE RESTRICT,
  enrollment_id uuid REFERENCES public.kid_aerial_enrollments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','cancelled','completed','incomplete')),
  provider text NOT NULL DEFAULT 'hyp',
  initial_payment_id uuid UNIQUE REFERENCES public.kid_aerial_payments(id) ON DELETE SET NULL,
  last_payment_id uuid REFERENCES public.kid_aerial_payments(id) ON DELETE SET NULL,
  provider_subscription_id text,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'ILS',
  current_period_index integer NOT NULL DEFAULT 1 CHECK (current_period_index > 0),
  total_periods integer NOT NULL DEFAULT 10 CHECK (total_periods > 0),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
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

CREATE TRIGGER kid_aerial_subscriptions_set_updated_at
BEFORE UPDATE ON public.kid_aerial_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS kid_aerial_one_running_subscription
  ON public.kid_aerial_subscriptions(child_id)
  WHERE status IN ('active','past_due','incomplete');
CREATE INDEX IF NOT EXISTS kid_aerial_subscriptions_due_idx
  ON public.kid_aerial_subscriptions(next_charge_at)
  WHERE status IN ('active','past_due');

CREATE TABLE IF NOT EXISTS public.kid_aerial_payment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL UNIQUE REFERENCES public.kid_aerial_subscriptions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'hyp',
  token text NOT NULL,
  token_exp_month text NOT NULL,
  token_exp_year text NOT NULL,
  token_user_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_payment_tokens_set_updated_at
BEFORE UPDATE ON public.kid_aerial_payment_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kid_aerial_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kid_aerial_children(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','transferred','ended')),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER kid_aerial_class_assignments_set_updated_at
BEFORE UPDATE ON public.kid_aerial_class_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS kid_aerial_one_active_class_assignment
  ON public.kid_aerial_class_assignments(child_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS kid_aerial_class_assignments_class_idx
  ON public.kid_aerial_class_assignments(class_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.kid_aerial_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.kid_aerial_children(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.kid_aerial_class_assignments(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.kid_aerial_enrollments(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('present','absent','excused')),
  credit_delta integer NOT NULL DEFAULT 0,
  notes text,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, class_id)
);

CREATE TRIGGER kid_aerial_attendance_set_updated_at
BEFORE UPDATE ON public.kid_aerial_attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS kid_aerial_attendance_class_idx
  ON public.kid_aerial_attendance(class_id);
CREATE INDEX IF NOT EXISTS kid_aerial_attendance_child_idx
  ON public.kid_aerial_attendance(child_id, marked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.kid_aerial_children,
  public.kid_aerial_packages,
  public.kid_aerial_enrollments,
  public.kid_aerial_payments,
  public.kid_aerial_subscriptions,
  public.kid_aerial_class_assignments,
  public.kid_aerial_attendance
TO authenticated;

GRANT ALL ON
  public.kid_aerial_children,
  public.kid_aerial_packages,
  public.kid_aerial_enrollments,
  public.kid_aerial_payments,
  public.kid_aerial_subscriptions,
  public.kid_aerial_payment_tokens,
  public.kid_aerial_class_assignments,
  public.kid_aerial_attendance
TO service_role;

ALTER TABLE public.kid_aerial_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_payment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_aerial_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage kid aerial children" ON public.kid_aerial_children
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage kid aerial packages" ON public.kid_aerial_packages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage kid aerial enrollments" ON public.kid_aerial_enrollments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage kid aerial payments" ON public.kid_aerial_payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage kid aerial subscriptions" ON public.kid_aerial_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service role manages kid aerial payment tokens" ON public.kid_aerial_payment_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins manage kid aerial class assignments" ON public.kid_aerial_class_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage kid aerial attendance" ON public.kid_aerial_attendance
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
