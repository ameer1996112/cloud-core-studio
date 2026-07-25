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
-- Initialize new members once from the contact data supplied at registration. ON CONFLICT is
-- deliberately non-mutating so a later member opt-out can never be silently reversed.
CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_phone text;
  v_phone_enabled boolean;
  v_email_enabled boolean;
  v_now timestamptz := now();
BEGIN
  v_normalized_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9+]', '', 'g');
  v_phone_enabled := NEW.status = 'active'
    AND v_normalized_phone ~ '^\+[1-9][0-9]{7,14}$';
  v_email_enabled := NEW.status = 'active'
    AND COALESCE(NEW.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  INSERT INTO public.member_notification_preferences (
    member_id,
    whatsapp_enabled,
    email_enabled,
    whatsapp_consent_source,
    email_consent_source,
    whatsapp_consented_at,
    email_consented_at
  ) VALUES (
    NEW.id,
    v_phone_enabled,
    v_email_enabled,
    CASE WHEN v_phone_enabled THEN 'new_active_member_auto_enable' END,
    CASE WHEN v_email_enabled THEN 'new_active_member_auto_enable' END,
    CASE WHEN v_phone_enabled THEN v_now END,
    CASE WHEN v_email_enabled THEN v_now END
  )
  ON CONFLICT (member_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_member_notification_preferences ON public.members;
CREATE TRIGGER trg_member_notification_preferences
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_member_notification_preferences();
COMMENT ON FUNCTION public.ensure_member_notification_preferences() IS
  'Creates default preferences for a new member once; existing preferences and opt-outs are never overwritten.';
CREATE OR REPLACE FUNCTION public.enqueue_member_welcome_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'active'
     OR NOT public.canonical_message_writes_enabled()
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
-- A booking accepted from a promoted waitlist has one semantic outcome. Emitting only
-- waitlist_accepted prevents four duplicate channel deliveries from a second booking_confirmed event.
CREATE OR REPLACE FUNCTION public.enqueue_booking_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_class_status text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;

  IF (TG_OP = 'INSERT' AND NEW.status = 'booked')
     OR (
       TG_OP = 'UPDATE'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'booked'
     )
  THEN
    IF public.premium_notification_event_enabled('waitlist_accepted')
       AND EXISTS (
         SELECT 1
         FROM public.waitlist_entries
         WHERE member_id = NEW.member_id
           AND class_id = NEW.class_id
           AND status IN ('waiting', 'ready', 'offered', 'promoted')
       )
    THEN
      v_event := 'waitlist_accepted';
    ELSE
      v_event := 'booking_confirmed';
    END IF;
  ELSIF TG_OP = 'UPDATE'
        AND OLD.class_id IS DISTINCT FROM NEW.class_id
        AND NEW.status = 'booked'
        AND public.premium_notification_event_enabled('booking_changed')
  THEN
    v_event := 'booking_changed';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'booked'
        AND NEW.status = 'cancelled'
  THEN
    SELECT status INTO v_class_status FROM public.classes WHERE id = NEW.class_id;
    IF v_class_status = 'cancelled' THEN RETURN NEW; END IF;
    v_event := 'booking_cancelled';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'checked_in'
        AND public.premium_notification_event_enabled('booking_checked_in')
  THEN
    v_event := 'booking_checked_in';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'no_show'
        AND public.premium_notification_event_enabled('booking_no_show_followup')
  THEN
    v_event := 'booking_no_show_followup';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.emit_message_outbox(
    v_event,
    'booking',
    NEW.id,
    NEW.member_id,
    jsonb_build_object(
      'booking_id', NEW.id,
      'class_id', NEW.class_id,
      'previous_class_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.class_id ELSE NULL END
    ),
    CASE
      WHEN v_event = 'waitlist_accepted' THEN concat('booking:', NEW.id, ':waitlist_accepted')
      ELSE concat('booking:', NEW.id, ':', v_event, ':', txid_current())
    END,
    now(),
    NULL
  );
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.enqueue_booking_message_event() IS
  'Emits exactly one semantic booking outcome, including waitlist acceptance without a duplicate confirmation.';
-- The admin promotion RPC creates the booking before it marks the waitlist row promoted, while a
-- normal offer marks the row promoted without a booking. Treat both orderings correctly: the
-- booking trigger emits acceptance, and this trigger emits an offer only when no booking exists.
CREATE OR REPLACE FUNCTION public.enqueue_waitlist_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_waitlist record;
  v_position integer;
  v_member_already_booked boolean := false;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
    v_event := 'waitlist_joined';
  ELSIF NEW.status = 'promoted'
        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.bookings
      WHERE member_id = NEW.member_id
        AND class_id = NEW.class_id
        AND status IN ('booked', 'checked_in')
    ) INTO v_member_already_booked;
    IF NEW.status = 'promoted' AND NOT v_member_already_booked THEN
      v_event := 'waitlist_spot_available';
    END IF;
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('expired', 'no_response')
        AND public.premium_notification_event_enabled('waitlist_offer_expired')
  THEN
    v_event := 'waitlist_offer_expired';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('left', 'cancelled', 'removed')
        AND public.premium_notification_event_enabled('waitlist_removed')
  THEN
    v_event := 'waitlist_removed';
  ELSE
    RETURN NEW;
  END IF;

  IF v_event IS NOT NULL THEN
    PERFORM public.emit_message_outbox(
      v_event,
      'waitlist_entry',
      NEW.id,
      NEW.member_id,
      jsonb_build_object(
        'waitlist_entry_id', NEW.id,
        'class_id', NEW.class_id,
        'offered_at', NEW.offered_at,
        'offer_expires_at', NEW.offer_expires_at
      ),
      concat('waitlist:', NEW.id, ':', v_event, ':', txid_current()),
      now(),
      CASE WHEN v_event = 'waitlist_spot_available' THEN NEW.offer_expires_at ELSE NULL END
    );
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status <> 'waiting'
     AND public.premium_notification_event_enabled('waitlist_position_changed')
  THEN
    v_position := 0;
    FOR v_waitlist IN
      SELECT id, member_id
      FROM public.waitlist_entries
      WHERE class_id = NEW.class_id AND status = 'waiting'
      ORDER BY created_at, id
    LOOP
      v_position := v_position + 1;
      PERFORM public.emit_message_outbox(
        'waitlist_position_changed',
        'waitlist_entry',
        v_waitlist.id,
        v_waitlist.member_id,
        jsonb_build_object(
          'waitlist_entry_id', v_waitlist.id,
          'class_id', NEW.class_id,
          'waitlist_position', v_position
        ),
        concat('waitlist:', v_waitlist.id, ':position:', v_position, ':', txid_current()),
        now(),
        NULL
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.enqueue_waitlist_message_event() IS
  'Separates a waitlist offer from an already-booked acceptance across both supported transaction orderings.';
