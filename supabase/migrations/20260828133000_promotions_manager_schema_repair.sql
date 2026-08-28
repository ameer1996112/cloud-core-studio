-- Forward-only repair for environments where 20260824120000 was recorded
-- before the reusable promotions-manager contract was added to that file.
-- Preserve legacy claims, entitlements, and exact-class restrictions.

ALTER TABLE public.promotion_campaigns
  ADD COLUMN IF NOT EXISTS promotion_type text NOT NULL DEFAULT 'announcement'
    CHECK (promotion_type IN ('announcement','free_class_credit')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','active','paused','ended','archived')),
  ADD COLUMN IF NOT EXISTS localized_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience jsonb NOT NULL DEFAULT '{"kind":"all_marketing"}'::jsonb,
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  ADD COLUMN IF NOT EXISTS whatsapp_templates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_url text NOT NULL DEFAULT '/member/schedule',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS audience_previewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS audience_preview_count integer,
  ADD COLUMN IF NOT EXISTS test_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_sent_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS broadcast_dispatch_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS broadcast_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.promotion_campaign_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text,
  next_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotion_engagement_events (
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

CREATE TABLE IF NOT EXISTS public.promotion_deliveries (
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
  UNIQUE (promotion_id,member_id,channel)
);

-- This table already exists in production from the later exact-class hotfix,
-- but was missing from the repository migration chain.
CREATE TABLE IF NOT EXISTS public.promotion_eligible_classes (
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id,class_id)
);
COMMENT ON TABLE public.promotion_eligible_classes IS
  'Exact class-instance restrictions. When present for a campaign, these override class-type eligibility.';

ALTER TABLE public.member_notifications
  ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES public.promotion_campaigns(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS promotion_engagement_idempotency_idx
  ON public.promotion_engagement_events(promotion_id,idempotency_key);
CREATE INDEX IF NOT EXISTS promotion_campaign_audit_idx
  ON public.promotion_campaign_audit(promotion_id,created_at DESC);
CREATE INDEX IF NOT EXISTS promotion_deliveries_status_idx
  ON public.promotion_deliveries(promotion_id,channel,status);

UPDATE public.promotion_campaigns
SET promotion_type='free_class_credit',
    localized_content=jsonb_build_object(
      'he',jsonb_build_object('eyebrow','Cloud & Core','title','יוגה עם לינה','body','שיעור יוגה אחד במתנה לעשר הראשונות.','cta','לקבלת השיעור'),
      'ar',jsonb_build_object('eyebrow','Cloud & Core','title','يوغا مع لينا','body','حصة يوغا مجانية لأول عشر مشتركات.','cta','احصلي على الحصة'),
      'en',jsonb_build_object('eyebrow','Cloud & Core','title','Yoga with Lina','body','One complimentary Yoga class for the first ten eligible members.','cta','Claim your class')
    ),
    audience='{"kind":"not_attended_program"}'::jsonb,
    channels=ARRAY['in_app','push','whatsapp']::text[],
    action_url='/member/schedule?program=yoga',
    is_public=true,is_featured=true,priority=50,new_accounts_only=false,
    enabled=false,
    status=CASE WHEN ends_at IS NOT NULL AND ends_at<=now() THEN 'ended' ELSE 'draft' END,
    updated_at=now()
WHERE slug='yoga-lina-launch';

CREATE OR REPLACE FUNCTION public.prevent_published_promotion_content_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.broadcast_dispatch_started_at IS NOT NULL
    OR OLD.broadcast_dispatched_at IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.promotion_deliveries WHERE promotion_id=OLD.id) THEN
    RAISE EXCEPTION 'published_promotions_are_immutable';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS promotion_campaign_content_immutable_after_delivery ON public.promotion_campaigns;
CREATE TRIGGER promotion_campaign_content_immutable_after_delivery
  BEFORE UPDATE OF slug,name,promotion_type,localized_content,audience,channels,
    whatsapp_templates,action_url,is_public,is_featured,priority,starts_at,ends_at,
    claim_limit,new_accounts_only,credit_quantity,credit_expires_at
  ON public.promotion_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_published_promotion_content_mutation();

CREATE OR REPLACE FUNCTION public.prevent_promotion_campaign_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'promotion campaign audit is append-only';
END; $$;

DROP TRIGGER IF EXISTS promotion_campaign_audit_append_only ON public.promotion_campaign_audit;
CREATE TRIGGER promotion_campaign_audit_append_only
  BEFORE UPDATE OR DELETE ON public.promotion_campaign_audit
  FOR EACH ROW EXECUTE FUNCTION public.prevent_promotion_campaign_audit_mutation();

CREATE OR REPLACE FUNCTION public.suppress_inactive_promotion_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.promotion_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.promotion_campaigns
    WHERE id=NEW.promotion_id AND enabled=true AND status='active'
  ) THEN
    NEW.delivery_status:='suppressed';
    NEW.suppression_reason:='campaign_inactive';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS member_notification_inactive_promotion_guard ON public.member_notifications;
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

