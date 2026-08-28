-- Yoga with Lina launch promotion.
-- Production-safe default: the campaign is seeded disabled and cannot issue credits
-- until an administrator configures its class type/window and explicitly enables it.

CREATE TABLE public.promotion_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  promotion_type text NOT NULL DEFAULT 'announcement'
    CHECK (promotion_type IN ('announcement','free_class_credit')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','active','paused','ended','archived')),
  localized_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience jsonb NOT NULL DEFAULT '{"kind":"all_marketing"}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  whatsapp_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_url text NOT NULL DEFAULT '/member/schedule',
  is_public boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  claim_limit integer NOT NULL CHECK (claim_limit > 0),
  claimed_count integer NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  new_accounts_only boolean NOT NULL DEFAULT true,
  credit_quantity integer NOT NULL DEFAULT 1 CHECK (credit_quantity = 1),
  credit_expires_at timestamptz,
  admin_timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  audience_previewed_at timestamptz,
  audience_preview_count integer,
  test_sent_at timestamptz,
  test_sent_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  broadcast_dispatch_started_at timestamptz,
  broadcast_dispatched_at timestamptz,
  paused_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (claimed_count <= claim_limit),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.promotion_eligible_class_types (
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
  program_type_id uuid NOT NULL REFERENCES public.program_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id, program_type_id)
);

CREATE TABLE public.promotion_attributions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'campaign_link' CHECK (source = 'campaign_link'),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  bound_at timestamptz,
  consumed_at timestamptz
);

CREATE TABLE public.promotion_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  attribution_token uuid REFERENCES public.promotion_attributions(token) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','revoked')),
  source text NOT NULL DEFAULT 'in_app' CHECK (source IN ('in_app','campaign_link')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, user_id),
  UNIQUE (promotion_id, idempotency_key)
);

CREATE TABLE public.promotion_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_claim_id uuid NOT NULL UNIQUE REFERENCES public.promotion_claims(id) ON DELETE RESTRICT,
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity = 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reserved','consumed','revoked','expired')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reserved_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  consumed_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, member_id)
);

CREATE TABLE public.promotion_entitlement_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES public.promotion_entitlements(id) ON DELETE RESTRICT,
  actor_id uuid,
  action text NOT NULL CHECK (action IN ('issued','reserved','consumed','restored','expired','revoked','admin_restored')),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promotion_campaign_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text,
  next_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promotion_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'impression','cta_clicked','dismissed','claim_started','claim_succeeded','booking_completed'
  )),
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','push','whatsapp','public_link')),
  attribution_token uuid REFERENCES public.promotion_attributions(token) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promotion_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('in_app','push','whatsapp')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed','skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, member_id, channel)
);

CREATE OR REPLACE FUNCTION public.prevent_published_promotion_content_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.broadcast_dispatch_started_at IS NOT NULL
    OR OLD.broadcast_dispatched_at IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.promotion_deliveries WHERE promotion_id=OLD.id) THEN
    RAISE EXCEPTION 'published_promotions_are_immutable';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER promotion_campaign_content_immutable_after_delivery
  BEFORE UPDATE OF slug,name,promotion_type,localized_content,audience,channels,
    whatsapp_templates,action_url,is_public,is_featured,priority,starts_at,ends_at,
    claim_limit,new_accounts_only,credit_quantity,credit_expires_at
  ON public.promotion_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_published_promotion_content_mutation();

CREATE OR REPLACE FUNCTION public.prevent_promotion_campaign_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'promotion campaign audit is append-only';
END; $$;

CREATE TRIGGER promotion_campaign_audit_append_only
  BEFORE UPDATE OR DELETE ON public.promotion_campaign_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_promotion_campaign_audit_mutation();

CREATE TABLE public.promotion_claim_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, promotion_id)
);

ALTER TABLE public.bookings
  ADD COLUMN promotion_entitlement_id uuid REFERENCES public.promotion_entitlements(id) ON DELETE RESTRICT;
ALTER TABLE public.member_notifications
  ADD COLUMN promotion_id uuid REFERENCES public.promotion_campaigns(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.suppress_inactive_promotion_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.promotion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.promotion_campaigns
    WHERE id=NEW.promotion_id AND enabled=true AND status='active'
  ) THEN
    NEW.delivery_status:='suppressed';
    NEW.suppression_reason:='campaign_inactive';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER member_notification_inactive_promotion_guard
  BEFORE INSERT OR UPDATE OF promotion_id,delivery_status ON public.member_notifications
  FOR EACH ROW EXECUTE FUNCTION public.suppress_inactive_promotion_notification();

CREATE OR REPLACE FUNCTION public.restore_promotion_notifications_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.enabled=true AND NEW.status='active'
    AND (OLD.enabled IS DISTINCT FROM true OR OLD.status IS DISTINCT FROM 'active') THEN
    UPDATE public.member_notifications
    SET delivery_status='inbox',suppression_reason=NULL
    WHERE promotion_id=NEW.id AND delivery_status='suppressed'
      AND suppression_reason='campaign_inactive' AND (expires_at IS NULL OR expires_at>now());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER promotion_notification_activation_restore
  AFTER UPDATE OF status,enabled ON public.promotion_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.restore_promotion_notifications_on_activation();

CREATE OR REPLACE FUNCTION public.sync_promotion_inbox_read_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.promotion_id IS NOT NULL AND NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    UPDATE public.promotion_deliveries SET status='read',read_at=NEW.read_at,updated_at=now()
    WHERE promotion_id=NEW.promotion_id AND member_id=NEW.member_id AND channel='in_app';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER member_notification_promotion_read_receipt
  AFTER UPDATE OF read_at ON public.member_notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_promotion_inbox_read_receipt();

CREATE UNIQUE INDEX promotion_entitlement_one_booking_idx
  ON public.bookings(promotion_entitlement_id)
  WHERE promotion_entitlement_id IS NOT NULL AND status = 'booked';
