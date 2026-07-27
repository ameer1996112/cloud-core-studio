-- Record an optional Concierge onboarding deferral without adding a new table or workflow.

ALTER TABLE public.personal_concierge_preference_evidence
DROP CONSTRAINT IF EXISTS personal_concierge_preference_evidence_preference_key_check;

ALTER TABLE public.personal_concierge_preference_evidence
ADD CONSTRAINT personal_concierge_preference_evidence_preference_key_check
CHECK (
  preference_key IN (
    'class_style',
    'time_window',
    'instructor',
    'location',
    'communication_pace',
    'member_intention',
    'onboarding_status'
  )
);
