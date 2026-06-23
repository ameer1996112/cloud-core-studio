
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS care_notes text,
  ADD COLUMN IF NOT EXISTS emergency_contact text;

UPDATE public.members m SET email = u.email
FROM auth.users u WHERE u.id = m.id AND (m.email IS NULL OR m.email = '');

CREATE TABLE IF NOT EXISTS public.member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body text NOT NULL,
  important boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_notes TO authenticated;
GRANT ALL ON public.member_notes TO service_role;
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view member notes" ON public.member_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Admin can insert member notes" ON public.member_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update member notes" ON public.member_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete member notes" ON public.member_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS member_notes_member_idx ON public.member_notes(member_id, created_at DESC);
CREATE TRIGGER member_notes_set_updated_at BEFORE UPDATE ON public.member_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