CREATE INDEX promotion_claims_campaign_idx ON public.promotion_claims(promotion_id, claimed_at);
CREATE INDEX promotion_entitlements_member_idx ON public.promotion_entitlements(member_id, status, expires_at);
CREATE INDEX promotion_attributions_user_idx ON public.promotion_attributions(user_id, promotion_id);
CREATE INDEX promotion_audit_entitlement_idx ON public.promotion_entitlement_audit(entitlement_id, created_at DESC);
CREATE INDEX promotion_campaign_audit_idx ON public.promotion_campaign_audit(promotion_id, created_at DESC);
CREATE UNIQUE INDEX promotion_engagement_idempotency_idx
  ON public.promotion_engagement_events(promotion_id, idempotency_key);
CREATE INDEX promotion_deliveries_status_idx ON public.promotion_deliveries(promotion_id, channel, status);

ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_eligible_class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_entitlement_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_campaign_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_claim_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own promotion claims" ON public.promotion_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members read own promotion entitlements" ON public.promotion_entitlements
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "members read own promotion audit" ON public.promotion_entitlement_audit
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.promotion_entitlements e WHERE e.id = entitlement_id AND e.member_id = auth.uid())
  );
CREATE POLICY "admins read promotion campaigns" ON public.promotion_campaigns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read promotion class types" ON public.promotion_eligible_class_types
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read promotion claims" ON public.promotion_claims
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read promotion entitlements" ON public.promotion_entitlements
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read promotion audit" ON public.promotion_entitlement_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read promotion campaign audit" ON public.promotion_campaign_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members read own promotion engagement" ON public.promotion_engagement_events
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "admins read promotion engagement" ON public.promotion_engagement_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members read own promotion deliveries" ON public.promotion_deliveries
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "admins read promotion deliveries" ON public.promotion_deliveries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.promotion_claims, public.promotion_entitlements, public.promotion_entitlement_audit,
  public.promotion_campaign_audit, public.promotion_engagement_events, public.promotion_deliveries TO authenticated;
GRANT SELECT ON public.promotion_campaigns, public.promotion_eligible_class_types TO authenticated;
GRANT ALL ON public.promotion_campaigns, public.promotion_eligible_class_types,
  public.promotion_attributions, public.promotion_claims, public.promotion_entitlements,
  public.promotion_entitlement_audit, public.promotion_campaign_audit,
  public.promotion_engagement_events, public.promotion_deliveries,
  public.promotion_claim_rate_limits TO service_role;

INSERT INTO public.promotion_campaigns (
  slug, name, promotion_type, status, localized_content, audience, channels, action_url,
  is_public, is_featured, priority, enabled, claim_limit, credit_quantity,
  new_accounts_only, admin_timezone, starts_at, ends_at, credit_expires_at
) VALUES (
  'yoga-lina-launch', 'Yoga with Lina Launch', 'free_class_credit', 'draft',
  jsonb_build_object(
    'he', jsonb_build_object('eyebrow','Cloud & Core','title','יוגה עם לינה','body','שיעור יוגה אחד במתנה לעשר הראשונות.','cta','לקבלת השיעור'),
    'ar', jsonb_build_object('eyebrow','Cloud & Core','title','يوغا مع لينا','body','حصة يوغا مجانية لأول عشر مشتركات.','cta','احصلي على الحصة'),
    'en', jsonb_build_object('eyebrow','Cloud & Core','title','Yoga with Lina','body','One complimentary Yoga class for the first ten eligible members.','cta','Claim your class')
  ),
  jsonb_build_object('kind', 'not_attended_program'),
  ARRAY['in_app','push','whatsapp']::text[], '/member/schedule?program=yoga',
  true, true, 50, false, 10, 1, false, 'Asia/Jerusalem',
  now(), now()+interval '7 days', now()+interval '21 days'
) ON CONFLICT (slug) DO NOTHING;
-- Yoga is open to existing and new members: new_accounts_only, false.

