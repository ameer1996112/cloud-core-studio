UPDATE public.program_types
SET default_capacity = 7,
    default_credit_cost = 0,
    description_he = 'שיעור יוגה אווירית לילדים בקבוצה שבועית קבועה: יום שני בשעה 18:00, עד 7 ילדים.',
    updated_at = now()
WHERE slug = 'kids-aerial-yoga';

ALTER TABLE public.kid_aerial_class_assignments
  ALTER COLUMN class_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS weekday smallint NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 7 CHECK (capacity > 0);

UPDATE public.kid_aerial_class_assignments
SET weekday = 1,
    start_time = '18:00',
    capacity = 7
WHERE status = 'active';

UPDATE public.classes c
SET capacity = 7,
    credit_cost = 0,
    member_visible = false
FROM public.program_types pt
WHERE c.program_type_id = pt.id
  AND pt.slug = 'kids-aerial-yoga';
