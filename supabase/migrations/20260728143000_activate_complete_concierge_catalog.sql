CREATE TABLE IF NOT EXISTS public.notification_copy_review_evidence (
  event_type text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('he', 'ar', 'en')),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  review_reference text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  PRIMARY KEY (event_type, locale, content_hash)
);

ALTER TABLE public.notification_copy_review_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage notification copy review evidence"
  ON public.notification_copy_review_evidence;
CREATE POLICY "admins manage notification copy review evidence"
  ON public.notification_copy_review_evidence
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.notification_copy_review_evidence TO authenticated;
GRANT ALL ON public.notification_copy_review_evidence TO service_role;

INSERT INTO public.notification_copy_review_evidence (
  event_type, locale, content_hash, review_reference, reviewed_at
)
VALUES
  ('weekly_schedule', 'he', '45e35d23a3236d87acf8c39474c77e65dca44dceefdd90a2fa32eabe7872d9bd', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z'),
  ('weekly_schedule', 'ar', 'aec3a122995ba310174b90cf5de652d59f5548014923e9ebb03cacfe462724fe', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z'),
  ('weekly_schedule', 'en', 'f45b074e72a89b8d7163f9b2ed34a149cc7bb6af80d841534b10c7e41611c542', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z'),
  ('daily_briefing', 'he', 'b26ade0479384c917ccac501f739d41e0dfb9ab1523238307de3b606f1a67abf', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z'),
  ('daily_briefing', 'ar', '901d86e7a031034b80008f4d036df5df07c745f8eb986e1331faa38ca25c9c57', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z'),
  ('daily_briefing', 'en', 'e12e374e8655fc2b6afd47262e79a053d571efe67c3f33c1f9ad1f689fccd7ec', 'catalog-spec-and-standards-review', '2026-07-28T12:00:00Z')
ON CONFLICT DO NOTHING;

-- Register the two scheduled customer journeys on Unified Messaging. Neither
-- journey uses WhatsApp. Copy review derives from complete localized evidence.
INSERT INTO public.notification_event_rollouts (
  event_type, enabled, allowlist_only, copy_reviewed, enabled_channels
)
SELECT
  event_type,
  false,
  true,
  (
    SELECT count(DISTINCT evidence.locale) = 3
    FROM public.notification_copy_review_evidence evidence
    WHERE evidence.event_type = required.event_type
  ),
  channels
FROM (
  VALUES
    ('weekly_schedule', ARRAY['in_app', 'push']::text[]),
    ('daily_briefing', ARRAY['in_app']::text[])
) AS required(event_type, channels)
ON CONFLICT (event_type) DO NOTHING;

-- Activation never grants review approval to existing journeys. Abort the
-- release if any required localized copy has not already passed its gate.
DO $$
DECLARE
  v_unreviewed text[];
BEGIN
  SELECT array_agg(event_type ORDER BY event_type)
  INTO v_unreviewed
  FROM unnest(ARRAY[
    'weekly_schedule',
    'daily_briefing',
    'class_recommendation',
    'trial_followup',
    'retention_reminder'
  ]::text[]) AS required(event_type)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notification_event_rollouts rollout
    WHERE rollout.event_type = required.event_type
      AND rollout.copy_reviewed = true
  );

  IF v_unreviewed IS NOT NULL THEN
    RAISE EXCEPTION 'Concierge activation blocked; copy review missing for %', v_unreviewed;
  END IF;
END;
$$;

UPDATE public.notification_event_rollouts
SET
  enabled = true,
  allowlist_only = false,
  enabled_at = COALESCE(enabled_at, now()),
  updated_at = now()
WHERE event_type IN (
  'weekly_schedule',
  'daily_briefing',
  'class_recommendation',
  'trial_followup',
  'retention_reminder'
)
  AND copy_reviewed = true;