CREATE OR REPLACE FUNCTION public.begin_promotion_attribution(
  p_slug text,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_promotion_id uuid; v_token uuid;
BEGIN
  SELECT id INTO v_promotion_id FROM public.promotion_campaigns WHERE slug = p_slug AND is_public=true;
  IF v_promotion_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.promotion_attributions (
    promotion_id, utm_source, utm_medium, utm_campaign
  ) VALUES (v_promotion_id, left(p_utm_source, 100), left(p_utm_medium, 100), left(p_utm_campaign, 150))
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_has_attended_promotion_program(
  p_member_id uuid,
  p_promotion_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records attendance
    JOIN public.classes class ON class.id = attendance.class_id
    JOIN public.promotion_eligible_class_types eligible
      ON eligible.program_type_id = class.program_type_id
    WHERE attendance.member_id = p_member_id
      AND eligible.promotion_id = p_promotion_id
      AND attendance.status IN ('checked_in','attended')
  );
$$;

CREATE OR REPLACE FUNCTION public.member_matches_promotion_audience(
  p_member_id uuid,
  p_promotion_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_member public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id;
  IF v_campaign.id IS NULL OR v_member.id IS NULL OR v_member.status<>'active' OR
    COALESCE(v_member.tags,'{}'::text[]) && ARRAY['test','staff','service','blocked','deleted','duplicate']::text[] THEN
    RETURN false;
  END IF;
  RETURN CASE v_campaign.audience->>'kind'
    WHEN 'never_booked' THEN NOT EXISTS (
      SELECT 1 FROM public.bookings WHERE member_id=p_member_id AND status<>'cancelled'
    )
    WHEN 'no_upcoming' THEN NOT EXISTS (
      SELECT 1 FROM public.bookings booking JOIN public.classes class ON class.id=booking.class_id
      WHERE booking.member_id=p_member_id AND booking.status='booked' AND class.starts_at>now()
    )
    WHEN 'inactive_14d' THEN v_member.last_visit_at IS NULL OR v_member.last_visit_at<=now()-interval '14 days'
    WHEN 'low_credits' THEN v_member.remaining_credits<=2
    WHEN 'expiring_7d' THEN EXISTS (
      SELECT 1 FROM public.member_plans plan WHERE plan.member_id=p_member_id AND plan.status='active'
      AND plan.expires_at BETWEEN now() AND now()+interval '7 days'
    )
    WHEN 'not_attended_program' THEN NOT public.member_has_attended_promotion_program(p_member_id,p_promotion_id)
    WHEN 'specific' THEN v_campaign.audience->'memberIds' ? p_member_id::text
    ELSE true
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_promotion_status(
  p_slug text,
  p_attribution_token uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_campaign public.promotion_campaigns%ROWTYPE;
  v_user uuid := auth.uid();
  v_claimed boolean := false;
  v_entitlement_status text;
  v_entitlement_expires_at timestamptz;
  v_eligible boolean := false;
  v_class_type_id uuid;
  v_class_name text;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug = p_slug;
  IF NOT FOUND THEN RETURN jsonb_build_object('active', false, 'soldOut', false, 'remaining', 0); END IF;

  SELECT pt.id, COALESCE(pt.name_he, pt.name_en) INTO v_class_type_id, v_class_name
  FROM public.promotion_eligible_class_types pct
  JOIN public.program_types pt ON pt.id = pct.program_type_id
  WHERE pct.promotion_id = v_campaign.id ORDER BY pt.sort_order LIMIT 1;

  IF v_user IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.promotion_claims WHERE promotion_id = v_campaign.id AND user_id = v_user AND status = 'claimed')
    INTO v_claimed;
    SELECT e.status, e.expires_at INTO v_entitlement_status, v_entitlement_expires_at
    FROM public.promotion_entitlements e
    WHERE e.promotion_id = v_campaign.id AND e.member_id = v_user;
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.members m ON m.id = p.id
      JOIN auth.users u ON u.id = p.id
      WHERE p.id = v_user AND p.role = 'member' AND m.status = 'active'
        AND NOT (m.tags && ARRAY['test','staff','service','blocked','deleted','duplicate']::text[])
        AND (NOT v_campaign.new_accounts_only OR (v_campaign.starts_at IS NOT NULL AND u.created_at >= v_campaign.starts_at))
        AND public.member_matches_promotion_audience(v_user, v_campaign.id)
    ) INTO v_eligible;
  END IF;

  RETURN jsonb_build_object(
    'active', v_campaign.enabled AND v_campaign.status IN ('scheduled','active')
      AND v_campaign.starts_at IS NOT NULL AND v_now >= v_campaign.starts_at
      AND (v_campaign.ends_at IS NULL OR v_now < v_campaign.ends_at),
    'remaining', GREATEST(v_campaign.claim_limit - v_campaign.claimed_count, 0),
    'claimLimit', v_campaign.claim_limit,
    'claimedByCurrentUser', v_claimed,
    'entitlementStatus', v_entitlement_status,
    'creditAvailable', v_entitlement_status = 'active' AND v_entitlement_expires_at > v_now,
    'eligible', v_eligible,
    'soldOut', v_campaign.claimed_count >= v_campaign.claim_limit,
    'startsAt', v_campaign.starts_at,
    'endsAt', v_campaign.ends_at,
    'creditExpiresAt', v_campaign.credit_expires_at,
    'eligibleClassTypeId', v_class_type_id,
    'eligibleClassTypeName', v_class_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_promotion(
  p_slug text,
  p_attribution_token uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.promotion_campaigns%ROWTYPE;
  v_claim public.promotion_claims%ROWTYPE;
  v_attr public.promotion_attributions%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_role public.app_role;
  v_user_created_at timestamptz;
  v_entitlement_id uuid;
  v_rate public.promotion_claim_rate_limits%ROWTYPE;
  v_claim_source text := 'in_app';
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RETURN jsonb_build_object('status','error','message','invalid_idempotency_key');
  END IF;

  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug = p_slug FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','ineligible','reason','campaign_not_found'); END IF;

  SELECT * INTO v_claim FROM public.promotion_claims
  WHERE promotion_id = v_campaign.id AND user_id = v_user;
  IF FOUND THEN
    SELECT id INTO v_entitlement_id FROM public.promotion_entitlements WHERE promotion_claim_id = v_claim.id;
    RETURN jsonb_build_object('status','already_claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id,
      'remaining',GREATEST(v_campaign.claim_limit-v_campaign.claimed_count,0));
  END IF;

  INSERT INTO public.promotion_claim_rate_limits(user_id, promotion_id)
  VALUES (v_user, v_campaign.id)
  ON CONFLICT (user_id, promotion_id) DO UPDATE SET
    window_started_at = CASE WHEN public.promotion_claim_rate_limits.window_started_at < now() - interval '1 minute' THEN now() ELSE public.promotion_claim_rate_limits.window_started_at END,
    attempt_count = CASE WHEN public.promotion_claim_rate_limits.window_started_at < now() - interval '1 minute' THEN 1 ELSE public.promotion_claim_rate_limits.attempt_count + 1 END
  RETURNING * INTO v_rate;
  IF v_rate.attempt_count > 5 THEN RETURN jsonb_build_object('status','rate_limited'); END IF;

  IF NOT v_campaign.enabled THEN RETURN jsonb_build_object('status','ineligible','reason','disabled'); END IF;
  IF v_campaign.starts_at IS NULL OR now() < v_campaign.starts_at THEN RETURN jsonb_build_object('status','ineligible','reason','not_started'); END IF;
  IF v_campaign.ends_at IS NOT NULL AND now() >= v_campaign.ends_at THEN RETURN jsonb_build_object('status','ineligible','reason','ended'); END IF;
  IF v_campaign.credit_expires_at IS NULL OR v_campaign.credit_expires_at <= now() THEN
    RETURN jsonb_build_object('status','ineligible','reason','invalid_credit_expiry');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.promotion_eligible_class_types WHERE promotion_id = v_campaign.id) THEN
    RETURN jsonb_build_object('status','ineligible','reason','class_type_not_configured');
  END IF;

  IF p_attribution_token IS NOT NULL THEN
    SELECT * INTO v_attr FROM public.promotion_attributions WHERE token = p_attribution_token FOR UPDATE;
    IF NOT FOUND OR v_attr.promotion_id <> v_campaign.id OR v_attr.created_at < v_campaign.starts_at
      OR (v_attr.user_id IS NOT NULL AND v_attr.user_id <> v_user) THEN
      RETURN jsonb_build_object('status','ineligible','reason','invalid_campaign_attribution');
    END IF;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id=v_user FOR UPDATE;
  SELECT p.role, u.created_at INTO v_role, v_user_created_at
  FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=v_user;
  IF v_member.id IS NULL OR v_role <> 'member' OR v_member.status <> 'active'
    OR v_member.tags && ARRAY['test','staff','service','blocked','deleted','duplicate']::text[] THEN
    RETURN jsonb_build_object('status','ineligible','reason','account_not_eligible');
  END IF;
  IF v_campaign.new_accounts_only AND v_user_created_at < v_campaign.starts_at THEN
    RETURN jsonb_build_object('status','ineligible','reason','existing_account');
  END IF;
  IF v_campaign.audience->>'kind' = 'not_attended_program'
    AND public.member_has_attended_promotion_program(v_user, v_campaign.id) THEN
    RETURN jsonb_build_object('status','ineligible','reason','already_attended_program');
  END IF;
  IF NOT public.member_matches_promotion_audience(v_user, v_campaign.id) THEN
    RETURN jsonb_build_object('status','ineligible','reason','audience_not_eligible');
  END IF;
  IF v_campaign.claimed_count >= v_campaign.claim_limit THEN RETURN jsonb_build_object('status','sold_out','remaining',0); END IF;

  IF p_attribution_token IS NOT NULL THEN
    UPDATE public.promotion_attributions SET user_id=v_user, bound_at=COALESCE(bound_at,now()), consumed_at=now() WHERE token=p_attribution_token;
    v_claim_source := COALESCE(v_attr.source, 'in_app');
  END IF;
  INSERT INTO public.promotion_claims (
    promotion_id,user_id,attribution_token,source,utm_source,utm_medium,utm_campaign,idempotency_key
  ) VALUES (
    v_campaign.id,v_user,p_attribution_token,v_claim_source,v_attr.utm_source,v_attr.utm_medium,v_attr.utm_campaign,left(p_idempotency_key,200)
  ) RETURNING * INTO v_claim;
  INSERT INTO public.promotion_entitlements (
    promotion_claim_id,promotion_id,member_id,quantity,expires_at
  ) VALUES (v_claim.id,v_campaign.id,v_user,v_campaign.credit_quantity,v_campaign.credit_expires_at)
  RETURNING id INTO v_entitlement_id;
  INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,reason)
  VALUES(v_entitlement_id,v_user,'issued','campaign claim');
  UPDATE public.promotion_campaigns SET claimed_count=claimed_count+1,updated_at=now() WHERE id=v_campaign.id;
  RETURN jsonb_build_object('status','claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id,
    'remaining',v_campaign.claim_limit-v_campaign.claimed_count-1);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_claim FROM public.promotion_claims c
  WHERE c.promotion_id=v_campaign.id AND c.user_id=v_user;
  IF FOUND THEN
    SELECT id INTO v_entitlement_id FROM public.promotion_entitlements WHERE promotion_claim_id=v_claim.id;
    RETURN jsonb_build_object('status','already_claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id);
  END IF;
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_promotion_entitlements(p_member_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.promotion_entitlements SET status='expired',updated_at=now()
    WHERE status='active' AND expires_at <= now() AND (p_member_id IS NULL OR member_id=p_member_id)
    RETURNING id,member_id
  ), audited AS (
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,reason)
    SELECT id,member_id,'expired','expiration reached' FROM expired RETURNING 1
  ) SELECT count(*) INTO v_count FROM audited;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.book_class_v3(p_actor_id uuid, p_class_id uuid, p_promotion_entitlement_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := p_actor_id; v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE;
  v_existing public.bookings%ROWTYPE; v_booking_id uuid; v_ent public.promotion_entitlements%ROWTYPE;
  v_has_active_package boolean := false; v_first_booking boolean := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  IF auth.uid() IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  PERFORM public.sweep_member_credits(v_user); PERFORM public.expire_promotion_entitlements(v_user);
  SELECT * INTO v_class FROM public.classes WHERE id=p_class_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  IF v_class.status <> 'scheduled' THEN RETURN jsonb_build_object('status','error','message','class_not_open'); END IF;
  SELECT * INTO v_member FROM public.members WHERE id=v_user FOR UPDATE;
  SELECT * INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=v_user AND status='booked' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','already_booked','booking_id',v_existing.id,'remaining_credits',v_member.remaining_credits); END IF;
  IF v_class.booked_count >= v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;

  IF p_promotion_entitlement_id IS NOT NULL THEN
    SELECT e.* INTO v_ent FROM public.promotion_entitlements e
    WHERE e.id=p_promotion_entitlement_id AND e.member_id=v_user FOR UPDATE;
    IF NOT FOUND OR v_ent.status <> 'active' OR v_ent.expires_at <= now() OR NOT EXISTS (
      SELECT 1 FROM public.promotion_eligible_class_types pct
      WHERE pct.promotion_id=v_ent.promotion_id AND pct.program_type_id=v_class.program_type_id
    ) THEN RETURN jsonb_build_object('status','error','message','PROMO_CREDIT_NOT_VALID_FOR_CLASS'); END IF;
  ELSE
    SELECT e.* INTO v_ent FROM public.promotion_entitlements e
    WHERE e.member_id=v_user AND e.status='active' AND e.expires_at>now() AND EXISTS (
      SELECT 1 FROM public.promotion_eligible_class_types pct
      WHERE pct.promotion_id=e.promotion_id AND pct.program_type_id=v_class.program_type_id
    ) ORDER BY e.expires_at,e.issued_at LIMIT 1 FOR UPDATE;
  END IF;

  IF v_ent.id IS NULL AND v_member.remaining_credits < v_class.credit_cost THEN
    SELECT EXISTS(SELECT 1 FROM public.member_plans WHERE member_id=v_user AND status='active' AND (expires_at IS NULL OR expires_at>now())) INTO v_has_active_package;
    RETURN jsonb_build_object('status',CASE WHEN v_has_active_package THEN 'insufficient_credits' ELSE 'no_active_package' END,'remaining_credits',v_member.remaining_credits);
  END IF;
  SELECT NOT EXISTS(SELECT 1 FROM public.bookings WHERE member_id=v_user) INTO v_first_booking;
  INSERT INTO public.bookings(class_id,member_id,status,credit_cost,promotion_entitlement_id)
  VALUES(p_class_id,v_user,'booked',CASE WHEN v_ent.id IS NULL THEN v_class.credit_cost ELSE 0 END,v_ent.id) RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count=booked_count+1 WHERE id=p_class_id;
  IF v_ent.id IS NOT NULL THEN
    UPDATE public.promotion_entitlements SET status='consumed',consumed_booking_id=v_booking_id,consumed_at=now(),updated_at=now() WHERE id=v_ent.id;
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,booking_id,reason) VALUES(v_ent.id,v_user,'consumed',v_booking_id,'confirmed booking');
    INSERT INTO public.promotion_engagement_events(promotion_id,member_id,event_type,channel,idempotency_key,metadata)
    VALUES(v_ent.promotion_id,v_user,'booking_completed','in_app','booking:'||v_booking_id::text,jsonb_build_object('booking_id',v_booking_id))
    ON CONFLICT (promotion_id,idempotency_key) DO NOTHING;
  ELSE
    UPDATE public.members SET remaining_credits=remaining_credits-v_class.credit_cost WHERE id=v_user;
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(v_user,-v_class.credit_cost,'booking',v_booking_id,v_user);
  END IF;
  INSERT INTO public.attendance_records(booking_id,member_id,class_id,status) VALUES(v_booking_id,v_user,p_class_id,'booked') ON CONFLICT DO NOTHING;
  PERFORM public.emit_message_outbox('booking_registered_admin','booking',v_booking_id,v_user,
    jsonb_build_object('booking_id',v_booking_id,'class_id',p_class_id,'member_phone',v_member.phone,'first_booking',v_first_booking),
    concat('booking:',v_booking_id,':registered-admin'),now(),NULL);
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id,'remaining_credits',v_member.remaining_credits-CASE WHEN v_ent.id IS NULL THEN v_class.credit_cost ELSE 0 END,'promotion_entitlement_id',v_ent.id);
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_booking_id FROM public.bookings WHERE class_id=p_class_id AND member_id=v_user AND status='booked' LIMIT 1;
  RETURN jsonb_build_object('status','already_booked','booking_id',v_booking_id);
