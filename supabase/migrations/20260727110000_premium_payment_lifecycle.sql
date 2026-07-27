-- Keep routine payment lifecycle updates in the member inbox.
-- Cloud & Core sends one branded completion email; EZcount sends the legal receipt.

UPDATE public.notification_event_rollouts
SET
  enabled_channels = CASE event_type
    WHEN 'payment_request_received' THEN ARRAY['in_app']::text[]
    WHEN 'payment_confirmed' THEN ARRAY['in_app', 'push', 'email']::text[]
    WHEN 'receipt_issued' THEN ARRAY['in_app']::text[]
    WHEN 'membership_activated' THEN ARRAY['in_app']::text[]
    ELSE enabled_channels
  END,
  updated_at = now()
WHERE event_type IN (
  'payment_request_received',
  'payment_confirmed',
  'receipt_issued',
  'membership_activated'
);

