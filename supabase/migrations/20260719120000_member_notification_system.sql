CREATE TABLE IF NOT EXISTS public.member_notification_preferences (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  lesson_reminders boolean NOT NULL DEFAULT true,
  schedule_updates boolean NOT NULL DEFAULT true,
  package_reminders boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  sound boolean NOT NULL DEFAULT true,
  quiet_hours_start time NOT NULL DEFAULT '21:00',
  quiet_hours_end time NOT NULL DEFAULT '08:30',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform = 'ios'),
  active boolean NOT NULL DEFAULT true,
  permission_status text NOT NULL DEFAULT 'granted'
    CHECK (permission_status IN ('granted', 'denied', 'prompt')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (
    category IN ('activation','marketing','retention','schedule')
  ),
  localized_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_url text,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  booked_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN (
      'activation','lesson_reminder','marketing','package','payment_confirmed',
      'payment_failed','retention','schedule','urgent_class_change','waitlist'
    )
  ),
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  sound boolean NOT NULL DEFAULT false,
  campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE SET NULL,
  related_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  related_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  related_member_plan_id uuid REFERENCES public.member_plans(id) ON DELETE SET NULL,
  delivery_status text NOT NULL DEFAULT 'inbox'
    CHECK (delivery_status IN ('inbox','queued','sending','sent','delivered','failed','suppressed')),
  suppression_reason text,
  idempotency_key text,
  apns_id text,
  read_at timestamptz,
  opened_at timestamptz,
  delivered_at timestamptz,
  sent_at timestamptz,
  scheduled_for timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_campaign_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, member_id, booking_id)
);

CREATE INDEX IF NOT EXISTS member_push_tokens_active_idx
  ON public.member_push_tokens(member_id, active, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS member_notifications_inbox_idx
  ON public.member_notifications(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS member_notifications_unread_idx
  ON public.member_notifications(member_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS member_notifications_delivery_idx
  ON public.member_notifications(delivery_status, scheduled_for, created_at)
  WHERE delivery_status = 'queued';
CREATE UNIQUE INDEX IF NOT EXISTS member_notifications_idempotency_idx
  ON public.member_notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_campaigns_due_idx
  ON public.notification_campaigns(status, scheduled_for)
  WHERE status = 'scheduled';

ALTER TABLE public.member_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_campaign_conversions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.member_notification_preferences TO authenticated;
GRANT SELECT ON public.member_push_tokens TO authenticated;
GRANT SELECT ON public.member_notifications TO authenticated;
GRANT ALL ON public.member_notification_preferences TO service_role;
GRANT ALL ON public.member_push_tokens TO service_role;
GRANT ALL ON public.notification_campaigns TO service_role;
GRANT ALL ON public.member_notifications TO service_role;
GRANT ALL ON public.notification_campaign_conversions TO service_role;

CREATE POLICY "members read notification preferences"
  ON public.member_notification_preferences FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "members read own push devices"
  ON public.member_push_tokens FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "members read own notifications"
  ON public.member_notifications FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "admins manage notification campaigns"
  ON public.notification_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read member notification preferences"
  ON public.member_notification_preferences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read member push devices"
  ON public.member_push_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read member notifications"
  ON public.member_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read notification campaign conversions"
  ON public.notification_campaign_conversions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.member_notification_preferences (member_id)
SELECT id FROM public.members
ON CONFLICT (member_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_member_notification_preferences()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.member_notification_preferences (member_id)
  VALUES (NEW.id)
  ON CONFLICT (member_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_notification_preferences ON public.members;
CREATE TRIGGER trg_member_notification_preferences
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_member_notification_preferences();

CREATE OR REPLACE FUNCTION public.increment_notification_campaign_metric(
  p_campaign_id uuid,
  p_metric text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_metric = 'opened' THEN
    UPDATE public.notification_campaigns
    SET opened_count = opened_count + 1, updated_at = now()
    WHERE id = p_campaign_id;
  ELSIF p_metric = 'booked' THEN
    UPDATE public.notification_campaigns
    SET booked_count = booked_count + 1, updated_at = now()
    WHERE id = p_campaign_id;
  ELSE
    RAISE EXCEPTION 'unsupported campaign metric';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_notification_campaign_metric(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_notification_campaign_metric(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_notification_campaign_metric(uuid, text) TO service_role;
