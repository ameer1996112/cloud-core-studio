-- Expand-only hardening for selected Concierge presentation versions and legacy compatibility.
-- This migration does not activate live delivery or mutate any remote provider.

-- An approved source template must always carry review provenance. Historical seeds that
-- predated this invariant are made draft so an administrator can review and approve them.
UPDATE public.concierge_template_versions
SET lifecycle_status = 'draft',
    approved_by = NULL,
    approved_at = NULL
WHERE lifecycle_status = 'approved'
  AND (approved_by IS NULL OR approved_at IS NULL);

ALTER TABLE public.concierge_template_versions
  DROP CONSTRAINT IF EXISTS concierge_approved_requires_provenance;
ALTER TABLE public.concierge_template_versions
  ADD CONSTRAINT concierge_approved_requires_provenance
  CHECK (
    lifecycle_status <> 'approved'
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ) NOT VALID;
ALTER TABLE public.concierge_template_versions
  VALIDATE CONSTRAINT concierge_approved_requires_provenance;

-- The v2 source migration omitted these 15 WhatsApp variants. They are intentionally
-- draft with null provenance until an administrator approves this exact content hash.
WITH missing_catalog AS (
  SELECT *
  FROM jsonb_to_recordset($missing_catalog$[{"template_key":"payment_one_time_succeeded","locale":"en","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"Hi {{member_name}}, your payment to Cloud & Core was completed successfully. You can review the payment details in the app.","content_hash":"f4050711b0648736b3edbb2ae13a60f28b0fa3423b17b82572b5fc5abb17c915","first_person_voice_approved":false},{"template_key":"payment_one_time_succeeded","locale":"he","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"היי {{member_name}}, התשלום שלך ל-Cloud & Core הושלם בהצלחה. אפשר לצפות בפרטי התשלום באפליקציה.","content_hash":"0064d08b8ad9a253a9899f187dbea25abdee935e2bc6154832f06a50cd3bcf9e","first_person_voice_approved":false},{"template_key":"payment_one_time_succeeded","locale":"ar","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"مرحباً {{member_name}}، تم إتمام دفعتك إلى Cloud & Core بنجاح. يمكنك مراجعة تفاصيل الدفع في التطبيق.","content_hash":"890bacc517c51f42edbf6dda8d08cb30aa8566a361269afcd3cd888f08953036","first_person_voice_approved":false},{"template_key":"payment_subscription_renewal_succeeded","locale":"en","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"Hi {{member_name}}, your Cloud & Core membership renewal was completed successfully. Your membership remains active.","content_hash":"b16bd4deb3a23779ad471fe356945ee6bfb54702f10160af4e82c5410f2c17e0","first_person_voice_approved":false},{"template_key":"payment_subscription_renewal_succeeded","locale":"he","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"היי {{member_name}}, חידוש המינוי שלך ב-Cloud & Core הושלם בהצלחה. המינוי שלך ממשיך להיות פעיל.","content_hash":"0fb211ab7c8e7395cd8fe81046024402d1947e8506e7f28d0ab3a3a753b968b6","first_person_voice_approved":false},{"template_key":"payment_subscription_renewal_succeeded","locale":"ar","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"مرحباً {{member_name}}، تم تجديد عضويتك في Cloud & Core بنجاح. عضويتك ما زالت فعالة.","content_hash":"cc833f96912215a8b8a35e2b088df6212fd00ef8add3bce08d9aa5584012cea9","first_person_voice_approved":false},{"template_key":"payment_requires_action","locale":"en","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"Hi {{member_name}}, your Cloud & Core payment needs your attention. Open the app to review the payment and complete the required step.","content_hash":"5be8993736bd297068abed38e7e31d3764c674aa1f44adb5006b2fcae1929774","first_person_voice_approved":false},{"template_key":"payment_requires_action","locale":"he","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"היי {{member_name}}, התשלום שלך ל-Cloud & Core דורש טיפול. אפשר לפתוח את האפליקציה כדי לבדוק את התשלום ולהשלים את הפעולה הנדרשת.","content_hash":"9d1c2fffaef4fbd8f0fb00fc7643c2a3c5bcd56e0dfdb298b9a9b1b6a66a4e31","first_person_voice_approved":false},{"template_key":"payment_requires_action","locale":"ar","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"مرحباً {{member_name}}، دفعتك إلى Cloud & Core تحتاج إلى انتباهك. افتحي التطبيق لمراجعة الدفع وإكمال الخطوة المطلوبة.","content_hash":"b84e578b8951f858a6ee2d0eb3f41651d8744ef782b4ec619c9b988c75a00e7a","first_person_voice_approved":false},{"template_key":"payment_terminally_failed","locale":"en","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"Hi {{member_name}}, your Cloud & Core payment could not be completed. Open the app to update your payment method or contact the studio for help.","content_hash":"78ea0e429f845c1fec94bca23cc119f75f68c4c856da97f3ef398ce795ea9f57","first_person_voice_approved":false},{"template_key":"payment_terminally_failed","locale":"he","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"היי {{member_name}}, לא הצלחנו להשלים את התשלום שלך ל-Cloud & Core. אפשר לעדכן את אמצעי התשלום באפליקציה או לפנות לסטודיו לעזרה.","content_hash":"2b35da99c2dd6ca90dcb6f7ef20bfe2f5b631869db64520c2ed0040a610eb041","first_person_voice_approved":false},{"template_key":"payment_terminally_failed","locale":"ar","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"مرحباً {{member_name}}، تعذر إتمام دفعتك إلى Cloud & Core. افتحي التطبيق لتحديث وسيلة الدفع أو تواصلي مع الاستوديو للمساعدة.","content_hash":"a531b4891b2ecd8738c87c536e81abb0b980b18a4e2fd24ad04543d59eb37789","first_person_voice_approved":false},{"template_key":"recommendation","locale":"en","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"Hi {{member_name}}, we found a Cloud & Core class that may suit you. Open the app to review the recommendation and current availability.","content_hash":"81bdc5f709b3af591991a69bcead1e6702b0ff9b0a610cd5145ee3880e48ac9e","first_person_voice_approved":false},{"template_key":"recommendation","locale":"he","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"היי {{member_name}}, מצאנו שיעור ב-Cloud & Core שעשוי להתאים לך. אפשר לפתוח את האפליקציה כדי לצפות בהמלצה ובזמינות העדכנית.","content_hash":"74e4682885df59f780fb7ab82a82f4065248a1514412a4dcc7a5faf9ac2a2301","first_person_voice_approved":false},{"template_key":"recommendation","locale":"ar","version":1,"required_variables":["member_name"],"subject_template":null,"body_template":"مرحباً {{member_name}}، وجدنا حصة في Cloud & Core قد تناسبك. افتحي التطبيق لمراجعة التوصية والتوفر الحالي.","content_hash":"f73046fdb4fe3aa12702c9f4e972b5d7177efd79d46855edd699be0a85ff5f25","first_person_voice_approved":false}]$missing_catalog$::jsonb) AS row(
    template_key text,
    locale text,
    version integer,
    required_variables text[],
    subject_template text,
    body_template text,
    content_hash text,
    first_person_voice_approved boolean
  )
)
INSERT INTO public.concierge_template_versions(
  studio_id, template_key, channel, locale, version, lifecycle_status,
  subject_template, body_template, required_variables, content_hash,
  first_person_voice_approved, approved_by, approved_at
)
SELECT
  studio.id, catalog.template_key, 'whatsapp', catalog.locale, catalog.version,
  'draft',
  catalog.subject_template, catalog.body_template, catalog.required_variables,
  catalog.content_hash,
  catalog.first_person_voice_approved, NULL, NULL
FROM public.studios studio
CROSS JOIN missing_catalog catalog
ON CONFLICT (studio_id, template_key, channel, locale, version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.concierge_journey_for_template(p_template_key text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_template_key
    WHEN 'booking_confirmed_first' THEN 'booking'
    WHEN 'booking_confirmed_repeat' THEN 'booking'
    WHEN 'booking_cancelled' THEN 'booking_cancellation'
    WHEN 'class_cancelled' THEN 'class_change'
    WHEN 'class_time_changed' THEN 'class_change'
    WHEN 'payment_outcome' THEN 'payment_outcome'
    WHEN 'payment_one_time_succeeded' THEN 'payment_outcome'
    WHEN 'payment_subscription_renewal_succeeded' THEN 'payment_outcome'
    WHEN 'payment_requires_action' THEN 'payment_outcome'
    WHEN 'payment_terminally_failed' THEN 'payment_outcome'
    WHEN 'payment_recovered' THEN 'payment_outcome'
    WHEN 'weekly_schedule' THEN 'weekly_schedule'
    WHEN 'retention' THEN 'retention'
    WHEN 'waitlist_offer' THEN 'waitlist'
    WHEN 'lead_to_trial' THEN 'lead_to_trial'
    WHEN 'recommendation' THEN 'recommendation'
    WHEN 'daily_briefing' THEN 'daily_briefing'
    ELSE p_template_key
  END
$$;

CREATE OR REPLACE FUNCTION public.concierge_legacy_email_event(p_template_key text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_template_key
    WHEN 'booking_confirmed_first' THEN 'booking_confirmed'
    WHEN 'booking_confirmed_repeat' THEN 'booking_confirmed'
    WHEN 'booking_cancelled' THEN 'booking_cancelled'
    WHEN 'class_cancelled' THEN 'class_cancelled_by_admin'
    WHEN 'class_time_changed' THEN 'class_time_changed'
    WHEN 'payment_one_time_succeeded' THEN 'payment_confirmed'
    WHEN 'payment_subscription_renewal_succeeded' THEN 'subscription_renewal_succeeded'
    WHEN 'payment_requires_action' THEN 'payment_failed'
    WHEN 'payment_terminally_failed' THEN 'payment_failed'
    WHEN 'payment_recovered' THEN 'payment_confirmed'
    WHEN 'waitlist_offer' THEN 'waitlist_spot_available'
    WHEN 'lead_to_trial' THEN 'trial_followup'
    WHEN 'recommendation' THEN 'class_recommendation'
    WHEN 'retention' THEN 'retention_reminder'
    ELSE 'human_handoff'
  END
$$;

CREATE OR REPLACE FUNCTION public.concierge_action_url(
  p_template_key text,
  p_presentation_version integer
)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_presentation_version = 2 AND p_template_key IN (
      'booking_confirmed_first','booking_confirmed_repeat'
    ) THEN 'https://cloudandcorestudio.com/member/bookings'
    WHEN p_presentation_version = 2 AND p_template_key IN (
      'payment_requires_action','payment_terminally_failed'
    ) THEN 'https://cloudandcorestudio.com/member/packages'
    WHEN p_presentation_version = 2 AND p_template_key IN (
      'waitlist_offer','recommendation','weekly_schedule'
    ) THEN 'https://cloudandcorestudio.com/member/schedule'
    WHEN p_presentation_version = 1 AND p_template_key IN (
      'booking_confirmed_first','booking_confirmed_repeat','booking_cancelled'
    ) THEN 'https://cloudandcorestudio.com/member/bookings'
    WHEN p_presentation_version = 1 AND p_template_key IN (
      'payment_one_time_succeeded','payment_subscription_renewal_succeeded',
      'payment_requires_action','payment_terminally_failed','payment_recovered'
    ) THEN 'https://cloudandcorestudio.com/member/packages'
    WHEN p_presentation_version = 1 AND p_template_key IN (
      'class_cancelled','class_time_changed','waitlist_offer','recommendation',
      'weekly_schedule','retention','lead_to_trial'
    ) THEN 'https://cloudandcorestudio.com/member/schedule'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.concierge_category_label(
  p_journey_type text,
  p_locale text
)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_journey_type
    WHEN 'booking' THEN CASE p_locale WHEN 'he' THEN 'פרטי ההזמנה' WHEN 'ar' THEN 'تفاصيل الحجز' ELSE 'Booking details' END
    WHEN 'booking_cancellation' THEN CASE p_locale WHEN 'he' THEN 'פרטי הביטול' WHEN 'ar' THEN 'تفاصيل الإلغاء' ELSE 'Cancellation details' END
    WHEN 'class_change' THEN CASE p_locale WHEN 'he' THEN 'עדכון שיעור' WHEN 'ar' THEN 'تحديث الحصة' ELSE 'Class update' END
    WHEN 'payment_outcome' THEN CASE p_locale WHEN 'he' THEN 'פרטי התשלום' WHEN 'ar' THEN 'تفاصيل الدفع' ELSE 'Payment details' END
    WHEN 'weekly_schedule' THEN CASE p_locale WHEN 'he' THEN 'המערכת שלך' WHEN 'ar' THEN 'جدولك' ELSE 'Your schedule' END
    WHEN 'waitlist' THEN CASE p_locale WHEN 'he' THEN 'רשימת המתנה' WHEN 'ar' THEN 'قائمة الانتظار' ELSE 'Waitlist' END
    WHEN 'recommendation' THEN CASE p_locale WHEN 'he' THEN 'המלצה עבורך' WHEN 'ar' THEN 'توصية لك' ELSE 'A recommendation for you' END
    WHEN 'lead_to_trial' THEN CASE p_locale WHEN 'he' THEN 'ברוכה הבאה' WHEN 'ar' THEN 'مرحباً بك' ELSE 'Welcome' END
    WHEN 'daily_briefing' THEN CASE p_locale WHEN 'he' THEN 'העדכון שלך' WHEN 'ar' THEN 'تحديثك' ELSE 'Your update' END
    ELSE 'Cloud & Core'
  END
$$;

CREATE OR REPLACE FUNCTION public.concierge_action_label(
  p_template_key text,
  p_locale text
)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_template_key IN ('booking_confirmed_first','booking_confirmed_repeat')
      THEN CASE p_locale WHEN 'he' THEN 'צפייה בהזמנה' WHEN 'ar' THEN 'عرض الحجز' ELSE 'View booking' END
    WHEN p_template_key IN ('payment_requires_action','payment_terminally_failed')
      THEN CASE p_locale WHEN 'he' THEN 'בדיקת התשלום' WHEN 'ar' THEN 'مراجعة الدفع' ELSE 'Review payment' END
    WHEN p_template_key = 'waitlist_offer'
      THEN CASE p_locale WHEN 'he' THEN 'מימוש המקום' WHEN 'ar' THEN 'حجز المكان' ELSE 'Claim spot' END
    WHEN p_template_key = 'recommendation'
      THEN CASE p_locale WHEN 'he' THEN 'צפייה בהמלצה' WHEN 'ar' THEN 'عرض التوصية' ELSE 'View recommendation' END
    ELSE CASE p_locale WHEN 'he' THEN 'למערכת השעות' WHEN 'ar' THEN 'استكشاف الجدول' ELSE 'Explore schedule' END
  END
$$;

CREATE OR REPLACE FUNCTION public.concierge_fact_definitions(
  p_journey_type text,
  p_locale text
)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_journey_type IN ('booking','booking_cancellation','class_change') THEN
      jsonb_build_array(
        jsonb_build_object('key','class_name','label',CASE p_locale WHEN 'he' THEN 'שיעור' WHEN 'ar' THEN 'الحصة' ELSE 'Class' END,'ltr',false),
        jsonb_build_object('key','class_date','label',CASE p_locale WHEN 'he' THEN 'תאריך' WHEN 'ar' THEN 'التاريخ' ELSE 'Date' END,'ltr',true),
        jsonb_build_object('key','class_time','label',CASE p_locale WHEN 'he' THEN 'שעה' WHEN 'ar' THEN 'الوقت' ELSE 'Time' END,'ltr',true)
      )
    WHEN p_journey_type = 'payment_outcome' THEN
      jsonb_build_array(
        jsonb_build_object('key','amount','label',CASE p_locale WHEN 'he' THEN 'סכום' WHEN 'ar' THEN 'المبلغ' ELSE 'Amount' END,'ltr',true),
        jsonb_build_object('key','payment_date','label',CASE p_locale WHEN 'he' THEN 'תאריך' WHEN 'ar' THEN 'التاريخ' ELSE 'Date' END,'ltr',true)
      )
    WHEN p_journey_type = 'weekly_schedule' THEN
      jsonb_build_array(jsonb_build_object('key','week_of','label',CASE p_locale WHEN 'he' THEN 'שבוע של' WHEN 'ar' THEN 'أسبوع' ELSE 'Week of' END,'ltr',true))
    WHEN p_journey_type = 'waitlist' THEN
      jsonb_build_array(
        jsonb_build_object('key','class_name','label',CASE p_locale WHEN 'he' THEN 'שיעור' WHEN 'ar' THEN 'الحصة' ELSE 'Class' END,'ltr',false),
        jsonb_build_object('key','class_date','label',CASE p_locale WHEN 'he' THEN 'תאריך' WHEN 'ar' THEN 'التاريخ' ELSE 'Date' END,'ltr',true),
        jsonb_build_object('key','class_time','label',CASE p_locale WHEN 'he' THEN 'שעה' WHEN 'ar' THEN 'الوقت' ELSE 'Time' END,'ltr',true),
        jsonb_build_object('key','offer_expires_at','label',CASE p_locale WHEN 'he' THEN 'בתוקף עד' WHEN 'ar' THEN 'صالح حتى' ELSE 'Valid until' END,'ltr',true)
      )
    WHEN p_journey_type = 'recommendation' THEN
      jsonb_build_array(
        jsonb_build_object('key','recommendation_summary','label',CASE p_locale WHEN 'he' THEN 'המלצה' WHEN 'ar' THEN 'التوصية' ELSE 'Recommendation' END,'ltr',false),
        jsonb_build_object('key','class_name','label',CASE p_locale WHEN 'he' THEN 'שיעור' WHEN 'ar' THEN 'الحصة' ELSE 'Class' END,'ltr',false)
      )
    ELSE '[]'::jsonb
  END
$$;

-- Every candidate path, including a source approved after this migration runs, uses the
-- same complete presentation contract. The hash covers the canonical jsonb contract and
-- the email shell identity, while provider content remains separate exact evidence.
CREATE OR REPLACE FUNCTION public.concierge_presentation_contract(
  p_template_key text,
  p_channel text,
  p_locale text,
  p_source_content_hash text,
  p_presentation_version integer,
  p_provider_template_name text,
  p_provider_content_hash text
)
RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'schema','concierge_presentation_v' || p_presentation_version,
    'presentationKey',
      p_template_key || ':' || p_channel || ':v' || p_presentation_version,
    'eventType',CASE
      WHEN p_presentation_version = 1 OR p_channel = 'email'
      THEN public.concierge_legacy_email_event(p_template_key)
      ELSE NULL
    END,
    'actionUrl',public.concierge_action_url(p_template_key,p_presentation_version),
    'sourceContentHash',p_source_content_hash,
    'categoryLabel',CASE
      WHEN p_presentation_version = 2 AND p_channel = 'email'
      THEN public.concierge_category_label(
        public.concierge_journey_for_template(p_template_key),p_locale
      )
      ELSE NULL
    END,
    'actionLabel',CASE
      WHEN p_presentation_version = 2
       AND p_channel = 'email'
       AND public.concierge_action_url(p_template_key,2) IS NOT NULL
      THEN public.concierge_action_label(p_template_key,p_locale)
      ELSE NULL
    END,
    'facts',public.concierge_fact_definitions(
      public.concierge_journey_for_template(p_template_key),p_locale
    ),
    'providerTemplateName',CASE
      WHEN p_presentation_version = 2 AND p_channel = 'whatsapp'
      THEN p_provider_template_name
      ELSE NULL
    END,
    'providerContentHash',CASE
      WHEN p_presentation_version = 2 AND p_channel = 'whatsapp'
      THEN p_provider_content_hash
      ELSE NULL
    END,
    'header',CASE
      WHEN p_presentation_version = 2 AND p_channel = 'whatsapp'
      THEN jsonb_build_object(
        'url','https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png',
        'mimeType','image/png',
        'width',1200,
        'height',628,
        'sha256','b29c3947567fd874164ce7a7e24d1f230b6987183ea905fc13fbc7aebe830fb6'
      )
      ELSE NULL
    END
  ))
$$;

CREATE OR REPLACE FUNCTION public.concierge_presentation_hash(
  p_presentation_contract jsonb,
  p_email_shell_version integer,
  p_email_shell_hash text
)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT encode(digest(concat_ws(
    chr(31),
    'concierge-presentation-hash-v1',
    p_presentation_contract::text,
    COALESCE(p_email_shell_version::text,''),
    COALESCE(p_email_shell_hash,'')
  ),'sha256'),'hex')
$$;

CREATE TABLE IF NOT EXISTS public.concierge_delivery_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_type text NOT NULL,
  template_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app','push','email','whatsapp')),
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  source_template_id uuid NOT NULL
    REFERENCES public.concierge_template_versions(id) ON DELETE RESTRICT,
  source_template_version integer NOT NULL CHECK (source_template_version > 0),
  source_content_hash text NOT NULL,
  source_approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_approved_at timestamptz NOT NULL,
  presentation_version integer NOT NULL CHECK (presentation_version IN (1,2)),
  presentation_key text NOT NULL,
  presentation_hash text NOT NULL,
  presentation_contract jsonb NOT NULL,
  email_shell_version integer,
  email_shell_hash text,
  presentation_approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  presentation_approved_at timestamptz,
  provider_template_name text,
  provider_content_hash text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    channel = 'whatsapp'
    OR (provider_template_name IS NULL AND provider_content_hash IS NULL)
  ),
  CHECK (
    (channel = 'email' AND email_shell_version IS NOT NULL AND email_shell_hash IS NOT NULL)
    OR (channel <> 'email' AND email_shell_version IS NULL AND email_shell_hash IS NULL)
  ),
  CHECK (
    presentation_version = 1
    OR (presentation_approved_by IS NULL) = (presentation_approved_at IS NULL)
  ),
  UNIQUE (studio_id, source_template_id, presentation_version)
);

