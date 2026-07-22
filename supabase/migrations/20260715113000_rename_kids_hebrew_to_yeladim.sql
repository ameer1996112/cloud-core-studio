UPDATE public.program_types
SET name_he = 'יוגה אווירית לילדים',
    description_he = 'שיעור יוגה אווירית לילדים בקבוצה שבועית קבועה: יום שני בשעה 18:00, עד 7 ילדים.',
    updated_at = now()
WHERE slug = 'kids-aerial-yoga';

UPDATE public.kid_aerial_packages
SET name = CASE code
  WHEN 'monthly' THEN 'חודשי לילדים - 4 שיעורים'
  WHEN 'yearly' THEN 'שנתי לילדים - 40 שיעורים'
  ELSE name
END,
updated_at = now()
WHERE code IN ('monthly', 'yearly');

UPDATE public.classes c
SET title = 'יוגה אווירית לילדים'
FROM public.program_types pt
WHERE c.program_type_id = pt.id
  AND pt.slug = 'kids-aerial-yoga'
  AND c.title = 'יוגה אווירית לילדות';

UPDATE public.kid_aerial_payments
SET notes = replace(notes, 'לילדות', 'לילדים')
WHERE notes LIKE '%לילדות%';
