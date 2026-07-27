ALTER TABLE public.kid_aerial_payments
  ADD COLUMN IF NOT EXISTS external_provider text,
  ADD COLUMN IF NOT EXISTS external_status text,
  ADD COLUMN IF NOT EXISTS external_doc_id text,
  ADD COLUMN IF NOT EXISTS external_doc_number text,
  ADD COLUMN IF NOT EXISTS external_doc_url text,
  ADD COLUMN IF NOT EXISTS external_error text,
  ADD COLUMN IF NOT EXISTS external_attempted_at timestamptz;

CREATE INDEX IF NOT EXISTS kid_aerial_payments_external_receipt_status_idx
  ON public.kid_aerial_payments(external_provider, external_status, external_attempted_at);