CREATE OR REPLACE FUNCTION public.prevent_concierge_delivery_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    to_jsonb(NEW) - 'presentation_approved_by' - 'presentation_approved_at'
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - 'presentation_approved_by' - 'presentation_approved_at'
  ) THEN
    RAISE EXCEPTION 'concierge_delivery_version_identity_is_immutable';
  END IF;
  IF (NEW.presentation_approved_by IS NULL) <>
     (NEW.presentation_approved_at IS NULL) THEN
    RAISE EXCEPTION 'concierge_presentation_approval_is_incomplete';
  END IF;
  IF OLD.presentation_approved_by IS NOT NULL
     AND (
       NEW.presentation_approved_by IS DISTINCT FROM OLD.presentation_approved_by
       OR NEW.presentation_approved_at IS DISTINCT FROM OLD.presentation_approved_at
     ) THEN
    RAISE EXCEPTION 'concierge_presentation_approval_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_concierge_delivery_identity_mutation
ON public.concierge_delivery_versions;
CREATE TRIGGER prevent_concierge_delivery_identity_mutation
BEFORE UPDATE ON public.concierge_delivery_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_concierge_delivery_identity_mutation();

CREATE TABLE IF NOT EXISTS public.concierge_trusted_provider_settings (
  studio_id uuid PRIMARY KEY REFERENCES public.studios(id) ON DELETE RESTRICT,
  whatsapp_waba_id text NOT NULL,
  configured_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  configured_at timestamptz NOT NULL DEFAULT now()
);

-- This is the confirmed production Cloud & Core account, not a deployment discovered by
-- scanning arbitrary WABAs. Provider evidence is always resolved through this setting.
INSERT INTO public.concierge_trusted_provider_settings(studio_id, whatsapp_waba_id)
SELECT studio.id, '1009561255148806'
FROM public.studios studio
WHERE studio.slug = 'cloud-core'
ON CONFLICT (studio_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.concierge_presentation_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  delivery_version_id uuid NOT NULL
    REFERENCES public.concierge_delivery_versions(id) ON DELETE RESTRICT,
  source_content_hash text NOT NULL,
  presentation_hash text NOT NULL,
  previewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  previewed_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS concierge_presentation_preview_audit_idx
ON public.concierge_presentation_previews(
  delivery_version_id, presentation_hash, approved_at DESC
);

CREATE TABLE IF NOT EXISTS public.concierge_delivery_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  journey_type text NOT NULL,
  template_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app','push','email','whatsapp')),
  locale text NOT NULL CHECK (locale IN ('ar','he','en')),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('test_only','live')),
  delivery_version_id uuid NOT NULL
    REFERENCES public.concierge_delivery_versions(id) ON DELETE RESTRICT,
  selected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  retired_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retired_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS concierge_one_active_delivery_selection
ON public.concierge_delivery_selections(
  studio_id, template_key, channel, locale, delivery_mode
)
WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS concierge_delivery_selection_version_idx
ON public.concierge_delivery_selections(delivery_version_id)
WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.concierge_delivery_selection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL
    REFERENCES public.concierge_delivery_selections(id) ON DELETE RESTRICT,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  delivery_version_id uuid NOT NULL
    REFERENCES public.concierge_delivery_versions(id) ON DELETE RESTRICT,
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('test_only','live')),
  event_type text NOT NULL CHECK (event_type IN ('selected','retired')),
  replacement_selection_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.prevent_concierge_selection_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'concierge_selection_history_is_append_only';
END;
$$;

CREATE TRIGGER concierge_selection_history_is_append_only
BEFORE UPDATE OR DELETE ON public.concierge_delivery_selection_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_concierge_selection_history_mutation();

CREATE OR REPLACE FUNCTION public.prevent_direct_concierge_selection_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_table_owner text;
BEGIN
  SELECT pg_get_userbyid(relation.relowner)
  INTO v_table_owner
  FROM pg_class relation
  WHERE relation.oid = TG_RELID;
  IF current_user IS DISTINCT FROM v_table_owner THEN
    RAISE EXCEPTION 'direct_concierge_selection_mutation_forbidden';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER prevent_direct_concierge_selection_mutation
BEFORE UPDATE OR DELETE ON public.concierge_delivery_selections
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_concierge_selection_mutation();

CREATE TABLE IF NOT EXISTS public.concierge_delivery_promotion_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE RESTRICT,
  delivery_version_id uuid NOT NULL
    REFERENCES public.concierge_delivery_versions(id) ON DELETE RESTRICT,
  test_selection_id uuid NOT NULL
    REFERENCES public.concierge_delivery_selections(id) ON DELETE RESTRICT,
  test_delivery_id uuid NOT NULL
    REFERENCES public.message_deliveries(id) ON DELETE RESTRICT,
  provider_message_id text NOT NULL,
  receipt_evidence_hash text NOT NULL CHECK (receipt_evidence_hash ~ '^[a-f0-9]{64}$'),
  receipt_evidence jsonb NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_version_id, test_delivery_id, receipt_evidence_hash)
);

ALTER TABLE public.concierge_delivery_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_delivery_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_trusted_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_presentation_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_delivery_promotion_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_delivery_selection_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.concierge_delivery_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concierge_delivery_selections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concierge_trusted_provider_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concierge_presentation_previews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concierge_delivery_promotion_evidence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concierge_delivery_selection_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.concierge_delivery_versions TO service_role;
GRANT ALL ON public.concierge_delivery_selections TO service_role;
GRANT ALL ON public.concierge_trusted_provider_settings TO service_role;
GRANT ALL ON public.concierge_presentation_previews TO service_role;
GRANT SELECT ON public.concierge_delivery_promotion_evidence TO service_role;
GRANT SELECT ON public.concierge_delivery_selection_history TO service_role;
REVOKE UPDATE, DELETE ON public.concierge_delivery_selections FROM service_role;

-- v1 is the rollback-safe current presentation. A WhatsApp v1 candidate is eligible only
-- when an exact confirmed-production deployment is already known.
WITH approved_source AS (
  SELECT DISTINCT ON (
    source.studio_id, source.template_key, source.channel, source.locale
  )
    source.*
  FROM public.concierge_template_versions source
  WHERE source.lifecycle_status = 'approved'
    AND source.approved_by IS NOT NULL
    AND source.approved_at IS NOT NULL
    AND source.retired_at IS NULL
  ORDER BY
    source.studio_id, source.template_key, source.channel, source.locale,
    source.version DESC, source.approved_at DESC, source.id DESC
)
INSERT INTO public.concierge_delivery_versions(
  studio_id, journey_type, template_key, channel, locale,
  source_template_id, source_template_version, source_content_hash,
  source_approved_by, source_approved_at,
  presentation_version, presentation_key, presentation_hash, presentation_contract,
  email_shell_version, email_shell_hash,
  provider_template_name, provider_content_hash
)
SELECT
  source.studio_id,
  public.concierge_journey_for_template(source.template_key),
  source.template_key,
  source.channel,
  source.locale,
  source.id,
  source.version,
  source.content_hash,
  source.approved_by,
  source.approved_at,
  1,
  source.template_key || ':' || source.channel || ':v1',
  public.concierge_presentation_hash(
    public.concierge_presentation_contract(
      source.template_key,source.channel,source.locale,source.content_hash,1,NULL,NULL
    ),
    CASE WHEN source.channel = 'email' THEN 1 ELSE NULL END,
    CASE WHEN source.channel = 'email'
      THEN '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a'
      ELSE NULL END
  ),
  public.concierge_presentation_contract(
    source.template_key,source.channel,source.locale,source.content_hash,1,NULL,NULL
  ),
  CASE WHEN source.channel = 'email' THEN 1 ELSE NULL END,
  CASE WHEN source.channel = 'email'
    THEN '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a'
    ELSE NULL
  END,
  CASE WHEN source.channel = 'whatsapp' THEN source.template_key ELSE NULL END,
  CASE WHEN source.channel = 'whatsapp' THEN deployment.content_hash ELSE NULL END
FROM approved_source source
JOIN public.concierge_trusted_provider_settings trusted
  ON trusted.studio_id = source.studio_id
LEFT JOIN LATERAL (
  SELECT w.content_hash
  FROM public.whatsapp_template_deployments w
  WHERE w.waba_id = trusted.whatsapp_waba_id
    AND w.template_name = source.template_key
    AND w.language = CASE source.locale WHEN 'en' THEN 'en_US' ELSE source.locale END
    AND upper(w.approval_status) = 'APPROVED'
  ORDER BY w.updated_at DESC
  LIMIT 1
) deployment ON source.channel = 'whatsapp'
WHERE source.channel <> 'whatsapp' OR deployment.content_hash IS NOT NULL
ON CONFLICT (studio_id, source_template_id, presentation_version) DO NOTHING;

-- Email v2 is local presentation. WhatsApp v2 candidates carry the canonical catalog hash;
-- a provider deployment still has to match it exactly before selection is eligible.
WITH approved_source AS (
  SELECT DISTINCT ON (
    source.studio_id, source.template_key, source.channel, source.locale
  )
    source.*
  FROM public.concierge_template_versions source
  WHERE source.lifecycle_status = 'approved'
    AND source.approved_by IS NOT NULL
    AND source.approved_at IS NOT NULL
    AND source.retired_at IS NULL
  ORDER BY
    source.studio_id, source.template_key, source.channel, source.locale,
    source.version DESC, source.approved_at DESC, source.id DESC
)
INSERT INTO public.concierge_delivery_versions(
  studio_id, journey_type, template_key, channel, locale,
  source_template_id, source_template_version, source_content_hash,
  source_approved_by, source_approved_at,
  presentation_version, presentation_key, presentation_hash, presentation_contract,
  email_shell_version, email_shell_hash,
  provider_template_name, provider_content_hash
)
SELECT
  source.studio_id,
  public.concierge_journey_for_template(source.template_key),
  source.template_key,
  source.channel,
  source.locale,
  source.id,
  source.version,
  source.content_hash,
  source.approved_by,
  source.approved_at,
  2,
  source.template_key || ':' || source.channel || ':v2',
  public.concierge_presentation_hash(
    public.concierge_presentation_contract(
      source.template_key,source.channel,source.locale,source.content_hash,2,NULL,NULL
    ),
    1,
    '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a'
  ),
  public.concierge_presentation_contract(
    source.template_key,source.channel,source.locale,source.content_hash,2,NULL,NULL
  ),
  1,
  '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a',
  NULL,
  NULL