END; $$;

CREATE OR REPLACE FUNCTION public.book_class_v2(p_actor_id uuid, p_class_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.book_class_v3(p_actor_id,p_class_id,NULL);
$$;

CREATE OR REPLACE FUNCTION public._restore_promotion_entitlement(
  p_entitlement_id uuid,
  p_actor_id uuid,
  p_booking_id uuid,
  p_restore_reason text,
  p_expiry_reason text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ent public.promotion_entitlements%ROWTYPE; v_result text;
BEGIN
  SELECT * INTO v_ent FROM public.promotion_entitlements WHERE id=p_entitlement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_ent.expires_at>now() THEN
    UPDATE public.promotion_entitlements SET status='active',consumed_booking_id=NULL,consumed_at=NULL,updated_at=now() WHERE id=v_ent.id;
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,booking_id,reason) VALUES(v_ent.id,p_actor_id,'restored',p_booking_id,p_restore_reason);
    v_result := 'restored';
  ELSE
    UPDATE public.promotion_entitlements SET status='expired',updated_at=now() WHERE id=v_ent.id;
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,booking_id,reason) VALUES(v_ent.id,p_actor_id,'expired',p_booking_id,p_expiry_reason);
    v_result := 'expired';
  END IF;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.member_cancel_booking(p_actor_id uuid, p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking public.bookings%ROWTYPE; v_class public.classes%ROWTYPE; v_deadline timestamptz; v_next public.waitlist_entries%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_booking.member_id<>p_actor_id THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF v_booking.status<>'booked' THEN RETURN jsonb_build_object('status','error','message','already_cancelled'); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id=v_booking.class_id FOR UPDATE;
  v_deadline:=v_class.starts_at-(COALESCE(v_class.cancellation_window_hours,4)||' hours')::interval;
  IF now()>v_deadline THEN RETURN jsonb_build_object('status','window_passed','deadline',v_deadline); END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking_id;
  UPDATE public.classes SET booked_count=GREATEST(0,booked_count-1) WHERE id=v_class.id;
  UPDATE public.attendance_records SET status='cancelled',marked_by=p_actor_id,marked_at=now() WHERE booking_id=p_booking_id;
  IF v_booking.promotion_entitlement_id IS NOT NULL THEN
    PERFORM public._restore_promotion_entitlement(v_booking.promotion_entitlement_id,p_actor_id,p_booking_id,'timely member cancellation','expired before cancellation restoration');
  ELSIF v_booking.credit_cost>0 THEN
    UPDATE public.members SET remaining_credits=remaining_credits+v_booking.credit_cost WHERE id=v_booking.member_id;
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(v_booking.member_id,v_booking.credit_cost,'member self cancel refund',p_booking_id,p_actor_id);
  END IF;
  SELECT * INTO v_next FROM public.waitlist_entries WHERE class_id=v_class.id AND status='waiting' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF FOUND THEN UPDATE public.waitlist_entries SET status='promoted',promoted_at=now() WHERE id=v_next.id; END IF;
  INSERT INTO public.admin_activity_log(actor_id,action,entity_type,entity_id,metadata) VALUES(p_actor_id,'booking.member_cancel','booking',p_booking_id,jsonb_build_object('class_id',v_class.id,'waitlist_promoted',v_next.id,'promotion_entitlement_id',v_booking.promotion_entitlement_id));
  RETURN jsonb_build_object('status','cancelled');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_create_booking(p_actor_id uuid,p_class_id uuid,p_member_id uuid,p_override boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE; v_booking_id uuid; v_existing uuid; v_ent public.promotion_entitlements%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  PERFORM public.expire_promotion_entitlements(p_member_id);
  SELECT * INTO v_class FROM public.classes WHERE id=p_class_id FOR UPDATE;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF v_class.id IS NULL THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  IF v_member.id IS NULL THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT id INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=p_member_id AND status='booked' LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('status','already_booked','booking_id',v_existing); END IF;
  IF NOT p_override AND v_class.booked_count>=v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  SELECT e.* INTO v_ent FROM public.promotion_entitlements e
  WHERE e.member_id=p_member_id AND e.status='active' AND e.expires_at>now() AND EXISTS(
    SELECT 1 FROM public.promotion_eligible_class_types pct WHERE pct.promotion_id=e.promotion_id AND pct.program_type_id=v_class.program_type_id
  ) ORDER BY e.expires_at,e.issued_at LIMIT 1 FOR UPDATE;
  IF v_ent.id IS NULL AND NOT p_override AND v_member.remaining_credits<v_class.credit_cost THEN RETURN jsonb_build_object('status','insufficient_credits'); END IF;
  INSERT INTO public.bookings(class_id,member_id,status,credit_cost,promotion_entitlement_id)
  VALUES(p_class_id,p_member_id,'booked',CASE WHEN v_ent.id IS NULL THEN v_class.credit_cost ELSE 0 END,v_ent.id) RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count=booked_count+1 WHERE id=p_class_id;
  IF v_ent.id IS NOT NULL THEN
    UPDATE public.promotion_entitlements SET status='consumed',consumed_booking_id=v_booking_id,consumed_at=now(),updated_at=now() WHERE id=v_ent.id;
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,booking_id,reason) VALUES(v_ent.id,p_actor_id,'consumed',v_booking_id,'waitlist or admin confirmed booking');
    INSERT INTO public.promotion_engagement_events(promotion_id,member_id,event_type,channel,idempotency_key,metadata)
    VALUES(v_ent.promotion_id,p_member_id,'booking_completed','in_app','booking:'||v_booking_id::text,jsonb_build_object('booking_id',v_booking_id,'booked_by_admin',true))
    ON CONFLICT (promotion_id,idempotency_key) DO NOTHING;
  ELSIF v_member.remaining_credits>=v_class.credit_cost THEN
    UPDATE public.members SET remaining_credits=remaining_credits-v_class.credit_cost WHERE id=p_member_id;
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(p_member_id,-v_class.credit_cost,'admin booking',v_booking_id,p_actor_id);
  ELSE
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(p_member_id,0,'admin booking (credit override)',v_booking_id,p_actor_id);
  END IF;
  INSERT INTO public.attendance_records(booking_id,member_id,class_id,status) VALUES(v_booking_id,p_member_id,p_class_id,'booked');
  PERFORM public._log_action_as(p_actor_id,'booking.created','booking',v_booking_id,jsonb_build_object('class_id',p_class_id,'member_id',p_member_id,'override',p_override,'promotion_entitlement_id',v_ent.id));
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id,'promotion_entitlement_id',v_ent.id);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_actor_id uuid,p_booking_id uuid,p_refund boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_booking public.bookings%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF v_booking.status<>'booked' THEN RETURN jsonb_build_object('status','error','message','already_cancelled'); END IF;
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking_id;
  UPDATE public.classes SET booked_count=GREATEST(0,booked_count-1) WHERE id=v_booking.class_id;
  UPDATE public.attendance_records SET status='cancelled',marked_by=p_actor_id,marked_at=now() WHERE booking_id=p_booking_id;
  IF p_refund AND v_booking.promotion_entitlement_id IS NOT NULL THEN
    PERFORM public._restore_promotion_entitlement(v_booking.promotion_entitlement_id,p_actor_id,p_booking_id,'admin cancellation refund','expired before admin cancellation');
  ELSIF p_refund AND v_booking.credit_cost>0 THEN
    UPDATE public.members SET remaining_credits=remaining_credits+v_booking.credit_cost WHERE id=v_booking.member_id;
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(v_booking.member_id,v_booking.credit_cost,'admin cancel refund',p_booking_id,p_actor_id);
  END IF;
  PERFORM public._log_action_as(p_actor_id,'booking.cancelled','booking',p_booking_id,jsonb_build_object('refund',p_refund,'promotion_entitlement_id',v_booking.promotion_entitlement_id));
  RETURN jsonb_build_object('status','cancelled');
