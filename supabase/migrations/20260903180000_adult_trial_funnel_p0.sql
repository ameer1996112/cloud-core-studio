-- P0 Adult inquiry -> assisted trial -> payment -> attendance -> continuation.
-- This is deliberately separate from members/bookings/payments so a prospect is
-- never represented by a fabricated auth user. Existing member flows are unchanged.

ALTER TABLE public.lead_journeys
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS attribution_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_question text,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT 'reply',
  ADD COLUMN IF NOT EXISTS trial_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offered_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS continuation_outcome text,
  ADD COLUMN IF NOT EXISTS linked_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.lead_journeys
  ADD CONSTRAINT lead_journeys_next_action_check CHECK (
    next_action IN ('reply','offer_class','waiting_suitable_time','waiting_next_schedule','none')
  ) NOT VALID,
  ADD CONSTRAINT lead_journeys_continuation_outcome_check CHECK (
    continuation_outcome IS NULL OR continuation_outcome IN ('pending','purchased','did_not_purchase','unknown')
  ) NOT VALID;

ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_next_action_check;
ALTER TABLE public.lead_journeys VALIDATE CONSTRAINT lead_journeys_continuation_outcome_check;

CREATE TABLE IF NOT EXISTS public.adult_trial_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  lead_journey_id uuid NOT NULL REFERENCES public.lead_journeys(id) ON DELETE RESTRICT,
  communication_recipient_id uuid NOT NULL REFERENCES public.communication_recipients(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  booking_route text NOT NULL DEFAULT 'assisted' CHECK (booking_route IN ('assisted','self_service')),
  state text NOT NULL DEFAULT 'booked' CHECK (state IN ('hold','booked','cancelled','expired')),
  hold_expires_at timestamptz,
  attendance_status text CHECK (attendance_status IN ('attended','no_show','cancelled')),
  attendance_marked_at timestamptz,
  attendance_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancellation_reason text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'hold') = (hold_expires_at IS NOT NULL)),
  UNIQUE (studio_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS adult_trial_reservations_one_active_per_recipient_class
  ON public.adult_trial_reservations(class_id, communication_recipient_id)
  WHERE state IN ('hold','booked');
CREATE INDEX IF NOT EXISTS adult_trial_reservations_active_class_idx
  ON public.adult_trial_reservations(class_id, hold_expires_at)
  WHERE state IN ('hold','booked');
CREATE INDEX IF NOT EXISTS adult_trial_reservations_lead_idx
  ON public.adult_trial_reservations(lead_journey_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.adult_trial_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.adult_trial_reservations(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL DEFAULT 80 CHECK (amount = 80),
  currency text NOT NULL DEFAULT 'ILS' CHECK (currency = 'ILS'),
  method text NOT NULL CHECK (method IN ('card','apple_pay','bit','cash','other')),
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('hyp','manual','other')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','checkout_creating','pending','paid','failed','cancelled')),
  provider_payment_id text,
  provider_session_id text,
  provider_status text,
  paid_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trial_credit_applied_to_payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'paid' AND paid_at IS NOT NULL AND confirmed_at IS NOT NULL)
    OR (status <> 'paid' AND paid_at IS NULL AND confirmed_at IS NULL)
  ),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS adult_trial_payments_reservation_idx
  ON public.adult_trial_payments(reservation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS adult_trial_payments_provider_payment_idx
  ON public.adult_trial_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS adult_trial_payments_one_credit_per_package_payment_idx
  ON public.adult_trial_payments(trial_credit_applied_to_payment_id)
  WHERE trial_credit_applied_to_payment_id IS NOT NULL;
-- A reservation can have historical failed/cancelled HYP attempts, but never
-- more than one checkout that could still be paid.
CREATE UNIQUE INDEX IF NOT EXISTS adult_trial_payments_one_active_hyp_checkout_per_reservation
  ON public.adult_trial_payments(reservation_id)
  WHERE provider = 'hyp' AND status IN ('checkout_creating','pending');

CREATE TABLE IF NOT EXISTS public.adult_acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'adult_inquiry_created','trial_interested','class_offered','trial_hold_created',
    'trial_booking_created','trial_payment_requested','trial_payment_received',
    'trial_payment_failed','trial_hold_expired','trial_rescheduled','trial_cancelled',
    'trial_attended','trial_no_show','package_purchased','trial_credit_applied',
    'prospect_linked_to_member','active_paying_adult_created'
  )),
  lead_journey_id uuid REFERENCES public.lead_journeys(id) ON DELETE RESTRICT,
  reservation_id uuid REFERENCES public.adult_trial_reservations(id) ON DELETE RESTRICT,
  trial_payment_id uuid REFERENCES public.adult_trial_payments(id) ON DELETE RESTRICT,
  member_id uuid REFERENCES public.members(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT,
  service text,
  locality text,
  source text,
  booking_route text CHECK (booking_route IN ('assisted','self_service')),
  payment_method text,
  payment_status text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (studio_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS adult_acquisition_events_reporting_idx
  ON public.adult_acquisition_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS adult_acquisition_events_lead_idx
  ON public.adult_acquisition_events(lead_journey_id, occurred_at);

ALTER TABLE public.adult_trial_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adult_trial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adult_acquisition_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read adult trial reservations" ON public.adult_trial_reservations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read adult trial payments" ON public.adult_trial_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read adult acquisition events" ON public.adult_acquisition_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The browser-facing admin role may read these records, but all state
-- transitions must pass through the service-role transactional RPCs below.
REVOKE ALL ON public.adult_trial_reservations, public.adult_trial_payments, public.adult_acquisition_events FROM anon, authenticated;
GRANT SELECT ON public.adult_trial_reservations, public.adult_trial_payments, public.adult_acquisition_events TO authenticated;
GRANT ALL ON public.adult_trial_reservations, public.adult_trial_payments TO service_role;
REVOKE ALL ON public.adult_acquisition_events FROM service_role;
GRANT SELECT, INSERT ON public.adult_acquisition_events TO service_role;

CREATE OR REPLACE FUNCTION public.adult_trial_emit_event(
  p_studio_id uuid,
  p_event_type text,
  p_idempotency_key text,
  p_lead_journey_id uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_trial_payment_id uuid DEFAULT NULL,
  p_member_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_service text DEFAULT NULL,
  p_locality text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_booking_route text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_payment_status text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.adult_acquisition_events(
    studio_id,event_type,idempotency_key,lead_journey_id,reservation_id,trial_payment_id,
    member_id,class_id,service,locality,source,booking_route,payment_method,payment_status,metadata
  ) VALUES (
    p_studio_id,p_event_type,p_idempotency_key,p_lead_journey_id,p_reservation_id,p_trial_payment_id,
    p_member_id,p_class_id,p_service,p_locality,p_source,p_booking_route,p_payment_method,p_payment_status,
    COALESCE(p_metadata,'{}'::jsonb)
  ) ON CONFLICT (studio_id,idempotency_key) DO NOTHING;
END;
$$;

-- RLS does not constrain service_role. A trigger keeps the measurement ledger
-- immutable even for normal service-role application calls.
CREATE OR REPLACE FUNCTION public.reject_adult_acquisition_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'adult_acquisition_events_are_append_only';
END;
$$;

CREATE TRIGGER adult_acquisition_events_append_only
  BEFORE UPDATE OR DELETE ON public.adult_acquisition_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_adult_acquisition_event_mutation();

CREATE OR REPLACE FUNCTION public.expire_adult_trial_holds(
  p_actor_id uuid,
  p_class_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_reservation public.adult_trial_reservations%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF p_actor_id IS NOT NULL AND NOT public.has_role(p_actor_id, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Canonical capacity lock order: class first, then its reservations.
  -- Lock classes deterministically so a bulk expiry cannot deadlock a booking.
  FOR v_class IN
    SELECT c.* FROM public.classes c
    JOIN (
      SELECT DISTINCT class_id FROM public.adult_trial_reservations
      WHERE state = 'hold' AND hold_expires_at <= now()
        AND (p_class_id IS NULL OR class_id = p_class_id)
    ) expired_holds ON expired_holds.class_id = c.id
    ORDER BY c.id
    FOR UPDATE OF c
  LOOP
    FOR v_reservation IN
      SELECT * FROM public.adult_trial_reservations
      WHERE class_id = v_class.id AND state = 'hold' AND hold_expires_at <= now()
      FOR UPDATE
    LOOP
      UPDATE public.adult_trial_reservations
        SET state = 'expired', hold_expires_at = NULL, updated_at = now()
        WHERE id = v_reservation.id AND state = 'hold';
      IF FOUND THEN
        UPDATE public.adult_trial_payments SET status='cancelled',provider_status='reservation_expired',updated_at=now()
          WHERE reservation_id=v_reservation.id AND provider='hyp' AND status IN ('checkout_creating','pending');
        UPDATE public.classes SET booked_count = GREATEST(0, booked_count - 1)
          WHERE id = v_reservation.class_id;
        PERFORM public.adult_trial_emit_event(
          v_reservation.studio_id,'trial_hold_expired','trial-hold-expired:' || v_reservation.id::text,
          v_reservation.lead_journey_id,v_reservation.id,NULL,NULL,v_reservation.class_id,
          NULL,NULL,NULL,v_reservation.booking_route,NULL,'expired'
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_adult_inquiry(
  p_actor_id uuid,
  p_contact_name text,
  p_phone_e164 text,
  p_email text,
  p_locale text,
  p_service text,
  p_locality text,
  p_source text,
  p_attribution_evidence jsonb,
  p_primary_question text,
  p_assigned_staff_id uuid,
  p_trial_interest boolean,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_studio_id uuid;
  v_recipient_id uuid;
  v_journey public.lead_journeys%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF length(trim(COALESCE(p_contact_name,''))) = 0 OR length(trim(COALESCE(p_idempotency_key,''))) = 0 THEN
    RETURN jsonb_build_object('status','invalid_input');
  END IF;
  SELECT id INTO v_studio_id FROM public.studios WHERE slug = 'cloud-core';
  IF v_studio_id IS NULL THEN RAISE EXCEPTION 'cloud_core_studio_missing'; END IF;

  SELECT * INTO v_journey FROM public.lead_journeys
    WHERE studio_id = v_studio_id AND provider = 'manual'
      AND provider_lead_id = 'adult:' || p_idempotency_key
    LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','already_created','lead_journey_id',v_journey.id,'recipient_id',v_journey.communication_recipient_id); END IF;

  IF NULLIF(trim(COALESCE(p_phone_e164,'')),'') IS NOT NULL THEN
    SELECT id INTO v_recipient_id FROM public.communication_recipients
      WHERE studio_id = v_studio_id AND phone_e164 = trim(p_phone_e164) AND status = 'active'
      ORDER BY created_at LIMIT 1;
  ELSIF NULLIF(trim(COALESCE(p_email,'')),'') IS NOT NULL THEN
    SELECT id INTO v_recipient_id FROM public.communication_recipients
      WHERE studio_id = v_studio_id AND lower(email) = lower(trim(p_email)) AND status = 'active'
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_recipient_id IS NULL THEN
    INSERT INTO public.communication_recipients(
      studio_id,display_name,phone_e164,email,preferred_locale,is_adult,status
    ) VALUES (
      v_studio_id,trim(p_contact_name),NULLIF(trim(p_phone_e164),''),NULLIF(trim(p_email),''),
      CASE WHEN p_locale IN ('ar','he','en') THEN p_locale ELSE 'ar' END,true,'active'
    ) RETURNING id INTO v_recipient_id;
  END IF;

  INSERT INTO public.lead_journeys(
    studio_id,provider,provider_lead_id,communication_recipient_id,state,service,locality,source,
    attribution_evidence,primary_question,assigned_staff_id,next_action,trial_interest
  ) VALUES (
    v_studio_id,'manual','adult:' || p_idempotency_key,v_recipient_id,'lead_received',p_service,p_locality,
    p_source,COALESCE(p_attribution_evidence,'{}'::jsonb),p_primary_question,p_assigned_staff_id,
    CASE WHEN p_trial_interest THEN 'offer_class' ELSE 'reply' END,p_trial_interest
  ) RETURNING * INTO v_journey;
  PERFORM public.adult_trial_emit_event(
    v_studio_id,'adult_inquiry_created','adult-inquiry:' || v_journey.id::text,v_journey.id,NULL,NULL,NULL,NULL,
    v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL
  );
  IF p_trial_interest THEN
    PERFORM public.adult_trial_emit_event(
      v_studio_id,'trial_interested','trial-interested:' || v_journey.id::text,v_journey.id,NULL,NULL,NULL,NULL,
      v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL
    );
  END IF;
  RETURN jsonb_build_object('status','created','lead_journey_id',v_journey.id,'recipient_id',v_recipient_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.offer_adult_trial_class(
  p_actor_id uuid,
  p_lead_journey_id uuid,
  p_class_id uuid,
  p_next_action text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_journey public.lead_journeys%ROWTYPE; v_class public.classes%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id = p_lead_journey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lead_not_found'); END IF;
  IF p_next_action NOT IN ('offer_class','waiting_suitable_time','waiting_next_schedule') THEN RETURN jsonb_build_object('status','invalid_action'); END IF;
  IF p_class_id IS NOT NULL THEN
    SELECT * INTO v_class FROM public.classes WHERE id = p_class_id AND status = 'scheduled' AND member_visible = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','class_not_available'); END IF;
  END IF;
  UPDATE public.lead_journeys SET state = CASE WHEN p_class_id IS NULL THEN state ELSE 'trial_proposed' END,
    offered_class_id = p_class_id, next_action = p_next_action, updated_at = now()
    WHERE id = v_journey.id;
  IF p_class_id IS NOT NULL THEN
    PERFORM public.adult_trial_emit_event(
      v_journey.studio_id,'class_offered','class-offered:' || v_journey.id::text || ':' || p_class_id::text,
      v_journey.id,NULL,NULL,NULL,p_class_id,v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL
    );
  END IF;
  RETURN jsonb_build_object('status','ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_adult_trial(
  p_actor_id uuid,
  p_lead_journey_id uuid,
  p_class_id uuid,
  p_booking_route text,
  p_hold_expires_at timestamptz,
  p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_journey public.lead_journeys%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_reservation public.adult_trial_reservations%ROWTYPE;
  v_state text;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF p_booking_route NOT IN ('assisted','self_service') OR length(trim(COALESCE(p_idempotency_key,''))) = 0 THEN
    RETURN jsonb_build_object('status','invalid_input');
  END IF;
  -- Read only enough to establish the studio for idempotency. The journey lock
  -- is deliberately taken only after the class/session lock below.
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id = p_lead_journey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lead_not_found'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations
    WHERE studio_id = v_journey.studio_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('status','already_reserved','reservation_id',v_reservation.id,'state',v_reservation.state); END IF;
  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND OR v_class.status <> 'scheduled' OR NOT v_class.member_visible THEN
    RETURN jsonb_build_object('status','class_not_available');
  END IF;
  PERFORM public.expire_adult_trial_holds(p_actor_id, p_class_id);
  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF v_class.booked_count >= v_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id = p_lead_journey_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lead_not_found'); END IF;
  v_state := CASE WHEN p_hold_expires_at IS NULL THEN 'booked' ELSE 'hold' END;
  IF p_hold_expires_at IS NOT NULL AND p_hold_expires_at <= now() THEN RETURN jsonb_build_object('status','invalid_hold_expiry'); END IF;
  INSERT INTO public.adult_trial_reservations(
    studio_id,lead_journey_id,communication_recipient_id,class_id,booking_route,state,hold_expires_at,created_by,idempotency_key
  ) VALUES (
    v_journey.studio_id,v_journey.id,v_journey.communication_recipient_id,p_class_id,p_booking_route,v_state,
    p_hold_expires_at,p_actor_id,p_idempotency_key
  ) RETURNING * INTO v_reservation;
  UPDATE public.classes SET booked_count = booked_count + 1 WHERE id = p_class_id;
  UPDATE public.lead_journeys SET state = 'trial_booked', offered_class_id = p_class_id, next_action = 'none', updated_at = now()
    WHERE id = v_journey.id;
  PERFORM public.adult_trial_emit_event(
    v_journey.studio_id,CASE WHEN v_state='hold' THEN 'trial_hold_created' ELSE 'trial_booking_created' END,
    CASE WHEN v_state='hold' THEN 'trial-hold:' ELSE 'trial-booking:' END || v_reservation.id::text,
    v_journey.id,v_reservation.id,NULL,NULL,p_class_id,v_journey.service,v_journey.locality,v_journey.source,p_booking_route,NULL,v_state
  );
  RETURN jsonb_build_object('status',v_state,'reservation_id',v_reservation.id);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_reservation FROM public.adult_trial_reservations
    WHERE studio_id = v_journey.studio_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('status','already_reserved','reservation_id',v_reservation.id,'state',v_reservation.state);
  END IF;
  -- A new idempotency key may race an existing active reservation for the same
  -- prospect and class. Return that canonical reservation rather than a null ID.
  SELECT * INTO v_reservation FROM public.adult_trial_reservations
    WHERE class_id = p_class_id AND communication_recipient_id = v_journey.communication_recipient_id
      AND state IN ('hold','booked')
    ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','already_reserved','reservation_id',v_reservation.id,'state',v_reservation.state);
  END IF;
  RETURN jsonb_build_object('status','reservation_conflict');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_adult_trial_reservation(
  p_actor_id uuid, p_reservation_id uuid, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_class public.classes%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT c.* INTO v_class FROM public.classes c
    JOIN public.adult_trial_reservations r ON r.class_id=c.id
    WHERE r.id=p_reservation_id FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','already_released'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  UPDATE public.adult_trial_reservations SET state='cancelled',hold_expires_at=NULL,cancelled_at=now(),cancellation_reason=p_reason,updated_at=now()
    WHERE id=v_reservation.id;
  UPDATE public.adult_trial_payments SET status='cancelled',provider_status='reservation_cancelled',updated_at=now()
    WHERE reservation_id=v_reservation.id AND provider='hyp' AND status IN ('checkout_creating','pending');
  UPDATE public.classes SET booked_count=GREATEST(0,booked_count-1) WHERE id=v_reservation.class_id;
  UPDATE public.lead_journeys SET state='trial_cancelled',next_action='reply',updated_at=now() WHERE id=v_journey.id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_cancelled','trial-cancelled:' || v_reservation.id::text,
    v_journey.id,v_reservation.id,NULL,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,NULL,'cancelled');
  RETURN jsonb_build_object('status','cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_adult_trial_reservation(
  p_actor_id uuid, p_reservation_id uuid, p_new_class_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_new_class public.classes%ROWTYPE; v_old_class_id uuid; v_locked_class_count integer;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT class_id INTO v_old_class_id FROM public.adult_trial_reservations WHERE id=p_reservation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  IF v_old_class_id=p_new_class_id THEN RETURN jsonb_build_object('status','already_scheduled'); END IF;
  -- Always acquire both class locks in UUID order before locking the reservation.
  SELECT count(*) INTO v_locked_class_count FROM (
    SELECT c.id FROM public.classes c WHERE c.id IN (v_old_class_id,p_new_class_id)
    ORDER BY c.id FOR UPDATE
  ) locked_classes;
  IF v_locked_class_count<>2 THEN RETURN jsonb_build_object('status','class_not_available'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  IF v_reservation.class_id<>v_old_class_id THEN RETURN jsonb_build_object('status','reservation_changed_retry'); END IF;
  SELECT * INTO v_new_class FROM public.classes WHERE id=p_new_class_id;
  IF v_new_class.status<>'scheduled' OR NOT v_new_class.member_visible THEN RETURN jsonb_build_object('status','class_not_available'); END IF;
  PERFORM public.expire_adult_trial_holds(p_actor_id,p_new_class_id);
  SELECT * INTO v_new_class FROM public.classes WHERE id=p_new_class_id;
  IF v_new_class.booked_count>=v_new_class.capacity THEN RETURN jsonb_build_object('status','full'); END IF;
  v_old_class_id:=v_reservation.class_id;
  UPDATE public.classes SET booked_count=GREATEST(0,booked_count-1) WHERE id=v_old_class_id;
  UPDATE public.classes SET booked_count=booked_count+1 WHERE id=p_new_class_id;
  UPDATE public.adult_trial_reservations SET class_id=p_new_class_id,updated_at=now() WHERE id=v_reservation.id;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  UPDATE public.lead_journeys SET offered_class_id=p_new_class_id,updated_at=now() WHERE id=v_journey.id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_rescheduled','trial-rescheduled:' || v_reservation.id::text || ':' || p_new_class_id::text,
    v_journey.id,v_reservation.id,NULL,NULL,p_new_class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,NULL,v_reservation.state,jsonb_build_object('previous_class_id',v_old_class_id));
  RETURN jsonb_build_object('status','rescheduled','reservation_id',v_reservation.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_adult_trial_payment(
  p_actor_id uuid, p_reservation_id uuid, p_method text, p_provider text, p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_payment public.adult_trial_payments%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF p_method NOT IN ('card','apple_pay','bit','cash','other') OR p_provider NOT IN ('hyp','manual','other') THEN RETURN jsonb_build_object('status','invalid_input'); END IF;
  IF p_provider='hyp' THEN RETURN jsonb_build_object('status','use_hyp_checkout_claim'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_payment FROM public.adult_trial_payments WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('status','already_requested','payment_id',v_payment.id,'payment_status',v_payment.status); END IF;
  INSERT INTO public.adult_trial_payments(reservation_id,method,provider,status,idempotency_key)
    VALUES(v_reservation.id,p_method,p_provider,'requested',p_idempotency_key)
    RETURNING * INTO v_payment;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_payment_requested','trial-payment-requested:' || v_payment.id::text,
    v_journey.id,v_reservation.id,v_payment.id,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,v_payment.method,v_payment.status);
  RETURN jsonb_build_object('status','requested','payment_id',v_payment.id,'payment_status',v_payment.status);
END;
$$;

-- This is the sole entry point for an Adult HYP checkout. The reservation row
-- serializes contenders, and the partial unique index is the backstop if a
-- future caller bypasses that intended path.
CREATE OR REPLACE FUNCTION public.claim_adult_trial_hyp_checkout(
  p_actor_id uuid, p_reservation_id uuid, p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reservation public.adult_trial_reservations%ROWTYPE;
  v_journey public.lead_journeys%ROWTYPE;
  v_payment public.adult_trial_payments%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF length(trim(COALESCE(p_idempotency_key,''))) = 0 THEN RETURN jsonb_build_object('status','invalid_input'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;

  SELECT * INTO v_payment FROM public.adult_trial_payments
    WHERE reservation_id=v_reservation.id AND provider='hyp' AND status='paid'
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('status','already_paid','payment_id',v_payment.id); END IF;

  SELECT * INTO v_payment FROM public.adult_trial_payments
    WHERE reservation_id=v_reservation.id AND provider='hyp' AND status IN ('checkout_creating','pending')
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_payment.status='checkout_creating' AND v_payment.updated_at < now() - interval '10 minutes' THEN
      UPDATE public.adult_trial_payments SET status='failed',provider_status='checkout_claim_timed_out',updated_at=now()
        WHERE id=v_payment.id AND status='checkout_creating';
    ELSIF v_payment.status='pending' AND NULLIF(v_payment.metadata->>'payment_url','') IS NOT NULL THEN
      RETURN jsonb_build_object('status','ready','payment_id',v_payment.id,'checkout_url',v_payment.metadata->>'payment_url');
    ELSE
      RETURN jsonb_build_object('status','checkout_in_progress','payment_id',v_payment.id);
    END IF;
  END IF;

  INSERT INTO public.adult_trial_payments(reservation_id,method,provider,status,idempotency_key)
    VALUES(v_reservation.id,'card','hyp','checkout_creating',p_idempotency_key)
    RETURNING * INTO v_payment;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_payment_requested','trial-payment-requested:' || v_payment.id::text,
    v_journey.id,v_reservation.id,v_payment.id,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,v_payment.method,v_payment.status);
  RETURN jsonb_build_object('status','checkout_claimed','payment_id',v_payment.id);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_payment FROM public.adult_trial_payments
    WHERE reservation_id=p_reservation_id AND provider='hyp' AND status IN ('checkout_creating','pending')
    ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object('status','checkout_in_progress','payment_id',v_payment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_adult_trial_payment(
  p_actor_id uuid, p_payment_id uuid, p_verified boolean, p_provider_payment_id text DEFAULT NULL,
  p_provider_session_id text DEFAULT NULL, p_provider_status text DEFAULT NULL,
  p_provider_amount numeric DEFAULT NULL, p_provider_currency text DEFAULT NULL,
  p_provider_order_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payment public.adult_trial_payments%ROWTYPE; v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_class public.classes%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF NOT p_verified THEN RETURN jsonb_build_object('status','verification_required'); END IF;
  -- Identify first without locking, then use the same class -> reservation ->
  -- payment order as cancellation/expiry before changing payment state.
  SELECT * INTO v_payment FROM public.adult_trial_payments WHERE id=p_payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','payment_not_found'); END IF;
  SELECT c.* INTO v_class FROM public.classes c JOIN public.adult_trial_reservations r ON r.class_id=c.id
    WHERE r.id=v_payment.reservation_id FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=v_payment.reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_payment FROM public.adult_trial_payments WHERE id=p_payment_id FOR UPDATE;
  IF v_payment.reservation_id<>v_reservation.id THEN RETURN jsonb_build_object('status','payment_changed_retry'); END IF;
  IF v_payment.status='paid' THEN RETURN jsonb_build_object('status','already_paid','payment_id',v_payment.id); END IF;
  IF v_payment.provider='hyp' THEN
    IF v_payment.status <> 'pending' THEN RETURN jsonb_build_object('status','payment_not_pending'); END IF;
    IF p_provider_order_id IS DISTINCT FROM v_payment.id::text
      OR p_provider_amount IS DISTINCT FROM v_payment.amount
      OR upper(COALESCE(p_provider_currency,'')) <> v_payment.currency THEN
      RETURN jsonb_build_object('status','provider_reconciliation_failed');
    END IF;
  END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  UPDATE public.adult_trial_payments SET status='paid',paid_at=now(),confirmed_at=now(),confirmed_by=p_actor_id,
    provider_payment_id=COALESCE(p_provider_payment_id,provider_payment_id),provider_session_id=COALESCE(p_provider_session_id,provider_session_id),
    provider_status=COALESCE(p_provider_status,provider_status),updated_at=now() WHERE id=v_payment.id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_payment_received','trial-payment-received:' || v_payment.id::text,
    v_journey.id,v_reservation.id,v_payment.id,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,v_payment.method,'paid');
  RETURN jsonb_build_object('status','paid','payment_id',v_payment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_adult_trial_payment(
  p_actor_id uuid, p_payment_id uuid, p_provider_status text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payment public.adult_trial_payments%ROWTYPE; v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_class public.classes%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT * INTO v_payment FROM public.adult_trial_payments WHERE id=p_payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','payment_not_found'); END IF;
  SELECT c.* INTO v_class FROM public.classes c JOIN public.adult_trial_reservations r ON r.class_id=c.id
    WHERE r.id=v_payment.reservation_id FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=v_payment.reservation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_payment FROM public.adult_trial_payments WHERE id=p_payment_id FOR UPDATE;
  IF v_payment.reservation_id<>v_reservation.id THEN RETURN jsonb_build_object('status','payment_changed_retry'); END IF;
  IF v_payment.status='paid' THEN RETURN jsonb_build_object('status','already_paid'); END IF;
  IF v_payment.status IN ('failed','cancelled') THEN RETURN jsonb_build_object('status','already_final'); END IF;
  UPDATE public.adult_trial_payments SET status='failed',provider_status=COALESCE(p_provider_status,provider_status),updated_at=now() WHERE id=v_payment.id;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,'trial_payment_failed','trial-payment-failed:' || v_payment.id::text,
    v_journey.id,v_reservation.id,v_payment.id,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,v_payment.method,'failed');
  RETURN jsonb_build_object('status','failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_adult_trial_attendance(
  p_actor_id uuid, p_reservation_id uuid, p_attendance_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reservation public.adult_trial_reservations%ROWTYPE; v_journey public.lead_journeys%ROWTYPE; v_event text; v_class public.classes%ROWTYPE;
BEGIN
  IF NOT (public.has_role(p_actor_id,'admin') OR public.has_role(p_actor_id,'instructor')) THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF p_attendance_status NOT IN ('attended','no_show','cancelled') THEN RETURN jsonb_build_object('status','invalid_status'); END IF;
  SELECT c.* INTO v_class FROM public.classes c
    JOIN public.adult_trial_reservations r ON r.class_id=c.id
    WHERE r.id=p_reservation_id FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  SELECT * INTO v_reservation FROM public.adult_trial_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.state NOT IN ('hold','booked') THEN RETURN jsonb_build_object('status','reservation_not_active'); END IF;
  IF v_reservation.attendance_status=p_attendance_status THEN RETURN jsonb_build_object('status','already_finalized'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=v_reservation.lead_journey_id;
  UPDATE public.adult_trial_reservations SET attendance_status=p_attendance_status,
    state=CASE WHEN p_attendance_status='cancelled' THEN 'cancelled' ELSE state END,
    hold_expires_at=CASE WHEN p_attendance_status='cancelled' THEN NULL ELSE hold_expires_at END,
    cancelled_at=CASE WHEN p_attendance_status='cancelled' THEN now() ELSE cancelled_at END,
    attendance_marked_at=now(),attendance_marked_by=p_actor_id,updated_at=now()
    WHERE id=v_reservation.id;
  IF p_attendance_status='cancelled' THEN
    UPDATE public.adult_trial_payments SET status='cancelled',provider_status='reservation_cancelled',updated_at=now()
      WHERE reservation_id=v_reservation.id AND provider='hyp' AND status IN ('checkout_creating','pending');
    UPDATE public.classes SET booked_count=GREATEST(0,booked_count-1) WHERE id=v_reservation.class_id;
  END IF;
  UPDATE public.lead_journeys SET state=CASE p_attendance_status WHEN 'attended' THEN 'trial_attended' WHEN 'no_show' THEN 'trial_no_show' ELSE 'trial_cancelled' END,
    continuation_outcome=CASE WHEN p_attendance_status='attended' THEN 'pending' ELSE continuation_outcome END,
    next_action=CASE WHEN p_attendance_status='attended' THEN 'reply' ELSE next_action END,updated_at=now() WHERE id=v_journey.id;
  v_event:=CASE p_attendance_status WHEN 'attended' THEN 'trial_attended' WHEN 'no_show' THEN 'trial_no_show' ELSE 'trial_cancelled' END;
  PERFORM public.adult_trial_emit_event(v_reservation.studio_id,v_event,v_event || ':' || v_reservation.id::text,
    v_journey.id,v_reservation.id,NULL,NULL,v_reservation.class_id,v_journey.service,v_journey.locality,v_journey.source,
    v_reservation.booking_route,NULL,p_attendance_status);
  RETURN jsonb_build_object('status','ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.link_adult_prospect_to_member(
  p_actor_id uuid, p_lead_journey_id uuid, p_member_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_journey public.lead_journeys%ROWTYPE; v_recipient public.communication_recipients%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id=p_member_id) THEN RETURN jsonb_build_object('status','member_not_found'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=p_lead_journey_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lead_not_found'); END IF;
  IF v_journey.linked_member_id IS NOT NULL AND v_journey.linked_member_id<>p_member_id THEN RETURN jsonb_build_object('status','already_linked'); END IF;
  SELECT * INTO v_recipient FROM public.communication_recipients WHERE id=v_journey.communication_recipient_id FOR UPDATE;
  IF v_recipient.member_id IS NOT NULL AND v_recipient.member_id<>p_member_id THEN RETURN jsonb_build_object('status','recipient_already_linked'); END IF;
  UPDATE public.lead_journeys SET linked_member_id=p_member_id,updated_at=now() WHERE id=v_journey.id;
  UPDATE public.communication_recipients SET member_id=p_member_id,updated_at=now() WHERE id=v_journey.communication_recipient_id AND member_id IS NULL;
  PERFORM public.adult_trial_emit_event(v_journey.studio_id,'prospect_linked_to_member','prospect-linked:' || v_journey.id::text || ':' || p_member_id::text,
    v_journey.id,NULL,NULL,p_member_id,NULL,v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,NULL);
  RETURN jsonb_build_object('status','linked');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_adult_trial_continuation(
  p_actor_id uuid, p_lead_journey_id uuid, p_outcome text, p_package_payment_id uuid DEFAULT NULL, p_trial_payment_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_journey public.lead_journeys%ROWTYPE; v_trial_payment public.adult_trial_payments%ROWTYPE; v_payment public.payments%ROWTYPE; v_reservation public.adult_trial_reservations%ROWTYPE;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF p_outcome NOT IN ('pending','purchased','did_not_purchase','unknown') THEN RETURN jsonb_build_object('status','invalid_outcome'); END IF;
  SELECT * INTO v_journey FROM public.lead_journeys WHERE id=p_lead_journey_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','lead_not_found'); END IF;
  IF p_outcome='purchased' THEN
    IF v_journey.linked_member_id IS NULL OR p_package_payment_id IS NULL THEN RETURN jsonb_build_object('status','member_and_verified_payment_required'); END IF;
    SELECT * INTO v_reservation FROM public.adult_trial_reservations
      WHERE lead_journey_id=v_journey.id AND attendance_status='attended'
      ORDER BY attendance_marked_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','attended_trial_required'); END IF;
    SELECT * INTO v_payment FROM public.payments
      WHERE id=p_package_payment_id AND member_id=v_journey.linked_member_id
        AND status='paid' AND confirmed_at IS NOT NULL AND amount > 0;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','verified_package_payment_required'); END IF;
    IF p_trial_payment_id IS NOT NULL THEN
      SELECT p.* INTO v_trial_payment FROM public.adult_trial_payments p
        JOIN public.adult_trial_reservations r ON r.id=p.reservation_id
        WHERE p.id=p_trial_payment_id AND p.status='paid' AND r.lead_journey_id=v_journey.id
        FOR UPDATE OF p;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','verified_trial_payment_required'); END IF;
      IF v_trial_payment.trial_credit_applied_to_payment_id IS NOT NULL AND v_trial_payment.trial_credit_applied_to_payment_id<>p_package_payment_id THEN RETURN jsonb_build_object('status','trial_credit_already_applied'); END IF;
      UPDATE public.adult_trial_payments SET trial_credit_applied_to_payment_id=p_package_payment_id,updated_at=now() WHERE id=v_trial_payment.id;
      PERFORM public.adult_trial_emit_event(v_journey.studio_id,'trial_credit_applied','trial-credit-applied:' || v_trial_payment.id::text,
        v_journey.id,v_trial_payment.reservation_id,v_trial_payment.id,v_journey.linked_member_id,NULL,v_journey.service,v_journey.locality,v_journey.source,NULL,NULL,'paid',
        jsonb_build_object('package_payment_id',p_package_payment_id));
    END IF;
    PERFORM public.adult_trial_emit_event(v_journey.studio_id,'package_purchased','package-purchased:' || p_package_payment_id::text || ':' || v_journey.id::text,
      v_journey.id,NULL,NULL,v_journey.linked_member_id,NULL,v_journey.service,v_journey.locality,v_journey.source,NULL,v_payment.method,'paid');
    PERFORM public.adult_trial_emit_event(v_journey.studio_id,'active_paying_adult_created','active-paying-adult:' || v_journey.id::text || ':' || p_package_payment_id::text,
      v_journey.id,NULL,NULL,v_journey.linked_member_id,NULL,v_journey.service,v_journey.locality,v_journey.source,NULL,v_payment.method,'paid');
  END IF;
  UPDATE public.lead_journeys SET continuation_outcome=p_outcome,state=CASE WHEN p_outcome='purchased' THEN 'package_purchased' ELSE state END,
    next_action=CASE WHEN p_outcome='purchased' THEN 'none' ELSE next_action END,updated_at=now() WHERE id=v_journey.id;
  RETURN jsonb_build_object('status','ok');
END;
$$;

CREATE OR REPLACE VIEW public.adult_acquisition_funnel_export WITH (security_invoker = true) AS
SELECT
  event_type,occurred_at,service,locality,source,booking_route,payment_method,payment_status,
  lead_journey_id,reservation_id,trial_payment_id,member_id,class_id,metadata
FROM public.adult_acquisition_events;

REVOKE ALL ON FUNCTION public.adult_trial_emit_event(uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_adult_trial_holds(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_adult_inquiry(uuid,text,text,text,text,text,text,text,jsonb,text,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_adult_trial_class(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_adult_trial(uuid,uuid,uuid,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_adult_trial_reservation(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_adult_trial_reservation(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_adult_trial_payment(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_adult_trial_hyp_checkout(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_adult_trial_payment(uuid,uuid,boolean,text,text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_adult_trial_payment(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_adult_trial_attendance(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_adult_prospect_to_member(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_adult_trial_continuation(uuid,uuid,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_adult_trial_holds(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_adult_inquiry(uuid,text,text,text,text,text,text,text,jsonb,text,uuid,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.offer_adult_trial_class(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_adult_trial(uuid,uuid,uuid,text,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_adult_trial_reservation(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_adult_trial_reservation(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_adult_trial_payment(uuid,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_adult_trial_hyp_checkout(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_adult_trial_payment(uuid,uuid,boolean,text,text,text,numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_adult_trial_payment(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_adult_trial_attendance(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_adult_prospect_to_member(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_adult_trial_continuation(uuid,uuid,text,uuid,uuid) TO service_role;
GRANT SELECT ON public.adult_acquisition_funnel_export TO authenticated, service_role;

COMMENT ON TABLE public.adult_trial_reservations IS 'No-auth adult trial reservations. Active rows consume classes.booked_count atomically.';
COMMENT ON TABLE public.adult_trial_payments IS '₪80 adult trial payment states. Manual selection is never proof of payment.';
COMMENT ON TABLE public.adult_acquisition_events IS 'Append-only, PII-minimized Adult acquisition measurement. No Meta delivery in P0.';
