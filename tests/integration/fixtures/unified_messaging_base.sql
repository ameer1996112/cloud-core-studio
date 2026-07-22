DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('member', 'instructor', 'admin');
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  role public.app_role NOT NULL DEFAULT 'member'
);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE TABLE public.members (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  preferred_language text NOT NULL DEFAULT 'en',
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active',
  remaining_credits integer NOT NULL DEFAULT 0
);
CREATE TABLE public.instructors (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.rooms (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.classes (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  cancellation_window_hours integer NOT NULL DEFAULT 24,
  instructor_id uuid REFERENCES public.instructors(id),
  room_id uuid REFERENCES public.rooms(id),
  room text,
  status text NOT NULL DEFAULT 'scheduled',
  member_visible boolean NOT NULL DEFAULT true,
  capacity integer NOT NULL DEFAULT 10,
  booked_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  status text NOT NULL DEFAULT 'booked',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.plans (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.member_plans (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  credits_granted integer NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.member_subscriptions (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  retry_count integer NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 100,
  currency text NOT NULL DEFAULT 'ILS',
  last_payment_id uuid,
  next_charge_at timestamptz NOT NULL DEFAULT now() + interval '1 month',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  status text NOT NULL DEFAULT 'pending',
  plan_id uuid REFERENCES public.plans(id),
  subscription_id uuid REFERENCES public.member_subscriptions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  receipt_number text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.package_requests (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id),
  plan_id uuid REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.studio_settings (
  id integer PRIMARY KEY,
  waitlist_claim_window_minutes integer NOT NULL DEFAULT 30
);
INSERT INTO public.studio_settings VALUES (1, 30);
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id),
  member_id uuid NOT NULL REFERENCES public.members(id),
  status text NOT NULL DEFAULT 'waiting',
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.member_notification_preferences (
  member_id uuid PRIMARY KEY REFERENCES public.members(id),
  lesson_reminders boolean NOT NULL DEFAULT true,
  schedule_updates boolean NOT NULL DEFAULT true,
  package_reminders boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  sound boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.member_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios',
  active boolean NOT NULL DEFAULT true,
  permission_status text NOT NULL DEFAULT 'granted',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_push_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.member_push_tokens TO authenticated;
GRANT ALL ON public.member_push_tokens TO service_role;
CREATE POLICY "members read own push devices"
  ON public.member_push_tokens FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "admins read member push devices"
  ON public.member_push_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.admin_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios',
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_push_tokens TO service_role;
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY,
  template_key text,
  channel text NOT NULL,
  recipient_member_id uuid REFERENCES public.members(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  trigger_type text,
  related_class_id uuid REFERENCES public.classes(id),
  related_booking_id uuid REFERENCES public.bookings(id),
  related_member_plan_id uuid,
  generated_text text,
  subject text,
  marked_sent_at timestamptz,
  language text,
  provider text,
  provider_message_id text,
  related_payment_id uuid REFERENCES public.payments(id),
  related_receipt_id uuid REFERENCES public.receipts(id),
  related_package_request_id uuid REFERENCES public.package_requests(id),
  sent_at timestamptz,
  error_message text,
  idempotency_key text,
  staff_visibility text NOT NULL DEFAULT 'operational',
  scheduled_for timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.member_notifications (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  sound boolean NOT NULL DEFAULT false,
  campaign_id uuid,
  related_booking_id uuid REFERENCES public.bookings(id),
  related_class_id uuid REFERENCES public.classes(id),
  related_payment_id uuid REFERENCES public.payments(id),
  related_member_plan_id uuid,
  delivery_status text NOT NULL DEFAULT 'inbox',
  suppression_reason text,
  idempotency_key text,
  apns_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  read_at timestamptz,
  opened_at timestamptz,
  delivered_at timestamptz,
  sent_at timestamptz,
  scheduled_for timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notification_logs_idempotency_key_uniq
  ON public.notification_logs(idempotency_key);
CREATE UNIQUE INDEX member_notifications_idempotency_idx
  ON public.member_notifications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'member@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'admin@example.com');
INSERT INTO public.profiles VALUES
  ('00000000-0000-0000-0000-000000000001', 'member'),
  ('00000000-0000-0000-0000-000000000002', 'admin');
INSERT INTO public.members (id, name, preferred_language, phone, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Member', 'he', '+972501234567', 'member@example.com');
INSERT INTO public.member_notification_preferences (member_id) VALUES
  ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.instructors VALUES
  ('10000000-0000-0000-0000-000000000001', 'Instructor');
INSERT INTO public.classes (id, title, starts_at, cancellation_window_hours, instructor_id, status) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Class', now() + interval '1 day', 24, '10000000-0000-0000-0000-000000000001', 'scheduled');
INSERT INTO public.bookings VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'booked', now());
INSERT INTO public.notification_logs (
  id, template_key, channel, recipient_member_id, status, trigger_type, language, provider, generated_text
) VALUES (
  '40000000-0000-0000-0000-000000000001', 'legacy_booking', 'whatsapp',
  '00000000-0000-0000-0000-000000000001', 'sent', 'booking_confirmed', 'he',
  'official_whatsapp', 'Legacy WhatsApp'
);
INSERT INTO public.member_notifications (
  id, member_id, category, title, body, delivery_status
) VALUES (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', 'schedule', 'Legacy inbox', 'Legacy body', 'delivered'
);
