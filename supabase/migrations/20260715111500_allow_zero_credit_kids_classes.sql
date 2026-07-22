ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_credit_cost_check;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_credit_cost_check CHECK (credit_cost >= 0);

UPDATE public.classes c
SET credit_cost = 0,
    member_visible = false
FROM public.program_types pt
WHERE c.program_type_id = pt.id
  AND pt.slug = 'kids-aerial-yoga';
