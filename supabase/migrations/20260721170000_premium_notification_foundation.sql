-- Premium branded notification foundation.
-- Expand-only: legacy preferences, tokens, notifications, and canonical message rows are retained.

ALTER TABLE public.member_notification_preferences
  ADD COLUMN IF NOT EXISTS class_operations_enabled boolean,
  ADD COLUMN IF NOT EXISTS class_reminders_enabled boolean,
  ADD COLUMN IF NOT EXISTS schedule_openings_enabled boolean,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean,
  ADD COLUMN IF NOT EXISTS payments_enabled boolean,
  ADD COLUMN IF NOT EXISTS membership_enabled boolean,
  ADD COLUMN IF NOT EXISTS staff_replies_enabled boolean,
  ADD COLUMN IF NOT EXISTS recommendations_enabled boolean,
  ADD COLUMN IF NOT EXISTS marketing_analytics_enabled boolean,
  ADD COLUMN IF NOT EXISTS time_sensitive_enabled boolean,
  ADD COLUMN IF NOT EXISTS preference_revision integer;

UPDATE public.member_notification_preferences
SET class_operations_enabled = COALESCE(class_operations_enabled, true),
    class_reminders_enabled = COALESCE(class_reminders_enabled, lesson_reminders, true),
    schedule_openings_enabled = COALESCE(schedule_openings_enabled, schedule_updates, true),
    waitlist_enabled = COALESCE(waitlist_enabled, lesson_reminders, true),
    payments_enabled = COALESCE(payments_enabled, package_reminders, true),
    membership_enabled = COALESCE(membership_enabled, package_reminders, true),
    staff_replies_enabled = COALESCE(staff_replies_enabled, true),
    recommendations_enabled = COALESCE(recommendations_enabled, marketing, false),
    marketing_analytics_enabled = COALESCE(marketing_analytics_enabled, false),
    time_sensitive_enabled = COALESCE(time_sensitive_enabled, true),
    preference_revision = COALESCE(preference_revision, 1);

