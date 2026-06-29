-- 1) program_types table
CREATE TABLE public.program_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_he text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_he text,
  description_ar text,
  age_groups text[] NOT NULL DEFAULT '{}',
  level text,
  default_duration_minutes integer NOT NULL DEFAULT 60,
  default_capacity integer NOT NULL DEFAULT 12,
  default_credit_cost integer NOT NULL DEFAULT 1,
  equipment text[] NOT NULL DEFAULT '{}',
  color_tag text NOT NULL DEFAULT '#D4AF6A',
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTs (required for Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_types TO authenticated;
GRANT ALL ON public.program_types TO service_role;

-- 3) RLS
ALTER TABLE public.program_types ENABLE ROW LEVEL SECURITY;

-- 4) Policies — authenticated users can read active programs; admins can manage everything
CREATE POLICY "Authenticated can read active program types"
  ON public.program_types FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert program types"
  ON public.program_types FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update program types"
  ON public.program_types FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete program types"
  ON public.program_types FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) updated_at trigger (shared helper if not present)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER program_types_set_updated_at
BEFORE UPDATE ON public.program_types
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Extend classes (additive only — no drops, no renames)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS program_type_id uuid REFERENCES public.program_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_override numeric,
  ADD COLUMN IF NOT EXISTS capacity_override integer;

CREATE INDEX IF NOT EXISTS classes_program_type_id_idx ON public.classes(program_type_id);

-- 7) Seed the two starter program types
INSERT INTO public.program_types
  (slug, name_en, name_he, name_ar,
   description_en, description_he, description_ar,
   age_groups, level, default_duration_minutes, default_capacity, default_credit_cost,
   equipment, color_tag, sort_order, active)
VALUES
  ('aerial-yoga',
   'Aerial Yoga', 'יוגה אווירית', 'يوغا هوائية',
   'Suspended silk-hammock practice blending traditional yoga with playful inversions and decompression.',
   'תרגול מתקדם בערסל משי המשלב יוגה מסורתית עם היפוכים והרפיה עמוקה לעמוד השדרה.',
   'ممارسة معلّقة على أرجوحة حريرية تجمع بين اليوغا التقليدية والانقلابات اللطيفة وتخفيف الضغط على العمود الفقري.',
   ARRAY['adults','teens'], 'all-levels', 60, 10, 1,
   ARRAY['silk hammock','yoga mat'], '#B7CCE6', 1, true),

  ('mat-pilates',
   'Mat Pilates', 'פילאטיס מזרן', 'بيلاتس على البساط',
   'Core-led mat work focused on alignment, controlled breath, and lengthened movement quality.',
   'עבודת מזרן ממוקדת ליבה, יישור גוף, נשימה מבוקרת ותנועה ארוכה ומדויקת.',
   'تمارين على البساط تركّز على عضلات الجذع والمحاذاة والتنفّس المتحكَّم به وحركة مطوّلة دقيقة.',
   ARRAY['adults'], 'all-levels', 55, 14, 1,
   ARRAY['yoga mat','small ball','resistance band'], '#E8DFD1', 2, true)
ON CONFLICT (slug) DO NOTHING;

-- 8) Back-fill: link existing classes by their current `energy` label
UPDATE public.classes c
SET program_type_id = pt.id
FROM public.program_types pt
WHERE c.program_type_id IS NULL
  AND pt.slug = 'aerial-yoga'
  AND lower(coalesce(c.energy, '')) IN ('aerial', 'aerial yoga', 'yoga', 'silks');

UPDATE public.classes c
SET program_type_id = pt.id
FROM public.program_types pt
WHERE c.program_type_id IS NULL
  AND pt.slug = 'mat-pilates'
  AND lower(coalesce(c.energy, '')) IN ('mat', 'pilates', 'mat pilates', 'core');