FROM approved_source source
WHERE source.channel = 'email'
ON CONFLICT (studio_id, source_template_id, presentation_version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.concierge_provider_template_catalog (
  template_name text NOT NULL,
  language text NOT NULL,
  content_hash text NOT NULL,
  header_asset_url text NOT NULL,
  header_asset_sha256 text NOT NULL,
  PRIMARY KEY (template_name, language)
);
ALTER TABLE public.concierge_provider_template_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.concierge_provider_template_catalog FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.concierge_provider_template_catalog TO service_role;

WITH provider_catalog AS (
  SELECT *
  FROM jsonb_to_recordset($provider_catalog$[{"template_name":"booking_confirmed_first_branded_v2","language":"en_US","content_hash":"29e05283822f1da7fce974026e58640708b922dc71ed366bbbed05bc859caf45"},{"template_name":"booking_confirmed_first_branded_v2","language":"he","content_hash":"8f4e9d55d09604aad0203944bbb2d2fa39c5dd3f811a9084e9254bcb5359f783"},{"template_name":"booking_confirmed_first_branded_v2","language":"ar","content_hash":"6913a1ee1be8dd5b89a5d29fa811cbaf278a79147d820e7052fbf274b3ea57d5"},{"template_name":"booking_confirmed_repeat_branded_v2","language":"en_US","content_hash":"24a37ec56ca90ddca9454b3e66d69a9f116a8d3ccec9d1fa13b2a69a14261c8d"},{"template_name":"booking_confirmed_repeat_branded_v2","language":"he","content_hash":"25951ea416bc9ef80a89eb38f820f22578097cff2192374212f09c38d27bce08"},{"template_name":"booking_confirmed_repeat_branded_v2","language":"ar","content_hash":"48004d7dbcc86ae64b75b12e980ffe936788ef0010fdae057c522b11be0e0d53"},{"template_name":"class_cancelled_branded_v2","language":"en_US","content_hash":"87941e377b9ee6d829330f097069a77471364425a9086d62cad53d52122fafce"},{"template_name":"class_cancelled_branded_v2","language":"he","content_hash":"2579c57621361b1c59f082345b0c8d8366d8bae65d60e555d9cb2021cd0730db"},{"template_name":"class_cancelled_branded_v2","language":"ar","content_hash":"52cc82b95bde7e859cda08be7950216cd671ce5cc24afc787344506f1ee24ad3"},{"template_name":"class_time_changed_branded_v2","language":"en_US","content_hash":"59bd4364d24e7261ca21d89210c3936fc7ad12bc4acfc794276fdbc1c040d0a8"},{"template_name":"class_time_changed_branded_v2","language":"he","content_hash":"bb3796d1ee12f1aa15243cc5cbf12939136cb4df52b746d8dc03c2c4658d2039"},{"template_name":"class_time_changed_branded_v2","language":"ar","content_hash":"a94307b7247c8f648304db8b33ea8f1539902a79294fa62ba7372823f9164c62"},{"template_name":"payment_one_time_succeeded_branded_v2","language":"en_US","content_hash":"ccc461062f66ffd8e83d83e26200351c6cb6eac09367b71274f87b4150666b8d"},{"template_name":"payment_one_time_succeeded_branded_v2","language":"he","content_hash":"0db1253704fffad597b2bd3ea7589779094bd25f72926c213882bc76f2e074bc"},{"template_name":"payment_one_time_succeeded_branded_v2","language":"ar","content_hash":"526870deb5bfcd5be78c35bf37978c9ccc601d57130278f0f490ae93055ea79e"},{"template_name":"payment_subscription_renewal_succeeded_branded_v2","language":"en_US","content_hash":"b0d8e708abdda2a2daffd848286cd3fd6823048c8123767b40d55432018cc641"},{"template_name":"payment_subscription_renewal_succeeded_branded_v2","language":"he","content_hash":"892a02d5c8cf557326719c26250045ffc0f7a7b3d11f4290bd3c1d4d13e814f9"},{"template_name":"payment_subscription_renewal_succeeded_branded_v2","language":"ar","content_hash":"9d8d2f7af43491ee2b3f5965a6c7c6b0bf8f07307d52e784436d1fa332004cbf"},{"template_name":"payment_requires_action_branded_v2","language":"en_US","content_hash":"5b583b4e3674ae00b127c7058123f1f1759f097547337198b150d9bdb83f7f3f"},{"template_name":"payment_requires_action_branded_v2","language":"he","content_hash":"5aac36f664ea8f76f5f7c1e22ea5a53ee4c853e341279b7113c8e5e238386cd8"},{"template_name":"payment_requires_action_branded_v2","language":"ar","content_hash":"8f3f556c1ef9cea651cccb840fcdd7fbccdd058cc30fc9665cff66af3b227dfd"},{"template_name":"payment_terminally_failed_branded_v2","language":"en_US","content_hash":"23d967e971a144207fb86e7ce33c1731439b1de331397c3b47b9a8683afc5b78"},{"template_name":"payment_terminally_failed_branded_v2","language":"he","content_hash":"f143ad2d23baa8208318061ec36271067c8592865cdf45c92ba05982f015ab4d"},{"template_name":"payment_terminally_failed_branded_v2","language":"ar","content_hash":"21a4cc494502e314aabe01df803b0aa8676ecfe87912ebb61e879ae55c673a2a"},{"template_name":"retention_branded_v2","language":"en_US","content_hash":"8721dea32f0b7ca942f320edfa823980bbed3101c89fb8511a16935cdb796bd8"},{"template_name":"retention_branded_v2","language":"he","content_hash":"20f8da5c69ac32586349c4f283b60494e604ea0e103e451d5e2f4728129c959b"},{"template_name":"retention_branded_v2","language":"ar","content_hash":"7e6e6f1e8e8b7a46e55c11c3512ece1342c98b939793bb23ec0c0be2aee90d60"},{"template_name":"waitlist_offer_branded_v2","language":"en_US","content_hash":"1dc0f2b1afab460db923062814f9b9998ac6c2cb42084e83a3fc76ab09bd124d"},{"template_name":"waitlist_offer_branded_v2","language":"he","content_hash":"1607473f9e0b26dbd5fcf7efb1a74b26c27d83d60d687356948dbce0bf271012"},{"template_name":"waitlist_offer_branded_v2","language":"ar","content_hash":"0bb7f9f92901c90465bd3f98646ddef1fca404dcdd7f65c64823c61bc614e9f2"},{"template_name":"recommendation_branded_v2","language":"en_US","content_hash":"237ccd7c2fa131f0ae94365a13578482048e9d4cf5ba6494283ac37ecc09a00a"},{"template_name":"recommendation_branded_v2","language":"he","content_hash":"09d944cdbc08d5b24fca1f30ef5c8081c719e253be221624eeaacbfce92e2e68"},{"template_name":"recommendation_branded_v2","language":"ar","content_hash":"8abb4db96a549dd5b61c541b054d3e2ed23331525967e027c45f613cb27ec349"}]$provider_catalog$::jsonb) AS row(
    template_name text,
    language text,
    content_hash text
  )
)
INSERT INTO public.concierge_provider_template_catalog(
  template_name, language, content_hash, header_asset_url, header_asset_sha256
)
SELECT
  provider.template_name,
  provider.language,
  provider.content_hash,
  'https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png',
  'b29c3947567fd874164ce7a7e24d1f230b6987183ea905fc13fbc7aebe830fb6'
FROM provider_catalog provider
ON CONFLICT (template_name, language) DO UPDATE
SET content_hash = EXCLUDED.content_hash,
    header_asset_url = EXCLUDED.header_asset_url,
    header_asset_sha256 = EXCLUDED.header_asset_sha256;

WITH approved_source AS (
  SELECT DISTINCT ON (
    source.studio_id, source.template_key, source.channel, source.locale
  )
    source.*
  FROM public.concierge_template_versions source
  WHERE source.lifecycle_status = 'approved'
    AND source.approved_by IS NOT NULL
    AND source.approved_at IS NOT NULL
    AND source.retired_at IS NULL
    AND source.channel = 'whatsapp'
  ORDER BY
    source.studio_id, source.template_key, source.channel, source.locale,
    source.version DESC, source.approved_at DESC, source.id DESC
)
INSERT INTO public.concierge_delivery_versions(
  studio_id, journey_type, template_key, channel, locale,
  source_template_id, source_template_version, source_content_hash,
  source_approved_by, source_approved_at,
  presentation_version, presentation_key, presentation_hash, presentation_contract,
  email_shell_version, email_shell_hash,
  provider_template_name, provider_content_hash
)
SELECT
  source.studio_id,
  public.concierge_journey_for_template(source.template_key),
  source.template_key,
  source.channel,
  source.locale,
  source.id,
  source.version,
  source.content_hash,
  source.approved_by,
  source.approved_at,
  2,
  source.template_key || ':' || source.channel || ':v2',
  public.concierge_presentation_hash(
    public.concierge_presentation_contract(
      source.template_key,source.channel,source.locale,source.content_hash,2,
      provider.template_name,provider.content_hash
    ),
    NULL,
    NULL
  ),
  public.concierge_presentation_contract(
    source.template_key,source.channel,source.locale,source.content_hash,2,
    provider.template_name,provider.content_hash
  ),
  NULL,
  NULL,
  provider.template_name,
  provider.content_hash
FROM approved_source source
JOIN public.concierge_provider_template_catalog provider
  ON regexp_replace(provider.template_name, '_branded_v2$', '') = source.template_key
 AND provider.language = CASE source.locale WHEN 'en' THEN 'en_US' ELSE source.locale END
ON CONFLICT (studio_id, source_template_id, presentation_version) DO NOTHING;

-- Preview first: both modes remain on rollback-safe v1. An authenticated preview approval
-- plus an explicit exact-candidate selection is required before either mode can use v2.
INSERT INTO public.concierge_delivery_selections(
  studio_id, journey_type, template_key, channel, locale,
  delivery_mode, delivery_version_id, selected_by
)
SELECT
  v1.studio_id, v1.journey_type, v1.template_key, v1.channel, v1.locale,
  mode.delivery_mode,
  v1.id, NULL
FROM public.concierge_delivery_versions v1
CROSS JOIN (VALUES ('test_only'::text), ('live'::text)) mode(delivery_mode)
WHERE v1.presentation_version = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.concierge_delivery_selections selected
    WHERE selected.studio_id = v1.studio_id
      AND selected.template_key = v1.template_key
      AND selected.channel = v1.channel
      AND selected.locale = v1.locale
      AND selected.delivery_mode = mode.delivery_mode
      AND selected.retired_at IS NULL
  );

INSERT INTO public.concierge_delivery_selection_history(
  selection_id,studio_id,delivery_version_id,delivery_mode,event_type,actor_id,occurred_at
)
SELECT
  selected.id,selected.studio_id,selected.delivery_version_id,selected.delivery_mode,
  'selected'::text,selected.selected_by,selected.selected_at
FROM public.concierge_delivery_selections selected
WHERE NOT EXISTS (
  SELECT 1
  FROM public.concierge_delivery_selection_history history
  WHERE history.selection_id = selected.id
    AND history.event_type = 'selected'
);