END; $$;

CREATE OR REPLACE FUNCTION public.promotion_activation_requirements(p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_errors text[] := ARRAY[]::text[]; v_language text;
BEGIN
  IF COALESCE(auth.role(),'') <> 'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'errors',ARRAY['forbidden']);
  END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'errors',ARRAY['campaign_not_found']); END IF;
  IF v_campaign.starts_at IS NULL OR v_campaign.ends_at IS NULL OR v_campaign.ends_at<=v_campaign.starts_at THEN
    v_errors:=array_append(v_errors,'campaign_window_invalid');
  END IF;
  IF v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at<=now() THEN
    v_errors:=array_append(v_errors,'campaign_window_expired');
  END IF;
  FOREACH v_language IN ARRAY ARRAY['he','ar','en']::text[] LOOP
    IF COALESCE(v_campaign.localized_content->v_language->>'title','')='' OR
       COALESCE(v_campaign.localized_content->v_language->>'body','')='' OR
       COALESCE(v_campaign.localized_content->v_language->>'cta','')='' THEN
      v_errors:=array_append(v_errors,'localized_content_'||v_language||'_required');
    END IF;
  END LOOP;
  IF v_campaign.promotion_type='free_class_credit' AND NOT EXISTS (
    SELECT 1 FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id
  ) THEN v_errors:=array_append(v_errors,'eligible_program_required'); END IF;
  IF v_campaign.promotion_type='free_class_credit' AND
     (v_campaign.credit_expires_at IS NULL OR v_campaign.credit_expires_at<=v_campaign.ends_at) THEN
    v_errors:=array_append(v_errors,'credit_expiry_must_follow_campaign');
  END IF;
  IF v_campaign.audience_previewed_at IS NULL THEN v_errors:=array_append(v_errors,'audience_preview_required'); END IF;
  IF v_campaign.test_sent_at IS NULL THEN v_errors:=array_append(v_errors,'test_send_required'); END IF;
  IF 'whatsapp'=ANY(v_campaign.channels) AND EXISTS (
    SELECT 1 FROM unnest(ARRAY['he','ar','en']::text[]) language
    WHERE COALESCE(v_campaign.whatsapp_templates->language->>'status','')<>'approved'
  ) THEN v_errors:=array_append(v_errors,'whatsapp_template_not_approved'); END IF;
  RETURN jsonb_build_object('ok',cardinality(v_errors)=0,'errors',to_jsonb(v_errors));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_preview_promotion_audience(p_actor_id uuid,p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  SELECT count(*) INTO v_count FROM public.members member
  WHERE public.member_matches_promotion_audience(member.id,v_campaign.id);
  UPDATE public.promotion_campaigns SET audience_previewed_at=now(),audience_preview_count=v_count,updated_by=p_actor_id,updated_at=now()
  WHERE id=v_campaign.id;
  INSERT INTO public.promotion_campaign_audit(promotion_id,actor_id,action,metadata)
  VALUES(v_campaign.id,p_actor_id,'audience_previewed',jsonb_build_object('eligible_count',v_count));
  RETURN jsonb_build_object('status','ok','eligibleCount',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_mark_promotion_test_sent(p_actor_id uuid,p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  UPDATE public.promotion_campaigns SET test_sent_at=now(),test_sent_to=p_actor_id,updated_by=p_actor_id,updated_at=now()
  WHERE id=p_promotion_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  INSERT INTO public.promotion_campaign_audit(promotion_id,actor_id,action) VALUES(p_promotion_id,p_actor_id,'test_sent');
  RETURN jsonb_build_object('status','ok');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transition_promotion(p_actor_id uuid,p_promotion_id uuid,p_next_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_requirements jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN
    RETURN jsonb_build_object('status','error','message','forbidden');
  END IF;
  IF p_next_status NOT IN ('scheduled','active','paused','archived') THEN
    RETURN jsonb_build_object('status','error','message','invalid_transition');
  END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  IF v_campaign.status=p_next_status THEN RETURN jsonb_build_object('status','ok','nextStatus',p_next_status,'unchanged',true); END IF;
  IF p_next_status='active' AND v_campaign.starts_at>now() THEN
    RETURN jsonb_build_object('status','error','message','future_campaign_must_be_scheduled');
  END IF;
  IF p_next_status IN ('scheduled','active') THEN
    v_requirements:=public.promotion_activation_requirements(p_promotion_id);
    IF NOT COALESCE((v_requirements->>'ok')::boolean,false) THEN
      RETURN jsonb_build_object('status','error','message','activation_requirements_failed','requirements',v_requirements);
    END IF;
  END IF;
  UPDATE public.promotion_campaigns SET
    status=p_next_status,
    enabled=p_next_status IN ('scheduled','active'),
    activated_at=CASE WHEN p_next_status IN ('scheduled','active') THEN COALESCE(activated_at,now()) ELSE activated_at END,
    paused_at=CASE WHEN p_next_status='paused' THEN now() ELSE paused_at END,
    archived_at=CASE WHEN p_next_status='archived' THEN now() ELSE archived_at END,
    updated_by=p_actor_id,updated_at=now()
  WHERE id=p_promotion_id;
  IF p_next_status IN ('paused','archived') THEN
    UPDATE public.member_notifications
    SET delivery_status='suppressed',suppression_reason='campaign_inactive'
    WHERE promotion_id=p_promotion_id
      AND delivery_status IN ('inbox','queued','sending','sent','delivered','failed');
  END IF;
  INSERT INTO public.promotion_campaign_audit(promotion_id,actor_id,action,previous_status,next_status)
  VALUES(p_promotion_id,p_actor_id,'status_changed',v_campaign.status,p_next_status);
  RETURN jsonb_build_object('status','ok','nextStatus',p_next_status);
END; $$;

CREATE OR REPLACE FUNCTION public.track_promotion_engagement(
  p_slug text,p_event_type text,p_channel text,p_idempotency_key text,p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign_id uuid; v_event_id uuid;
BEGIN
  SELECT id INTO v_campaign_id FROM public.promotion_campaigns WHERE slug=p_slug;
  IF v_campaign_id IS NULL THEN RETURN jsonb_build_object('status','ignored'); END IF;
  INSERT INTO public.promotion_engagement_events(promotion_id,member_id,event_type,channel,idempotency_key,metadata)
  VALUES(v_campaign_id,auth.uid(),p_event_type,p_channel,left(p_idempotency_key,200),COALESCE(p_metadata,'{}'::jsonb))
  ON CONFLICT (promotion_id,idempotency_key) DO UPDATE SET metadata=public.promotion_engagement_events.metadata
  RETURNING id INTO v_event_id;
  RETURN jsonb_build_object('status','ok','eventId',v_event_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_member_promotions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',campaign.id,
    'slug',campaign.slug,
    'promotionType',campaign.promotion_type,
    'localizedContent',campaign.localized_content,
    'actionUrl',campaign.action_url,
    'priority',campaign.priority,
    'remaining',GREATEST(campaign.claim_limit-campaign.claimed_count,0),
    'claimLimit',campaign.claim_limit,
    'soldOut',campaign.claimed_count>=campaign.claim_limit,
    'claimedByCurrentUser',claim.id IS NOT NULL,
    'entitlementStatus',entitlement.status,
    'creditAvailable',entitlement.status='active' AND entitlement.expires_at>now(),
    'startsAt',campaign.starts_at,
    'endsAt',campaign.ends_at,
    'creditExpiresAt',campaign.credit_expires_at
  ) ORDER BY campaign.priority DESC,campaign.starts_at DESC),'[]'::jsonb)
  FROM public.promotion_campaigns campaign
  JOIN public.members member ON member.id=auth.uid()
  LEFT JOIN public.promotion_claims claim ON claim.promotion_id=campaign.id
    AND claim.user_id=auth.uid() AND claim.status='claimed'
  LEFT JOIN public.promotion_entitlements entitlement ON entitlement.promotion_id=campaign.id
    AND entitlement.member_id=auth.uid()
  WHERE campaign.enabled=true
    AND campaign.status IN ('scheduled','active')
    AND campaign.is_featured=true
    AND campaign.starts_at<=now()
    AND (campaign.ends_at IS NULL OR campaign.ends_at>now())
    AND public.member_matches_promotion_audience(member.id,campaign.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.promotion_engagement_events event
      WHERE event.promotion_id=campaign.id AND event.member_id=auth.uid() AND event.event_type='dismissed'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_public_promotion(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'id',id,'slug',slug,'promotionType',promotion_type,'localizedContent',localized_content,
      'actionUrl',action_url,'remaining',GREATEST(claim_limit-claimed_count,0),
      'claimLimit',claim_limit,'soldOut',claimed_count>=claim_limit,
      'startsAt',starts_at,'endsAt',ends_at,'creditExpiresAt',credit_expires_at
    )
    FROM public.promotion_campaigns
    WHERE slug=p_slug AND is_public=true AND enabled=true AND status IN ('scheduled','active')
      AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
  ),'null'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.admin_update_promotion(
  p_actor_id uuid,p_slug text,p_enabled boolean,p_starts_at timestamptz,p_ends_at timestamptz,
  p_claim_limit integer,p_credit_expires_at timestamptz,p_program_type_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF p_enabled THEN RETURN jsonb_build_object('status','error','message','use_promotions_manager_activation_flow'); END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug=p_slug FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  IF p_claim_limit<v_campaign.claimed_count THEN RETURN jsonb_build_object('status','error','message','limit_below_claimed_count'); END IF;
  IF p_enabled AND (p_starts_at IS NULL OR p_credit_expires_at IS NULL OR cardinality(p_program_type_ids)=0) THEN RETURN jsonb_build_object('status','error','message','incomplete_configuration'); END IF;
  IF p_enabled AND (p_credit_expires_at<=now() OR (p_ends_at IS NOT NULL AND p_ends_at<=now())) THEN RETURN jsonb_build_object('status','error','message','promotion_window_expired'); END IF;
  UPDATE public.promotion_campaigns SET enabled=p_enabled,starts_at=p_starts_at,ends_at=p_ends_at,claim_limit=p_claim_limit,credit_expires_at=p_credit_expires_at,updated_at=now() WHERE id=v_campaign.id;
  DELETE FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id;
  INSERT INTO public.promotion_eligible_class_types(promotion_id,program_type_id) SELECT v_campaign.id,unnest(p_program_type_ids);
  PERFORM public._log_action_as(p_actor_id,'promotion.updated','promotion',v_campaign.id,jsonb_build_object('enabled',p_enabled,'claim_limit',p_claim_limit,'program_type_ids',p_program_type_ids));
  RETURN jsonb_build_object('status','ok');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_promotion_entitlement(p_actor_id uuid,p_entitlement_id uuid,p_action text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ent public.promotion_entitlements%ROWTYPE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF length(trim(COALESCE(p_reason,'')))<3 OR p_action NOT IN ('revoke','restore') THEN RETURN jsonb_build_object('status','error','message','reason_required'); END IF;
  SELECT * INTO v_ent FROM public.promotion_entitlements WHERE id=p_entitlement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','not_found'); END IF;
  IF p_action='restore' AND (v_ent.expires_at<=now() OR v_ent.status NOT IN ('revoked','consumed')) THEN RETURN jsonb_build_object('status','error','message','cannot_restore'); END IF;
  IF p_action='restore' AND v_ent.status='consumed' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id=v_ent.consumed_booking_id AND b.status='booked'
  ) THEN RETURN jsonb_build_object('status','error','message','cannot_restore_active_booking'); END IF;
  UPDATE public.promotion_entitlements SET status=CASE WHEN p_action='revoke' THEN 'revoked' ELSE 'active' END,
    consumed_booking_id=CASE WHEN p_action='restore' THEN NULL ELSE consumed_booking_id END,
    consumed_at=CASE WHEN p_action='restore' THEN NULL ELSE consumed_at END,updated_at=now() WHERE id=p_entitlement_id;
  INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,reason) VALUES(p_entitlement_id,p_actor_id,CASE WHEN p_action='revoke' THEN 'revoked' ELSE 'admin_restored' END,p_reason);
  PERFORM public._log_action_as(p_actor_id,'promotion.entitlement_'||p_action,'promotion_entitlement',p_entitlement_id,jsonb_build_object('reason',p_reason));
  RETURN jsonb_build_object('status','ok');
END; $$;

REVOKE ALL ON FUNCTION public.begin_promotion_attribution(text,text,text,text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.get_promotion_status(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_promotion(text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_promotion_entitlements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.book_class_v3(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.book_class_v2(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._restore_promotion_entitlement(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_promotion(uuid,text,boolean,timestamptz,timestamptz,integer,timestamptz,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_adjust_promotion_entitlement(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_has_attended_promotion_program(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_matches_promotion_audience(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promotion_activation_requirements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_preview_promotion_audience(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_promotion_test_sent(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_transition_promotion(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_promotion_engagement(text,text,text,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_promotions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_promotion(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_promotion_attribution(text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_promotion_status(text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_promotion(text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_promotion_entitlements(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.book_class_v3(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_v2(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_booking(uuid,uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_promotion(uuid,text,boolean,timestamptz,timestamptz,integer,timestamptz,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_promotion_entitlement(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_has_attended_promotion_program(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_matches_promotion_audience(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promotion_activation_requirements(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_promotion_audience(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_promotion_test_sent(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_promotion(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_promotion_engagement(text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_promotions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_promotion(text) TO anon, authenticated;

COMMENT ON TABLE public.promotion_entitlements IS 'Restricted, non-cash promotional credits; never included in members.remaining_credits.';
COMMENT ON FUNCTION public.claim_promotion(text,uuid,text) IS 'Atomic, idempotent, authenticated promotion claim with row-locked capacity.';
