ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS external_doc_number text,
  ADD COLUMN IF NOT EXISTS external_status text,
  ADD COLUMN IF NOT EXISTS external_error text,
  ADD COLUMN IF NOT EXISTS external_attempted_at timestamptz;

ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_external_status_check
  CHECK (external_status IS NULL OR external_status IN ('pending', 'issued', 'failed', 'ambiguous'));

CREATE UNIQUE INDEX IF NOT EXISTS receipts_external_hyp_document_uniq
  ON public.receipts (external_provider, external_doc_id)
  WHERE external_provider = 'hyp' AND external_doc_id IS NOT NULL;

COMMENT ON COLUMN public.receipts.external_doc_number IS
  'Fiscal document number assigned by the external invoicing provider.';
COMMENT ON COLUMN public.receipts.external_status IS
  'External fiscal-document workflow state: pending, issued, failed, or ambiguous.';
COMMENT ON COLUMN public.receipts.external_error IS
  'Last external fiscal-document issuance error; cleared after success.';
COMMENT ON COLUMN public.receipts.external_attempted_at IS
  'Timestamp used to recover an abandoned external-document issuance claim.';
