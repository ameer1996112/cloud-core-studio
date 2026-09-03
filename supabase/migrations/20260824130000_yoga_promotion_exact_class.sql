-- Restrict promotions to configured class instances when any are present.
-- Program-type eligibility remains as a fallback for reusable campaigns that do
-- not opt into exact-class targeting.

CREATE TABLE public.promotion_eligible_classes (
  promotion_id uuid NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  PRIMARY KEY (promotion_id, class_id)
);

CREATE INDEX promotion_eligible_classes_class_idx
  ON public.promotion_eligible_classes(class_id, promotion_id);

ALTER TABLE public.promotion_eligible_classes ENABLE ROW LEVEL SECURITY;

-- A deployment must never leave the launch campaign enabled with only the old,
-- broader class-type configuration. The audited v2 admin RPC reenables it only
-- after one exact class has been selected.
UPDATE public.promotion_campaigns
SET enabled=false, updated_at=now()
WHERE slug='yoga-lina-launch';

CREATE POLICY "admins read promotion classes" ON public.promotion_eligible_classes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.promotion_eligible_classes TO authenticated;
GRANT ALL ON public.promotion_eligible_classes TO service_role;

CREATE OR REPLACE FUNCTION public.promotion_allows_class(
  p_promotion_id uuid,
  p_class_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.promotion_campaigns pc
      WHERE pc.id = p_promotion_id AND pc.slug = 'yoga-lina-launch'
    ) OR EXISTS (
      SELECT 1 FROM public.promotion_eligible_classes pec
      WHERE pec.promotion_id = p_promotion_id
    ) THEN EXISTS (
      SELECT 1 FROM public.promotion_eligible_classes pec
      WHERE pec.promotion_id = p_promotion_id AND pec.class_id = p_class_id
    )
    ELSE EXISTS (
      SELECT 1
      FROM public.promotion_eligible_class_types pct
      JOIN public.classes c ON c.program_type_id = pct.program_type_id
      WHERE pct.promotion_id = p_promotion_id AND c.id = p_class_id
    )
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
  v_class_id uuid;
  v_class_title text;
  v_class_starts_at timestamptz;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug = p_slug;
  IF NOT FOUND THEN RETURN jsonb_build_object('active', false, 'soldOut', false, 'remaining', 0); END IF;

  SELECT pt.id, COALESCE(pt.name_he, pt.name_en) INTO v_class_type_id, v_class_name
  FROM public.promotion_eligible_class_types pct
  JOIN public.program_types pt ON pt.id = pct.program_type_id
  WHERE pct.promotion_id = v_campaign.id ORDER BY pt.sort_order LIMIT 1;

  SELECT c.id, c.title, c.starts_at INTO v_class_id, v_class_title, v_class_starts_at
  FROM public.promotion_eligible_classes pec
  JOIN public.classes c ON c.id = pec.class_id
  WHERE pec.promotion_id = v_campaign.id
  ORDER BY c.starts_at, c.id
  LIMIT 1;

  IF v_user IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.promotion_claims
      WHERE promotion_id = v_campaign.id AND user_id = v_user AND status = 'claimed'
    ) INTO v_claimed;
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
        AND EXISTS (
          SELECT 1 FROM public.promotion_attributions a
          WHERE a.token = p_attribution_token AND a.promotion_id = v_campaign.id
            AND (a.user_id IS NULL OR a.user_id = v_user)
            AND v_campaign.starts_at IS NOT NULL AND a.created_at >= v_campaign.starts_at
        )
    ) INTO v_eligible;
  END IF;

  RETURN jsonb_build_object(
    'active', v_campaign.enabled AND v_campaign.starts_at IS NOT NULL AND v_now >= v_campaign.starts_at
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
    'eligibleClassTypeName', v_class_name,
    'eligibleClassId', v_class_id,
    'eligibleClassTitle', v_class_title,
    'eligibleClassStartsAt', v_class_starts_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_class_v3(
  p_actor_id uuid,
  p_class_id uuid,
  p_promotion_entitlement_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT * INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=v_user AND status='booked' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','already_booked','booking_id',v_existing.id,'remaining_credits',v_member.remaining_credits); END IF;
  IF v_class.booked_count >= v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;

  IF p_promotion_entitlement_id IS NOT NULL THEN
    SELECT e.* INTO v_ent FROM public.promotion_entitlements e
    WHERE e.id=p_promotion_entitlement_id AND e.member_id=v_user FOR UPDATE;
    IF NOT FOUND OR v_ent.status <> 'active' OR v_ent.expires_at <= now()
      OR NOT public.promotion_allows_class(v_ent.promotion_id, v_class.id)
    THEN RETURN jsonb_build_object('status','error','message','PROMO_CREDIT_NOT_VALID_FOR_CLASS'); END IF;
  ELSE
    SELECT e.* INTO v_ent FROM public.promotion_entitlements e
    WHERE e.member_id=v_user AND e.status='active' AND e.expires_at>now()
      AND public.promotion_allows_class(e.promotion_id, v_class.id)
    ORDER BY e.expires_at,e.issued_at LIMIT 1 FOR UPDATE;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_booking(
  p_actor_id uuid,
  p_class_id uuid,
  p_member_id uuid,
  p_override boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_class public.classes%ROWTYPE; v_member public.members%ROWTYPE; v_booking_id uuid; v_existing uuid; v_ent public.promotion_entitlements%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  PERFORM public.sweep_member_credits(p_member_id);
  PERFORM public.expire_promotion_entitlements(p_member_id);
  SELECT * INTO v_class FROM public.classes WHERE id=p_class_id FOR UPDATE;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF v_class.id IS NULL THEN RETURN jsonb_build_object('status','error','message','class_not_found'); END IF;
  IF v_member.id IS NULL THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;
  SELECT id INTO v_existing FROM public.bookings WHERE class_id=p_class_id AND member_id=p_member_id AND status='booked' LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('status','already_booked','booking_id',v_existing); END IF;
  IF NOT p_override AND v_class.booked_count>=v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  SELECT e.* INTO v_ent FROM public.promotion_entitlements e
  WHERE e.member_id=p_member_id AND e.status='active' AND e.expires_at>now()
    AND public.promotion_allows_class(e.promotion_id, v_class.id)
  ORDER BY e.expires_at,e.issued_at LIMIT 1 FOR UPDATE;
  IF v_ent.id IS NULL AND NOT p_override AND v_member.remaining_credits<v_class.credit_cost THEN RETURN jsonb_build_object('status','insufficient_credits'); END IF;
  INSERT INTO public.bookings(class_id,member_id,status,credit_cost,promotion_entitlement_id)
  VALUES(p_class_id,p_member_id,'booked',CASE WHEN v_ent.id IS NULL THEN v_class.credit_cost ELSE 0 END,v_ent.id) RETURNING id INTO v_booking_id;
  UPDATE public.classes SET booked_count=booked_count+1 WHERE id=p_class_id;
  IF v_ent.id IS NOT NULL THEN
    UPDATE public.promotion_entitlements SET status='consumed',consumed_booking_id=v_booking_id,consumed_at=now(),updated_at=now() WHERE id=v_ent.id;
    INSERT INTO public.promotion_entitlement_audit(entitlement_id,actor_id,action,booking_id,reason) VALUES(v_ent.id,p_actor_id,'consumed',v_booking_id,'waitlist or admin confirmed booking');
  ELSIF v_member.remaining_credits>=v_class.credit_cost THEN
    UPDATE public.members SET remaining_credits=remaining_credits-v_class.credit_cost WHERE id=p_member_id;
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(p_member_id,-v_class.credit_cost,'admin booking',v_booking_id,p_actor_id);
  ELSE
    INSERT INTO public.credit_transactions(member_id,amount_delta,reason,related_booking_id,created_by) VALUES(p_member_id,0,'admin booking (credit override)',v_booking_id,p_actor_id);
  END IF;
  INSERT INTO public.attendance_records(booking_id,member_id,class_id,status) VALUES(v_booking_id,p_member_id,p_class_id,'booked');
  PERFORM public._log_action_as(p_actor_id,'booking.created','booking',v_booking_id,jsonb_build_object('class_id',p_class_id,'member_id',p_member_id,'override',p_override,'promotion_entitlement_id',v_ent.id));
  RETURN jsonb_build_object('status','booked','booking_id',v_booking_id,'promotion_entitlement_id',v_ent.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_promotion_v2(
  p_actor_id uuid,
  p_slug text,
  p_enabled boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_claim_limit integer,
  p_credit_expires_at timestamptz,
  p_program_type_ids uuid[],
  p_class_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_campaign public.promotion_campaigns%ROWTYPE;
  v_service_role boolean := auth.role() = 'service_role';
BEGIN
  IF (NOT v_service_role AND auth.uid() IS DISTINCT FROM p_actor_id)
    OR NOT public.has_role(p_actor_id,'admin')
  THEN RETURN jsonb_build_object('status','error','message','forbidden'); END IF;
  SELECT * INTO v_campaign FROM public.promotion_campaigns WHERE slug=p_slug FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','campaign_not_found'); END IF;
  IF p_claim_limit<v_campaign.claimed_count THEN RETURN jsonb_build_object('status','error','message','limit_below_claimed_count'); END IF;
  IF p_enabled AND (
    p_starts_at IS NULL OR p_credit_expires_at IS NULL
    OR COALESCE(cardinality(p_program_type_ids),0)=0
    OR (p_slug='yoga-lina-launch' AND COALESCE(cardinality(p_class_ids),0)<>1)
  ) THEN RETURN jsonb_build_object('status','error','message','incomplete_configuration'); END IF;
  IF p_ends_at IS NOT NULL AND p_starts_at IS NOT NULL AND p_ends_at<=p_starts_at THEN
    RETURN jsonb_build_object('status','error','message','invalid_campaign_window');
  END IF;
  IF p_enabled AND (p_credit_expires_at<=now() OR (p_ends_at IS NOT NULL AND p_ends_at<=now())) THEN
    RETURN jsonb_build_object('status','error','message','promotion_window_expired');
  END IF;
  IF p_ends_at IS NOT NULL AND p_credit_expires_at IS NOT NULL AND p_credit_expires_at<p_ends_at THEN
    RETURN jsonb_build_object('status','error','message','credit_expires_before_claims_close');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_class_ids, ARRAY[]::uuid[])) requested(class_id)
    LEFT JOIN public.classes c ON c.id=requested.class_id
    WHERE c.id IS NULL
      OR NOT (c.program_type_id=ANY(COALESCE(p_program_type_ids, ARRAY[]::uuid[])))
      OR (p_enabled AND c.status<>'scheduled')
  ) THEN RETURN jsonb_build_object('status','error','message','invalid_eligible_class'); END IF;
  IF p_enabled AND p_slug='yoga-lina-launch' AND EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id=ANY(p_class_ids) AND c.starts_at<>p_credit_expires_at
  ) THEN RETURN jsonb_build_object('status','error','message','credit_expiry_must_match_class_start'); END IF;

  UPDATE public.promotion_campaigns SET enabled=p_enabled,starts_at=p_starts_at,ends_at=p_ends_at,
    claim_limit=p_claim_limit,credit_expires_at=p_credit_expires_at,updated_at=now()
  WHERE id=v_campaign.id;
  DELETE FROM public.promotion_eligible_classes WHERE promotion_id=v_campaign.id;
  DELETE FROM public.promotion_eligible_class_types WHERE promotion_id=v_campaign.id;
  INSERT INTO public.promotion_eligible_class_types(promotion_id,program_type_id)
    SELECT v_campaign.id, id FROM unnest(COALESCE(p_program_type_ids, ARRAY[]::uuid[])) id GROUP BY id;
  INSERT INTO public.promotion_eligible_classes(promotion_id,class_id)
    SELECT v_campaign.id, id FROM unnest(COALESCE(p_class_ids, ARRAY[]::uuid[])) id GROUP BY id;
  PERFORM public._log_action_as(p_actor_id,'promotion.updated','promotion',v_campaign.id,
    jsonb_build_object('enabled',p_enabled,'claim_limit',p_claim_limit,
      'program_type_ids',p_program_type_ids,'class_ids',p_class_ids));
  RETURN jsonb_build_object('status','ok');
END;
$$;

-- Preserve compatibility for already-open admin clients without allowing them to
-- remove an exact-class restriction. New clients use admin_update_promotion_v2.
CREATE OR REPLACE FUNCTION public.admin_update_promotion(
  p_actor_id uuid,p_slug text,p_enabled boolean,p_starts_at timestamptz,p_ends_at timestamptz,
  p_claim_limit integer,p_credit_expires_at timestamptz,p_program_type_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_class_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(class_id ORDER BY class_id), ARRAY[]::uuid[]) INTO v_class_ids
  FROM public.promotion_eligible_classes pec
  JOIN public.promotion_campaigns pc ON pc.id=pec.promotion_id
  WHERE pc.slug=p_slug;
  RETURN public.admin_update_promotion_v2(
    p_actor_id,p_slug,p_enabled,p_starts_at,p_ends_at,p_claim_limit,
    p_credit_expires_at,p_program_type_ids,v_class_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promotion_allows_class(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_promotion_v2(uuid,text,boolean,timestamptz,timestamptz,integer,timestamptz,uuid[],uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promotion_allows_class(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_promotion_v2(uuid,text,boolean,timestamptz,timestamptz,integer,timestamptz,uuid[],uuid[]) TO authenticated, service_role;

COMMENT ON TABLE public.promotion_eligible_classes IS
  'Exact class-instance restrictions. When present for a campaign, these override class-type eligibility.';
COMMENT ON FUNCTION public.promotion_allows_class(uuid,uuid) IS
  'Checks exact class eligibility first and uses configured program types only when no exact classes exist.';