CREATE OR REPLACE FUNCTION public.approve_concierge_template_version(
  p_studio_id uuid,
  p_template_id uuid,
  p_expected_content_hash text,
  p_actor_id uuid,
  p_confirmation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.concierge_template_versions%ROWTYPE;
  v_trusted_waba_id text;
  v_replaced_source_ids uuid[] := '{}'::uuid[];
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_access_required';
  END IF;
  IF p_confirmation IS DISTINCT FROM
     'APPROVE SOURCE ' || p_template_id::text || ' ' || p_expected_content_hash THEN
    RAISE EXCEPTION 'exact_source_approval_confirmation_required';
  END IF;

  SELECT source.*
  INTO v_source
  FROM public.concierge_template_versions source
  WHERE source.id = p_template_id
    AND source.studio_id = p_studio_id
    AND source.lifecycle_status = 'draft'
    AND source.retired_at IS NULL
    AND source.content_hash = p_expected_content_hash
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_source_hash_mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(
    ':',v_source.studio_id,v_source.template_key,v_source.channel,v_source.locale
  ),0));

  WITH retired AS (
    UPDATE public.concierge_template_versions source
    SET lifecycle_status = 'retired',
        retired_at = now()
    WHERE source.studio_id = v_source.studio_id
      AND source.template_key = v_source.template_key
      AND source.channel = v_source.channel
      AND source.locale = v_source.locale
      AND source.id <> v_source.id
      AND source.lifecycle_status = 'approved'
      AND source.retired_at IS NULL
    RETURNING source.id
  )
  SELECT COALESCE(array_agg(retired.id ORDER BY retired.id),'{}'::uuid[])
  INTO v_replaced_source_ids
  FROM retired;

  UPDATE public.concierge_template_versions source
  SET lifecycle_status = 'approved',
      approved_by = p_actor_id,
      approved_at = now()
  WHERE source.id = v_source.id
    AND source.lifecycle_status = 'draft'
    AND source.retired_at IS NULL
  RETURNING * INTO v_source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft_source_hash_mismatch';
  END IF;

  SELECT trusted.whatsapp_waba_id
  INTO v_trusted_waba_id
  FROM public.concierge_trusted_provider_settings trusted
  WHERE trusted.studio_id = p_studio_id;

  INSERT INTO public.concierge_delivery_versions(
    studio_id, journey_type, template_key, channel, locale,
    source_template_id, source_template_version, source_content_hash,
    source_approved_by, source_approved_at,
    presentation_version, presentation_key, presentation_hash, presentation_contract,
    email_shell_version, email_shell_hash, provider_template_name, provider_content_hash,
    created_by
  )
  SELECT
    v_source.studio_id, public.concierge_journey_for_template(v_source.template_key),
    v_source.template_key, v_source.channel, v_source.locale,
    v_source.id, v_source.version, v_source.content_hash,
    v_source.approved_by, v_source.approved_at,
    presentation.version,
    v_source.template_key || ':' || v_source.channel || ':v' || presentation.version,
    public.concierge_presentation_hash(
      public.concierge_presentation_contract(
        v_source.template_key,v_source.channel,v_source.locale,v_source.content_hash,
        presentation.version,
        CASE WHEN presentation.version = 2 AND v_source.channel = 'whatsapp'
          THEN provider.template_name ELSE NULL END,
        CASE WHEN presentation.version = 2 AND v_source.channel = 'whatsapp'
          THEN provider.content_hash ELSE NULL END
      ),
      CASE WHEN v_source.channel = 'email' THEN 1 ELSE NULL END,
      CASE WHEN v_source.channel = 'email'
        THEN '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a'
        ELSE NULL END
    ),
    public.concierge_presentation_contract(
      v_source.template_key,v_source.channel,v_source.locale,v_source.content_hash,
      presentation.version,
      CASE WHEN presentation.version = 2 AND v_source.channel = 'whatsapp'
        THEN provider.template_name ELSE NULL END,
      CASE WHEN presentation.version = 2 AND v_source.channel = 'whatsapp'
        THEN provider.content_hash ELSE NULL END
    ),
    CASE WHEN v_source.channel = 'email' THEN 1 ELSE NULL END,
    CASE WHEN v_source.channel = 'email'
      THEN '04d94d0696900fac5e98c6a2cc8f92faab2a748626f891542aaf1ea96fe7e36a'
      ELSE NULL END,
    CASE
      WHEN v_source.channel = 'whatsapp' AND presentation.version = 1
        THEN v_source.template_key
      WHEN v_source.channel = 'whatsapp' THEN provider.template_name
      ELSE NULL
    END,
    CASE
      WHEN v_source.channel = 'whatsapp' AND presentation.version = 1
        THEN legacy.content_hash
      WHEN v_source.channel = 'whatsapp' THEN provider.content_hash
      ELSE NULL
    END,
    p_actor_id
  FROM (VALUES (1),(2)) AS presentation(version)
  LEFT JOIN public.concierge_provider_template_catalog provider
    ON presentation.version = 2
   AND v_source.channel = 'whatsapp'
   AND regexp_replace(provider.template_name,'_branded_v2$','') = v_source.template_key
   AND provider.language = CASE v_source.locale WHEN 'en' THEN 'en_US' ELSE v_source.locale END
  LEFT JOIN LATERAL (
    SELECT deployment.content_hash
    FROM public.whatsapp_template_deployments deployment
    WHERE deployment.waba_id = v_trusted_waba_id
      AND deployment.template_name = v_source.template_key
      AND deployment.language = CASE v_source.locale WHEN 'en' THEN 'en_US' ELSE v_source.locale END
      AND upper(deployment.approval_status) = 'APPROVED'
    ORDER BY deployment.updated_at DESC
    LIMIT 1
  ) legacy ON presentation.version = 1 AND v_source.channel = 'whatsapp'
  WHERE (presentation.version = 1 OR v_source.channel IN ('email','whatsapp'))
    AND (v_source.channel <> 'whatsapp' OR presentation.version <> 1
      OR legacy.content_hash IS NOT NULL)
    AND (v_source.channel <> 'whatsapp' OR presentation.version <> 2
      OR provider.content_hash IS NOT NULL)
  ON CONFLICT (studio_id, source_template_id, presentation_version) DO NOTHING;

  INSERT INTO public.concierge_delivery_selections(
    studio_id,journey_type,template_key,channel,locale,delivery_mode,
    delivery_version_id,selected_by
  )
  SELECT
    candidate.studio_id,candidate.journey_type,candidate.template_key,
    candidate.channel,candidate.locale,mode.delivery_mode,candidate.id,p_actor_id
  FROM public.concierge_delivery_versions candidate
  CROSS JOIN (VALUES ('test_only'::text),('live'::text)) mode(delivery_mode)
  WHERE candidate.source_template_id = v_source.id
    AND candidate.presentation_version = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.concierge_delivery_selections selected
      WHERE selected.studio_id = candidate.studio_id
        AND selected.template_key = candidate.template_key
        AND selected.channel = candidate.channel
        AND selected.locale = candidate.locale
        AND selected.delivery_mode = mode.delivery_mode
        AND selected.retired_at IS NULL
    );

  INSERT INTO public.concierge_delivery_selection_history(
    selection_id,studio_id,delivery_version_id,delivery_mode,event_type,actor_id,occurred_at
  )
  SELECT
    selected.id,selected.studio_id,selected.delivery_version_id,selected.delivery_mode,
    'selected'::text,p_actor_id,selected.selected_at
  FROM public.concierge_delivery_selections selected
  JOIN public.concierge_delivery_versions candidate
    ON candidate.id = selected.delivery_version_id
  WHERE candidate.source_template_id = v_source.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.concierge_delivery_selection_history history
      WHERE history.selection_id = selected.id
        AND history.event_type = 'selected'
    );

  INSERT INTO public.admin_activity_log(actor_id,action,entity_type,entity_id,metadata)
  VALUES (
    p_actor_id,'concierge.template_exact_hash_approved',
    'concierge_template_version',p_template_id,
    jsonb_build_object(
      'studio_id',p_studio_id,
      'content_hash',p_expected_content_hash,
      'replaced_source_ids',v_replaced_source_ids
    )
  );
  RETURN p_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_concierge_template_version(
  uuid,uuid,text,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_concierge_template_version(
  uuid,uuid,text,uuid,text
) TO service_role;
REVOKE EXECUTE ON FUNCTION public.approve_concierge_template_library(
  uuid,uuid,text
) FROM service_role;

CREATE OR REPLACE FUNCTION public.approve_concierge_delivery_preview(
  p_studio_id uuid,
  p_delivery_version_id uuid,
  p_expected_source_hash text,
  p_expected_presentation_hash text,
  p_actor_id uuid,
  p_confirmation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version public.concierge_delivery_versions%ROWTYPE;
  v_preview_id uuid;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_access_required';
  END IF;
  IF p_confirmation IS DISTINCT FROM
     'APPROVE PREVIEW ' || p_delivery_version_id::text || ' ' ||
     p_expected_presentation_hash THEN
    RAISE EXCEPTION 'exact_preview_approval_confirmation_required';
  END IF;
  SELECT *
  INTO v_version
  FROM public.concierge_delivery_versions version
  WHERE version.id = p_delivery_version_id
    AND version.studio_id = p_studio_id
    AND version.presentation_version = 2
    AND version.source_content_hash = p_expected_source_hash
    AND version.presentation_hash = p_expected_presentation_hash
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'preview_candidate_hash_mismatch'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.concierge_template_versions source
    WHERE source.id = v_version.source_template_id
      AND source.lifecycle_status = 'approved'
      AND source.retired_at IS NULL
      AND source.content_hash = v_version.source_content_hash
      AND source.approved_by = v_version.source_approved_by
      AND source.approved_at = v_version.source_approved_at
  ) THEN
    RAISE EXCEPTION 'preview_source_evidence_changed';
  END IF;

  INSERT INTO public.concierge_presentation_previews(
    studio_id,delivery_version_id,source_content_hash,presentation_hash,
    previewed_by,approved_by
  ) VALUES (
    p_studio_id,v_version.id,v_version.source_content_hash,v_version.presentation_hash,
    p_actor_id,p_actor_id
  )
  RETURNING id INTO v_preview_id;

  UPDATE public.concierge_delivery_versions
  SET presentation_approved_by = p_actor_id,
      presentation_approved_at = now()
  WHERE id = v_version.id
    AND presentation_hash = p_expected_presentation_hash
    AND presentation_approved_by IS NULL
    AND presentation_approved_at IS NULL;
  INSERT INTO public.admin_activity_log(actor_id,action,entity_type,entity_id,metadata)
  VALUES (
    p_actor_id,'concierge.presentation_preview_approved',
    'concierge_delivery_version',v_version.id,
    jsonb_build_object(
      'source_content_hash',v_version.source_content_hash,
      'presentation_hash',v_version.presentation_hash,
      'preview_id',v_preview_id
    )
  );
  RETURN v_preview_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_concierge_delivery_preview(
  uuid,uuid,text,text,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_concierge_delivery_preview(
  uuid,uuid,text,text,uuid,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.review_concierge_test_delivery_evidence(
  p_studio_id uuid,
  p_delivery_version_id uuid,
  p_test_delivery_id uuid,
  p_expected_provider_message_id text,
  p_receipt_evidence_hash text,
  p_receipt_evidence jsonb,
  p_actor_id uuid,
  p_confirmation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence_id uuid;
  v_test_selection_id uuid;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id AND profile.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_access_required';
  END IF;
  IF p_confirmation IS DISTINCT FROM
     'REVIEW TEST DELIVERY ' || p_test_delivery_id::text || ' ' ||
     COALESCE(p_receipt_evidence_hash,'') THEN
    RAISE EXCEPTION 'test_delivery_review_confirmation_required';
  END IF;
  IF p_receipt_evidence_hash !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_receipt_evidence) IS DISTINCT FROM 'object'
     OR p_receipt_evidence = '{}'::jsonb THEN
    RAISE EXCEPTION 'receipt_evidence_required';
  END IF;

  SELECT test_selection.id
  INTO v_test_selection_id
  FROM public.message_deliveries test_delivery
  JOIN public.message_snapshots test_snapshot
    ON test_snapshot.id = test_delivery.snapshot_id
  JOIN public.concierge_delivery_selections test_selection
    ON test_selection.id = test_snapshot.delivery_selection_id
  JOIN public.concierge_delivery_versions version
    ON version.id = test_selection.delivery_version_id
  WHERE test_delivery.id = p_test_delivery_id
    AND version.id = p_delivery_version_id
    AND version.studio_id = p_studio_id
    AND version.presentation_version = 2
    AND test_selection.studio_id = p_studio_id
    AND test_selection.delivery_mode = 'test_only'
    AND test_delivery.status IN ('delivered','read')
    AND test_delivery.provider_message_id = p_expected_provider_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'successful_test_delivery_evidence_required';
  END IF;

  INSERT INTO public.concierge_delivery_promotion_evidence(
    studio_id,delivery_version_id,test_selection_id,test_delivery_id,
    provider_message_id,receipt_evidence_hash,receipt_evidence,reviewed_by
  ) VALUES (
    p_studio_id,p_delivery_version_id,v_test_selection_id,p_test_delivery_id,
    p_expected_provider_message_id,p_receipt_evidence_hash,p_receipt_evidence,p_actor_id
  )
  RETURNING id INTO v_evidence_id;

  INSERT INTO public.admin_activity_log(actor_id,action,entity_type,entity_id,metadata)
  VALUES (
    p_actor_id,'concierge.test_delivery_evidence_reviewed',
    'concierge_delivery_promotion_evidence',v_evidence_id,
    jsonb_build_object(
      'studio_id',p_studio_id,
      'delivery_version_id',p_delivery_version_id,
      'test_delivery_id',p_test_delivery_id,
      'receipt_evidence_hash',p_receipt_evidence_hash
    )
  );
  RETURN v_evidence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_concierge_test_delivery_evidence(
  uuid,uuid,uuid,text,text,jsonb,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_concierge_test_delivery_evidence(
  uuid,uuid,uuid,text,text,jsonb,uuid,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.select_concierge_delivery_version(
  p_studio_id uuid,
  p_template_key text,
  p_channel text,
  p_locale text,
  p_delivery_mode text,
  p_delivery_version_id uuid,
  p_expected_presentation_hash text,
  p_actor_id uuid,
  p_confirmation text
)
RETURNS TABLE(selection_id uuid, delivery_version_id uuid, presentation_version integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version public.concierge_delivery_versions%ROWTYPE;
  v_canonical_whatsapp_waba_id text;
  v_selection_id uuid;
  v_expected_confirmation text;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_actor_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_access_required';
  END IF;
  IF p_delivery_mode NOT IN ('test_only','live') THEN
    RAISE EXCEPTION 'invalid_delivery_mode';
  END IF;
  v_expected_confirmation :=
    CASE p_delivery_mode WHEN 'live' THEN 'SELECT LIVE ' ELSE 'SELECT TEST ' END
    || p_delivery_version_id::text || ' ' || COALESCE(p_expected_presentation_hash, '');
  IF p_confirmation IS DISTINCT FROM v_expected_confirmation THEN
    RAISE EXCEPTION 'delivery_selection_confirmation_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws(':',p_studio_id,p_template_key,p_channel,p_locale,p_delivery_mode), 0
  ));

  SELECT *
  INTO v_version
  FROM public.concierge_delivery_versions v
  WHERE v.id = p_delivery_version_id
    AND v.studio_id = p_studio_id
    AND v.template_key = p_template_key
    AND v.channel = p_channel
    AND v.locale = p_locale
    AND v.presentation_hash = p_expected_presentation_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_version_not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.concierge_template_versions source
    WHERE source.id = v_version.source_template_id
      AND source.studio_id = p_studio_id
      AND source.template_key = v_version.template_key
      AND source.channel = v_version.channel
      AND source.locale = v_version.locale
      AND source.version = v_version.source_template_version
      AND source.content_hash = v_version.source_content_hash
      AND source.lifecycle_status = 'approved'
      AND source.approved_by = v_version.source_approved_by
      AND source.approved_at = v_version.source_approved_at
      AND source.retired_at IS NULL
  ) THEN
    RAISE EXCEPTION 'delivery_version_source_evidence_changed';
  END IF;
  IF v_version.presentation_version = 2 AND NOT EXISTS (
    SELECT 1
    FROM public.concierge_presentation_previews preview
    WHERE preview.delivery_version_id = v_version.id
      AND preview.studio_id = p_studio_id
      AND preview.source_content_hash = v_version.source_content_hash
      AND preview.presentation_hash = v_version.presentation_hash
      AND preview.approved_by IS NOT NULL
      AND preview.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'authenticated_presentation_preview_required';
  END IF;
  IF p_delivery_mode = 'live'
     AND v_version.presentation_version = 2
     AND NOT EXISTS (
       SELECT 1
       FROM public.concierge_delivery_promotion_evidence promotion
       JOIN public.concierge_delivery_selections test_selection
         ON test_selection.id = promotion.test_selection_id
       JOIN public.message_deliveries test_delivery
         ON test_delivery.id = promotion.test_delivery_id
       JOIN public.message_snapshots test_snapshot
         ON test_snapshot.id = test_delivery.snapshot_id
       WHERE promotion.studio_id = p_studio_id
         AND promotion.delivery_version_id = v_version.id
         AND promotion.reviewed_by IS NOT NULL
         AND promotion.reviewed_at IS NOT NULL
         AND test_selection.studio_id = p_studio_id
         AND test_selection.delivery_mode = 'test_only'
         AND test_selection.delivery_version_id = v_version.id
         AND test_snapshot.delivery_selection_id = test_selection.id
         AND test_delivery.status IN ('delivered','read')
         AND test_delivery.provider_message_id = promotion.provider_message_id
     ) THEN
    RAISE EXCEPTION 'successful_test_delivery_evidence_required';
  END IF;
  SELECT trusted.whatsapp_waba_id
  INTO v_canonical_whatsapp_waba_id
  FROM public.concierge_trusted_provider_settings trusted
  WHERE trusted.studio_id = p_studio_id;
  IF v_version.channel = 'whatsapp' AND (
    v_canonical_whatsapp_waba_id IS NULL
    OR
    v_version.provider_template_name IS NULL
    OR v_version.provider_content_hash IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.whatsapp_template_deployments w
      WHERE w.waba_id = v_canonical_whatsapp_waba_id
        AND w.template_name = v_version.provider_template_name
        AND w.language = CASE v_version.locale WHEN 'en' THEN 'en_US' ELSE v_version.locale END
        AND upper(w.approval_status) = 'APPROVED'
        AND w.content_hash = v_version.provider_content_hash
    )
  ) THEN
    RAISE EXCEPTION 'whatsapp_delivery_version_not_deployed';
  END IF;

  v_selection_id := gen_random_uuid();

  INSERT INTO public.concierge_delivery_selection_history(
    selection_id,studio_id,delivery_version_id,delivery_mode,event_type,
    replacement_selection_id,actor_id
  )
  SELECT
    selected.id,selected.studio_id,selected.delivery_version_id,selected.delivery_mode,
    'retired'::text,v_selection_id,p_actor_id
  FROM public.concierge_delivery_selections selected
  WHERE selected.studio_id = p_studio_id
    AND selected.template_key = p_template_key
    AND selected.channel = p_channel
    AND selected.locale = p_locale
    AND selected.delivery_mode = p_delivery_mode
    AND selected.retired_at IS NULL;

  UPDATE public.concierge_delivery_selections
  SET retired_at = now(), retired_by = p_actor_id
  WHERE studio_id = p_studio_id
    AND template_key = p_template_key
    AND channel = p_channel
    AND locale = p_locale
    AND delivery_mode = p_delivery_mode
    AND retired_at IS NULL;

  INSERT INTO public.concierge_delivery_selections(
    id, studio_id, journey_type, template_key, channel, locale,
    delivery_mode, delivery_version_id, selected_by
  ) VALUES (
    v_selection_id, p_studio_id, v_version.journey_type, p_template_key, p_channel, p_locale,
    p_delivery_mode, v_version.id, p_actor_id
  );

  INSERT INTO public.concierge_delivery_selection_history(
    selection_id,studio_id,delivery_version_id,delivery_mode,event_type,actor_id
  ) VALUES (
    v_selection_id,p_studio_id,v_version.id,p_delivery_mode,'selected'::text,p_actor_id
  );

  INSERT INTO public.admin_activity_log(actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_actor_id,
    'concierge.delivery_version_selected',
    'concierge_delivery_selection',
    v_selection_id,
    jsonb_build_object(
      'studio_id',p_studio_id,
      'template_key',p_template_key,
      'channel',p_channel,
      'locale',p_locale,
      'delivery_mode',p_delivery_mode,
      'presentation_version',v_version.presentation_version,
      'presentation_hash',v_version.presentation_hash,
      'delivery_version_id',v_version.id
    )
  );

  RETURN QUERY SELECT v_selection_id, v_version.id, v_version.presentation_version;
END;
$$;

REVOKE ALL ON FUNCTION public.select_concierge_delivery_version(
  uuid,text,text,text,text,uuid,text,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_concierge_delivery_version(
  uuid,text,text,text,text,uuid,text,uuid,text
) TO service_role;

ALTER TABLE public.message_snapshots
  ADD COLUMN IF NOT EXISTS delivery_selection_id uuid
    REFERENCES public.concierge_delivery_selections(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS presentation_key text,
  ADD COLUMN IF NOT EXISTS presentation_hash text,
  ADD COLUMN IF NOT EXISTS presentation_contract jsonb,
  ADD COLUMN IF NOT EXISTS rendered_facts jsonb,
  ADD COLUMN IF NOT EXISTS email_shell_version integer,
  ADD COLUMN IF NOT EXISTS email_shell_hash text,
  ADD COLUMN IF NOT EXISTS source_content_hash text,
  ADD COLUMN IF NOT EXISTS action_url text;

-- Convert queued pre-deploy WhatsApp payloads from the positional "parameters" shape to
-- the component shape consumed by the current sender. Sending/sent rows are never touched.
UPDATE public.message_deliveries delivery
SET provider_payload =
  (delivery.provider_payload - 'parameters')
  || jsonb_build_object(
    'components',
    jsonb_build_array(
      jsonb_build_object(
        'type','body',
        'parameters',
        COALESCE((
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(parameter.value) = 'object'
                AND parameter.value ? 'type'
              THEN parameter.value
              ELSE jsonb_build_object(
                'type','text',
                'text',CASE
                  WHEN jsonb_typeof(parameter.value) = 'string'
                  THEN parameter.value #>> '{}'
                  ELSE parameter.value::text
                END
              )
            END
            ORDER BY parameter.ordinality
          )
          FROM jsonb_array_elements(delivery.provider_payload->'parameters')
            WITH ORDINALITY AS parameter(value, ordinality)
        ), '[]'::jsonb)
      )
    ),
    'compatibility_version','legacy_parameters_v1_backfill'
  )
WHERE delivery.channel = 'whatsapp'
  AND delivery.provider = 'official_whatsapp'
  AND delivery.status IN ('queued','failed')
  AND jsonb_typeof(delivery.provider_payload->'parameters') = 'array'
  AND NOT (delivery.provider_payload ? 'components');

ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_status_check;
ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (
    status IN (
      'draft','queued','sending','manually_sent','sent','failed','cancelled','skipped',
      'generated','copied','opened','marked_sent','delivery_unknown'
    )
  ) NOT VALID;
ALTER TABLE public.notification_logs
  VALIDATE CONSTRAINT notification_logs_status_check;

CREATE OR REPLACE FUNCTION public.materialize_concierge_delivery(
  p_studio_id uuid, p_recipient_id uuid, p_intent_id uuid, p_decision_key text,
  p_policy_version text, p_automation_config_version integer, p_mode text,
  p_template_key text, p_correlation_id uuid, p_reason_codes text[],
  p_competing_action_ids uuid[], p_rendered_variables jsonb, p_materializations jsonb,
  p_whatsapp_waba_id text, p_now timestamptz
)
RETURNS TABLE(result_decision_id uuid, outcome text, result_suppression_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
  v_recipient public.communication_recipients%ROWTYPE;
  v_config public.automation_config_versions%ROWTYPE;
  v_template public.concierge_template_versions%ROWTYPE;
  v_delivery_version public.concierge_delivery_versions%ROWTYPE;
  v_selection public.concierge_delivery_selections%ROWTYPE;
  v_snapshot public.message_snapshots%ROWTYPE;
  v_item jsonb;
  v_rendered_variables jsonb;
  v_expected_rendered_facts jsonb;
  v_expected_provider text;
  v_expected_address text;
  v_expected_presentation_key text;
  v_expected_action_url text;
  v_expected_provider_payload jsonb;
  v_whatsapp_parameters jsonb;
  v_canonical_whatsapp_waba_id text;
  v_materialization_evidence jsonb;
  v_replay_evidence jsonb;
  v_existing_evidence jsonb;
  v_existing_decision_id uuid;
  v_decision_id uuid;
  v_snapshot_id uuid;
  v_message_id uuid;
  v_first_template_id uuid;
  v_first_template_version integer;
  v_external_count integer;
  v_reserved boolean;
  v_reservation_reason text;
  v_existing_decision boolean := false;
BEGIN
  IF p_mode NOT IN ('test_only','live') THEN
    RAISE EXCEPTION 'invalid_delivery_mode';
  END IF;
  IF p_materializations IS NULL
     OR jsonb_typeof(p_materializations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;
  IF COALESCE(jsonb_array_length(p_materializations), 0) = 0 THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;
  IF p_rendered_variables IS NULL
     OR jsonb_typeof(p_rendered_variables) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'rendered_variables_required';
  END IF;

  -- exact_stored_materialization_replay: a completed request is authenticated by the
  -- immutable decision/snapshot/delivery evidence before recipient, config, source,
  -- selection, retirement, rollback, or provider state is consulted.
  SELECT jsonb_build_object(
    'intent_id',p_intent_id,
    'correlation_id',p_correlation_id,
    'journey_type',item->'snapshot'->>'journeyType',
    'whatsapp_waba_id',CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_materializations) candidate
      WHERE candidate->'snapshot'->>'channel' = 'whatsapp'
    ) THEN NULLIF(btrim(p_whatsapp_waba_id),'') ELSE NULL END,
    'deliveries',jsonb_agg(
      jsonb_build_object(
        'channel',item->'snapshot'->>'channel',
        'template_id',item->'snapshot'->>'templateId',
        'template_version',item->'snapshot'->>'templateVersion',
        'locale',item->'snapshot'->>'locale',
        'rendered_variables',COALESCE(
          item->'snapshot'->'renderedVariables',p_rendered_variables
        ),
        'final_subject',item->'snapshot'->>'finalSubject',
        'final_body',item->'snapshot'->>'finalBody',
        'presentation_key',item->'snapshot'->>'presentationKey',
        'presentation_hash',item->'snapshot'->>'presentationHash',
        'presentation_contract',item->'snapshot'->'presentationContract',
        'rendered_facts',item->'snapshot'->'renderedFacts',
        'email_shell_version',item->'snapshot'->'emailShellVersion',
        'email_shell_hash',item->'snapshot'->>'emailShellHash',
        'source_content_hash',item->'snapshot'->>'sourceContentHash',
        'journey_type',item->'snapshot'->>'journeyType',
        'action_url',item->'snapshot'->>'actionUrl',
        'selection_id',item->'snapshot'->>'selectionId',
        'provider_content_hash',
          item->'delivery'->'providerPayload'->>'expected_content_hash',
        'provider',item->'delivery'->>'provider',
        'recipient_address',item->'delivery'->>'recipientAddress',
        'provider_payload',COALESCE(item->'delivery'->'providerPayload','{}'::jsonb)
      )
      ORDER BY item->'snapshot'->>'channel'
    )
  )
  INTO v_replay_evidence
  FROM jsonb_array_elements(p_materializations) item
  GROUP BY item->'snapshot'->>'journeyType';

  SELECT decision.id, decision.materialization_evidence
  INTO v_existing_decision_id, v_existing_evidence
  FROM public.concierge_decisions decision
  WHERE decision.studio_id = p_studio_id
    AND decision.decision_key = p_decision_key
    AND decision.intent_id = p_intent_id
    AND decision.communication_recipient_id = p_recipient_id;
  IF v_existing_decision_id IS NOT NULL THEN
    -- stored_materialization_evidence_reconstruction: decisions written before the
    -- evidence column was populated are authenticated from their immutable stored
    -- snapshots/messages/deliveries. No current source, selection, or provider row is used.
    IF v_existing_evidence IS NULL THEN
      SELECT jsonb_build_object(
        'intent_id',p_intent_id,
        'correlation_id',
          (array_agg(snapshot.correlation_id ORDER BY snapshot.channel))[1],
        'journey_type',
          (array_agg(message.content->>'journey_type' ORDER BY snapshot.channel))[1],
        'whatsapp_waba_id',NULL,
        'deliveries',jsonb_agg(
          jsonb_build_object(
            'channel',snapshot.channel,
            'template_id',snapshot.template_id::text,
            'template_version',message.template_version::text,
            'locale',snapshot.locale,
            'rendered_variables',snapshot.rendered_variables,
            'final_subject',snapshot.final_subject,
            'final_body',snapshot.final_body,
            'presentation_key',snapshot.presentation_key,
            'presentation_hash',snapshot.presentation_hash,
            'presentation_contract',snapshot.presentation_contract,
            'rendered_facts',snapshot.rendered_facts,
            'email_shell_version',snapshot.email_shell_version,
            'email_shell_hash',snapshot.email_shell_hash,
            'source_content_hash',snapshot.source_content_hash,
            'journey_type',message.content->>'journey_type',
            'action_url',snapshot.action_url,
            'selection_id',snapshot.delivery_selection_id::text,
            'provider_content_hash',
              delivery.provider_payload->>'expected_content_hash',
            'provider',delivery.provider,
            'recipient_address',delivery.recipient_address,
            'provider_payload',COALESCE(delivery.provider_payload,'{}'::jsonb)
          )
          ORDER BY snapshot.channel
        )
      )
      INTO v_existing_evidence
      FROM public.message_snapshots snapshot
      JOIN public.message_deliveries delivery ON delivery.snapshot_id = snapshot.id
      JOIN public.messages message ON message.id = delivery.message_id
      WHERE snapshot.decision_id = v_existing_decision_id
      HAVING count(*) > 0;
    END IF;
    IF v_existing_evidence IS DISTINCT FROM v_replay_evidence THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    IF (
      SELECT count(*) FROM public.message_snapshots snapshot
      WHERE snapshot.decision_id = v_existing_decision_id
    ) = jsonb_array_length(p_materializations) THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.message_snapshots snapshot
          JOIN public.message_deliveries delivery ON delivery.snapshot_id = snapshot.id
          WHERE snapshot.decision_id = v_existing_decision_id
            AND snapshot.channel = v_item->'snapshot'->>'channel'
            AND snapshot.template_id =
              (v_item->'snapshot'->>'templateId')::uuid
            AND snapshot.rendered_variables = COALESCE(
              v_item->'snapshot'->'renderedVariables',p_rendered_variables
            )
            AND snapshot.final_subject IS NOT DISTINCT FROM
              v_item->'snapshot'->>'finalSubject'
            AND snapshot.final_body = v_item->'snapshot'->>'finalBody'
            AND delivery.provider = v_item->'delivery'->>'provider'
            AND delivery.recipient_address IS NOT DISTINCT FROM
              v_item->'delivery'->>'recipientAddress'
            AND delivery.provider_payload = COALESCE(
              v_item->'delivery'->'providerPayload','{}'::jsonb
            )
        ) THEN
          RAISE EXCEPTION 'snapshot_replay_mismatch';
        END IF;
      END LOOP;
      RETURN QUERY SELECT v_existing_decision_id, 'duplicate'::text, NULL::text;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_intent
  FROM public.journey_intents
  WHERE id = p_intent_id
    AND studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'concierge_intent_not_found'; END IF;
  IF v_intent.status NOT IN ('pending','postponed','suppressed','materialized') THEN
    RAISE EXCEPTION 'concierge_intent_not_dispatchable';
  END IF;
  IF v_intent.status <> 'materialized'
     AND v_intent.expires_at IS NOT NULL
     AND v_intent.expires_at <= p_now THEN
    UPDATE public.journey_intents
    SET status = 'expired', updated_at = now()
    WHERE id = v_intent.id;
    RETURN QUERY SELECT NULL::uuid, 'expired'::text, 'intent_expired'::text;
    RETURN;
  END IF;

  SELECT *
  INTO v_recipient
  FROM public.communication_recipients
  WHERE id = p_recipient_id
    AND studio_id = p_studio_id
    AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_recipient_not_found'; END IF;

  SELECT *
  INTO v_config
  FROM public.automation_config_versions
  WHERE studio_id = p_studio_id
    AND journey_type = v_intent.journey_type
    AND version = p_automation_config_version
    AND mode = p_mode
    AND retired_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'automation_configuration_changed'; END IF;
  IF p_mode = 'live' AND (v_config.approved_at IS NULL OR v_config.approved_by IS NULL) THEN
    RAISE EXCEPTION 'live_configuration_not_approved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_materializations) item
    GROUP BY item->'snapshot'->>'channel'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_materialization_channel';
  END IF;

  SELECT trusted.whatsapp_waba_id
  INTO v_canonical_whatsapp_waba_id
  FROM public.concierge_trusted_provider_settings trusted
  WHERE trusted.studio_id = p_studio_id;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_materializations) item
    WHERE item->'snapshot'->>'channel' = 'whatsapp'
  ) AND (
    v_canonical_whatsapp_waba_id IS NULL
    OR NULLIF(btrim(p_whatsapp_waba_id),'') IS DISTINCT FROM
      v_canonical_whatsapp_waba_id
  ) THEN
    RAISE EXCEPTION 'trusted_whatsapp_waba_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_materializations) item
    WHERE item->'snapshot'->>'channel' = 'whatsapp'
  ) THEN
    v_canonical_whatsapp_waba_id := NULL;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    IF jsonb_typeof(v_item->'snapshot') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'delivery') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid_materialization_shape';
    END IF;
    IF v_item->'snapshot'->>'channel' IS DISTINCT FROM v_item->'delivery'->>'channel' THEN
      RAISE EXCEPTION 'materialization_channel_mismatch';
    END IF;
    IF v_item->'snapshot'->>'locale' IS DISTINCT FROM v_recipient.preferred_locale THEN
      RAISE EXCEPTION 'materialization_locale_mismatch';
    END IF;
    IF v_item->'delivery'->>'status' NOT IN ('queued','suppressed') THEN
      RAISE EXCEPTION 'invalid_initial_delivery_status';
    END IF;
    IF v_item->'delivery'->>'idempotencyKey'
       IS DISTINCT FROM p_decision_key || ':' || (v_item->'snapshot'->>'channel') THEN
      RAISE EXCEPTION 'invalid_delivery_idempotency_key';
    END IF;
    IF NOT (v_item->'snapshot' ? 'presentationKey')
       OR NOT (v_item->'snapshot' ? 'presentationHash')
       OR NOT (v_item->'snapshot' ? 'presentationContract')
       OR NOT (v_item->'snapshot' ? 'renderedFacts')
       OR NOT (v_item->'snapshot' ? 'sourceContentHash')
       OR NOT (v_item->'snapshot' ? 'journeyType')
       OR NOT (v_item->'snapshot' ? 'actionUrl')
       OR NOT (v_item->'snapshot' ? 'selectionId')
       OR v_item->'snapshot'->>'journeyType' IS DISTINCT FROM v_intent.journey_type THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;

    SELECT *
    INTO v_template
    FROM public.concierge_template_versions source
    WHERE source.id = (v_item->'snapshot'->>'templateId')::uuid
      AND source.studio_id = p_studio_id
      AND source.template_key = p_template_key
      AND source.channel = v_item->'snapshot'->>'channel'
      AND source.locale = v_recipient.preferred_locale
      AND source.version = (v_item->'snapshot'->>'templateVersion')::integer
      AND source.lifecycle_status = 'approved'
      AND source.approved_by IS NOT NULL
      AND source.approved_at IS NOT NULL
      AND source.retired_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'approved_template_mismatch'; END IF;

    SELECT selected.*
    INTO v_selection
    FROM public.concierge_delivery_selections selected
    WHERE selected.id = (v_item->'snapshot'->>'selectionId')::uuid
      AND selected.studio_id = p_studio_id
      AND selected.journey_type = v_intent.journey_type
      AND selected.template_key = p_template_key
      AND selected.channel = v_template.channel
      AND selected.locale = v_recipient.preferred_locale
      AND selected.delivery_mode = p_mode
      AND selected.retired_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery_selection_mismatch'; END IF;

    SELECT version.*
    INTO v_delivery_version
    FROM public.concierge_delivery_versions version
    WHERE version.id = v_selection.delivery_version_id
      AND version.studio_id = p_studio_id
      AND version.journey_type = v_intent.journey_type
      AND version.template_key = p_template_key
      AND version.channel = v_template.channel
      AND version.locale = v_recipient.preferred_locale
      AND version.source_template_id = v_template.id
      AND version.source_template_version = v_template.version
      AND version.source_content_hash = v_template.content_hash
      AND version.source_approved_by = v_template.approved_by
      AND version.source_approved_at = v_template.approved_at;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery_version_mismatch'; END IF;

    v_expected_presentation_key := v_delivery_version.presentation_key;
    IF v_item->'snapshot'->>'presentationKey'
       IS DISTINCT FROM v_expected_presentation_key
       OR v_item->'snapshot'->>'presentationHash'
         IS DISTINCT FROM v_delivery_version.presentation_hash
       OR v_item->'snapshot'->'presentationContract'
         IS DISTINCT FROM v_delivery_version.presentation_contract
       OR v_item->'snapshot'->>'sourceContentHash'
         IS DISTINCT FROM v_delivery_version.source_content_hash
       OR (v_item->'snapshot'->>'emailShellVersion')::integer
         IS DISTINCT FROM v_delivery_version.email_shell_version
       OR v_item->'snapshot'->>'emailShellHash'
         IS DISTINCT FROM v_delivery_version.email_shell_hash THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;

    v_expected_action_url := v_delivery_version.presentation_contract->>'actionUrl';
    IF v_item->'snapshot'->>'actionUrl' IS DISTINCT FROM v_expected_action_url THEN
      RAISE EXCEPTION 'invalid_concierge_presentation_evidence';
    END IF;

    v_rendered_variables :=
      COALESCE(v_item->'snapshot'->'renderedVariables', p_rendered_variables);
    IF jsonb_typeof(v_rendered_variables) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'rendered_variables_required';
    END IF;
    IF jsonb_typeof(v_delivery_version.presentation_contract->'facts')
       IS DISTINCT FROM 'array'
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(
           v_delivery_version.presentation_contract->'facts'
         ) fact
         WHERE jsonb_typeof(fact) IS DISTINCT FROM 'object'
            OR jsonb_typeof(fact->'key') IS DISTINCT FROM 'string'
            OR jsonb_typeof(fact->'label') IS DISTINCT FROM 'string'
            OR jsonb_typeof(fact->'ltr') IS DISTINCT FROM 'boolean'
       ) THEN
      RAISE EXCEPTION 'invalid_presentation_fact_contract';
    END IF;
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'key',fact.value->>'key',
          'label',fact.value->>'label',
          'value',v_rendered_variables->>(fact.value->>'key'),
          'ltr',(fact.value->>'ltr')::boolean
        )
        ORDER BY fact.ordinality
      ),
      '[]'::jsonb
    )
    INTO v_expected_rendered_facts
    FROM jsonb_array_elements(v_delivery_version.presentation_contract->'facts')
      WITH ORDINALITY AS fact(value, ordinality)
    WHERE NULLIF(btrim(v_rendered_variables->>(fact.value->>'key')),'') IS NOT NULL;
    IF v_item->'snapshot'->'renderedFacts'
       IS DISTINCT FROM v_expected_rendered_facts THEN
      RAISE EXCEPTION 'rendered_fact_evidence_mismatch';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unnest(v_template.required_variables) required(name)
      WHERE NOT (v_rendered_variables ? required.name)
    ) THEN
      RAISE EXCEPTION 'required_template_variable_missing';
    END IF;
    IF v_template.channel = 'email'
       AND p_template_key IN (
         'payment_one_time_succeeded','payment_subscription_renewal_succeeded',
         'payment_recovered'
       )
       AND (
         NULLIF(v_rendered_variables->>'amount','') IS NULL
         OR NULLIF(v_rendered_variables->>'payment_date','') IS NULL
       ) THEN
      RAISE EXCEPTION 'payment_presentation_proof_required';
    END IF;
    v_expected_provider := CASE v_template.channel
      WHEN 'in_app' THEN 'internal'
      WHEN 'push' THEN 'apns'
      WHEN 'email' THEN 'resend'
      WHEN 'whatsapp' THEN 'official_whatsapp'
    END;
    v_expected_address := CASE v_template.channel
      WHEN 'in_app' THEN v_recipient.member_id::text
      WHEN 'push' THEN v_recipient.member_id::text
      WHEN 'email' THEN v_recipient.email
      WHEN 'whatsapp' THEN v_recipient.phone_e164
    END;
    IF v_item->'delivery'->>'provider' IS DISTINCT FROM v_expected_provider
       OR v_item->'delivery'->>'recipientAddress' IS DISTINCT FROM v_expected_address THEN
      RAISE EXCEPTION 'untrusted_delivery_target';
    END IF;

    IF v_template.channel <> 'whatsapp' THEN
      IF COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb)
         IS DISTINCT FROM '{}'::jsonb THEN
        RAISE EXCEPTION 'invalid_concierge_provider_evidence';
      END IF;
    ELSE
      IF v_delivery_version.provider_template_name IS NULL
         OR v_delivery_version.provider_content_hash IS NULL THEN
        RAISE EXCEPTION 'whatsapp_delivery_version_not_deployed';
      END IF;
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'type','text',
            'text',v_rendered_variables->>required.name
          )
          ORDER BY required.ordinality
        ),
        '[]'::jsonb
      )
      INTO v_whatsapp_parameters
      FROM unnest(v_template.required_variables)
        WITH ORDINALITY AS required(name, ordinality);

      v_expected_provider_payload := jsonb_build_object(
        'template_name',v_delivery_version.provider_template_name,
        'template_language',CASE v_recipient.preferred_locale
          WHEN 'en' THEN 'en_US' ELSE v_recipient.preferred_locale END,
        'presentation_key',v_expected_presentation_key,
        'expected_content_hash',v_delivery_version.provider_content_hash,
        'selection_id',v_selection.id,
        'components',
          CASE v_delivery_version.presentation_version
            WHEN 2 THEN jsonb_build_array(
              jsonb_build_object(
                'type','header',
                'parameters',jsonb_build_array(
                  jsonb_build_object(
                    'type','image',
                    'image',jsonb_build_object(
                      'link','https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png'
                    )
                  )
                )
              ),
              jsonb_build_object('type','body','parameters',v_whatsapp_parameters)
            )
            ELSE jsonb_build_array(
              jsonb_build_object('type','body','parameters',v_whatsapp_parameters)
            )
          END
      );
      IF COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb)
         IS DISTINCT FROM v_expected_provider_payload THEN
        RAISE EXCEPTION 'invalid_concierge_whatsapp_evidence';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM public.whatsapp_template_deployments w
        WHERE w.waba_id = v_canonical_whatsapp_waba_id
          AND w.template_name = v_delivery_version.provider_template_name
          AND w.language = CASE v_recipient.preferred_locale
            WHEN 'en' THEN 'en_US' ELSE v_recipient.preferred_locale END
          AND upper(w.approval_status) = 'APPROVED'
          AND w.content_hash = v_delivery_version.provider_content_hash
      ) THEN
        RAISE EXCEPTION 'whatsapp_template_not_provider_approved';
      END IF;
    END IF;
  END LOOP;

  SELECT jsonb_build_object(
    'intent_id',p_intent_id,
    'correlation_id',p_correlation_id,
    'journey_type',v_intent.journey_type,
    'whatsapp_waba_id',v_canonical_whatsapp_waba_id,
    'deliveries',jsonb_agg(
      jsonb_build_object(
        'channel',item->'snapshot'->>'channel',
        'template_id',item->'snapshot'->>'templateId',
        'template_version',item->'snapshot'->>'templateVersion',
        'locale',item->'snapshot'->>'locale',
        'rendered_variables',COALESCE(
          item->'snapshot'->'renderedVariables',p_rendered_variables
        ),
        'final_subject',item->'snapshot'->>'finalSubject',
        'final_body',item->'snapshot'->>'finalBody',
        'presentation_key',item->'snapshot'->>'presentationKey',
        'presentation_hash',item->'snapshot'->>'presentationHash',
        'presentation_contract',item->'snapshot'->'presentationContract',
        'rendered_facts',item->'snapshot'->'renderedFacts',
        'email_shell_version',item->'snapshot'->'emailShellVersion',
        'email_shell_hash',item->'snapshot'->>'emailShellHash',
        'source_content_hash',item->'snapshot'->>'sourceContentHash',
        'journey_type',item->'snapshot'->>'journeyType',
        'action_url',item->'snapshot'->>'actionUrl',
        'selection_id',item->'snapshot'->>'selectionId',
        'provider_content_hash',item->'delivery'->'providerPayload'->>'expected_content_hash',
        'provider',item->'delivery'->>'provider',
        'recipient_address',item->'delivery'->>'recipientAddress',
        'provider_payload',COALESCE(item->'delivery'->'providerPayload','{}'::jsonb)
      )
      ORDER BY item->'snapshot'->>'channel'
    )
  )
  INTO v_materialization_evidence
  FROM jsonb_array_elements(p_materializations) item;

  SELECT
    (item->'snapshot'->>'templateId')::uuid,
    (item->'snapshot'->>'templateVersion')::integer
  INTO v_first_template_id, v_first_template_version
  FROM jsonb_array_elements(p_materializations) item
  ORDER BY item->'snapshot'->>'channel'
  LIMIT 1;

  IF v_intent.status = 'materialized' THEN
    SELECT id, materialization_evidence
    INTO v_decision_id, v_existing_evidence
    FROM public.concierge_decisions
    WHERE studio_id = p_studio_id
      AND decision_key = p_decision_key;
    v_existing_decision := true;
  ELSE
    INSERT INTO public.concierge_decisions(
      studio_id, journey_instance_id, intent_id, communication_recipient_id,
      decision_key, policy_version, automation_config_version, template_id,
      template_version, locale, reason_codes, competing_action_ids, simulated,
      materialization_evidence
    ) VALUES (
      p_studio_id, v_intent.journey_instance_id, v_intent.id, p_recipient_id,
      p_decision_key, p_policy_version, p_automation_config_version,
      v_first_template_id, v_first_template_version, v_recipient.preferred_locale,
      COALESCE(p_reason_codes,'{}'), COALESCE(p_competing_action_ids,'{}'), false,
      v_materialization_evidence
    )
    ON CONFLICT (studio_id, decision_key) DO NOTHING
    RETURNING id INTO v_decision_id;
    IF v_decision_id IS NULL THEN
      SELECT id, materialization_evidence
      INTO v_decision_id, v_existing_evidence
      FROM public.concierge_decisions
      WHERE studio_id = p_studio_id
        AND decision_key = p_decision_key;
      v_existing_decision := true;
    END IF;
  END IF;

  IF v_existing_decision THEN
    IF v_decision_id IS NULL
       OR v_existing_evidence IS NULL
       OR v_existing_evidence IS DISTINCT FROM v_materialization_evidence THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    IF v_intent.status = 'materialized' THEN
      IF (
        SELECT count(*) FROM public.message_snapshots snapshot
        WHERE snapshot.decision_id = v_decision_id
      ) <> jsonb_array_length(p_materializations) THEN
        RAISE EXCEPTION 'snapshot_replay_mismatch';
      END IF;
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.message_snapshots snapshot
          JOIN public.message_deliveries delivery ON delivery.snapshot_id = snapshot.id
          JOIN public.messages message ON message.id = delivery.message_id
          WHERE snapshot.decision_id = v_decision_id
            AND snapshot.channel = v_item->'snapshot'->>'channel'
            AND snapshot.template_id IS NOT DISTINCT FROM
              (v_item->'snapshot'->>'templateId')::uuid
            AND snapshot.locale IS NOT DISTINCT FROM v_item->'snapshot'->>'locale'
            AND snapshot.rendered_variables IS NOT DISTINCT FROM COALESCE(
              v_item->'snapshot'->'renderedVariables',p_rendered_variables
            )
            AND snapshot.final_subject IS NOT DISTINCT FROM
              v_item->'snapshot'->>'finalSubject'
            AND snapshot.final_body IS NOT DISTINCT FROM
              v_item->'snapshot'->>'finalBody'
            AND snapshot.correlation_id IS NOT DISTINCT FROM p_correlation_id
            AND snapshot.presentation_key IS NOT DISTINCT FROM
              v_item->'snapshot'->>'presentationKey'
            AND snapshot.action_url IS NOT DISTINCT FROM
              v_item->'snapshot'->>'actionUrl'
            AND snapshot.delivery_selection_id IS NOT DISTINCT FROM
              (v_item->'snapshot'->>'selectionId')::uuid
            AND delivery.provider IS NOT DISTINCT FROM v_item->'delivery'->>'provider'
            AND delivery.recipient_address IS NOT DISTINCT FROM
              v_item->'delivery'->>'recipientAddress'
            AND delivery.provider_payload IS NOT DISTINCT FROM COALESCE(
              v_item->'delivery'->'providerPayload','{}'::jsonb
            )
            AND message.content->>'journey_type' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'journeyType'
            AND message.content->>'presentation_key' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'presentationKey'
            AND message.content->>'presentation_hash' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'presentationHash'
            AND message.content->'presentation_contract' IS NOT DISTINCT FROM
              v_item->'snapshot'->'presentationContract'
            AND message.content->'rendered_facts' IS NOT DISTINCT FROM
              v_item->'snapshot'->'renderedFacts'
            AND message.content->>'email_shell_hash' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'emailShellHash'
            AND message.content->>'source_content_hash' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'sourceContentHash'
            AND message.content->>'action_url' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'actionUrl'
            AND message.content->>'selection_id' IS NOT DISTINCT FROM
              v_item->'snapshot'->>'selectionId'
        ) THEN
          RAISE EXCEPTION 'snapshot_replay_mismatch';
        END IF;
      END LOOP;
    ELSIF EXISTS (
      SELECT 1 FROM public.message_snapshots snapshot
      WHERE snapshot.decision_id = v_decision_id
    ) THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
    RETURN QUERY SELECT v_decision_id, 'duplicate'::text, NULL::text;
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_external_count
  FROM jsonb_array_elements(p_materializations) item
  WHERE item->'delivery'->>'channel' <> 'in_app'
    AND item->'delivery'->>'status' = 'queued';

  IF v_external_count > 0 THEN
    IF v_intent.priority = 1 THEN
      INSERT INTO public.recipient_contact_state(studio_id,communication_recipient_id)
      VALUES (p_studio_id,p_recipient_id)
      ON CONFLICT DO NOTHING;
      PERFORM 1
      FROM public.recipient_contact_state
      WHERE studio_id = p_studio_id
        AND communication_recipient_id = p_recipient_id
      FOR UPDATE;
      INSERT INTO public.frequency_reservations(
        studio_id,communication_recipient_id,decision_id,purpose,
        local_calendar_day,expires_at
      ) VALUES (
        p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,
        (p_now AT TIME ZONE 'Asia/Jerusalem')::date,p_now + interval '8 days'
      )
      ON CONFLICT (decision_id) DO NOTHING;
      v_reserved := true;
    ELSE
      SELECT reserved, reason
      INTO v_reserved, v_reservation_reason
      FROM public.reserve_recipient_contact_capacity(
        p_studio_id,p_recipient_id,v_decision_id,v_intent.purpose,p_now
      );
    END IF;
    IF NOT COALESCE(v_reserved,false) THEN
      UPDATE public.concierge_decisions
      SET suppression_reason = v_reservation_reason,
          reason_codes = reason_codes || v_reservation_reason
      WHERE id = v_decision_id;
      UPDATE public.journey_intents
      SET status = 'postponed',
          suppression_reason = v_reservation_reason,
          eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),
          updated_at = now()
      WHERE id = v_intent.id;
      RETURN QUERY SELECT v_decision_id, 'postponed'::text, v_reservation_reason;
      RETURN;
    END IF;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    INSERT INTO public.message_snapshots(
      studio_id, decision_id, template_id, locale, channel, rendered_variables,
      final_subject, final_body, content_hash, correlation_id, journey_instance_id,
      delivery_selection_id, presentation_key, presentation_hash,
      presentation_contract, rendered_facts, email_shell_version, email_shell_hash,
      source_content_hash, action_url
    ) VALUES (
      p_studio_id, v_decision_id, (v_item->'snapshot'->>'templateId')::uuid,
      v_item->'snapshot'->>'locale', v_item->'snapshot'->>'channel',
      COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables),
      v_item->'snapshot'->>'finalSubject', v_item->'snapshot'->>'finalBody',
      md5(
        COALESCE(v_item->'snapshot'->>'finalSubject','') || E'\n' ||
        (v_item->'snapshot'->>'finalBody')
      ),
      p_correlation_id, v_intent.journey_instance_id,
      (v_item->'snapshot'->>'selectionId')::uuid,
      v_item->'snapshot'->>'presentationKey',
      v_item->'snapshot'->>'presentationHash',
      v_item->'snapshot'->'presentationContract',
      v_item->'snapshot'->'renderedFacts',
      (v_item->'snapshot'->>'emailShellVersion')::integer,
      v_item->'snapshot'->>'emailShellHash',
      v_item->'snapshot'->>'sourceContentHash',
      v_item->'snapshot'->>'actionUrl'
    )
    ON CONFLICT (decision_id,channel) DO NOTHING
    RETURNING id INTO v_snapshot_id;
    IF v_snapshot_id IS NULL THEN
      SELECT *
      INTO v_snapshot
      FROM public.message_snapshots
      WHERE decision_id = v_decision_id
        AND channel = v_item->'snapshot'->>'channel';
      IF v_snapshot.template_id IS DISTINCT FROM
           (v_item->'snapshot'->>'templateId')::uuid
         OR v_snapshot.locale IS DISTINCT FROM v_item->'snapshot'->>'locale'
         OR v_snapshot.rendered_variables IS DISTINCT FROM COALESCE(
           v_item->'snapshot'->'renderedVariables',p_rendered_variables
         )
         OR v_snapshot.final_subject IS DISTINCT FROM v_item->'snapshot'->>'finalSubject'
         OR v_snapshot.final_body IS DISTINCT FROM v_item->'snapshot'->>'finalBody'
         OR v_snapshot.correlation_id IS DISTINCT FROM p_correlation_id
         OR v_snapshot.presentation_key IS DISTINCT FROM
           v_item->'snapshot'->>'presentationKey'
         OR v_snapshot.presentation_hash IS DISTINCT FROM
           v_item->'snapshot'->>'presentationHash'
         OR v_snapshot.presentation_contract IS DISTINCT FROM
           v_item->'snapshot'->'presentationContract'
         OR v_snapshot.rendered_facts IS DISTINCT FROM
           v_item->'snapshot'->'renderedFacts'
         OR v_snapshot.email_shell_version IS DISTINCT FROM
           (v_item->'snapshot'->>'emailShellVersion')::integer
         OR v_snapshot.email_shell_hash IS DISTINCT FROM
           v_item->'snapshot'->>'emailShellHash'
         OR v_snapshot.source_content_hash IS DISTINCT FROM
           v_item->'snapshot'->>'sourceContentHash'
         OR v_snapshot.action_url IS DISTINCT FROM v_item->'snapshot'->>'actionUrl'
         OR v_snapshot.delivery_selection_id IS DISTINCT FROM
           (v_item->'snapshot'->>'selectionId')::uuid THEN
        RAISE EXCEPTION 'snapshot_replay_mismatch';
      END IF;
      v_snapshot_id := v_snapshot.id;
    END IF;

    INSERT INTO public.messages(
      member_id,direction,audience,event_type,language,template_key,template_version,
      subject,body,content,member_visible,idempotency_key
    ) VALUES (
      v_recipient.member_id,'outbound','member',p_template_key,
      v_recipient.preferred_locale,p_template_key,
      (v_item->'snapshot'->>'templateVersion'),
      v_item->'snapshot'->>'finalSubject',
      v_item->'snapshot'->>'finalBody',
      jsonb_build_object(
        'variables',COALESCE(
          v_item->'snapshot'->'renderedVariables',p_rendered_variables
        ),
        'concierge_decision_id',v_decision_id,
        'correlation_id',p_correlation_id,
        'journey_type',v_intent.journey_type,
        'presentation_key',v_item->'snapshot'->>'presentationKey',
        'presentation_hash',v_item->'snapshot'->>'presentationHash',
        'presentation_contract',v_item->'snapshot'->'presentationContract',
        'rendered_facts',v_item->'snapshot'->'renderedFacts',
        'email_shell_version',v_item->'snapshot'->'emailShellVersion',
        'email_shell_hash',v_item->'snapshot'->>'emailShellHash',
        'source_content_hash',v_item->'snapshot'->>'sourceContentHash',
        'action_url',v_item->'snapshot'->>'actionUrl',
        'selection_id',v_item->'snapshot'->>'selectionId',
        'provider_content_hash',
          v_item->'delivery'->'providerPayload'->>'expected_content_hash'
      ),
      (v_item->'delivery'->>'channel') = 'in_app',
      'concierge:' || v_decision_id || ':' || (v_item->'delivery'->>'channel')
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_message_id;
    IF v_message_id IS NULL THEN
      SELECT id
      INTO v_message_id
      FROM public.messages
      WHERE idempotency_key =
        'concierge:' || v_decision_id || ':' || (v_item->'delivery'->>'channel');
      IF NOT EXISTS (
        SELECT 1
        FROM public.messages message
        WHERE message.id = v_message_id
          AND message.content->>'journey_type' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'journeyType'
          AND message.content->>'presentation_key' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'presentationKey'
          AND message.content->>'presentation_hash' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'presentationHash'
          AND message.content->'presentation_contract' IS NOT DISTINCT FROM
            v_item->'snapshot'->'presentationContract'
          AND message.content->'rendered_facts' IS NOT DISTINCT FROM
            v_item->'snapshot'->'renderedFacts'
          AND message.content->>'email_shell_hash' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'emailShellHash'
          AND message.content->>'source_content_hash' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'sourceContentHash'
          AND message.content->>'action_url' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'actionUrl'
          AND message.content->>'selection_id' IS NOT DISTINCT FROM
            v_item->'snapshot'->>'selectionId'
          AND message.content->>'provider_content_hash' IS NOT DISTINCT FROM
            v_item->'delivery'->'providerPayload'->>'expected_content_hash'
      ) THEN
        RAISE EXCEPTION 'snapshot_replay_mismatch';
      END IF;
    END IF;

    INSERT INTO public.message_deliveries(
      studio_id,snapshot_id,message_id,channel,provider,recipient_address,status,
      provider_payload,idempotency_key,scheduled_for,expires_at,failure_class,error_code
    ) VALUES (
      p_studio_id,v_snapshot_id,v_message_id,v_item->'delivery'->>'channel',
      v_item->'delivery'->>'provider',v_item->'delivery'->>'recipientAddress',
      v_item->'delivery'->>'status',
      COALESCE(v_item->'delivery'->'providerPayload','{}'::jsonb),
      v_item->'delivery'->>'idempotencyKey',
      (v_item->'delivery'->>'scheduledFor')::timestamptz,
      NULLIF(v_item->'delivery'->>'expiresAt','')::timestamptz,
      CASE WHEN v_item->'delivery'->>'status' = 'suppressed'
        THEN 'configuration' END,
      v_item->'delivery'->>'errorCode'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1
      FROM public.message_deliveries delivery
      WHERE delivery.idempotency_key = v_item->'delivery'->>'idempotencyKey'
        AND delivery.snapshot_id IS NOT DISTINCT FROM v_snapshot_id
        AND delivery.message_id IS NOT DISTINCT FROM v_message_id
        AND delivery.provider IS NOT DISTINCT FROM v_item->'delivery'->>'provider'
        AND delivery.recipient_address IS NOT DISTINCT FROM
          v_item->'delivery'->>'recipientAddress'
        AND delivery.provider_payload IS NOT DISTINCT FROM COALESCE(
          v_item->'delivery'->'providerPayload','{}'::jsonb
        )
    ) THEN
      RAISE EXCEPTION 'snapshot_replay_mismatch';
    END IF;
  END LOOP;

  UPDATE public.journey_intents
  SET status = 'materialized', suppression_reason = NULL, updated_at = now()
  WHERE id = v_intent.id;
  UPDATE public.journey_intents
  SET status = 'postponed',
      suppression_reason = 'higher_priority_action_selected',
      eligible_at = GREATEST(eligible_at,p_now + interval '6 hours'),
      updated_at = now()
  WHERE studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id
    AND id = ANY(COALESCE(p_competing_action_ids,'{}'))
    AND status IN ('pending','postponed','suppressed');

  RETURN QUERY SELECT v_decision_id, 'materialized'::text, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,text,timestamptz
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,text,timestamptz
) TO service_role;

