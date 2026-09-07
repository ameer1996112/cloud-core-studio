ALTER TABLE public.kid_aerial_payments
  ADD COLUMN IF NOT EXISTS billing_month date;

CREATE INDEX IF NOT EXISTS kid_aerial_payments_billing_month_idx
  ON public.kid_aerial_payments(child_id, billing_month, status);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS kid_session_number integer;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_kid_session_number_check
  CHECK (kid_session_number IS NULL OR kid_session_number BETWEEN 1 AND 35);
