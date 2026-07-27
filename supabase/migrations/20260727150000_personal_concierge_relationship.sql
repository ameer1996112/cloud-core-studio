-- One member relationship for the Cloud & Core Personal Concierge.
-- Expand-only: this migration creates no external delivery and changes no automation mode.

CREATE TABLE IF NOT EXISTS public.personal_concierge_relationships (
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'first_booking' CHECK (
    stage IN ('first_booking','first_attendance','learning','established','returning')
  ),
  personalization_paused boolean NOT NULL DEFAULT false,
  current_experience_state text NOT NULL DEFAULT 'quiet' CHECK (
    current_experience_state IN (
      'first_visit_preparation','first_visit_reflection','next_class','attention_required',
      'recovery_options','personal_recommendation','return_gently','weekly_rhythm',
      'human_care_active','quiet'
    )
  ),
  last_meaningful_contact_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.personal_concierge_preference_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  preference_key text NOT NULL CHECK (
    preference_key IN (
      'class_style','time_window','instructor','location','communication_pace','member_intention'
    )
  ),
  preference_value text NOT NULL,
  evidence_source text NOT NULL CHECK (evidence_source IN ('member','staff','booking','attendance')),
  confidence text NOT NULL CHECK (confidence IN ('known','likely')),
  observation_count integer NOT NULL DEFAULT 1 CHECK (observation_count > 0),
  member_visible boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (
    studio_id, member_id, preference_key, preference_value, removed_at
  )
);

CREATE INDEX IF NOT EXISTS personal_concierge_preferences_member_idx
ON public.personal_concierge_preference_evidence(studio_id, member_id, preference_key)
WHERE removed_at IS NULL;

ALTER TABLE public.personal_concierge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_concierge_preference_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own concierge relationship"
ON public.personal_concierge_relationships FOR SELECT TO authenticated
USING (member_id = auth.uid());

CREATE POLICY "members read own concierge preferences"
ON public.personal_concierge_preference_evidence FOR SELECT TO authenticated
USING (member_id = auth.uid() AND member_visible = true);

CREATE POLICY "members add own explicit concierge preferences"
ON public.personal_concierge_preference_evidence FOR INSERT TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND evidence_source = 'member'
  AND confidence = 'known'
  AND member_visible = true
);

CREATE POLICY "members correct own explicit concierge preferences"
ON public.personal_concierge_preference_evidence FOR UPDATE TO authenticated
USING (member_id = auth.uid() AND evidence_source = 'member' AND member_visible = true)
WITH CHECK (member_id = auth.uid() AND evidence_source = 'member' AND member_visible = true);

INSERT INTO public.personal_concierge_relationships (studio_id, member_id, stage)
SELECT
  s.id,
  m.id,
  CASE
    WHEN COALESCE(m.attendance_count, 0) = 0 THEN 'first_booking'
    WHEN COALESCE(m.attendance_count, 0) = 1 THEN 'first_attendance'
    ELSE 'established'
  END
FROM public.studios s
CROSS JOIN public.members m
WHERE s.slug = 'cloud-core'
ON CONFLICT (studio_id, member_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_personal_concierge_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.personal_concierge_relationships (studio_id, member_id)
  SELECT id, NEW.id FROM public.studios WHERE slug = 'cloud-core'
  ON CONFLICT (studio_id, member_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_create_personal_concierge_relationship ON public.members;
CREATE TRIGGER members_create_personal_concierge_relationship
AFTER INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.ensure_personal_concierge_relationship();

REVOKE INSERT, UPDATE, DELETE ON public.personal_concierge_relationships FROM authenticated;
GRANT SELECT ON public.personal_concierge_relationships TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_personal_concierge_pause(p_paused boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  UPDATE public.personal_concierge_relationships
  SET personalization_paused = p_paused,
      version = version + 1,
      updated_at = now()
  WHERE member_id = v_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'concierge_relationship_not_found';
  END IF;

  RETURN p_paused;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_personal_concierge_pause(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_personal_concierge_pause(boolean) TO authenticated;
