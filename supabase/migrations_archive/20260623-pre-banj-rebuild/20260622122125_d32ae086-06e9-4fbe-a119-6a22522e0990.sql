
-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  image_url text,
  capacity int NOT NULL DEFAULT 12,
  equipment_count int NOT NULL DEFAULT 0,
  setup_minutes_before int NOT NULL DEFAULT 0,
  setup_minutes_after int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#B7CCE6',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable by staff" ON public.rooms FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor') OR public.has_role(auth.uid(),'member'));
CREATE POLICY "rooms managed by admin" ON public.rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.classes ADD COLUMN room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN image_url text;
ALTER TABLE public.program_types ADD COLUMN image_url text;

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  method text NOT NULL CHECK (method IN ('cash','bit','card','transfer','stripe','other')),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded','partially_refunded')),
  refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  member_plan_id uuid REFERENCES public.member_plans(id) ON DELETE SET NULL,
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments admin all" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "payments member self read" ON public.payments FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_payments_member ON public.payments(member_id);
CREATE INDEX idx_payments_paid_at ON public.payments(paid_at DESC);

-- ============ MEDIA ASSETS ============
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('room','class','instructor','gallery','program_type')),
  entity_id uuid,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  caption text,
  width int,
  height int,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media read all signed in" ON public.media_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "media managed by admin" ON public.media_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ NOTIFICATION TEMPLATES + LOGS ============
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  subject text,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates staff read" ON public.notification_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "templates admin write" ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ntpl_updated BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text,
  channel text NOT NULL,
  recipient_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif logs staff read" ON public.notification_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "notif logs admin insert" ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));

-- ============ RECURRING CLASS RULES ============
CREATE TABLE public.recurring_class_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.class_templates(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  starts_on date NOT NULL DEFAULT (now()::date),
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_class_rules TO authenticated;
GRANT ALL ON public.recurring_class_rules TO service_role;
ALTER TABLE public.recurring_class_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring read staff" ON public.recurring_class_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'instructor'));
CREATE POLICY "recurring write admin" ON public.recurring_class_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rcr_updated BEFORE UPDATE ON public.recurring_class_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE POLICIES (bucket created via tool) ============
-- Anyone signed in can read public studio media; only admins can write.
CREATE POLICY "studio media read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'studio-media');
CREATE POLICY "studio media admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "studio media admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "studio media admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'studio-media' AND public.has_role(auth.uid(),'admin'));

-- ============ SEED a couple of starter templates ============
INSERT INTO public.notification_templates (key, label, channel, subject, body) VALUES
  ('class_reminder','Class reminder','whatsapp', NULL, 'Hi {{name}}, this is a gentle reminder for {{class_title}} on {{date}} at {{time}} with {{instructor}}. See you at the studio ✨'),
  ('package_expiring','Package expiring','whatsapp', NULL, 'Hi {{name}}, your {{plan_name}} package expires on {{expires_on}}. Renew anytime from your member area.'),
  ('waitlist_spot','Waitlist spot open','whatsapp', NULL, 'Hi {{name}}, a spot just opened in {{class_title}} on {{date}}. Claim it from your Cloud Card within 30 minutes.'),
  ('trial_followup','Trial follow-up','email','Thank you for joining us','Hi {{name}}, thank you for trying Cloud & Core. We hope you felt at home in the studio. Reply to this email to choose your next class or package.')
ON CONFLICT (key) DO NOTHING;
