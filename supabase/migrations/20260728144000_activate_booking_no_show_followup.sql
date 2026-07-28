-- Complete the Booking journey. This is a consented promotional follow-up,
-- protected by the canonical 1/day and 3/week frequency reservation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.notification_event_rollouts
    WHERE event_type = 'booking_no_show_followup'
      AND enabled = true
      AND copy_reviewed = true
  ) THEN
    RAISE EXCEPTION 'Booking journey activation blocked; no-show copy is not reviewed';
  END IF;
END;
$$;

UPDATE public.notification_event_rollouts
SET
  allowlist_only = false,
  enabled_at = COALESCE(enabled_at, now()),
  updated_at = now()
WHERE event_type = 'booking_no_show_followup'
  AND enabled = true
  AND copy_reviewed = true;
