
-- 1. Extend studio_settings with full studio identity + booking + comms config
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  ADD COLUMN IF NOT EXISTS supported_languages text[] NOT NULL DEFAULT ARRAY['he','ar','en']::text[],
  ADD COLUMN IF NOT EXISTS booking_window_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS registration_closes_minutes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_waitlist boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_promote_waitlist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_claim_window_minutes int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS trial_class_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS fallback_image_url text,
  ADD COLUMN IF NOT EXISTS welcome_text text,
  ADD COLUMN IF NOT EXISTS announcement_text text;

-- Seed a row if missing
INSERT INTO public.studio_settings (id, studio_name)
VALUES (1, 'Cloud & Core Studio')
ON CONFLICT (id) DO NOTHING;

-- 2. Extend notification_templates
ALTER TABLE public.notification_templates
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS description text;

-- Make (key) non-unique-friendly: drop existing unique if any, allow same key per channel/language
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_key_key') THEN
    ALTER TABLE public.notification_templates DROP CONSTRAINT notification_templates_key_key;
  END IF;
END $$;

-- 3. Extend notification_logs with richer fields
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS trigger_type text,
  ADD COLUMN IF NOT EXISTS related_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_member_plan_id uuid REFERENCES public.member_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_text text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_sent_at timestamptz;

-- 4. Package requests table
CREATE TABLE IF NOT EXISTS public.package_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested', -- requested | contacted | paid | cancelled
  message_text text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_requests TO authenticated;
GRANT ALL ON public.package_requests TO service_role;
ALTER TABLE public.package_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own requests" ON public.package_requests
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Members create own requests" ON public.package_requests
  FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY "Staff read all requests" ON public.package_requests
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'instructor'));
CREATE POLICY "Admin manage requests" ON public.package_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER package_requests_updated_at BEFORE UPDATE ON public.package_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Waitlist offer RPC — marks waiting -> offered (does NOT create booking)
CREATE OR REPLACE FUNCTION public.admin_waitlist_offer(p_actor_id uuid, p_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry public.waitlist_entries%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_entry FROM public.waitlist_entries WHERE id=p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  UPDATE public.waitlist_entries SET status='offered', promoted_at=now() WHERE id=p_entry_id;
  PERFORM public._log_action_as(p_actor_id,'waitlist.offered','waitlist',p_entry_id, jsonb_build_object('class_id',v_entry.class_id,'member_id',v_entry.member_id));
  RETURN jsonb_build_object('status','offered','member_id',v_entry.member_id,'class_id',v_entry.class_id);
END;$$;

-- 6. Seed additional notification templates with trigger types
UPDATE public.notification_templates SET trigger_type='class_reminder' WHERE key='class_reminder';
UPDATE public.notification_templates SET trigger_type='package_expiring' WHERE key='package_expiring';
UPDATE public.notification_templates SET trigger_type='waitlist_spot' WHERE key='waitlist_spot';
UPDATE public.notification_templates SET trigger_type='trial_followup' WHERE key='trial_followup';

INSERT INTO public.notification_templates (key,label,channel,subject,body,trigger_type,language) VALUES
  ('booking_confirmation_wa','Booking confirmation','whatsapp',NULL,
   'Hi {{member_name}}, your spot is confirmed for {{class_name}} on {{class_date}} at {{class_time}} in {{room_name}} with {{instructor_name}}. Cancel up to {{cancellation_deadline}} before. — {{studio_name}}',
   'booking_confirmation','en'),
  ('cancellation_confirmation_wa','Cancellation confirmation','whatsapp',NULL,
   'Hi {{member_name}}, your booking for {{class_name}} on {{class_date}} has been cancelled. Your credits are back in your account. — {{studio_name}}',
   'cancellation_confirmation','en'),
  ('low_credits_wa','Low credits reminder','whatsapp',NULL,
   'Hi {{member_name}}, you have {{credits_remaining}} credits left. Want to renew? Just message us. — {{studio_name}}',
   'low_credits','en'),
  ('no_show_followup_wa','No-show follow-up','whatsapp',NULL,
   'Hi {{member_name}}, we missed you at {{class_name}} on {{class_date}}. Is everything okay? Let us know how we can help. — {{studio_name}}',
   'no_show_followup','en')
ON CONFLICT DO NOTHING;