-- Bounded compatibility adapter for a pre-deploy 14-argument caller. It performs a
-- legacy_materialization_translation into the currently selected version, rebuilding all
-- presentation/provider evidence from trusted database state. Remove after every pre-deploy
-- worker is retired and no queued legacy payload remains.
CREATE OR REPLACE FUNCTION public.materialize_concierge_delivery(
  p_studio_id uuid, p_recipient_id uuid, p_intent_id uuid, p_decision_key text,
  p_policy_version text, p_automation_config_version integer, p_mode text,
  p_template_key text, p_correlation_id uuid, p_reason_codes text[],
  p_competing_action_ids uuid[], p_rendered_variables jsonb, p_materializations jsonb,
  p_now timestamptz
)
RETURNS TABLE(result_decision_id uuid, outcome text, result_suppression_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.journey_intents%ROWTYPE;
  v_recipient public.communication_recipients%ROWTYPE;
  v_template public.concierge_template_versions%ROWTYPE;
  v_delivery_version public.concierge_delivery_versions%ROWTYPE;
  v_selection public.concierge_delivery_selections%ROWTYPE;
  v_item jsonb;
  v_translated_item jsonb;
  v_translated_materializations jsonb := '[]'::jsonb;
  v_rendered_variables jsonb;
  v_expected_rendered_facts jsonb;
  v_expected_action_url text;
  v_expected_presentation_key text;
  v_expected_provider_payload jsonb;
  v_whatsapp_parameters jsonb;
  v_waba_id text;
  v_existing_decision_id uuid;
BEGIN
  IF p_materializations IS NULL
     OR jsonb_typeof(p_materializations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;
  IF COALESCE(jsonb_array_length(p_materializations), 0) = 0 THEN
    RAISE EXCEPTION 'materializations_required';
  END IF;
  IF p_mode NOT IN ('test_only','live') THEN
    RAISE EXCEPTION 'invalid_delivery_mode';
  END IF;

  -- historical_materialization_replay: reconstruct the exact stored v2 evidence for an
  -- already completed legacy request. This deliberately does not resolve the current
  -- source, selection, recipient status, config, provider deployment, or WABA.
  SELECT decision.id,
         decision.materialization_evidence->>'whatsapp_waba_id'
  INTO v_existing_decision_id, v_waba_id
  FROM public.concierge_decisions decision
  WHERE decision.studio_id = p_studio_id
    AND decision.decision_key = p_decision_key
    AND decision.intent_id = p_intent_id
    AND decision.communication_recipient_id = p_recipient_id;
  IF v_existing_decision_id IS NOT NULL
     AND (
       SELECT count(*) FROM public.message_snapshots snapshot
       WHERE snapshot.decision_id = v_existing_decision_id
     ) = jsonb_array_length(p_materializations) THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'snapshot',jsonb_build_object(
          'templateId',snapshot.template_id,
          'templateVersion',message.template_version,
          'locale',snapshot.locale,
          'channel',snapshot.channel,
          'renderedVariables',snapshot.rendered_variables,
          'finalSubject',snapshot.final_subject,
          'finalBody',snapshot.final_body,
          'presentationKey',snapshot.presentation_key,
          'presentationHash',snapshot.presentation_hash,
          'presentationContract',snapshot.presentation_contract,
          'renderedFacts',snapshot.rendered_facts,
          'emailShellVersion',snapshot.email_shell_version,
          'emailShellHash',snapshot.email_shell_hash,
          'sourceContentHash',snapshot.source_content_hash,
          'journeyType',message.content->>'journey_type',
          'actionUrl',snapshot.action_url,
          'selectionId',snapshot.delivery_selection_id
        ),
        'delivery',jsonb_build_object(
          'channel',delivery.channel,
          'provider',delivery.provider,
          'recipientAddress',delivery.recipient_address,
          'status',CASE WHEN delivery.status = 'suppressed'
            THEN 'suppressed' ELSE 'queued' END,
          'errorCode',delivery.error_code,
          'idempotencyKey',delivery.idempotency_key,
          'scheduledFor',delivery.scheduled_for,
          'expiresAt',delivery.expires_at,
          'providerPayload',delivery.provider_payload
        )
      )
      ORDER BY snapshot.channel
    )
    INTO v_translated_materializations
    FROM public.message_snapshots snapshot
    JOIN public.message_deliveries delivery ON delivery.snapshot_id = snapshot.id
    JOIN public.messages message ON message.id = delivery.message_id
    WHERE snapshot.decision_id = v_existing_decision_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_translated_materializations) stored
        WHERE stored->'snapshot'->>'channel' =
              v_item->'snapshot'->>'channel'
          AND stored->'snapshot'->>'templateId' =
              v_item->'snapshot'->>'templateId'
          AND stored->'snapshot'->>'finalBody' =
              v_item->'snapshot'->>'finalBody'
          AND stored->'delivery'->>'provider' =
              v_item->'delivery'->>'provider'
          AND stored->'delivery'->>'recipientAddress' IS NOT DISTINCT FROM
              v_item->'delivery'->>'recipientAddress'
      ) THEN
        RAISE EXCEPTION 'snapshot_replay_mismatch';
      END IF;
    END LOOP;
    RETURN QUERY
    SELECT *
    FROM public.materialize_concierge_delivery(
      p_studio_id,p_recipient_id,p_intent_id,p_decision_key,p_policy_version,
      p_automation_config_version,p_mode,p_template_key,p_correlation_id,
      p_reason_codes,p_competing_action_ids,p_rendered_variables,
      v_translated_materializations,v_waba_id,p_now
    );
    RETURN;
  END IF;

  SELECT *
  INTO v_intent
  FROM public.journey_intents
  WHERE id = p_intent_id
    AND studio_id = p_studio_id
    AND communication_recipient_id = p_recipient_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'concierge_intent_not_found'; END IF;

  SELECT *
  INTO v_recipient
  FROM public.communication_recipients
  WHERE id = p_recipient_id
    AND studio_id = p_studio_id
    AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'active_recipient_not_found'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_materializations) LOOP
    IF jsonb_typeof(v_item->'snapshot') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'delivery') IS DISTINCT FROM 'object'
       OR v_item->'snapshot'->>'channel'
          IS DISTINCT FROM v_item->'delivery'->>'channel' THEN
      RAISE EXCEPTION 'invalid_legacy_materialization_shape';
    END IF;

    SELECT *
    INTO v_template
    FROM public.concierge_template_versions source
    WHERE source.id = (v_item->'snapshot'->>'templateId')::uuid
      AND source.studio_id = p_studio_id
      AND source.template_key = p_template_key
      AND source.channel = v_item->'snapshot'->>'channel'
      AND source.locale = v_recipient.preferred_locale
      AND source.version = (v_item->'snapshot'->>'templateVersion')::integer
      AND source.retired_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'legacy_template_mismatch'; END IF;

    SELECT selected.*
    INTO v_selection
    FROM public.concierge_delivery_selections selected
    WHERE selected.studio_id = p_studio_id
      AND selected.journey_type = v_intent.journey_type
      AND selected.template_key = p_template_key
      AND selected.channel = v_template.channel
      AND selected.locale = v_recipient.preferred_locale
      AND selected.delivery_mode = p_mode
      AND selected.retired_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery_selection_mismatch'; END IF;

    SELECT version.*
    INTO v_delivery_version
    FROM public.concierge_delivery_versions version
    WHERE version.id = v_selection.delivery_version_id
      AND version.studio_id = p_studio_id
      AND version.template_key = p_template_key
      AND version.channel = v_template.channel
      AND version.locale = v_recipient.preferred_locale
      AND version.source_template_id = v_template.id
      AND version.source_template_version = v_template.version
      AND version.source_content_hash = v_template.content_hash
      AND version.source_approved_by = v_template.approved_by
      AND version.source_approved_at = v_template.approved_at;
    IF NOT FOUND THEN RAISE EXCEPTION 'delivery_version_mismatch'; END IF;

    v_rendered_variables :=
      COALESCE(v_item->'snapshot'->'renderedVariables',p_rendered_variables);
    IF jsonb_typeof(v_rendered_variables) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'rendered_variables_required';
    END IF;
    IF jsonb_typeof(v_delivery_version.presentation_contract->'facts')
       IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_presentation_fact_contract';
    END IF;
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'key',fact.value->>'key',
          'label',fact.value->>'label',
          'value',v_rendered_variables->>(fact.value->>'key'),
          'ltr',(fact.value->>'ltr')::boolean
        )
        ORDER BY fact.ordinality
      ),
      '[]'::jsonb
    )
    INTO v_expected_rendered_facts
    FROM jsonb_array_elements(v_delivery_version.presentation_contract->'facts')
      WITH ORDINALITY AS fact(value, ordinality)
    WHERE NULLIF(btrim(v_rendered_variables->>(fact.value->>'key')),'') IS NOT NULL;
    v_expected_presentation_key := v_delivery_version.presentation_key;
    v_expected_action_url := v_delivery_version.presentation_contract->>'actionUrl';

    IF v_template.channel = 'whatsapp' THEN
      IF v_delivery_version.provider_template_name IS NULL
         OR v_delivery_version.provider_content_hash IS NULL THEN
        RAISE EXCEPTION 'whatsapp_delivery_version_not_deployed';
      END IF;
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'type','text',
            'text',v_rendered_variables->>required.name
          )
          ORDER BY required.ordinality
        ),
        '[]'::jsonb
      )
      INTO v_whatsapp_parameters
      FROM unnest(v_template.required_variables)
        WITH ORDINALITY AS required(name, ordinality);
      v_expected_provider_payload := jsonb_build_object(
        'template_name',v_delivery_version.provider_template_name,
        'template_language',CASE v_recipient.preferred_locale
          WHEN 'en' THEN 'en_US' ELSE v_recipient.preferred_locale END,
        'presentation_key',v_expected_presentation_key,
        'expected_content_hash',v_delivery_version.provider_content_hash,
        'selection_id',v_selection.id,
        'components',
          CASE v_delivery_version.presentation_version
            WHEN 2 THEN jsonb_build_array(
              jsonb_build_object(
                'type','header',
                'parameters',jsonb_build_array(
                  jsonb_build_object(
                    'type','image',
                    'image',jsonb_build_object(
                      'link','https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png'
                    )
                  )
                )
              ),
              jsonb_build_object('type','body','parameters',v_whatsapp_parameters)
            )
            ELSE jsonb_build_array(
              jsonb_build_object('type','body','parameters',v_whatsapp_parameters)
            )
          END
      );
    ELSE
      v_expected_provider_payload := '{}'::jsonb;
    END IF;

    v_translated_item := jsonb_build_object(
      'snapshot',
        v_item->'snapshot' || jsonb_build_object(
          'renderedVariables',v_rendered_variables,
          'locale',v_recipient.preferred_locale,
          'presentationKey',v_expected_presentation_key,
          'presentationHash',v_delivery_version.presentation_hash,
          'presentationContract',v_delivery_version.presentation_contract,
          'renderedFacts',v_expected_rendered_facts,
          'emailShellVersion',v_delivery_version.email_shell_version,
          'emailShellHash',v_delivery_version.email_shell_hash,
          'sourceContentHash',v_delivery_version.source_content_hash,
          'journeyType',v_intent.journey_type,
          'actionUrl',v_expected_action_url,
          'selectionId',v_selection.id
        ),
      'delivery',
        v_item->'delivery' || jsonb_build_object(
          'providerPayload',v_expected_provider_payload
        )
    );
    v_translated_materializations :=
      v_translated_materializations || jsonb_build_array(v_translated_item);
  END LOOP;

  SELECT trusted.whatsapp_waba_id
  INTO v_waba_id
  FROM public.concierge_trusted_provider_settings trusted
  WHERE trusted.studio_id = p_studio_id;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_translated_materializations) item
    WHERE item->'snapshot'->>'channel' = 'whatsapp'
  ) AND (
    v_waba_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_translated_materializations) item
      WHERE item->'snapshot'->>'channel' = 'whatsapp'
        AND NOT EXISTS (
          SELECT 1
          FROM public.whatsapp_template_deployments deployment
          WHERE deployment.waba_id = v_waba_id
            AND upper(deployment.approval_status) = 'APPROVED'
            AND deployment.template_name =
              item->'delivery'->'providerPayload'->>'template_name'
            AND deployment.language =
              item->'delivery'->'providerPayload'->>'template_language'
            AND deployment.content_hash =
              item->'delivery'->'providerPayload'->>'expected_content_hash'
        )
    )
  ) THEN
    RAISE EXCEPTION 'trusted_whatsapp_deployment_missing';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.materialize_concierge_delivery(
    p_studio_id,p_recipient_id,p_intent_id,p_decision_key,p_policy_version,
    p_automation_config_version,p_mode,p_template_key,p_correlation_id,
    p_reason_codes,p_competing_action_ids,p_rendered_variables,
    v_translated_materializations,
    v_waba_id,
    p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,timestamptz
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_concierge_delivery(
  uuid,uuid,uuid,text,text,integer,text,text,uuid,text[],uuid[],jsonb,jsonb,timestamptz
) TO service_role;

-- Bind the final send authorization to the same trusted WABA that was verified
-- while materializing the immutable WhatsApp evidence. This check happens after
-- the original mode/channel/recipient gate so every Concierge send path must
-- present the runtime WABA identity immediately before the provider call.
CREATE OR REPLACE FUNCTION public.concierge_delivery_send_allowed(
  p_delivery_id uuid,
  p_live_runtime_enabled boolean,
  p_test_recipient_ids text[],
  p_runtime_whatsapp_waba_id text
)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate_allowed boolean;
  v_gate_reason text;
  v_channel text;
  v_studio_id uuid;
  v_trusted_whatsapp_waba_id text;
BEGIN
  SELECT gate.allowed, gate.reason
  INTO v_gate_allowed, v_gate_reason
  FROM public.concierge_delivery_send_allowed(
    p_delivery_id,
    p_live_runtime_enabled,
    p_test_recipient_ids
  ) gate;

  IF NOT COALESCE(v_gate_allowed,false) THEN
    RETURN QUERY SELECT v_gate_allowed,v_gate_reason;
    RETURN;
  END IF;

  SELECT delivery.channel::text, decision.studio_id
  INTO v_channel, v_studio_id
  FROM public.message_deliveries delivery
  JOIN public.message_snapshots snapshot
    ON snapshot.id = delivery.snapshot_id
  JOIN public.concierge_decisions decision
    ON decision.id = snapshot.decision_id
  WHERE delivery.id = p_delivery_id;

  IF v_channel = 'whatsapp' AND v_studio_id IS NOT NULL THEN
    SELECT trusted.whatsapp_waba_id
    INTO v_trusted_whatsapp_waba_id
    FROM public.concierge_trusted_provider_settings trusted
    WHERE trusted.studio_id = v_studio_id;

    IF v_trusted_whatsapp_waba_id IS NULL
       OR NULLIF(btrim(p_runtime_whatsapp_waba_id),'') IS DISTINCT FROM
         v_trusted_whatsapp_waba_id THEN
      RETURN QUERY
      SELECT false,'trusted_whatsapp_runtime_mismatch'::text;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true,NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.concierge_delivery_send_allowed(
  uuid,boolean,text[]
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.concierge_delivery_send_allowed(
  uuid,boolean,text[],text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.concierge_delivery_send_allowed(
  uuid,boolean,text[],text
) TO service_role;

-- Reachable payment events preserve the business subtype and evidence required by the
-- Concierge payment journey. Provider "requires action" states are not collapsed into
-- a generic pending event, and subscription renewals retain their subscription identity.
DROP TRIGGER IF EXISTS concierge_payment_domain_event ON public.payments;
CREATE OR REPLACE FUNCTION public.emit_concierge_payment_outcome_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
  v_recipient_id uuid;
  v_event_type text;
  v_payment_subtype text;
  v_previous_outcome text;
  v_current_outcome text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.provider_status IS NOT DISTINCT FROM NEW.provider_status THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_previous_outcome := CASE
      WHEN OLD.status = 'paid' THEN 'paid'
      WHEN lower(COALESCE(OLD.provider_status,'')) IN (
        'requires_action','requires_payment_method','authentication_required'
      ) THEN 'requires_action'
      WHEN OLD.status = 'failed' THEN 'failed'
      ELSE NULL
    END;
  END IF;
  v_current_outcome := CASE
    WHEN NEW.status = 'paid' THEN 'paid'
    WHEN lower(COALESCE(NEW.provider_status,'')) IN (
      'requires_action','requires_payment_method','authentication_required'
    ) THEN 'requires_action'
    WHEN NEW.status = 'failed' THEN 'failed'
    ELSE NULL
  END;
  IF TG_OP = 'UPDATE'
     AND v_previous_outcome IS NOT DISTINCT FROM v_current_outcome THEN
    RETURN NEW;
  END IF;
  SELECT studio.id INTO v_studio_id
  FROM public.studios studio
  WHERE studio.slug = 'cloud-core';
  SELECT relationship.communication_recipient_id
  INTO v_recipient_id
  FROM public.participant_relationships relationship
  WHERE relationship.studio_id = v_studio_id
    AND relationship.participant_member_id = NEW.member_id
    AND relationship.authorized
  ORDER BY (relationship.relationship_type = 'self') DESC, relationship.id
  LIMIT 1;
  v_payment_subtype := CASE WHEN NEW.subscription_id IS NULL
    THEN 'one_time' ELSE 'subscription_renewal' END;
  v_event_type := CASE
    WHEN v_current_outcome = 'paid'
      AND v_previous_outcome IN ('failed','requires_action')
      THEN 'payment.recovered'
    WHEN v_current_outcome = 'paid' THEN 'payment.succeeded'
    WHEN v_current_outcome = 'requires_action' THEN 'payment.requires_action'
    WHEN v_current_outcome = 'failed' THEN 'payment.failed'
    ELSE NULL
  END;
  IF v_event_type IS NULL OR v_recipient_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.domain_outbox(
    studio_id,event_type,schema_version,aggregate_type,aggregate_id,participant_id,
    communication_recipient_id,correlation_id,deduplication_key,payload
  ) VALUES (
    v_studio_id,v_event_type,1,'payments',NEW.id,NEW.member_id,
    v_recipient_id,gen_random_uuid(),
    concat('payment.outcome:',NEW.id,':',COALESCE(v_previous_outcome,'initial'),':',v_event_type),
    jsonb_build_object(
      'payment_id',NEW.id,
      'member_id',NEW.member_id,
      'status',NEW.status,
      'payment_subtype',v_payment_subtype,
      'subscription_id',NEW.subscription_id,
      'requires_action',v_event_type = 'payment.requires_action',
      'amount',NEW.amount,
      'currency',NEW.currency,
      'paid_at',NEW.paid_at,
      'provider',NEW.provider,
      'provider_status',NEW.provider_status,
      'provider_payment_id',NEW.provider_payment_id,
      'retryable',lower(COALESCE(NEW.metadata->>'retryable','')) IN ('true','1','yes')
    )
  )
  ON CONFLICT (studio_id,deduplication_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER concierge_payment_domain_event
AFTER INSERT OR UPDATE OF status, provider_status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.emit_concierge_payment_outcome_event();

CREATE OR REPLACE FUNCTION public.emit_concierge_recommendation_event(
  p_member_id uuid,
  p_class_id uuid,
  p_secondary_class_id uuid,
  p_recommendation_summary text,
  p_now timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
  v_recipient_id uuid;
  v_outbox_id uuid;
BEGIN
  SELECT studio.id INTO v_studio_id
  FROM public.studios studio
  WHERE studio.slug = 'cloud-core';
  IF p_class_id IS NULL
     OR NULLIF(btrim(p_recommendation_summary),'') IS NULL THEN
    RAISE EXCEPTION 'recommendation_summary_required';
  END IF;
  SELECT relationship.communication_recipient_id
  INTO v_recipient_id
  FROM public.participant_relationships relationship
  WHERE relationship.studio_id = v_studio_id
    AND relationship.participant_member_id = p_member_id
    AND relationship.authorized
  ORDER BY (relationship.relationship_type = 'self') DESC, relationship.id
  LIMIT 1;
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'recommendation_recipient_not_found';
  END IF;
  INSERT INTO public.domain_outbox(
    studio_id,event_type,schema_version,aggregate_type,aggregate_id,participant_id,
    communication_recipient_id,correlation_id,deduplication_key,payload,occurred_at
  ) VALUES (
    v_studio_id,'recommendation.created',1,'classes',p_class_id,p_member_id,
    v_recipient_id,gen_random_uuid(),
    concat('recommendation.created:',p_class_id,':',p_member_id),
    jsonb_build_object(
      'class_id',p_class_id,
      'secondary_class_id',p_secondary_class_id,
      'recommendation_summary',p_recommendation_summary
    ),
    p_now
  )
  ON CONFLICT (studio_id,deduplication_key) DO UPDATE
  SET id = public.domain_outbox.id
  RETURNING id INTO v_outbox_id;
  RETURN v_outbox_id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_concierge_recommendation_event(
  uuid,uuid,uuid,text,timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_concierge_recommendation_event(
  uuid,uuid,uuid,text,timestamptz
) TO service_role;
