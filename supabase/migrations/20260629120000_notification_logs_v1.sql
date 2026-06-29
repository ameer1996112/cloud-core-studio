ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_package_request_id uuid REFERENCES public.package_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS staff_visibility text NOT NULL DEFAULT 'operational';

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_staff_visibility_check
  CHECK (staff_visibility IN ('operational', 'admin_only')) NOT VALID;

ALTER TABLE public.notification_logs
  VALIDATE CONSTRAINT notification_logs_staff_visibility_check;

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_logs_payment_idx
  ON public.notification_logs(related_payment_id);

CREATE INDEX IF NOT EXISTS notification_logs_receipt_idx
  ON public.notification_logs(related_receipt_id);

CREATE INDEX IF NOT EXISTS notification_logs_package_request_idx
  ON public.notification_logs(related_package_request_id);

CREATE INDEX IF NOT EXISTS notification_logs_status_idx
  ON public.notification_logs(status, created_at DESC);

DROP POLICY IF EXISTS "notif logs staff read" ON public.notification_logs;

CREATE POLICY "notif logs split staff read" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'instructor')
      AND staff_visibility = 'operational'
    )
  );
