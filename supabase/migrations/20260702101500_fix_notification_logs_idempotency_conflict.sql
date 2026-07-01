DROP INDEX IF EXISTS public.notification_logs_idempotency_key_uniq;

CREATE UNIQUE INDEX notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key);
