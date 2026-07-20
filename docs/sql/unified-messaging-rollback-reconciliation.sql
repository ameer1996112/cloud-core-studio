-- Non-destructive rollback projection from canonical records into legacy storage.
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v cutover_at='2026-07-20T00:00:00Z' \
--     -f docs/sql/unified-messaging-rollback-reconciliation.sql
-- Review counts and run in a transaction. This script never deletes canonical or legacy rows.

BEGIN;
SET LOCAL app.messaging_rollback_reconciliation = 'on';

INSERT INTO public.member_notifications (
  id, member_id, category, title, body, action_url, sound,
  related_booking_id, related_class_id, related_payment_id,
  delivery_status, idempotency_key, read_at, delivered_at, sent_at,
  scheduled_for, expires_at, created_at
)
SELECT
  gen_random_uuid(), m.member_id,
  CASE
    WHEN m.event_type IN ('payment_confirmed', 'payment_failed') THEN m.event_type
    WHEN m.event_type IN ('waitlist_joined', 'waitlist_spot_available') THEN 'waitlist'
    WHEN m.event_type IN ('class_cancelled_by_admin', 'class_time_changed') THEN 'urgent_class_change'
    WHEN m.event_type IN ('class_reminder_planning', 'class_reminder_final') THEN 'lesson_reminder'
    ELSE 'schedule'
  END,
  COALESCE(m.subject, 'Cloud & Core'),
  COALESCE(m.body, ''),
  m.content->>'action_url',
  false,
  m.related_booking_id, m.related_class_id, m.related_payment_id,
  CASE
    WHEN d.status IN ('sent', 'accepted') THEN 'sent'
    WHEN d.status IN ('delivered', 'read') THEN 'delivered'
    WHEN d.status IN ('failed', 'dead_letter', 'delivery_unknown') THEN 'failed'
    WHEN d.status IN ('suppressed', 'expired', 'cancelled') THEN 'suppressed'
    WHEN d.status = 'sending' THEN 'sending'
    ELSE 'queued'
  END,
  concat('rollback:canonical:', d.id),
  d.read_at, d.delivered_at, d.sent_at, d.scheduled_for, d.expires_at, m.created_at
FROM public.messages m
JOIN public.message_deliveries d ON d.message_id = m.id AND d.channel = 'in_app'
WHERE m.created_at >= :'cutover_at'::timestamptz
  AND m.member_id IS NOT NULL
  AND m.member_visible = true
ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

INSERT INTO public.notification_logs (
  id, template_key, channel, recipient_member_id, payload, status,
  trigger_type, related_class_id, related_booking_id, generated_text, subject,
  language, provider, provider_message_id, related_payment_id, related_receipt_id,
  related_package_request_id, sent_at, error_message, idempotency_key,
  staff_visibility, scheduled_for, attempt_count, last_attempt_at,
  next_attempt_at, created_at
)
SELECT
  gen_random_uuid(), m.template_key, d.channel, m.member_id,
  jsonb_build_object('canonical_message_id', m.id, 'canonical_delivery_id', d.id),
  CASE
    WHEN d.status IN ('accepted', 'sent', 'delivered', 'read') THEN 'sent'
    WHEN d.status IN ('failed', 'dead_letter', 'delivery_unknown') THEN 'failed'
    WHEN d.status IN ('suppressed', 'expired') THEN 'skipped'
    WHEN d.status = 'cancelled' THEN 'cancelled'
    WHEN d.status = 'sending' THEN 'sending'
    ELSE 'queued'
  END,
  m.event_type, m.related_class_id, m.related_booking_id, m.body, m.subject,
  m.language,
  CASE WHEN d.channel = 'whatsapp' THEN 'official_whatsapp' ELSE 'manual' END,
  d.provider_message_id, m.related_payment_id, m.related_receipt_id,
  m.related_package_request_id, d.sent_at, d.error_message,
  concat('rollback:canonical:', d.id),
  CASE WHEN m.audience = 'admin' THEN 'admin_only' ELSE 'operational' END,
  d.scheduled_for, d.attempt_count, d.last_attempt_at, d.next_attempt_at, m.created_at
FROM public.messages m
JOIN public.message_deliveries d ON d.message_id = m.id
WHERE m.created_at >= :'cutover_at'::timestamptz
  AND d.channel IN ('whatsapp', 'email')
ON CONFLICT (idempotency_key) DO NOTHING;

COMMIT;
