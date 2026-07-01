ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

UPDATE public.notification_logs
SET attempt_count = 0
WHERE attempt_count IS NULL;

ALTER TABLE public.notification_logs
  ALTER COLUMN attempt_count SET DEFAULT 0,
  ALTER COLUMN attempt_count SET NOT NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS birth_date date;

DROP INDEX IF EXISTS public.notification_logs_due_queue_idx;
CREATE INDEX notification_logs_due_queue_idx
  ON public.notification_logs(provider, status, scheduled_for, next_attempt_at);

CREATE INDEX IF NOT EXISTS members_birth_date_idx
  ON public.members(birth_date)
  WHERE birth_date IS NOT NULL;

ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_status_check;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (
    status IN (
      'draft',
      'queued',
      'sending',
      'manually_sent',
      'sent',
      'failed',
      'cancelled',
      'skipped'
    )
  ) NOT VALID;

ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_provider_check;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_provider_check
  CHECK (
    provider IS NULL
    OR provider IN ('manual', 'openwa', 'official_whatsapp')
  ) NOT VALID;

ALTER TABLE public.notification_logs
  VALIDATE CONSTRAINT notification_logs_status_check;

ALTER TABLE public.notification_logs
  VALIDATE CONSTRAINT notification_logs_provider_check;