DROP TRIGGER IF EXISTS promotion_notification_activation_restore ON public.promotion_campaigns;
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

DROP TRIGGER IF EXISTS member_notification_promotion_read_receipt ON public.member_notifications;
CREATE TRIGGER member_notification_promotion_read_receipt
  AFTER UPDATE OF read_at ON public.member_notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_promotion_inbox_read_receipt();

-- Preserve the live booking RPCs, which contain a later exact-class restriction.
CREATE OR REPLACE FUNCTION public.record_promotion_booking_engagement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_promotion_id uuid;
BEGIN
  IF NEW.promotion_entitlement_id IS NULL THEN RETURN NEW; END IF;
  SELECT promotion_id INTO v_promotion_id
  FROM public.promotion_entitlements WHERE id=NEW.promotion_entitlement_id;
  IF v_promotion_id IS NOT NULL THEN
    INSERT INTO public.promotion_engagement_events(
      promotion_id,member_id,event_type,channel,idempotency_key,metadata
    ) VALUES(
      v_promotion_id,NEW.member_id,'booking_completed','in_app',
      'booking:'||NEW.id::text,jsonb_build_object('booking_id',NEW.id)
    ) ON CONFLICT (promotion_id,idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS promotion_booking_engagement ON public.bookings;
CREATE TRIGGER promotion_booking_engagement
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.record_promotion_booking_engagement();

CREATE OR REPLACE FUNCTION public.begin_promotion_attribution(
  p_slug text,p_utm_source text DEFAULT NULL,p_utm_medium text DEFAULT NULL,p_utm_campaign text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_promotion_id uuid; v_token uuid;
BEGIN
  SELECT id INTO v_promotion_id FROM public.promotion_campaigns WHERE slug=p_slug AND is_public=true;
  IF v_promotion_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.promotion_attributions(promotion_id,utm_source,utm_medium,utm_campaign)
  VALUES(v_promotion_id,left(p_utm_source,100),left(p_utm_medium,100),left(p_utm_campaign,150))
  RETURNING token INTO v_token;
  RETURN v_token;
END; $$;

CREATE OR REPLACE FUNCTION public.member_has_attended_promotion_program(p_member_id uuid,p_promotion_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.attendance_records attendance
    JOIN public.classes class ON class.id=attendance.class_id
    JOIN public.promotion_eligible_class_types eligible ON eligible.program_type_id=class.program_type_id
    WHERE attendance.member_id=p_member_id AND eligible.promotion_id=p_promotion_id
      AND attendance.status IN ('checked_in','attended')
  );
$$;

CREATE OR REPLACE FUNCTION public.member_matches_promotion_audience(p_member_id uuid,p_promotion_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_member public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id;
  IF v_campaign.id IS NULL OR v_member.id IS NULL OR v_member.status<>'active' OR
    COALESCE(v_member.tags,'{}'::text[]) && ARRAY['test','staff','service','blocked','deleted','duplicate']::text[] THEN
    RETURN false;
  END IF;
  RETURN CASE v_campaign.audience->>'kind'
    WHEN 'never_booked' THEN NOT EXISTS(
      SELECT 1 FROM public.bookings WHERE member_id=p_member_id AND status<>'cancelled'
    )
    WHEN 'no_upcoming' THEN NOT EXISTS(
      SELECT 1 FROM public.bookings booking JOIN public.classes class ON class.id=booking.class_id
      WHERE booking.member_id=p_member_id AND booking.status='booked' AND class.starts_at>now()
    )
    WHEN 'inactive_14d' THEN v_member.last_visit_at IS NULL OR v_member.last_visit_at<=now()-interval '14 days'
    WHEN 'low_credits' THEN v_member.remaining_credits<=2
    WHEN 'expiring_7d' THEN EXISTS(
      SELECT 1 FROM public.member_plans plan WHERE plan.member_id=p_member_id AND plan.status='active'
        AND plan.expires_at BETWEEN now() AND now()+interval '7 days'
    )
    WHEN 'not_attended_program' THEN NOT public.member_has_attended_promotion_program(p_member_id,p_promotion_id)
    WHEN 'specific' THEN v_campaign.audience->'memberIds' ? p_member_id::text
    ELSE true
  END;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_promotion(p_slug text,p_attribution_token uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid:=auth.uid(); v_campaign public.promotion_campaigns%ROWTYPE;
  v_claim public.promotion_claims%ROWTYPE; v_attr public.promotion_attributions%ROWTYPE;
  v_member public.members%ROWTYPE; v_role public.app_role; v_user_created_at timestamptz;
  v_entitlement_id uuid; v_rate public.promotion_claim_rate_limits%ROWTYPE; v_claim_source text:='in_app';
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('status','error','message','not_authenticated'); END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN
    RETURN jsonb_build_object('status','error','message','invalid_idempotency_key');
  END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug=p_slug FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','ineligible','reason','campaign_not_found'); END IF;
  SELECT * INTO v_claim FROM public.promotion_claims WHERE promotion_id=v_campaign.id AND user_id=v_user;
  IF FOUND THEN
    SELECT id INTO v_entitlement_id FROM public.promotion_entitlements WHERE promotion_claim_id=v_claim.id;
    RETURN jsonb_build_object('status','already_claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id,
      'remaining',GREATEST(v_campaign.claim_limit-v_campaign.claimed_count,0));
  END IF;
  INSERT INTO public.promotion_claim_rate_limits(user_id,promotion_id) VALUES(v_user,v_campaign.id)
  ON CONFLICT (user_id,promotion_id) DO UPDATE SET
    window_started_at=CASE WHEN public.promotion_claim_rate_limits.window_started_at<now()-interval '1 minute' THEN now() ELSE public.promotion_claim_rate_limits.window_started_at END,
    attempt_count=CASE WHEN public.promotion_claim_rate_limits.window_started_at<now()-interval '1 minute' THEN 1 ELSE public.promotion_claim_rate_limits.attempt_count+1 END
  RETURNING * INTO v_rate;
  IF v_rate.attempt_count>5 THEN RETURN jsonb_build_object('status','rate_limited'); END IF;
  IF NOT v_campaign.enabled OR v_campaign.status<>'active' THEN RETURN jsonb_build_object('status','ineligible','reason','disabled'); END IF;
  IF v_campaign.starts_at IS NULL OR now()<v_campaign.starts_at THEN RETURN jsonb_build_object('status','ineligible','reason','not_started'); END IF;
  IF v_campaign.ends_at IS NOT NULL AND now()>=v_campaign.ends_at THEN RETURN jsonb_build_object('status','ineligible','reason','ended'); END IF;
  IF v_campaign.credit_expires_at IS NULL OR v_campaign.credit_expires_at<=now() THEN RETURN jsonb_build_object('status','ineligible','reason','invalid_credit_expiry'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id) THEN RETURN jsonb_build_object('status','ineligible','reason','class_type_not_configured'); END IF;
  IF p_attribution_token IS NOT NULL THEN
    SELECT * INTO v_attr FROM public.promotion_attributions WHERE token=p_attribution_token FOR UPDATE;
    IF NOT FOUND OR v_attr.promotion_id<>v_campaign.id OR v_attr.created_at<v_campaign.starts_at
      OR (v_attr.user_id IS NOT NULL AND v_attr.user_id<>v_user) THEN
      RETURN jsonb_build_object('status','ineligible','reason','invalid_campaign_attribution');
    END IF;
  END IF;
  SELECT * INTO v_member FROM public.members WHERE id=v_user FOR UPDATE;
  SELECT p.role,u.created_at INTO v_role,v_user_created_at
  FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=v_user;
  IF v_member.id IS NULL OR v_role<>'member' OR v_member.status<>'active'
    OR COALESCE(v_member.tags,'{}'::text[]) && ARRAY['test','staff','service','blocked','deleted','duplicate']::text[] THEN
    RETURN jsonb_build_object('status','ineligible','reason','account_not_eligible');
  END IF;
  IF v_campaign.new_accounts_only AND v_user_created_at<v_campaign.starts_at THEN RETURN jsonb_build_object('status','ineligible','reason','existing_account'); END IF;
  IF NOT public.member_matches_promotion_audience(v_user,v_campaign.id) THEN RETURN jsonb_build_object('status','ineligible','reason','audience_not_eligible'); END IF;
  IF v_campaign.claimed_count>=v_campaign.claim_limit THEN RETURN jsonb_build_object('status','sold_out','remaining',0); END IF;
  IF p_attribution_token IS NOT NULL THEN
    UPDATE public.promotion_attributions SET user_id=v_user,bound_at=COALESCE(bound_at,now()),consumed_at=now() WHERE token=p_attribution_token;
    v_claim_source:=COALESCE(v_attr.source,'in_app');
  END IF;
  INSERT INTO public.promotion_claims(
    promotion_id,user_id,attribution_token,source,utm_source,utm_medium,utm_campaign,idempotency_key
  ) VALUES(
    v_campaign.id,v_user,p_attribution_token,v_claim_source,v_attr.utm_source,v_attr.utm_medium,v_attr.utm_campaign,left(p_idempotency_key,200)
  ) RETURNING * INTO v_claim;
  INSERT INTO public.promotion_entitlements(promotion_claim_id,promotion_id,member_id,quantity,expires_at)
  VALUES(v_claim.id,v_campaign.id,v_user,v_campaign.credit_quantity,v_campaign.credit_expires_at)
  RETURNING id INTO v_entitlement_id;
  INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,reason)
  VALUES(v_entitlement_id,v_user,'issued','campaign claim');
  UPDATE public.promotion_campaigns SET claimed_count=claimed_count+1,updated_at=now() WHERE id=v_campaign.id;
  RETURN jsonb_build_object('status','claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id,
    'remaining',v_campaign.claim_limit-v_campaign.claimed_count-1);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_claim FROM public.promotion_claims WHERE promotion_id=v_campaign.id AND user_id=v_user;
  IF FOUND THEN
    SELECT id INTO v_entitlement_id FROM public.promotion_entitlements WHERE promotion_claim_id=v_claim.id;
    RETURN jsonb_build_object('status','already_claimed','claimId',v_claim.id,'entitlementId',v_entitlement_id);
  END IF;
  RAISE;
END; $$;

CREATE OR REPLACE FUNCTION public.promotion_activation_requirements(p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_errors text[]:=ARRAY[]::text[]; v_language text;
BEGIN
  IF COALESCE(auth.role(),'')<>'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('ok',false,'errors',ARRAY['forbidden']);
  END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'errors',ARRAY['campaign_not_found']); END IF;
  IF v_campaign.starts_at IS NULL OR v_campaign.ends_at IS NULL OR v_campaign.ends_at<=v_campaign.starts_at THEN v_errors:=array_append(v_errors,'campaign_window_invalid'); END IF;
  IF v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at<=now() THEN v_errors:=array_append(v_errors,'campaign_window_expired'); END IF;
  FOREACH v_language IN ARRAY ARRAY['he','ar','en']::text[] LOOP
    IF COALESCE(v_campaign.localized_content->v_language->>'title','')='' OR
       COALESCE(v_campaign.localized_content->v_language->>'body','')='' OR
       COALESCE(v_campaign.localized_content->v_language->>'cta','')='' THEN
      v_errors:=array_append(v_errors,'localized_content_'||v_language||'_required');
    END IF;
  END LOOP;
  IF v_campaign.promotion_type='free_class_credit' AND NOT EXISTS(
    SELECT 1 FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id
  ) THEN v_errors:=array_append(v_errors,'eligible_program_required'); END IF;
  IF v_campaign.promotion_type='free_class_credit'
    AND (v_campaign.credit_expires_at IS NULL OR v_campaign.credit_expires_at<=v_campaign.ends_at) THEN
    v_errors:=array_append(v_errors,'credit_expiry_must_follow_campaign');
  END IF;
  IF v_campaign.audience_previewed_at IS NULL THEN v_errors:=array_append(v_errors,'audience_preview_required'); END IF;
  IF v_campaign.test_sent_at IS NULL THEN v_errors:=array_append(v_errors,'test_send_required'); END IF;
  IF 'whatsapp'=ANY(v_campaign.channels) AND EXISTS(
    SELECT 1 FROM unnest(ARRAY['he','ar','en']::text[]) language
    WHERE COALESCE(v_campaign.whatsapp_templates->language->>'status','')<>'approved'
  ) THEN v_errors:=array_append(v_errors,'whatsapp_template_not_approved'); END IF;
  RETURN jsonb_build_object('ok',cardinality(v_errors)=0,'errors',to_jsonb(v_errors));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_preview_promotion_audience(p_actor_id uuid,p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_count integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  SELECT count(*) INTO v_count FROM public.members member
  WHERE public.member_matches_promotion_audience(member.id,v_campaign.id);
  UPDATE public.promotion_campaigns
  SET audience_previewed_at=now(),audience_preview_count=v_count,updated_by=p_actor_id,updated_at=now()
  WHERE id=v_campaign.id;
  INSERT INTO public.promotion_campaign_audit(promotion_id,actor_id,action,metadata)
  VALUES(v_campaign.id,p_actor_id,'audience_previewed',jsonb_build_object('eligible_count',v_count));
  RETURN jsonb_build_object('status','ok','eligibleCount',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_mark_promotion_test_sent(p_actor_id uuid,p_promotion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  UPDATE public.promotion_campaigns
  SET test_sent_at=now(),test_sent_to=p_actor_id,updated_by=p_actor_id,updated_at=now()
  WHERE id=p_promotion_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  INSERT INTO public.promotion_campaign_audit(promotion_id,actor_id,action)
  VALUES(p_promotion_id,p_actor_id,'test_sent');
  RETURN jsonb_build_object('status','ok');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transition_promotion(p_actor_id uuid,p_promotion_id uuid,p_next_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_campaign public.promotion_campaigns%ROWTYPE; v_requirements jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id OR NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  IF p_next_status NOT IN ('scheduled','active','paused','archived') THEN RETURN jsonb_build_object('status','error','message','invalid_transition'); END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE id=p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  IF v_campaign.status=p_next_status THEN RETURN jsonb_build_object('status','ok','nextStatus',p_next_status,'unchanged',true); END IF;
  IF p_next_status='active' AND v_campaign.starts_at>now() THEN RETURN jsonb_build_object('status','error','message','future_campaign_must_be_scheduled'); END IF;
  IF p_next_status IN ('scheduled','active') THEN
    v_requirements:=public.promotion_activation_requirements(p_promotion_id);
    IF NOT COALESCE((v_requirements->>'ok')::boolean,false) THEN
      RETURN jsonb_build_object('status','error','message','activation_requirements_failed','requirements',v_requirements);
    END IF;
  END IF;
  UPDATE public.promotion_campaigns SET
    status=p_next_status,enabled=p_next_status IN ('scheduled','active'),
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
  INSERT INTO public.promotion_engagement_events(
    promotion_id,member_id,event_type,channel,idempotency_key,metadata
  ) VALUES(
    v_campaign_id,auth.uid(),p_event_type,p_channel,left(p_idempotency_key,200),COALESCE(p_metadata,'{}'::jsonb)
  ) ON CONFLICT (promotion_id,idempotency_key)
    DO UPDATE SET metadata=public.promotion_engagement_events.metadata
  RETURNING id INTO v_event_id;
  RETURN jsonb_build_object('status','ok','eventId',v_event_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_member_promotions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',campaign.id,'slug',campaign.slug,'promotionType',campaign.promotion_type,
    'localizedContent',campaign.localized_content,'actionUrl',campaign.action_url,
    'priority',campaign.priority,'remaining',GREATEST(campaign.claim_limit-campaign.claimed_count,0),
    'claimLimit',campaign.claim_limit,'soldOut',campaign.claimed_count>=campaign.claim_limit,
    'claimedByCurrentUser',claim.id IS NOT NULL,'entitlementStatus',entitlement.status,
    'creditAvailable',entitlement.status='active' AND entitlement.expires_at>now(),
    'startsAt',campaign.starts_at,'endsAt',campaign.ends_at,'creditExpiresAt',campaign.credit_expires_at
  ) ORDER BY campaign.priority DESC,campaign.starts_at DESC),'[]'::jsonb)
  FROM public.promotion_campaigns campaign
  JOIN public.members member ON member.id=auth.uid()
  LEFT JOIN public.promotion_claims claim
    ON claim.promotion_id=campaign.id AND claim.user_id=auth.uid() AND claim.status='claimed'
  LEFT JOIN public.promotion_entitlements entitlement
    ON entitlement.promotion_id=campaign.id AND entitlement.member_id=auth.uid()
  WHERE campaign.enabled=true AND campaign.status IN ('scheduled','active')
    AND campaign.is_featured=true AND campaign.starts_at<=now()
    AND (campaign.ends_at IS NULL OR campaign.ends_at>now())
    AND public.member_matches_promotion_audience(member.id,campaign.id)
    AND NOT EXISTS(
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
    ) FROM public.promotion_campaigns
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
  UPDATE public.promotion_campaigns
  SET enabled=false,starts_at=p_starts_at,ends_at=p_ends_at,claim_limit=p_claim_limit,
      credit_expires_at=p_credit_expires_at,updated_at=now()
  WHERE id=v_campaign.id;
  DELETE FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id;
  INSERT INTO public.promotion_eligible_class_types(promotion_id,program_type_id)
  SELECT v_campaign.id,id FROM unnest(COALESCE(p_program_type_ids,ARRAY[]::uuid[])) id GROUP BY id;
  RETURN jsonb_build_object('status','ok');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_promotion_v2(
  p_actor_id uuid,p_slug text,p_enabled boolean,p_starts_at timestamptz,p_ends_at timestamptz,
  p_claim_limit integer,p_credit_expires_at timestamptz,p_program_type_ids uuid[],p_class_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; v_campaign_id uuid;
BEGIN
  IF p_enabled THEN RETURN jsonb_build_object('status','error','message','use_promotions_manager_activation_flow'); END IF;
  v_result:=public.admin_update_promotion(
    p_actor_id,p_slug,false,p_starts_at,p_ends_at,p_claim_limit,p_credit_expires_at,p_program_type_ids
  );
  IF v_result->>'status'<>'ok' THEN RETURN v_result; END IF;
  SELECT id INTO v_campaign_id FROM public.promotion_campaigns WHERE slug=p_slug;
  DELETE FROM public.promotion_eligible_classes WHERE promotion_id=v_campaign_id;
  INSERT INTO public.promotion_eligible_classes(promotion_id,class_id)
  SELECT v_campaign_id,id FROM unnest(COALESCE(p_class_ids,ARRAY[]::uuid[])) id GROUP BY id;
  RETURN v_result;
END; $$;

ALTER TABLE public.promotion_campaign_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_eligible_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read promotion campaign audit" ON public.promotion_campaign_audit;
CREATE POLICY "admins read promotion campaign audit" ON public.promotion_campaign_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "members read own promotion engagement" ON public.promotion_engagement_events;
CREATE POLICY "members read own promotion engagement" ON public.promotion_engagement_events
  FOR SELECT TO authenticated USING (member_id=auth.uid());
DROP POLICY IF EXISTS "admins read promotion engagement" ON public.promotion_engagement_events;
CREATE POLICY "admins read promotion engagement" ON public.promotion_engagement_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "members read own promotion deliveries" ON public.promotion_deliveries;
CREATE POLICY "members read own promotion deliveries" ON public.promotion_deliveries
  FOR SELECT TO authenticated USING (member_id=auth.uid());
DROP POLICY IF EXISTS "admins read promotion deliveries" ON public.promotion_deliveries;
CREATE POLICY "admins read promotion deliveries" ON public.promotion_deliveries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins read promotion classes" ON public.promotion_eligible_classes;
CREATE POLICY "admins read promotion classes" ON public.promotion_eligible_classes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

REVOKE ALL ON public.promotion_campaign_audit,public.promotion_engagement_events,public.promotion_deliveries
  FROM anon,authenticated;
GRANT SELECT ON public.promotion_campaign_audit,public.promotion_engagement_events,public.promotion_deliveries
  TO authenticated;
GRANT ALL ON public.promotion_campaign_audit,public.promotion_engagement_events,public.promotion_deliveries
  TO service_role;
REVOKE ALL ON public.promotion_eligible_classes FROM anon,authenticated;
GRANT SELECT ON public.promotion_eligible_classes TO authenticated;
GRANT ALL ON public.promotion_eligible_classes TO service_role;

REVOKE ALL ON FUNCTION public.begin_promotion_attribution(text,text,text,text) FROM PUBLIC,authenticated;
REVOKE ALL ON FUNCTION public.claim_promotion(text,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.member_has_attended_promotion_program(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.member_matches_promotion_audience(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.promotion_activation_requirements(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_preview_promotion_audience(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_promotion_test_sent(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_transition_promotion(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.track_promotion_engagement(text,text,text,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_member_promotions() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_public_promotion(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_promotion_attribution(text,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_promotion(text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_has_attended_promotion_program(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_matches_promotion_audience(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promotion_activation_requirements(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_promotion_audience(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_promotion_test_sent(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_promotion(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_promotion_engagement(text,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_promotions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_promotion(text) TO anon,authenticated;