ALTER TABLE public.member_notification_preferences
  ALTER COLUMN class_operations_enabled SET DEFAULT true,
  ALTER COLUMN class_operations_enabled SET NOT NULL,
  ALTER COLUMN class_reminders_enabled SET DEFAULT true,
  ALTER COLUMN class_reminders_enabled SET NOT NULL,
  ALTER COLUMN schedule_openings_enabled SET DEFAULT true,
  ALTER COLUMN schedule_openings_enabled SET NOT NULL,
  ALTER COLUMN waitlist_enabled SET DEFAULT true,
  ALTER COLUMN waitlist_enabled SET NOT NULL,
  ALTER COLUMN payments_enabled SET DEFAULT true,
  ALTER COLUMN payments_enabled SET NOT NULL,
  ALTER COLUMN membership_enabled SET DEFAULT true,
  ALTER COLUMN membership_enabled SET NOT NULL,
  ALTER COLUMN staff_replies_enabled SET DEFAULT true,
  ALTER COLUMN staff_replies_enabled SET NOT NULL,
  ALTER COLUMN recommendations_enabled SET DEFAULT false,
  ALTER COLUMN recommendations_enabled SET NOT NULL,
  ALTER COLUMN marketing_analytics_enabled SET DEFAULT false,
  ALTER COLUMN marketing_analytics_enabled SET NOT NULL,
  ALTER COLUMN time_sensitive_enabled SET DEFAULT true,
  ALTER COLUMN time_sensitive_enabled SET NOT NULL,
  ALTER COLUMN preference_revision SET DEFAULT 1,
  ALTER COLUMN preference_revision SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_preference_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  preference_key text NOT NULL,
  previous_value boolean,
  new_value boolean NOT NULL,
  source text NOT NULL DEFAULT 'member_settings',
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_preference_events_member_idx
  ON public.notification_preference_events(member_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_member_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_source text := COALESCE(
    NULLIF(current_setting('app.notification_preference_source', true), ''),
    'member_settings'
  );
  v_keys constant text[] := ARRAY[
    'lesson_reminders', 'schedule_updates', 'package_reminders', 'marketing', 'sound',
    'whatsapp_enabled', 'email_enabled', 'class_operations_enabled',
    'class_reminders_enabled', 'schedule_openings_enabled', 'waitlist_enabled',
    'payments_enabled', 'membership_enabled', 'staff_replies_enabled',
    'recommendations_enabled', 'marketing_analytics_enabled', 'time_sensitive_enabled'
  ];
BEGIN
  FOREACH v_key IN ARRAY v_keys LOOP
    IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
      INSERT INTO public.notification_preference_events (
        member_id, preference_key, previous_value, new_value, source, actor_id
      ) VALUES (
        NEW.member_id,
        v_key,
        CASE WHEN v_old ? v_key THEN (v_old ->> v_key)::boolean ELSE NULL END,
        (v_new ->> v_key)::boolean,
        v_source,
        auth.uid()
      );
    END IF;
  END LOOP;
  NEW.preference_revision := OLD.preference_revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_member_notification_preferences
  ON public.member_notification_preferences;
CREATE TRIGGER trg_audit_member_notification_preferences
  BEFORE UPDATE ON public.member_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.audit_member_notification_preferences();

ALTER TABLE public.member_push_tokens
  ADD COLUMN IF NOT EXISTS installation_id text,
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS build_number text,
  ADD COLUMN IF NOT EXISTS device_locale text,
  ADD COLUMN IF NOT EXISTS apns_environment text,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_permission_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS logged_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS stale_after timestamptz;

ALTER TABLE public.admin_push_tokens
  ADD COLUMN IF NOT EXISTS apns_environment text;

UPDATE public.member_push_tokens
SET token_hash = COALESCE(token_hash, encode(digest(token, 'sha256'), 'hex')),
    last_permission_synced_at = COALESCE(last_permission_synced_at, updated_at, now()),
    stale_after = COALESCE(stale_after, last_seen_at + interval '90 days');

UPDATE public.member_push_tokens
SET active = false, apns_environment = NULL
WHERE apns_environment IS NULL;

-- The environment of legacy tokens cannot be inferred safely. Force a fresh
-- native registration instead of risking BadDeviceToken or cross-environment sends.
UPDATE public.admin_push_tokens
SET active = false, apns_environment = NULL
WHERE apns_environment IS NULL;

ALTER TABLE public.admin_push_tokens
  ALTER COLUMN apns_environment DROP DEFAULT,
  ALTER COLUMN apns_environment DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS admin_push_tokens_apns_environment_check;
ALTER TABLE public.admin_push_tokens
  ADD CONSTRAINT admin_push_tokens_apns_environment_check
  CHECK (apns_environment IS NULL OR apns_environment IN ('sandbox', 'production'));

CREATE OR REPLACE FUNCTION public.deactivate_admin_push_tokens_after_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
    UPDATE public.admin_push_tokens
    SET active = false, updated_at = now()
    WHERE user_id = NEW.id AND active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_admin_push_tokens_after_role_change ON public.profiles;
CREATE TRIGGER trg_deactivate_admin_push_tokens_after_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.deactivate_admin_push_tokens_after_role_change();

ALTER TABLE public.member_push_tokens
  DROP CONSTRAINT IF EXISTS member_push_tokens_apns_environment_check;
ALTER TABLE public.member_push_tokens
  ADD CONSTRAINT member_push_tokens_apns_environment_check
  CHECK (apns_environment IS NULL OR apns_environment IN ('sandbox', 'production'));

CREATE UNIQUE INDEX IF NOT EXISTS member_push_tokens_installation_uniq
  ON public.member_push_tokens(installation_id)
  WHERE installation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS member_push_tokens_hash_uniq
  ON public.member_push_tokens(token_hash)
  WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS member_push_tokens_delivery_eligible_idx
  ON public.member_push_tokens(member_id, last_seen_at DESC)
  WHERE active = true AND permission_status = 'granted' AND logged_out_at IS NULL;

CREATE OR REPLACE FUNCTION public.register_member_push_installation(
  p_member_id uuid,
  p_token text,
  p_token_hash text,
  p_platform text,
  p_installation_id text,
  p_app_version text,
  p_build_number text,
  p_device_locale text,
  p_apns_environment text,
  p_capabilities jsonb,
  p_permission_status text,
  p_seen_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
  v_installation_id uuid;
  v_target_id uuid;
  v_lock_a text := LEAST(COALESCE(p_installation_id, ''), p_token_hash);
  v_lock_b text := GREATEST(COALESCE(p_installation_id, ''), p_token_hash);
BEGIN
  IF p_member_id IS NULL OR p_token IS NULL OR p_token_hash IS NULL THEN
    RAISE EXCEPTION 'push_registration_identity_required';
  END IF;
  IF p_platform <> 'ios' OR p_apns_environment NOT IN ('sandbox', 'production') THEN
    RAISE EXCEPTION 'invalid_push_registration';
  END IF;
  IF p_permission_status NOT IN ('granted', 'denied', 'prompt') THEN
    RAISE EXCEPTION 'invalid_push_permission_status';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('push-registration:' || v_lock_a, 0));
  IF v_lock_b IS DISTINCT FROM v_lock_a THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('push-registration:' || v_lock_b, 0));
  END IF;

  SELECT id INTO v_token_id
  FROM public.member_push_tokens
  WHERE token_hash = p_token_hash OR token = p_token
  ORDER BY (token_hash = p_token_hash) DESC, created_at
  LIMIT 1
  FOR UPDATE;

  IF p_installation_id IS NOT NULL THEN
    SELECT id INTO v_installation_id
    FROM public.member_push_tokens
    WHERE installation_id = p_installation_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_token_id IS NOT NULL AND v_installation_id IS NOT NULL
     AND v_token_id <> v_installation_id THEN
    UPDATE public.member_push_tokens
    SET installation_id = NULL,
        active = false,
        logged_out_at = p_seen_at,
        updated_at = p_seen_at
    WHERE id = v_installation_id;
  END IF;

  v_target_id := COALESCE(v_token_id, v_installation_id);
  IF v_target_id IS NULL THEN
    INSERT INTO public.member_push_tokens (
      member_id, token, token_hash, platform, installation_id, app_version,
      build_number, device_locale, apns_environment, capabilities, active,
      permission_status, last_permission_synced_at, logged_out_at, stale_after,
      last_seen_at, updated_at
    ) VALUES (
      p_member_id, p_token, p_token_hash, p_platform, p_installation_id, p_app_version,
      p_build_number, p_device_locale, p_apns_environment, COALESCE(p_capabilities, '{}'::jsonb),
      true, p_permission_status, p_seen_at, NULL, p_seen_at + interval '90 days', p_seen_at, p_seen_at
    ) RETURNING id INTO v_target_id;
  ELSE
    UPDATE public.member_push_tokens
    SET member_id = p_member_id,
        token = p_token,
        token_hash = p_token_hash,
        platform = p_platform,
        installation_id = p_installation_id,
        app_version = p_app_version,
        build_number = p_build_number,
        device_locale = p_device_locale,
        apns_environment = p_apns_environment,
        capabilities = COALESCE(p_capabilities, '{}'::jsonb),
        active = true,
        permission_status = p_permission_status,
        last_permission_synced_at = p_seen_at,
        logged_out_at = NULL,
        stale_after = p_seen_at + interval '90 days',
        last_seen_at = p_seen_at,
        updated_at = p_seen_at
    WHERE id = v_target_id;
  END IF;
  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_member_push_installation(
  uuid, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_member_push_installation(
  uuid, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) TO service_role;

-- Raw APNs tokens are server-only. Members and admins use sanitized server functions/views.
DROP POLICY IF EXISTS "members read own push devices" ON public.member_push_tokens;
DROP POLICY IF EXISTS "admins read member push devices" ON public.member_push_tokens;
REVOKE SELECT ON public.member_push_tokens FROM authenticated;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS notification_family text,
  ADD COLUMN IF NOT EXISTS notification_tier text,
  ADD COLUMN IF NOT EXISTS preference_key text,
  ADD COLUMN IF NOT EXISTS deep_link text,
  ADD COLUMN IF NOT EXISTS action_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS thread_key text,
  ADD COLUMN IF NOT EXISTS collapse_key text,
  ADD COLUMN IF NOT EXISTS interruption_level text,
  ADD COLUMN IF NOT EXISTS sound_key text,
  ADD COLUMN IF NOT EXISTS badge_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pinned_until timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS supersedes_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_notification_tier_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_notification_tier_check CHECK (
    notification_tier IS NULL OR notification_tier IN (
      'critical', 'transactional', 'reminder', 'promotional', 'inbox_only'
    )
  );
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_interruption_level_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_interruption_level_check CHECK (
    interruption_level IS NULL OR interruption_level IN ('passive', 'active', 'time-sensitive')
  );

CREATE INDEX IF NOT EXISTS messages_member_inbox_v2_idx
  ON public.messages(member_id, archived_at, created_at DESC)
  WHERE member_visible = true;
CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON public.messages(member_id, thread_key, created_at DESC)
  WHERE thread_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_delivery_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.message_deliveries(id) ON DELETE CASCADE,
  push_token_id uuid REFERENCES public.member_push_tokens(id) ON DELETE CASCADE,
  admin_push_token_id uuid REFERENCES public.admin_push_tokens(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued', 'sending', 'accepted', 'sent', 'device_received', 'failed',
      'dead_letter', 'suppressed', 'expired', 'cancelled', 'delivery_unknown'
    )
  ),
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  accepted_at timestamptz,
  device_received_at timestamptz,
  failed_at timestamptz,
  failure_class text CHECK (
    failure_class IS NULL OR failure_class IN ('transient', 'permanent', 'configuration', 'ambiguous')
  ),
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, push_token_id),
  UNIQUE (delivery_id, admin_push_token_id),
  CHECK (
    (push_token_id IS NOT NULL AND member_id IS NOT NULL
      AND admin_push_token_id IS NULL AND admin_user_id IS NULL)
    OR
    (admin_push_token_id IS NOT NULL AND admin_user_id IS NOT NULL
      AND push_token_id IS NULL AND member_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS message_delivery_targets_provider_uniq
  ON public.message_delivery_targets(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_delivery_targets_due_idx
  ON public.message_delivery_targets(status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE TABLE IF NOT EXISTS public.message_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.message_deliveries(id) ON DELETE SET NULL,
  delivery_target_id uuid REFERENCES public.message_delivery_targets(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  installation_id text,
  event_type text NOT NULL CHECK (
    event_type IN ('device_received', 'opened', 'actioned', 'converted', 'archived', 'dismissed')
  ),
  action_id text,
  event_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_engagement_events_message_idx
  ON public.message_engagement_events(message_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS message_engagement_events_aggregate_idx
  ON public.message_engagement_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_event_rollouts (
  event_type text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  allowlist_only boolean NOT NULL DEFAULT true,
  copy_reviewed boolean NOT NULL DEFAULT false,
  enabled_channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  enabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (enabled = false OR copy_reviewed = true)
);

CREATE TABLE IF NOT EXISTS public.notification_frequency_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL UNIQUE REFERENCES public.message_outbox(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_frequency_reservations_member_idx
  ON public.notification_frequency_reservations(member_id, created_at DESC);

INSERT INTO public.notification_frequency_reservations (outbox_id, member_id, event_type, created_at)
SELECT id, member_id, event_type, created_at
FROM public.message_outbox
WHERE member_id IS NOT NULL
  AND event_type IN (
    'booking_no_show_followup', 'class_published', 'class_open_spots',
    'class_recommendation', 'trial_followup', 'retention_reminder'
  )
  AND created_at >= now() - interval '7 days'
ON CONFLICT (outbox_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_promotional_notification(
  p_outbox_id uuid,
  p_member_id uuid,
  p_event_type text,
  p_now timestamptz DEFAULT now()
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_day_count integer; v_week_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-frequency:' || p_member_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.notification_frequency_reservations WHERE outbox_id = p_outbox_id) THEN
    RETURN true;
  END IF;
  SELECT
    count(*) FILTER (WHERE created_at >= p_now - interval '24 hours'),
    count(*) FILTER (WHERE created_at >= p_now - interval '7 days')
  INTO v_day_count, v_week_count
  FROM public.notification_frequency_reservations
  WHERE member_id = p_member_id AND created_at >= p_now - interval '7 days';
  IF v_day_count >= 1 OR v_week_count >= 3 THEN RETURN false; END IF;
  INSERT INTO public.notification_frequency_reservations (outbox_id, member_id, event_type, created_at)
  VALUES (p_outbox_id, p_member_id, p_event_type, p_now);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_promotional_notification(uuid, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_promotional_notification(uuid, uuid, text, timestamptz)
  TO service_role;

INSERT INTO public.notification_event_rollouts (
  event_type, enabled, allowlist_only, copy_reviewed, enabled_channels
)
SELECT
  event_type,
  event_type = ANY(ARRAY[
    'booking_confirmed', 'booking_cancelled', 'class_cancelled_by_admin',
    'class_time_changed', 'class_reminder_planning', 'class_reminder_final',
    'class_open_spots', 'waitlist_joined', 'waitlist_spot_available',
    'payment_request_received', 'payment_pending_reminder', 'payment_confirmed',
    'payment_failed', 'receipt_issued', 'human_handoff'
  ]::text[]),
  NOT (event_type = ANY(ARRAY[
    'booking_confirmed', 'booking_cancelled', 'class_cancelled_by_admin',
    'class_time_changed', 'class_reminder_planning', 'class_reminder_final',
    'class_open_spots', 'waitlist_joined', 'waitlist_spot_available',
    'payment_request_received', 'payment_pending_reminder', 'payment_confirmed',
    'payment_failed', 'receipt_issued', 'human_handoff'
  ]::text[])),
  event_type = ANY(ARRAY[
    'booking_confirmed', 'booking_cancelled', 'class_cancelled_by_admin',
    'class_time_changed', 'class_reminder_planning', 'class_reminder_final',
    'class_open_spots', 'waitlist_joined', 'waitlist_spot_available',
    'payment_request_received', 'payment_pending_reminder', 'payment_confirmed',
    'payment_failed', 'receipt_issued', 'human_handoff'
  ]::text[]),
  CASE
    WHEN event_type = ANY(ARRAY[
      'booking_confirmed', 'booking_cancelled', 'class_cancelled_by_admin',
      'class_time_changed', 'payment_confirmed', 'payment_failed'
    ]::text[]) THEN ARRAY['in_app', 'push', 'whatsapp', 'email']::text[]
    WHEN event_type = ANY(ARRAY[
      'class_reminder_planning', 'class_reminder_final', 'waitlist_spot_available',
      'payment_pending_reminder', 'human_handoff'
    ]::text[]) THEN ARRAY['in_app', 'push', 'whatsapp']::text[]
    WHEN event_type = 'payment_request_received'
      THEN ARRAY['in_app', 'push', 'email']::text[]
    WHEN event_type = ANY(ARRAY['class_open_spots', 'waitlist_joined']::text[])
      THEN ARRAY['in_app', 'push']::text[]
    WHEN event_type = 'receipt_issued' THEN ARRAY['in_app', 'email']::text[]
    ELSE ARRAY['in_app']::text[]
  END
FROM unnest(ARRAY[
  'booking_confirmed', 'booking_cancelled', 'booking_changed', 'booking_checked_in',
  'booking_no_show_followup', 'class_cancelled_by_admin', 'class_time_changed',
  'class_location_changed', 'class_instructor_changed', 'class_reminder_planning',
  'class_reminder_final', 'class_published', 'class_open_spots', 'class_recommendation',
  'waitlist_joined', 'waitlist_position_changed', 'waitlist_spot_available',
  'waitlist_accepted', 'waitlist_offer_expired', 'waitlist_removed',
  'payment_request_received', 'payment_pending_reminder', 'payment_confirmed',
  'payment_failed', 'payment_refunded', 'receipt_issued', 'membership_activated',
  'credits_low', 'credits_depleted', 'membership_expiring', 'membership_expired',
  'subscription_renewal_upcoming', 'subscription_renewal_succeeded',
  'subscription_renewal_failed', 'subscription_paused', 'subscription_cancelled',
  'human_handoff', 'staff_reply', 'human_handoff_resolved',
  'urgent_studio_announcement', 'trial_followup', 'retention_reminder'
]::text[]) AS event_type
ON CONFLICT (event_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.premium_notification_event_enabled(p_event_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT enabled AND copy_reviewed
    FROM public.notification_event_rollouts
    WHERE event_type = p_event_type
  ), false)
$$;

REVOKE ALL ON FUNCTION public.premium_notification_event_enabled(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.premium_notification_event_enabled(text) TO service_role;

-- Extend existing transactional triggers. Every newly introduced event is dark until its
-- rollout row is separately copy-reviewed and enabled; current canonical events retain behavior.
CREATE OR REPLACE FUNCTION public.enqueue_booking_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_class_status text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'booked' THEN
    v_event := 'booking_confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'booked' THEN
    v_event := 'booking_confirmed';
  ELSIF TG_OP = 'UPDATE' AND OLD.class_id IS DISTINCT FROM NEW.class_id
        AND NEW.status = 'booked'
        AND public.premium_notification_event_enabled('booking_changed') THEN
    v_event := 'booking_changed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'booked' AND NEW.status = 'cancelled' THEN
    SELECT status INTO v_class_status FROM public.classes WHERE id = NEW.class_id;
    IF v_class_status = 'cancelled' THEN RETURN NEW; END IF;
    v_event := 'booking_cancelled';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'checked_in'
        AND public.premium_notification_event_enabled('booking_checked_in') THEN
    v_event := 'booking_checked_in';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'no_show'
        AND public.premium_notification_event_enabled('booking_no_show_followup') THEN
    v_event := 'booking_no_show_followup';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'booking', NEW.id, NEW.member_id,
    jsonb_build_object(
      'booking_id', NEW.id, 'class_id', NEW.class_id,
      'previous_class_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.class_id ELSE NULL END
    ),
    concat('booking:', NEW.id, ':', v_event, ':', txid_current()), now(), NULL
  );
  IF v_event = 'booking_confirmed'
     AND public.premium_notification_event_enabled('waitlist_accepted')
     AND EXISTS (
       SELECT 1 FROM public.waitlist_entries
       WHERE member_id = NEW.member_id AND class_id = NEW.class_id AND status = 'promoted'
     ) THEN
    PERFORM public.emit_message_outbox(
      'waitlist_accepted', 'booking', NEW.id, NEW.member_id,
      jsonb_build_object('booking_id', NEW.id, 'class_id', NEW.class_id),
      concat('booking:', NEW.id, ':waitlist_accepted'), now(), NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_message_outbox ON public.bookings;
CREATE TRIGGER trg_booking_message_outbox
  AFTER INSERT OR UPDATE OF status, class_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_booking_message_event();

CREATE OR REPLACE FUNCTION public.enqueue_class_message_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking record; v_event text; v_location text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    v_event := 'class_cancelled_by_admin';
  ELSIF OLD.starts_at IS DISTINCT FROM NEW.starts_at THEN
    v_event := 'class_time_changed';
  ELSIF (OLD.room_id IS DISTINCT FROM NEW.room_id OR OLD.room IS DISTINCT FROM NEW.room)
        AND public.premium_notification_event_enabled('class_location_changed') THEN
    v_event := 'class_location_changed';
    SELECT name INTO v_location FROM public.rooms WHERE id = NEW.room_id;
    v_location := COALESCE(v_location, NEW.room, 'Cloud & Core');
  ELSIF OLD.instructor_id IS DISTINCT FROM NEW.instructor_id
        AND public.premium_notification_event_enabled('class_instructor_changed') THEN
    v_event := 'class_instructor_changed';
  ELSE
    RETURN NEW;
  END IF;
  FOR v_booking IN
    SELECT id, member_id FROM public.bookings
    WHERE class_id = NEW.id AND status IN ('booked', 'checked_in')
  LOOP
    PERFORM public.emit_message_outbox(
      v_event, 'class', NEW.id, v_booking.member_id,
      jsonb_build_object(
        'class_id', NEW.id, 'booking_id', v_booking.id,
        'previous_starts_at', OLD.starts_at, 'starts_at', NEW.starts_at,
        'location_name', v_location
      ),
      concat('class:', NEW.id, ':', v_booking.member_id, ':', v_event, ':', txid_current()),
      now(), NULL
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_message_outbox ON public.classes;
CREATE TRIGGER trg_class_message_outbox
  AFTER UPDATE OF status, starts_at, room_id, room, instructor_id ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_class_message_events();

CREATE OR REPLACE FUNCTION public.enqueue_class_published_message_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member record;
BEGIN
  IF NOT public.canonical_message_writes_enabled()
     OR NOT public.premium_notification_event_enabled('class_published')
     OR NEW.status <> 'scheduled'
     OR COALESCE(NEW.member_visible, true) = false
     OR (TG_OP = 'UPDATE' AND OLD.status = 'scheduled' AND COALESCE(OLD.member_visible, true) = true)
  THEN RETURN NEW; END IF;
  FOR v_member IN SELECT id FROM public.members WHERE status = 'active' LOOP
    PERFORM public.emit_message_outbox(
      'class_published', 'class', NEW.id, v_member.id,
      jsonb_build_object('class_id', NEW.id),
      concat('class:', NEW.id, ':class_published:member:', v_member.id), now(), NEW.starts_at
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_published_message_outbox ON public.classes;
CREATE TRIGGER trg_class_published_message_outbox
  AFTER INSERT OR UPDATE OF status, member_visible ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_class_published_message_events();

CREATE OR REPLACE FUNCTION public.enqueue_waitlist_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_waitlist record; v_position integer;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.status = 'waiting' THEN
    v_event := 'waitlist_joined';
  ELSIF NEW.status = 'promoted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'waitlist_spot_available';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('expired', 'no_response')
        AND public.premium_notification_event_enabled('waitlist_offer_expired') THEN
    v_event := 'waitlist_offer_expired';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('left', 'cancelled', 'removed')
        AND public.premium_notification_event_enabled('waitlist_removed') THEN
    v_event := 'waitlist_removed';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'waitlist_entry', NEW.id, NEW.member_id,
    jsonb_build_object(
      'waitlist_entry_id', NEW.id, 'class_id', NEW.class_id,
      'offered_at', NEW.offered_at, 'offer_expires_at', NEW.offer_expires_at
    ),
    concat('waitlist:', NEW.id, ':', v_event, ':', txid_current()),
    now(), CASE WHEN v_event = 'waitlist_spot_available' THEN NEW.offer_expires_at ELSE NULL END
  );
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status <> 'waiting'
     AND public.premium_notification_event_enabled('waitlist_position_changed') THEN
    v_position := 0;
    FOR v_waitlist IN
      SELECT id, member_id FROM public.waitlist_entries
      WHERE class_id = NEW.class_id AND status = 'waiting'
      ORDER BY created_at, id
    LOOP
      v_position := v_position + 1;
      PERFORM public.emit_message_outbox(
        'waitlist_position_changed', 'waitlist_entry', v_waitlist.id, v_waitlist.member_id,
        jsonb_build_object(
          'waitlist_entry_id', v_waitlist.id, 'class_id', NEW.class_id,
          'waitlist_position', v_position
        ),
        concat('waitlist:', v_waitlist.id, ':position:', v_position, ':', txid_current()),
        now(), NULL
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_payment_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_confirmed';
  ELSIF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    v_event := 'payment_failed';
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event := 'payment_request_received';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('refunded', 'partially_refunded')
        AND public.premium_notification_event_enabled('payment_refunded') THEN
    v_event := 'payment_refunded';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'payment', NEW.id, NEW.member_id,
    jsonb_build_object(
      'payment_id', NEW.id, 'plan_id', NEW.plan_id,
      'subscription_id', NEW.subscription_id, 'amount', NEW.amount, 'currency', NEW.currency
    ),
    concat('payment:', NEW.id, ':', v_event), now(), NULL
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_credit_balance_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() OR OLD.remaining_credits IS NOT DISTINCT FROM NEW.remaining_credits THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.remaining_credits, 0) > 0 AND COALESCE(NEW.remaining_credits, 0) = 0
     AND public.premium_notification_event_enabled('credits_depleted') THEN
    v_event := 'credits_depleted';
  ELSIF COALESCE(OLD.remaining_credits, 0) > 2 AND COALESCE(NEW.remaining_credits, 0) BETWEEN 1 AND 2
     AND public.premium_notification_event_enabled('credits_low') THEN
    v_event := 'credits_low';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'member', NEW.id, NEW.id,
    jsonb_build_object('credits_remaining', NEW.remaining_credits),
    concat('member:', NEW.id, ':', v_event, ':', txid_current()), now(), NULL
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_member_plan_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_plan_name text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status = 'active'
     AND public.premium_notification_event_enabled('membership_activated') THEN
    v_event := 'membership_activated';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'expired'
        AND public.premium_notification_event_enabled('membership_expired') THEN
    v_event := 'membership_expired';
  ELSE
    RETURN NEW;
  END IF;
  SELECT name INTO v_plan_name FROM public.plans WHERE id = NEW.plan_id;
  PERFORM public.emit_message_outbox(
    v_event, 'member_plan', NEW.id, NEW.member_id,
    jsonb_build_object(
      'member_plan_id', NEW.id, 'plan_id', NEW.plan_id,
      'package_name', COALESCE(v_plan_name, 'Cloud & Core'), 'expiry_date', NEW.expires_at
    ),
    concat('member_plan:', NEW.id, ':', v_event), now(), NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_plan_message_outbox ON public.member_plans;
CREATE TRIGGER trg_member_plan_message_outbox
  AFTER INSERT OR UPDATE OF status ON public.member_plans
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_member_plan_message_event();

ALTER TABLE public.member_subscriptions
  DROP CONSTRAINT IF EXISTS member_subscriptions_status_check;
ALTER TABLE public.member_subscriptions
  ADD CONSTRAINT member_subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'cancelled', 'incomplete', 'paused'));

CREATE OR REPLACE FUNCTION public.enqueue_subscription_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text;
BEGIN
  IF NOT public.canonical_message_writes_enabled() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.last_payment_id IS DISTINCT FROM NEW.last_payment_id
        AND NEW.status = 'active'
        AND public.premium_notification_event_enabled('subscription_renewal_succeeded') THEN
    v_event := 'subscription_renewal_succeeded';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('past_due', 'incomplete')
        AND public.premium_notification_event_enabled('subscription_renewal_failed') THEN
    v_event := 'subscription_renewal_failed';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'paused'
        AND public.premium_notification_event_enabled('subscription_paused') THEN
    v_event := 'subscription_paused';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'cancelled'
        AND public.premium_notification_event_enabled('subscription_cancelled') THEN
    v_event := 'subscription_cancelled';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.emit_message_outbox(
    v_event, 'member_subscription', NEW.id, NEW.member_id,
    jsonb_build_object(
      'subscription_id', NEW.id, 'plan_id', NEW.plan_id,
      'renewal_date', NEW.next_charge_at
    ),
    concat(
      'subscription:', NEW.id, ':', v_event, ':',
      COALESCE(NEW.last_payment_id::text, NEW.status)
    ),
    now(), NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_message_outbox ON public.member_subscriptions;
CREATE TRIGGER trg_subscription_message_outbox
  AFTER INSERT OR UPDATE OF status, last_payment_id ON public.member_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_subscription_message_event();

DROP TRIGGER IF EXISTS trg_credit_balance_message_outbox ON public.members;
CREATE TRIGGER trg_credit_balance_message_outbox
  AFTER UPDATE OF remaining_credits ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_credit_balance_message_event();

CREATE TABLE IF NOT EXISTS public.notification_staff_test_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  push_token_id uuid UNIQUE REFERENCES public.member_push_tokens(id) ON DELETE CASCADE,
  admin_push_token_id uuid UNIQUE REFERENCES public.admin_push_tokens(id) ON DELETE CASCADE,
  label text NOT NULL,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((push_token_id IS NOT NULL) <> (admin_push_token_id IS NOT NULL))
);

CREATE OR REPLACE FUNCTION public.record_message_engagement(
  p_message_id uuid,
  p_event_type text,
  p_installation_id text DEFAULT NULL,
  p_action_id text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
  v_delivery_id uuid;
  v_target_id uuid;
  v_event_id uuid;
  v_event_key text;
BEGIN
  IF v_member_id IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF p_event_type NOT IN ('device_received', 'opened', 'actioned', 'converted', 'archived', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_engagement_event';
  END IF;
  IF octet_length(COALESCE(p_metadata, '{}'::jsonb)::text) > 4096 THEN
    RAISE EXCEPTION 'engagement_metadata_too_large';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message_id AND m.member_id = auth.uid() AND m.member_visible = true
  ) THEN
    RAISE EXCEPTION 'message_not_found';
  END IF;
  IF p_installation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.member_push_tokens t
    WHERE t.installation_id = p_installation_id AND t.member_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'installation_not_found';
  END IF;

  SELECT d.id INTO v_delivery_id
  FROM public.message_deliveries d
  WHERE d.message_id = p_message_id AND d.channel = 'push'
  LIMIT 1;

  IF p_installation_id IS NOT NULL AND v_delivery_id IS NOT NULL THEN
    SELECT target.id INTO v_target_id
    FROM public.message_delivery_targets target
    JOIN public.member_push_tokens t ON t.id = target.push_token_id
    WHERE target.delivery_id = v_delivery_id
      AND t.installation_id = p_installation_id
      AND t.member_id = auth.uid()
    LIMIT 1;
  END IF;

  v_event_key := concat_ws(
    ':', 'engagement', p_message_id::text, v_member_id::text,
    COALESCE(p_installation_id, 'no-installation'), p_event_type, COALESCE(p_action_id, 'none')
  );

  INSERT INTO public.message_engagement_events (
    message_id, delivery_id, delivery_target_id, member_id, installation_id,
    event_type, action_id, event_key, occurred_at, metadata
  ) VALUES (
    p_message_id, v_delivery_id, v_target_id, v_member_id, p_installation_id,
    p_event_type, p_action_id, v_event_key,
    LEAST(GREATEST(p_occurred_at, now() - interval '7 days'), now() + interval '5 minutes'),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF p_event_type IN ('opened', 'actioned') THEN
    UPDATE public.message_deliveries
    SET status = CASE WHEN status IN ('queued', 'sending', 'accepted', 'sent', 'delivered') THEN 'read' ELSE status END,
        read_at = COALESCE(read_at, now()),
        updated_at = now()
    WHERE message_id = p_message_id AND channel = 'in_app';
  ELSIF p_event_type = 'device_received' AND v_target_id IS NOT NULL THEN
    UPDATE public.message_delivery_targets
    SET status = CASE WHEN status IN ('queued', 'sending', 'accepted', 'sent') THEN 'device_received' ELSE status END,
        device_received_at = COALESCE(device_received_at, now()),
        updated_at = now()
    WHERE id = v_target_id;
  ELSIF p_event_type = 'archived' THEN
    UPDATE public.messages SET archived_at = COALESCE(archived_at, now()), updated_at = now()
    WHERE id = p_message_id;
  END IF;

  RETURN v_event_id;
END;
$$;

ALTER TABLE public.notification_preference_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_event_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_frequency_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_staff_test_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own engagement events"
  ON public.message_engagement_events FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "admins manage notification event rollouts"
  ON public.notification_event_rollouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.notification_preference_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.message_delivery_targets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.message_engagement_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.message_engagement_events FROM authenticated;
REVOKE ALL ON public.notification_staff_test_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notification_frequency_reservations FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.message_engagement_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_event_rollouts TO authenticated;
GRANT ALL ON public.notification_preference_events TO service_role;
GRANT ALL ON public.message_delivery_targets TO service_role;
GRANT ALL ON public.message_engagement_events TO service_role;
GRANT ALL ON public.notification_event_rollouts TO service_role;
GRANT ALL ON public.notification_staff_test_devices TO service_role;
GRANT ALL ON public.notification_frequency_reservations TO service_role;

REVOKE ALL ON FUNCTION public.record_message_engagement(uuid, text, text, text, timestamptz, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_message_engagement(uuid, text, text, text, timestamptz, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redact_and_purge_message_audit(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_redacted integer; v_webhook_bodies integer; v_deliveries integer;
  v_attempts integer; v_webhooks integer; v_targets integer;
  v_engagements integer; v_preference_events integer;
BEGIN
  UPDATE public.messages
  SET body = NULL,
      subject = CASE WHEN subject IS NULL THEN NULL ELSE '[redacted]' END,
      content = content - 'variables' - 'body' - 'text' - 'caption',
      redacted_at = p_now,
      updated_at = p_now
  WHERE redacted_at IS NULL AND created_at < p_now - interval '180 days';
  GET DIAGNOSTICS v_redacted = ROW_COUNT;

  UPDATE public.message_webhook_events
  SET payload = CASE
    WHEN jsonb_typeof(payload->'media') = 'object'
      THEN jsonb_set(payload - 'text', '{media}', (payload->'media') - 'caption')
    ELSE payload - 'text'
  END
  WHERE provider = 'whatsapp'
    AND received_at < p_now - interval '180 days'
    AND (payload ? 'text' OR (payload->'media') ? 'caption');
  GET DIAGNOSTICS v_webhook_bodies = ROW_COUNT;

  UPDATE public.message_deliveries
  SET recipient_address = NULL,
      provider_message_id = NULL,
      provider_payload = '{}'::jsonb,
      provider_status = NULL,
      error_code = NULL,
      error_message = NULL,
      lease_owner = NULL,
      lease_expires_at = NULL,
      updated_at = p_now
  WHERE created_at < p_now - interval '13 months'
    AND (
      recipient_address IS NOT NULL OR provider_message_id IS NOT NULL
      OR provider_payload <> '{}'::jsonb OR provider_status IS NOT NULL
      OR error_code IS NOT NULL OR error_message IS NOT NULL
      OR lease_owner IS NOT NULL OR lease_expires_at IS NOT NULL
    );
  GET DIAGNOSTICS v_deliveries = ROW_COUNT;

  DELETE FROM public.message_delivery_attempts WHERE created_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_attempts = ROW_COUNT;
  DELETE FROM public.message_webhook_events WHERE received_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_webhooks = ROW_COUNT;
  DELETE FROM public.message_delivery_targets WHERE created_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_targets = ROW_COUNT;
  DELETE FROM public.message_engagement_events WHERE created_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_engagements = ROW_COUNT;
  DELETE FROM public.notification_preference_events WHERE created_at < p_now - interval '13 months';
  GET DIAGNOSTICS v_preference_events = ROW_COUNT;
  DELETE FROM public.notification_frequency_reservations WHERE created_at < p_now - interval '13 months';

  RETURN jsonb_build_object(
    'redacted_messages', v_redacted,
    'redacted_webhook_bodies', v_webhook_bodies,
    'redacted_deliveries', v_deliveries,
    'deleted_attempts', v_attempts,
    'deleted_webhooks', v_webhooks,
    'deleted_delivery_targets', v_targets,
    'deleted_engagement_events', v_engagements,
    'deleted_preference_events', v_preference_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redact_and_purge_message_audit(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redact_and_purge_message_audit(timestamptz) TO service_role;

COMMENT ON TABLE public.message_delivery_targets IS
  'Per-installation APNs targets beneath one aggregate push delivery; raw tokens remain server-only.';
COMMENT ON TABLE public.message_engagement_events IS
  'Idempotent, member-owned notification receipt/open/action/conversion events.';
COMMENT ON TABLE public.notification_event_rollouts IS
  'Disabled-by-default production gates for newly approved premium notification events.';
