-- Complete the premium notification catalog while keeping every journey private to allowlist mode.
-- Expand-only: no legacy rows, templates, deliveries, or customer preferences are deleted.

INSERT INTO public.notification_event_rollouts (
  event_type,
  enabled,
  allowlist_only,
  copy_reviewed,
  enabled_channels,
  enabled_at,
  updated_at
)
SELECT
  event_type,
  true,
  true,
  true,
  enabled_channels,
  now(),
  now()
FROM (VALUES
  ('member_welcome', ARRAY['in_app', 'push', 'email']::text[]),
  ('booking_confirmed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('booking_cancelled', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('booking_changed', ARRAY['in_app', 'push', 'email']::text[]),
  ('booking_checked_in', ARRAY['in_app']::text[]),
  ('booking_no_show_followup', ARRAY['in_app', 'push']::text[]),
  ('class_cancelled_by_admin', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_time_changed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_location_changed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('class_instructor_changed', ARRAY['in_app', 'push']::text[]),
  ('class_reminder_planning', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('class_reminder_final', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('class_published', ARRAY['in_app', 'push']::text[]),
  ('class_open_spots', ARRAY['in_app', 'push']::text[]),
  ('class_recommendation', ARRAY['in_app', 'push']::text[]),
  ('waitlist_joined', ARRAY['in_app', 'push']::text[]),
  ('waitlist_position_changed', ARRAY['in_app']::text[]),
  ('waitlist_spot_available', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('waitlist_accepted', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('waitlist_offer_expired', ARRAY['in_app']::text[]),
  ('waitlist_removed', ARRAY['in_app', 'push']::text[]),
  ('payment_request_received', ARRAY['in_app', 'push', 'email']::text[]),
  ('payment_pending_reminder', ARRAY['in_app', 'push', 'whatsapp']::text[]),
  ('payment_confirmed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('payment_failed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('payment_refunded', ARRAY['in_app', 'push', 'email']::text[]),
  ('receipt_issued', ARRAY['in_app', 'email']::text[]),
  ('membership_activated', ARRAY['in_app', 'push', 'email']::text[]),
  ('credits_low', ARRAY['in_app', 'push']::text[]),
  ('credits_depleted', ARRAY['in_app', 'push']::text[]),
  ('membership_expiring', ARRAY['in_app', 'push', 'email']::text[]),
  ('membership_expired', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_renewal_upcoming', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_renewal_succeeded', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('subscription_renewal_failed', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('subscription_paused', ARRAY['in_app', 'push', 'email']::text[]),
  ('subscription_cancelled', ARRAY['in_app', 'push', 'email']::text[]),
  ('human_handoff', ARRAY['whatsapp', 'in_app', 'push']::text[]),
  ('staff_reply', ARRAY['in_app', 'push']::text[]),
  ('human_handoff_resolved', ARRAY['in_app']::text[]),
  ('urgent_studio_announcement', ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]),
  ('trial_followup', ARRAY['in_app', 'push']::text[]),
  ('retention_reminder', ARRAY['in_app', 'push']::text[])
) AS catalog(event_type, enabled_channels)
ON CONFLICT (event_type) DO UPDATE SET
  copy_reviewed = true,
  enabled = true,
  allowlist_only = true,
  enabled_channels = EXCLUDED.enabled_channels,
  enabled_at = COALESCE(public.notification_event_rollouts.enabled_at, now()),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.enqueue_member_welcome_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.canonical_message_writes_enabled()
     OR NOT public.premium_notification_event_enabled('member_welcome')
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_message_outbox(
    'member_welcome',
    'member',
    NEW.id,
    NEW.id,
    '{}'::jsonb,
    'member:welcome:' || NEW.id::text || ':v2',
    now(),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_welcome_outbox ON public.members;
CREATE TRIGGER trg_member_welcome_outbox
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_member_welcome_message_event();

REVOKE ALL ON FUNCTION public.enqueue_member_welcome_message_event()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_member_welcome_message_event() TO service_role;

COMMENT ON FUNCTION public.enqueue_member_welcome_message_event() IS
  'Emits one deduplicated premium welcome event for a newly created member when canonical writes are enabled.';
