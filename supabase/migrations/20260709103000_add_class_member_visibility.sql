ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS member_visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS classes_member_visible_idx
  ON public.classes(member_visible);

DROP POLICY IF EXISTS "Authenticated read classes" ON public.classes;
DROP POLICY IF EXISTS "Allow anonymous read classes" ON public.classes;

CREATE POLICY "Authenticated read classes"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    member_visible = true
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'instructor')
  );

CREATE POLICY "Allow anonymous read classes"
  ON public.classes
  FOR SELECT
  TO anon
  USING (member_visible = true);
